import { useInView } from "@/hooks/useInView";
import { cx } from "@/utils/cx";

/**
 * Fades and lifts its content in the first time it scrolls into view.
 * `index` staggers siblings (40ms apart, capped — see styles/motion.css).
 */
export default function Reveal({ as: Component = "div", index = 0, className, style, children, ...rest }) {
  const [ref, inView] = useInView();
  return (
    <Component
      ref={ref}
      className={cx("reveal", inView && "is-visible", className)}
      style={{ "--reveal-index": index, ...style }}
      {...rest}
    >
      {children}
    </Component>
  );
}
