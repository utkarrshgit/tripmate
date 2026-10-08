import { cx } from "@/utils/cx";
import "./Chip.css";

/**
 * filter-chip / filter-chip-active. Interactive when it has onClick (a toggle if
 * `pressed` is set); otherwise renders as a static label.
 */
export default function Chip({ pressed, onClick, className, children, ...rest }) {
  if (!onClick) {
    return (
      <span className={cx("chip", "chip-static", className)} {...rest}>
        {children}
      </span>
    );
  }
  return (
    <button type="button" className={cx("chip", className)} aria-pressed={pressed} onClick={onClick} {...rest}>
      {children}
    </button>
  );
}

export function ChipStrip({ className, children, ...rest }) {
  return (
    <div className={cx("chip-strip", className)} {...rest}>
      {children}
    </div>
  );
}
