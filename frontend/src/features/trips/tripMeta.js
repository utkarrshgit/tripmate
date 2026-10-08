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

export const titleCase = (text = "") => text.charAt(0).toUpperCase() + text.slice(1);
