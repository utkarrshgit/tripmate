/*
 * BranchedMenu — adapted from React Bits (https://reactbits.dev), JavaScript + CSS variant.
 *
 * Changes from the original, to fit this project:
 * - No @hugeicons dependency: `icon` takes any React element (e.g. <Icon name="pin" />).
 * - No built-in demo items; `items` is required.
 * - Optional controlled `active`, so a page can drive the highlight (e.g. scroll position).
 * - CSS follows DESIGN.md: no hover states, no gradients, colours from tokens.
 */
import { useLayoutEffect, useRef, useState } from "react";
import "./BranchedMenu.css";

const PAD = 6;
const MARK = 16;

const toSet = (open) => new Set(Array.isArray(open) ? open : open >= 0 ? [open] : []);

/**
 * A folding, branched list of links.
 *   items         [{ label, children: [{ value, label, icon? }] }] — a section that folds,
 *                 or { label, value } — a single row that selects.
 *   active        Selected value, when the parent controls it (optional).
 *   defaultActive Starting value when uncontrolled.
 *   defaultOpen   Index, or indexes, of the sections open at first. -1 for none.
 *   onSelect      (value, item) => void when a row is picked.
 *   onToggle      (index, open) => void when a section folds or unfolds.
 */
export default function BranchedMenu({
  items,
  active: activeProp,
  defaultOpen = 0,
  defaultActive = "",
  onSelect,
  onToggle,
  label,
  color = "var(--color-ink)",
  accentColor = "var(--color-ink)",
  lineColor = "var(--color-hairline)",
  width = 240,
  rowHeight = 36,
  indent = 40,
  trunk = 14,
  radius = 10,
  lineWidth = 1.5,
  fontSize = 14,
  drawDuration = 400,
  foldDuration = 300,
  className = "",
}) {
  const [open, setOpen] = useState(() => toSet(defaultOpen));
  const [activeState, setActive] = useState(() => {
    if (defaultActive) return defaultActive;
    const first = items.find((it, i) => it.children && toSet(defaultOpen).has(i));
    return first?.children?.[0]?.value ?? "";
  });
  const active = activeProp ?? activeState;
  const navRef = useRef(null);
  const heads = useRef([]);
  const markerRef = useRef(null);
  const latest = useRef({});
  latest.current = { onSelect, onToggle };

  // The marker sits beside the header of whichever section holds the active row.
  const activeSection = items.findIndex((it) => (it.children ? it.children.some((kid) => kid.value === active) : it.value === active));
  const markerShown = activeSection >= 0 && (!items[activeSection].children || open.has(activeSection));
  useLayoutEffect(() => {
    const place = (glide) => {
      const m = markerRef.current;
      const el = heads.current[activeSection];
      if (!m) return;
      const on = markerShown && el;
      if (!glide) m.style.transition = "none";
      if (on) m.style.top = `${el.offsetTop + (el.offsetHeight - MARK) / 2}px`;
      m.toggleAttribute("data-on", Boolean(on));
      if (!glide) {
        void m.offsetHeight;
        m.style.transition = "";
      }
    };
    place(true);
    let first = true;
    const ro = new ResizeObserver(() => {
      if (first) {
        first = false;
        return;
      }
      place(false);
    });
    if (navRef.current) ro.observe(navRef.current);
    return () => ro.disconnect();
  }, [activeSection, markerShown, items, fontSize, rowHeight]);

  const select = (value, item) => {
    setActive(value);
    latest.current.onSelect?.(value, item);
  };
  const toggle = (i) => {
    setOpen((prev) => {
      const next = new Set(prev);
      const isOpen = !next.has(i);
      if (isOpen) next.add(i);
      else next.delete(i);
      latest.current.onToggle?.(i, isOpen);
      return next;
    });
  };

  const r = Math.min(radius, rowHeight / 2 - 2);
  const endX = indent - 8;
  const rowY = (k) => PAD + k * rowHeight + rowHeight / 2;
  const branch = (k) => `M ${trunk} ${rowY(k) - r} A ${r} ${r} 0 0 0 ${trunk + r} ${rowY(k)} H ${endX}`;
  const reach = (k) => `M ${trunk} 0 V ${rowY(k) - r} A ${r} ${r} 0 0 0 ${trunk + r} ${rowY(k)} H ${endX}`;
  const length = (k) => rowY(k) - r + (Math.PI * r) / 2 + (endX - trunk - r);

  return (
    <nav
      ref={navRef}
      aria-label={label}
      className={`branched-menu${className ? ` ${className}` : ""}`}
      style={{
        "--bm-w": `${width}px`,
        "--bm-ink": color,
        "--bm-accent": accentColor,
        "--bm-line": lineColor,
        "--bm-font": `${fontSize}px`,
        "--bm-row": `${rowHeight}px`,
        "--bm-indent": `${indent}px`,
        "--bm-line-w": lineWidth,
        "--bm-draw": `${drawDuration}ms`,
        "--bm-fold": `${foldDuration}ms`,
      }}
    >
      <span ref={markerRef} className="branched-menu__marker" aria-hidden="true" />
      {items.map((item, i) => {
        const kids = item.children;
        const isOpen = kids ? open.has(i) : false;
        const leafValue = item.value ?? item.label;
        const leafActive = !kids && leafValue === active;
        const bodyH = kids ? PAD * 2 + kids.length * rowHeight : 0;
        return (
          <div key={item.value ?? item.label} className="branched-menu__section" data-open={isOpen ? "" : undefined}>
            <button
              ref={(el) => {
                heads.current[i] = el;
              }}
              type="button"
              className="branched-menu__head"
              aria-expanded={kids ? isOpen : undefined}
              aria-current={leafActive ? "location" : undefined}
              data-active={leafActive ? "" : undefined}
              onClick={() => (kids ? toggle(i) : select(leafValue, item))}
            >
              {item.label}
            </button>
            {kids ? (
              <div className="branched-menu__body">
                <div className="branched-menu__fold">
                  <div className="branched-menu__tree" style={{ height: bodyH }}>
                    <svg className="branched-menu__lines" width={indent} height={bodyH} aria-hidden="true">
                      <path className="branched-menu__base" d={`M ${trunk} 0 V ${rowY(kids.length - 1) - r}`} />
                      {kids.map((kid, k) => (
                        <path key={kid.value} className="branched-menu__base" d={branch(k)} />
                      ))}
                      {kids.map((kid, k) => (
                        <path
                          key={kid.value}
                          className="branched-menu__reach"
                          d={reach(k)}
                          style={{ strokeDasharray: length(k), strokeDashoffset: kid.value === active ? 0 : length(k) }}
                        />
                      ))}
                    </svg>
                    {kids.map((kid) => (
                      <button
                        key={kid.value}
                        type="button"
                        className="branched-menu__item"
                        aria-current={kid.value === active ? "location" : undefined}
                        data-active={kid.value === active ? "" : undefined}
                        tabIndex={isOpen ? 0 : -1}
                        onClick={() => select(kid.value, kid)}
                      >
                        {kid.icon ? (
                          <span className="branched-menu__icon" aria-hidden="true">
                            {kid.icon}
                          </span>
                        ) : null}
                        <span className="branched-menu__label">{kid.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
