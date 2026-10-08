import { Children } from "react";
import { cx } from "@/utils/cx";
import Reveal from "./Reveal";
import "./Tile.css";

/** category-tile: surface-card, 16px radius, 16px padding. */
export function Tile({ as: Component = "div", className, children, ...rest }) {
  return (
    <Component className={cx("category-tile", className)} {...rest}>
      {children}
    </Component>
  );
}

/**
 * Responsive grid of tiles: `columns` at desktop (2, 3 or 4), stepping down at
 * each breakpoint. Pass `ordered` for an <ol>. Items reveal in a stagger
 * unless `reveal={false}`.
 */
export function TileGrid({ columns = 4, ordered = false, reveal = true, className, children }) {
  const List = ordered ? "ol" : "ul";
  return (
    <List className={cx("tile-grid", `tile-grid-${columns}`, className)}>
      {Children.map(children, (child, i) =>
        reveal ? (
          <Reveal as="li" index={i} className="tile-grid-item">
            {child}
          </Reveal>
        ) : (
          <li className="tile-grid-item">{child}</li>
        ),
      )}
    </List>
  );
}
