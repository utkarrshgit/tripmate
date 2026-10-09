/*
 * Reads travel dates out of a trip request, e.g.
 *   "12-16 Dec" · "12th to 16th December" · "Dec 12-16" · "12 Dec to 3 Jan"
 *   "from 12 December for 4 days" · "on Dec 20 for 3 nights" · "2026-12-12 to 2026-12-15"
 * A date without a year means its next occurrence (today or later).
 * Pure functions, no React — so they're easy to test and reuse.
 */

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const DAY = "(\\d{1,2})(?:st|nd|rd|th)?";
const YEAR = "(?:,?\\s*(\\d{4}))?";
const TO = "\\s*(?:-|–|—|to|until|till|through)\\s*";

const pad = (n) => String(n).padStart(2, "0");
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromISO = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (iso, n) => {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};
export const daysBetween = (startISO, endISO) => Math.round((fromISO(endISO) - fromISO(startISO)) / 86400000);
export const todayISO = (now = new Date()) => toISO(now);

const monthIndex = (word) => MONTHS.indexOf(word.slice(0, 3).toLowerCase());

/** Builds a real date; with no year, picks the next occurrence on/after `today`. */
function makeDate(day, monthWord, year, today) {
  const month = monthIndex(monthWord);
  const d = Number(day);
  if (month < 0 || d < 1 || d > 31) return null;
  let y = year ? Number(year) : today.getFullYear();
  let date = new Date(y, month, d);
  if (date.getMonth() !== month) return null; // e.g. 31 Feb
  if (!year && date < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
    date = new Date(++y, month, d);
  }
  return date;
}

/** An end date earlier than its start (no years given) rolls into the following year: "28 Dec to 2 Jan". */
function ordered(start, end) {
  if (end && end < start) end = new Date(end.getFullYear() + 1, end.getMonth(), end.getDate());
  return end;
}

const RULES = [
  // 2026-12-12 to 2026-12-15  |  2026-12-12
  {
    re: new RegExp(`(\\d{4}-\\d{2}-\\d{2})(?:${TO}(\\d{4}-\\d{2}-\\d{2}))?`, "i"),
    build: (m) => [fromISO(m[1]), m[2] ? fromISO(m[2]) : null],
  },
  // 12 Dec to 3 Jan  |  12th December 2026 - 16th December 2026
  {
    re: new RegExp(`\\b${DAY}\\s+(?:of\\s+)?${MONTH}${YEAR}${TO}${DAY}\\s+(?:of\\s+)?${MONTH}${YEAR}`, "i"),
    build: (m, t) => [makeDate(m[1], m[2], m[3], t), makeDate(m[4], m[5], m[6] ?? m[3], t)],
  },
  // Dec 12 to Jan 3
  {
    re: new RegExp(`\\b${MONTH}\\s+${DAY}${YEAR}${TO}${MONTH}\\s+${DAY}${YEAR}`, "i"),
    build: (m, t) => [makeDate(m[2], m[1], m[3], t), makeDate(m[5], m[4], m[6] ?? m[3], t)],
  },
  // 12-16 Dec  |  12th to 16th December 2026
  {
    re: new RegExp(`\\b${DAY}${TO}${DAY}\\s+(?:of\\s+)?${MONTH}${YEAR}`, "i"),
    build: (m, t) => [makeDate(m[1], m[3], m[4], t), makeDate(m[2], m[3], m[4], t)],
  },
  // Dec 12-16  |  December 12th to 16th
  {
    re: new RegExp(`\\b${MONTH}\\s+${DAY}${TO}${DAY}\\b${YEAR}`, "i"),
    build: (m, t) => [makeDate(m[2], m[1], m[4], t), makeDate(m[3], m[1], m[4], t)],
  },
  // Single date: 12 Dec  |  12th of December 2026
  {
    re: new RegExp(`\\b${DAY}\\s+(?:of\\s+)?${MONTH}${YEAR}\\b`, "i"),
    build: (m, t) => [makeDate(m[1], m[2], m[3], t), null],
  },
  // Single date: Dec 12  |  December 12th, 2026
  {
    re: new RegExp(`\\b${MONTH}\\s+${DAY}\\b${YEAR}`, "i"),
    build: (m, t) => [makeDate(m[2], m[1], m[3], t), null],
  },
];

/**
 * Returns { start, end } as ISO strings (end may be null when only a start
 * date and no length were given), or null when the text has no date.
 */
export function parseTripDates(text, now = new Date()) {
  if (!text) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (const { re, build } of RULES) {
    const m = text.match(re);
    if (!m) continue;
    const [start, rawEnd] = build(m, today);
    if (!start || Number.isNaN(start.getTime())) continue;
    const end = ordered(start, rawEnd);
    let endISO = end ? toISO(end) : null;
    if (!endISO) {
      // "from 12 Dec for 4 days" → 15 Dec; "for 3 nights" → 15 Dec
      const len = text.match(/(\d+)\s*(days?|nights?)\b/i);
      if (len) endISO = addDays(toISO(start), Number(len[1]) - (/^d/i.test(len[2]) ? 1 : 0));
    }
    return { start: toISO(start), end: endISO };
  }
  return null;
}

export const MAX_TRIP_DAYS = 30;

/** Validates a { start, end } pair. Returns an error message, or null when it's fine. */
export function validateTripDates(dates, now = new Date()) {
  if (!dates?.start || !dates?.end) return "Select your travel dates.";
  if (dates.start < todayISO(now)) return "Select a start date from today onward.";
  if (dates.end < dates.start) return "Select a return date on or after the start date.";
  if (daysBetween(dates.start, dates.end) + 1 > MAX_TRIP_DAYS) return `Select dates up to ${MAX_TRIP_DAYS} days apart.`;
  return null;
}

/** Valid future dates, or null — for deciding whether a request can run straight away. */
export const usableDates = (dates, now = new Date()) => (dates && !validateTripDates(dates, now) ? dates : null);
