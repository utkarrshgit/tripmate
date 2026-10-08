import { cx } from "@/utils/cx";
import PinCard from "./PinCard";
import Reveal from "./Reveal";
import "./FeatureRow.css";

/**
 * feature-card (or feature-card-soft) laid out as text beside a 4:5 portrait
 * image; `reversed` swaps the sides so rows alternate down the page.
 */
export default function FeatureRow({ image, alt = "", eyebrow, title, body, action, reversed = false, soft = false, headingLevel = 3 }) {
  const Heading = `h${headingLevel}`;
  return (
    <Reveal as="article" className={cx("feature-card", soft && "feature-card-soft", "feature-row", reversed && "is-reversed")}>
      <div className="stack-lg">
        {eyebrow && <p className="t-body-sm-strong c-mute">{eyebrow}</p>}
        <Heading className="t-heading-xl">{title}</Heading>
        {body && <p className="t-body-md c-body">{body}</p>}
        {action && <div>{action}</div>}
      </div>
      <div className="feature-row-media">
        <PinCard src={image} alt={alt} ratio="4 / 5" />
      </div>
    </Reveal>
  );
}
