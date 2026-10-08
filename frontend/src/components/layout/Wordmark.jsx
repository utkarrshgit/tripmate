import { Icon } from "@/components/ui";
import "./Wordmark.css";

/** Brand wordmark — Pinterest Red is permitted here by DESIGN.md. */
export default function Wordmark({ className = "" }) {
  return (
    <span className={`wordmark ${className}`.trim()}>
      <span className="wordmark-mark" aria-hidden="true">
        <Icon name="pin" size={18} strokeWidth={2.4} />
      </span>
      <span className="wordmark-text">TripMate</span>
    </span>
  );
}
