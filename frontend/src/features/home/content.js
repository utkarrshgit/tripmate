import { featureImages } from "@/data/images";

export const HERO = {
  title: "Plan the trip you keep dreaming about",
  body: "One sentence in. A costed, day-by-day trip out.",
};

export const HOW_IT_WORKS = [
  {
    image: featureImages.describe,
    alt: "A traveller writing down trip ideas",
    title: "Describe it in one sentence",
    body: "Where, how long, who and how much.",
    cta: { label: "Try a request", to: "/plan" },
  },
  {
    image: featureImages.research,
    alt: "A map with a planned route",
    title: "Specialist planners do the legwork",
    body: "Nine planners, one after another.",
    cta: { label: "Meet the planners", href: "#planners" },
  },
  {
    image: featureImages.review,
    alt: "A day-by-day itinerary laid out on a table",
    title: "Review, adjust, save",
    body: "Tweak it, re-plan it, save it.",
    cta: { label: "Plan a trip", to: "/plan" },
  },
];
