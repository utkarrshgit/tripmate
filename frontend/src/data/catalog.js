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
  { id: "destination", icon: "pin", label: "Destination", text: "Learns about the place", orb: { state: "searching" } },
  { id: "transport", icon: "train", label: "Transport", text: "Prices the journey", orb: { state: "searching", variant: "lighthouse" } },
  { id: "hotel", icon: "bed", label: "Stays", text: "Finds rooms", orb: { state: "searching" } },
  { id: "activity", icon: "ticket", label: "Activities", text: "Picks things to do", orb: { state: "searching", variant: "lighthouse" } },
  { id: "food", icon: "utensils", label: "Food", text: "Budgets meals", orb: { state: "searching" } },
  { id: "budget", icon: "wallet", label: "Budget", text: "Adds up the costs", orb: { state: "working" } },
  { id: "itinerary", icon: "calendar", label: "Itinerary", text: "Lays out each day", orb: { state: "working", variant: "gyro" } },
  { id: "critic", icon: "shield", label: "Final review", text: "Checks the plan for problems", orb: { state: "reasoning", variant: "twins" } },
];

export const plannerById = (id) => PLANNERS.find((p) => p.id === id);

export const plannerLabel = (id) => plannerById(id)?.label ?? id;

/*
 * Featured destinations. Prompts read like something a person would type:
 * "<n> days in <place> under ₹<budget> for <n> people, <interests>".
 * `ratio` keeps the masonry grid in DESIGN.md's portrait/square mix.
 */
export const DESTINATIONS = [
  { key: "manali", name: "Manali", tag: "Mountains", ratio: "4 / 5", prompt: "5 days in Manali under ₹30,000 for 3 people, nature and adventure" },
  { key: "goa", name: "Goa", tag: "Beaches", ratio: "3 / 4", prompt: "4 days in Goa under ₹25,000 for 2 people, beaches and nightlife" },
  { key: "jaipur", name: "Jaipur", tag: "History", ratio: "2 / 3", prompt: "3 days in Jaipur under ₹18,000 for 2 people, history and shopping" },
  { key: "kerala", name: "Kerala", tag: "Nature", ratio: "3 / 4", prompt: "6 days in Kerala under ₹45,000 for 4 people, nature and food" },
  { key: "ladakh", name: "Ladakh", tag: "Adventure", ratio: "1 / 1", prompt: "7 days in Ladakh under ₹60,000 for 2 people, adventure and photography" },
  { key: "rishikesh", name: "Rishikesh", tag: "Spiritual", ratio: "2 / 3", prompt: "3 days in Rishikesh under ₹15,000 for 2 people, spiritual and adventure" },
  { key: "udaipur", name: "Udaipur", tag: "Culture", ratio: "4 / 5", prompt: "3 days in Udaipur under ₹22,000 for 2 people, culture and photography" },
  { key: "varanasi", name: "Varanasi", tag: "Spiritual", ratio: "3 / 4", prompt: "3 days in Varanasi under ₹14,000 for 2 people, spiritual and culture" },
  { key: "andaman", name: "Andaman", tag: "Beaches", ratio: "2 / 3", prompt: "6 days in Andaman under ₹70,000 for 2 people, beaches and adventure" },
  { key: "darjeeling", name: "Darjeeling", tag: "Mountains", ratio: "4 / 5", prompt: "4 days in Darjeeling under ₹28,000 for 3 people, mountains and nature" },
  { key: "coorg", name: "Coorg", tag: "Nature", ratio: "2 / 3", prompt: "3 days in Coorg under ₹20,000 for 4 people, nature and trekking" },
  { key: "hampi", name: "Hampi", tag: "History", ratio: "3 / 4", prompt: "3 days in Hampi under ₹12,000 for 2 people, history and photography" },
];

export const EXAMPLE_PROMPTS = DESTINATIONS.slice(0, 4).map((d) => d.prompt);
