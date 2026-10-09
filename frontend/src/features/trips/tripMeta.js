// Display metadata for trip plan fields returned by POST /api/trips/plan.

export const COST_CATEGORIES = {
  transport: { label: "Getting there", icon: "train" },
  hotel: { label: "Stays", icon: "bed" },
  activities: { label: "Activities", icon: "ticket" },
  food: { label: "Food", icon: "utensils" },
};

export const DAY_PARTS = [
  { key: "morning", label: "Morning", icon: "sun" },
  { key: "afternoon", label: "Afternoon", icon: "map" },
  { key: "evening", label: "Evening", icon: "moon" },
];

/**
 * How to name a trip in copy. The API sends an empty destination when it couldn't
 * tell where someone is going, so every sentence needs a fallback.
 *   tripName(plan)            → "Goa" | "Your trip"   (headings, pills)
 *   tripPhrase(plan, "your")  → "your Goa trip" | "your trip"   (inside sentences)
 */
export const tripName = (plan) => plan.destination || "Your trip";
export const tripPhrase = (plan, lead = "your") => (plan.destination ? `${lead} ${plan.destination} trip` : `${lead} trip`);

export const titleCase = (text = "") => text.charAt(0).toUpperCase() + text.slice(1);
