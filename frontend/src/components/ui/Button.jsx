import { cx } from "@/utils/cx";
import Icon from "./Icon";
import "./Button.css";

/**
 * button-primary / -secondary / -tertiary. Polymorphic: pass `as={Link}` and `to`
 * (or `as="a"` and `href`) to render a link that looks like a button.
 */
export default function Button({
  as: Component = "button",
  variant = "secondary",
  icon,
  iconEnd,
  block = false,
  className,
  children,
  ...rest
}) {
  const props = Component === "button" ? { type: "button", ...rest } : rest;
  return (
    <Component className={cx("btn", `btn-${variant}`, block && "btn-block", className)} {...props}>
      {icon && <Icon name={icon} size={16} />}
      {children}
      {iconEnd && <Icon name={iconEnd} size={16} />}
    </Component>
  );
}

/** button-icon-circular: always needs an accessible `label`. */
export function IconButton({ icon, label, size = 20, className, children, ...rest }) {
  return (
    <button type="button" className={cx("icon-btn", className)} aria-label={label} {...rest}>
      {children ?? <Icon name={icon} size={size} />}
    </button>
  );
}
