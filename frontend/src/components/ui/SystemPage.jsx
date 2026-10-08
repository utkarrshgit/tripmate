import Icon from "./Icon";
import "./SystemPage.css";

/** Full-page message: empty states, signed-out prompts, errors. `media` replaces the icon disc's contents. */
export default function SystemPage({ icon, media, eyebrow, title, children, actions }) {
  return (
    <div className="container container-narrow section">
      <div className="system-page stack-xl">
        {(media || icon) && <span className="system-page-icon">{media ?? <Icon name={icon} size={28} />}</span>}
        <div className="stack-md">
          {eyebrow && <p className="t-body-sm-strong c-mute">{eyebrow}</p>}
          <h1 className="t-display-lg">{title}</h1>
          {children}
        </div>
        {actions && <div className="row">{actions}</div>}
      </div>
    </div>
  );
}
