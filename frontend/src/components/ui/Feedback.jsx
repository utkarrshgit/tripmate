import { cx } from "@/utils/cx";
import Icon from "./Icon";
import "./Feedback.css";

/** Small status label. tone: "success" | "error" | "neutral". */
export function StatusPill({ tone = "neutral", icon, className, children, ...rest }) {
  return (
    <span className={cx("status-pill", `is-${tone}`, className)} {...rest}>
      {icon && <Icon name={icon} size={14} />}
      {children}
    </span>
  );
}

/** In-product message block. tone: "neutral" | "error" | "success". */
export function Notice({ tone = "neutral", icon = "info", title, className, children, ...rest }) {
  return (
    <div className={cx("notice", `is-${tone}`, className)} {...rest}>
      <Icon name={icon} />
      <div className="stack-xs notice-body">
        {title && <p className="t-body-strong">{title}</p>}
        {children}
      </div>
    </div>
  );
}

export function Avatar({ name = "", size = "md" }) {
  return (
    <span className={cx("avatar", size === "lg" && "avatar-lg")} aria-hidden="true">
      {name.trim().slice(0, 1).toUpperCase()}
    </span>
  );
}
