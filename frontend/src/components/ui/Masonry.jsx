import { Children } from "react";
import Reveal from "./Reveal";
import "./Masonry.css";

/** Column-based pin grid (5/6 → 4 → 3 → 2 → 1 columns, 8px gutters). Children reveal in a stagger. */
export default function Masonry({ children }) {
  return (
    <div className="masonry">
      {Children.map(children, (child, i) => (
        <Reveal index={i % 8} className="masonry-item">
          {child}
        </Reveal>
      ))}
    </div>
  );
}
