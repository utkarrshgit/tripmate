import { cx } from "@/utils/cx";
import PinCard from "./PinCard";
import Reveal from "./Reveal";
import "./FeatureRow.css";

/**
 * feature-card (or feature-card-soft) laid out as text beside a 4:5 portrait
 * image; `reversed` swaps the sides so rows alternate down the page.
 * `illustration` shows the image whole at its own shape instead of cropping it.
 */
export default function FeatureRow({ image, alt, illustration = false, eyebrow, title, body, action, reversed = false, soft = false, headingLevel = 3 }) {
  const Heading = `h${headingLevel}`;
  return (
    <Reveal as="article" className={cx("feature-card", soft && "feature-card-soft", "feature-row", reversed && "is-reversed")}>
      <div className="stack-lg">
        {eyebrow && <p className="t-body-sm-strong c-mute">{eyebrow}</p>}
        <Heading className="t-heading-xl">{title}</Heading>
        {body && <p className="t-body-md c-body">{body}</p>}
        {action && <div>{action}</div>}
      </div>
      <div className={cx("feature-row-media", illustration && "is-illustration")}>
        <PinCard
          src={image}
          alt={alt}
          ratio={illustration && image?.width ? `${image.width} / ${image.height}` : "4 / 5"}
          sizes={illustration ? "(max-width: 768px) calc(100vw - 64px), 560px" : undefined}
        />
      </div>
    </Reveal>
  );
}
