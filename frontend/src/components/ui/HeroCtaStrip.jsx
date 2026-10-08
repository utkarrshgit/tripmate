import Reveal from "./Reveal";
import "./HeroCtaStrip.css";

/** hero-cta-strip: full-bleed dark band with one red CTA. */
export default function HeroCtaStrip({ title, body, action }) {
  return (
    <Reveal className="hero-cta-strip">
      <div>
        <h2>{title}</h2>
        {body && <p className="t-body-md">{body}</p>}
      </div>
      {action}
    </Reveal>
  );
}
