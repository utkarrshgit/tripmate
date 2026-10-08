const rupeeFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export function rupees(value) {
  return `₹${rupeeFormatter.format(Math.round(Number(value) || 0))}`;
}

export function plural(count, one, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const parseISO = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** "Sat 12 Dec" */
export function formatDay(iso) {
  return parseISO(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

/** "12–15 Dec 2026", "28 Dec 2026 – 2 Jan 2027" */
export function formatDateRange(startISO, endISO) {
  if (!startISO) return "";
  const s = parseISO(startISO);
  const e = endISO ? parseISO(endISO) : s;
  const month = (d) => d.toLocaleDateString("en-IN", { month: "short" });
  if (s.getFullYear() !== e.getFullYear()) {
    return `${s.getDate()} ${month(s)} ${s.getFullYear()} – ${e.getDate()} ${month(e)} ${e.getFullYear()}`;
  }
  if (s.getMonth() !== e.getMonth()) return `${s.getDate()} ${month(s)} – ${e.getDate()} ${month(e)} ${e.getFullYear()}`;
  if (s.getDate() === e.getDate()) return `${s.getDate()} ${month(s)} ${s.getFullYear()}`;
  return `${s.getDate()}–${e.getDate()} ${month(s)} ${s.getFullYear()}`;
}
