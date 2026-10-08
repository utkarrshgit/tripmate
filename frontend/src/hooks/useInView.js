import { useEffect, useRef, useState } from "react";

/** True once the element has scrolled into view (fires once, then disconnects). */
export function useInView({ rootMargin = "0px 0px -10% 0px", threshold = 0.05 } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || inView) return undefined;
    if (!("IntersectionObserver" in window)) {
      setInView(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Content already scrolled past (e.g. after an anchor jump) counts as seen.
        if (entry.isIntersecting || entry.boundingClientRect.bottom < 0) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [inView, rootMargin, threshold]);

  return [ref, inView];
}
