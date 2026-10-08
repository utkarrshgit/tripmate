/*
 * Client-side mirror of what the backend's request reader looks for
 * (backend/app/agents/planner.py), so the form can show what it will pick up.
 * Keep these in sync when the backend parser changes.
 */
import { INTERESTS } from "@/data/catalog";

export const MIN_REQUEST_LENGTH = 3;

export const REQUEST_DETAILS = [
  { id: "destination", label: "Where you're going", hint: "e.g. “to Goa”", test: /\b(?:to|visit)\s+[a-z]/i },
  { id: "days", label: "How many days", hint: "Defaults to 3 days", test: /\d+\s*days?\b/i },
  { id: "travelers", label: "How many people", hint: "Defaults to 1 traveler", test: /\d+\s*(?:people|persons|travell?ers|friends)\b/i },
  { id: "budget", label: "Your budget in ₹", hint: "e.g. “under ₹25000”", test: /(?:under|within|budget|₹)\s*₹?\s*[\d,]+/i },
  { id: "interests", label: "What you enjoy", hint: "Pick interests below", test: new RegExp(`\\b(?:${INTERESTS.join("|")})\\b`, "i") },
];

export const detectDetails = (query) => Object.fromEntries(REQUEST_DETAILS.map((d) => [d.id, d.test.test(query)]));

export const mentions = (query, word) => new RegExp(`\\b${word}\\b`, "i").test(query);

/** Adds "with <word>" / "and <word>" to the request, or removes the word if present. */
export function toggleInterest(query, word) {
  if (mentions(query, word)) {
    return query
      .replace(new RegExp(`\\s*(?:,|\\band\\b)?\\s*\\b${word}\\b`, "i"), "")
      .replace(/\bwith\s*(?:and\s+)?(?=\w)/i, "with ")
      .replace(/\s+with\s*$/i, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }
  const base = query.trim();
  if (!base) return `with ${word}`;
  return /\bwith\b/i.test(base) ? `${base} and ${word}` : `${base} with ${word}`;
}

/** "Plan a 5 day trip to Manali under ₹30000 …" → "Manali · 5 days · ₹30k" for compact chips. */
export function shortPrompt(prompt) {
  const place = prompt.match(/\bto\s+([A-Z][\w ]*?)(?=\s+(?:under|for|with)\b|$)/)?.[1];
  const days = prompt.match(/(\d+)\s*day/i)?.[1];
  const budget = prompt.match(/₹\s*([\d,]+)/)?.[1]?.replace(/,/g, "");
  if (!place) return prompt.replace(/^Plan an? /, "");
  return [place, days && `${days} days`, budget && `₹${Math.round(budget / 1000)}k`].filter(Boolean).join(" · ");
}
