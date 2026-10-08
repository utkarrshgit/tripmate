import { cx } from "@/utils/cx";
import "./Skeleton.css";

/** A pulsing placeholder block. Size it with width/height or a className. */
export function Skeleton({ width, height, radius = "md", className, style }) {
  return (
    <span
      className={cx("skeleton", `skeleton-${radius}`, className)}
      style={{ width, height, ...style }}
      aria-hidden="true"
    />
  );
}

/** Lines of placeholder text; the last line is shorter, like a real paragraph. */
export function SkeletonText({ lines = 3, size = "md", className }) {
  return (
    <span className={cx("skeleton-text", `skeleton-text-${size}`, className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="skeleton skeleton-full" style={{ width: i === lines - 1 && lines > 1 ? "60%" : "100%" }} />
      ))}
    </span>
  );
}

/** Wraps a loading layout so assistive tech hears one "Loading…" instead of empty shapes. */
export function SkeletonScreen({ label = "Loading", className, children }) {
  return (
    <div className={cx("skeleton-screen", className)} role="status" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">{label}</span>
      {children}
    </div>
  );
}
