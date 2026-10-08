/** Joins truthy class names: cx("btn", isActive && "is-active") */
export const cx = (...names) => names.filter(Boolean).join(" ");
