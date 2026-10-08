/*
 * Image slots. Every photo in the UI is looked up here, so this is the only
 * file to touch when photos arrive.
 *
 * 1. Drop files into frontend/public/images/
 * 2. Set the matching key to its public path, e.g. manali: "/images/manali.jpg"
 *
 * A slot left as null renders as an empty warm-cream card at the right aspect
 * ratio, so layouts hold their shape before photos exist.
 */
export const destinationImages = {
  manali: null,
  goa: null,
  jaipur: null,
  kerala: null,
  ladakh: null,
  rishikesh: null,
  udaipur: null,
  varanasi: null,
  andaman: null,
  darjeeling: null,
  coorg: null,
  hampi: null,
};

export const featureImages = {
  describe: null, // home › "Describe it in one sentence"
  research: null, // home › "Specialist planners do the legwork"
  review: null, // home › "Review, adjust, save"
};

// Used on a trip plan whose destination has no photo of its own.
export const fallbackTripImage = null;

export function imageForDestination(destination = "") {
  const name = destination.toLowerCase();
  const key = Object.keys(destinationImages).find((k) => name.includes(k));
  return (key && destinationImages[key]) || fallbackTripImage;
}
