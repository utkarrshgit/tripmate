import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "./useMediaQuery";

/**
 * Cycles an index 0…count-1 every `interval` ms while `active`, for "one at a
 * time" highlights. Returns -1 when inactive or when reduced motion is on.
 */
export function useRelay(count, { interval = 1400, active = true } = {}) {
  const reduceMotion = usePrefersReducedMotion();
  const running = active && !reduceMotion && count > 0;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), interval);
    return () => clearInterval(id);
  }, [running, count, interval]);

  return running ? index : -1;
}
