// Interest keywords the backend planner recognises (backend/app/agents/planner.py).
export const INTERESTS = [
  "adventure",
  "trekking",
  "nature",
  "food",
  "nightlife",
  "culture",
  "shopping",
  "beaches",
  "mountains",
  "photography",
  "history",
  "spiritual",
];

// The supervisor's agents, in the order it runs them (backend/app/agents/supervisor.py).
// `orb` is the Thinking Orbs state that shows what each one is doing (see components/ui/AgentOrb.jsx).
export const PLANNERS = [
  { id: "planner", icon: "compass", label: "Request reader", text: "Reads your request", orb: { state: "reasoning" } },
  { id: "destination", icon: "pin", label: "Destination", text: "Sizes up the place", orb: { state: "searching" } },
  { id: "transport", icon: "train", label: "Transport", text: "Prices the journey", orb: { state: "searching", variant: "lighthouse" } },
  { id: "hotel", icon: "bed", label: "Stays", text: "Finds rooms", orb: { state: "searching" } },
  { id: "activity", icon: "ticket", label: "Activities", text: "Picks things to do", orb: { state: "searching", variant: "lighthouse" } },
  { id: "food", icon: "utensils", label: "Food", text: "Budgets meals", orb: { state: "searching" } },
  { id: "budget", icon: "wallet", label: "Budget", text: "Totals it up", orb: { state: "working" } },
  { id: "itinerary", icon: "calendar", label: "Itinerary", text: "Lays out each day", orb: { state: "working", variant: "gyro" } },
  { id: "critic", icon: "shield", label: "Final review", text: "Double-checks it all", orb: { state: "reasoning", variant: "twins" } },
];

export const plannerById = (id) => PLANNERS.find((p) => p.id === id);

export const plannerLabel = (id) => plannerById(id)?.label ?? id;

/*
 * Featured destinations. Prompts are phrased "to <place> under ₹<budget> for <n> people"
 * because that ordering parses cleanly in the backend's request reader.
 * `ratio` keeps the masonry grid in DESIGN.md's portrait/square mix.
 */
export const DESTINATIONS = [
  { key: "manali", name: "Manali", tag: "Mountains", ratio: "4 / 5", prompt: "Plan a 5 day trip to Manali under ₹30000 for 3 people with nature and adventure" },
  { key: "goa", name: "Goa", tag: "Beaches", ratio: "3 / 4", prompt: "Plan a 4 day trip to Goa under ₹25000 for 2 people with beaches and nightlife" },
  { key: "jaipur", name: "Jaipur", tag: "History", ratio: "2 / 3", prompt: "Plan a 3 day trip to Jaipur under ₹18000 for 2 people with history and shopping" },
  { key: "kerala", name: "Kerala", tag: "Nature", ratio: "3 / 4", prompt: "Plan a 6 day trip to Kerala under ₹45000 for 4 people with nature and food" },
  { key: "ladakh", name: "Ladakh", tag: "Adventure", ratio: "1 / 1", prompt: "Plan a 7 day trip to Ladakh under ₹60000 for 2 people with adventure and photography" },
  { key: "rishikesh", name: "Rishikesh", tag: "Spiritual", ratio: "2 / 3", prompt: "Plan a 3 day trip to Rishikesh under ₹15000 for 2 people with spiritual and adventure" },
  { key: "udaipur", name: "Udaipur", tag: "Culture", ratio: "4 / 5", prompt: "Plan a 3 day trip to Udaipur under ₹22000 for 2 people with culture and photography" },
  { key: "varanasi", name: "Varanasi", tag: "Spiritual", ratio: "3 / 4", prompt: "Plan a 3 day trip to Varanasi under ₹14000 for 2 people with spiritual and culture" },
  { key: "andaman", name: "Andaman", tag: "Beaches", ratio: "2 / 3", prompt: "Plan a 6 day trip to Andaman under ₹70000 for 2 people with beaches and adventure" },
  { key: "darjeeling", name: "Darjeeling", tag: "Mountains", ratio: "4 / 5", prompt: "Plan a 4 day trip to Darjeeling under ₹28000 for 3 people with mountains and nature" },
  { key: "coorg", name: "Coorg", tag: "Nature", ratio: "2 / 3", prompt: "Plan a 3 day trip to Coorg under ₹20000 for 4 people with nature and trekking" },
  { key: "hampi", name: "Hampi", tag: "History", ratio: "3 / 4", prompt: "Plan a 3 day trip to Hampi under ₹12000 for 2 people with history and photography" },
];

export const EXAMPLE_PROMPTS = DESTINATIONS.slice(0, 4).map((d) => d.prompt);
