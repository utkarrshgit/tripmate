/*
 * Every photo in the UI is looked up here.
 *
 * Destination photos are generated: put the original in frontend/images/destinations/
 * and run `npm run images` (see scripts/optimize-images.mjs). That writes responsive
 * AVIF, WebP and JPEG files to public/images/destinations/ and records them in
 * ./destination-images.json, which this file reads.
 *
 * Alt text is written by hand below. Describe what the photo shows, not just the
 * place name (the name is already on the card), and end with a period.
 *
 * A destination without a photo renders as an empty warm-cream card, so layouts
 * hold their shape before photos exist.
 */
import generated from "./destination-images.json";
import howItWorks from "./how-it-works-images.json";

const ALT = {
  andaman: "Turquoise sea and a rocky shore below a forested green headland.",
  coorg: "Stone steps winding through rainforest toward a waterfall.",
  darjeeling: "Snow-capped Himalayan peaks above a hillside town of colorful houses.",
  goa: "Colorful beach huts under coconut palms on a sandy beach.",
  hampi: "The carved stone chariot at Vittala Temple under a cloudy sky.",
  jaipur: "Sunset over Jaipur, with the Hawa Mahal in front and a hilltop fort behind.",
  kerala: "Morning sun over tea plantations and mist-filled hills.",
  ladakh: "A mountain road past prayer flags and a sign that reads “Welcomes you to the top of the world, Mighty Khardungla.”",
  manali: "A rocky river running through a pine valley toward snow-capped peaks.",
  rishikesh: "Priests raising flaming lamps during the evening Ganga aarti on the riverbank steps.",
  udaipur: "The City Palace glowing at sunset above Lake Pichola, with a red boat on the water.",
  varanasi: "Evening on the Varanasi ghats, with fires burning on the riverbank and boats at the water’s edge.",
};

/**
 * { src, alt, width, height, sources: { avif: [{ src, width }], webp: [...] } } per
 * destination, or null when there's no photo yet. PinCard renders these as <picture>.
 */
export const destinationImages = Object.fromEntries(
  Object.keys(ALT).map((key) => {
    const entry = generated[key];
    return [key, entry ? { src: entry.fallback, alt: ALT[key], width: entry.width, height: entry.height, sources: entry.sources } : null];
  }),
);

/** CSS aspect-ratio of a photo's natural shape, e.g. "736 / 1104" (DESIGN.md: pins keep their ratio). */
export const naturalRatio = (image) => (image ? `${image.width} / ${image.height}` : null);

// Home › "How it works" illustrations, built from frontend/images/how-it-works/ by `npm run images`.
const illustration = (key, alt) => {
  const entry = howItWorks[key];
  return entry ? { src: entry.fallback, alt, width: entry.width, height: entry.height, sources: entry.sources } : null;
};

export const featureImages = {
  describe: illustration("step-1", "Icons for a place, dates, people, and budget flowing into one search bar."),
  research: illustration("step-2", "A row of planner icons, finished one after another, leading to a trip plan."),
  review: illustration("step-3", "Three versions of a day-by-day plan side by side, with the front one saved."),
};

// Used on a trip plan whose destination has no photo of its own.
export const fallbackTripImage = null;

export function imageForDestination(destination = "") {
  const name = destination.toLowerCase();
  const key = Object.keys(destinationImages).find((k) => name.includes(k));
  return (key && destinationImages[key]) || fallbackTripImage;
}
