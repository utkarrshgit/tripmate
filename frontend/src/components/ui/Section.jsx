import { useId } from "react";
import { cx } from "@/utils/cx";
import Reveal from "./Reveal";
import "./Section.css";

/**
 * A page section on the 64px rhythm with a heading block. `id` makes it an
 * anchor target; `actions` sit on the right of the heading.
 */
export default function Section({ id, title, intro, actions, as: Heading = "h2", headingClass = "t-heading-xl", className, children }) {
  const headingId = useId();
  return (
    <section id={id} className={cx("section", className)} aria-labelledby={title ? headingId : undefined}>
      {title && (
        <Reveal className="section-head">
          <div className="stack-sm">
            <Heading id={headingId} className={headingClass}>
              {title}
            </Heading>
            {intro && <p className="t-body-md c-body">{intro}</p>}
          </div>
          {actions}
        </Reveal>
      )}
      {children}
    </section>
  );
}
