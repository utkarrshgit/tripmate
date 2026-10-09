import { featureImages } from "@/data/images";

export const HERO = {
  title: "Plan the trip you keep dreaming about",
  body: "Describe your trip in one sentence. Get a day-by-day plan with the costs worked out.",
};

export const HOW_IT_WORKS = [
  {
    image: featureImages.describe,
    title: "Describe it in one sentence",
    body: "Say where, how long, who's going, and your budget.",
    cta: { label: "Describe your trip", to: "/plan" },
  },
  {
    image: featureImages.research,
    title: "Specialist planners do the work",
    body: "Nine planners work through your trip, one after another.",
    cta: { label: "Meet the planners", href: "#planners" },
  },
  {
    image: featureImages.review,
    title: "Review, change, and save",
    body: "Change your request, plan again, and save the version you like.",
    cta: { label: "Plan a trip", to: "/plan" },
  },
];
