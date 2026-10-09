/*
 * ThoughtLine — adapted from React Bits (https://reactbits.dev), JavaScript + CSS variant.
 *
 * Changes from the original, to fit this project:
 * - No `motion` dependency: the glyph's breath uses the browser's element.animate().
 * - No @hugeicons dependency: icons come from ./Icon (sparkle, check, chevronDown).
 * - No text shimmer: it's a gradient sweep, which DESIGN.md rules out. The breath carries the motion.
 * - Keyboard focus keeps the site's focus ring (the original removed the outline).
 *
 * One line that says the AI is working ("Planning your trip…"), with an optional trace of
 * steps beneath it. When work stops it settles into a sentence with the time taken
 * ("Planned in 4.5s"), and the trace folds into the line.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import Icon from "./Icon";
import "./ThoughtLine.css";

const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
const EASE_IN_OUT = "cubic-bezier(0.77, 0, 0.175, 1)";
const GLYPH_DONE = 0.55;
const EMPTY_STEPS = [];

const fmt = (ds) => (ds < 600 ? `${(ds / 10).toFixed(1)}s` : `${Math.floor(ds / 600)}m ${((ds % 600) / 10).toFixed(1)}s`);
const spoken = (ds) =>
  ds < 600 ? `${(ds / 10).toFixed(1)} seconds` : `${Math.floor(ds / 600)} minutes ${((ds % 600) / 10).toFixed(1)} seconds`;

/** Fade an element to `to` and hold it there. */
const fadeTo = (el, to, ms) =>
  el.animate([{ opacity: getComputedStyle(el).opacity }, { opacity: to }], { duration: ms, easing: EASE_OUT, fill: "forwards" });

export default function ThoughtLine({
  label = "Thinking…",
  doneLabel = "",
  renderLabel,
  glyph = "sparkle",
  steps = EMPTY_STEPS,
  collapsible = true,
  collapseOnSettle = true,
  color = "currentColor",
  glyphColor = "",
  fontSize = 16,
  breathPeriod = 1.6,
  breathDepth = 0.45,
  settleDuration = 350,
  settleBlur = 2,
  working = true,
  settleAfter = 0,
  elapsed,
  showTimer = true,
  onSettle,
  className = "",
  style,
}) {
  const reduce = usePrefersReducedMotion();
  const [autoSettled, setAutoSettled] = useState(false);
  const [open, setOpen] = useState(true);
  const isWorking = working && !autoSettled;
  const doneText = doneLabel || (showTimer ? "Thought for" : "Done thinking");
  const hasTrace = steps.length > 0;
  const depth = reduce ? Math.min(breathDepth, 0.2) : breathDepth;
  const period = reduce ? breathPeriod * 1.5 : breathPeriod;
  const trough = 1 - depth;

  const glyphRef = useRef(null);
  const breathRef = useRef(null);
  const timerRef = useRef(null);
  const stackRef = useRef(null);
  const workRef = useRef(null);
  const doneRef = useRef(null);
  const dsRef = useRef(0);
  const prevWorking = useRef(isWorking);
  const latest = useRef({});
  latest.current = { onSettle };
  const [announce, setAnnounce] = useState(label);

  useEffect(() => {
    if (working) setAutoSettled(false);
  }, [working]);
  useEffect(() => {
    if (isWorking) setOpen(true);
    else if (collapseOnSettle) setOpen(false);
  }, [isWorking, collapseOnSettle]);

  // Breath: the glyph, then the label just behind it, dim and brighten while working.
  useEffect(() => {
    const glyphEl = glyphRef.current;
    const breathEl = breathRef.current;
    if (!breathEl) return undefined;
    const loop = (el, delay) =>
      el.animate([{ opacity: trough }, { opacity: 1 }, { opacity: trough }], {
        duration: period * 1000,
        easing: EASE_IN_OUT,
        iterations: Infinity,
        delay: delay * 1000,
      });
    let cancelled = false;
    const running = [];
    if (isWorking) {
      if (depth > 0) {
        if (glyphEl) {
          const lead = fadeTo(glyphEl, trough, 200);
          running.push(lead);
          lead.finished
            .then(() => {
              if (cancelled) return;
              running.push(loop(glyphEl, 0));
              running.push(loop(breathEl, 0.14));
            })
            .catch(() => {});
        } else {
          running.push(loop(breathEl, 0.14));
        }
      } else {
        if (glyphEl) running.push(fadeTo(glyphEl, 1, 200));
        running.push(fadeTo(breathEl, 1, 200));
      }
    } else {
      if (glyphEl) running.push(fadeTo(glyphEl, GLYPH_DONE, settleDuration));
      running.push(fadeTo(breathEl, 1, settleDuration));
    }
    return () => {
      cancelled = true;
      running.forEach((a) => a.cancel());
    };
  }, [isWorking, period, depth, trough, settleDuration, glyph]);

  const paint = (ds) => {
    dsRef.current = ds;
    if (timerRef.current) timerRef.current.textContent = fmt(ds);
  };
  useLayoutEffect(() => {
    if (elapsed != null) {
      paint(Math.round(elapsed * 10));
      return undefined;
    }
    if (!isWorking) return undefined;
    const startedAt = performance.now();
    paint(0);
    const id = setInterval(() => {
      const ds = Math.floor((performance.now() - startedAt) / 100);
      paint(ds);
      if (settleAfter > 0 && ds >= Math.round(settleAfter * 10)) setAutoSettled(true);
    }, 100);
    return () => clearInterval(id);
  }, [isWorking, elapsed, settleAfter]);

  // The timer glides from after the working label to after the settled sentence.
  useLayoutEffect(() => {
    const t = timerRef.current;
    const stack = stackRef.current;
    if (!t || !stack) return undefined;
    const place = (glide) => {
      const active = isWorking ? workRef.current : doneRef.current;
      if (!active) return;
      const shift = active.offsetWidth - stack.offsetWidth;
      if (!glide) t.style.transition = "none";
      t.style.transform = `translateX(${shift}px)`;
      if (!glide) {
        void t.offsetWidth;
        t.style.transition = "";
      }
    };
    place(prevWorking.current !== isWorking);
    prevWorking.current = isWorking;
    const ro = new ResizeObserver(() => place(false));
    if (workRef.current) ro.observe(workRef.current);
    if (doneRef.current) ro.observe(doneRef.current);
    return () => ro.disconnect();
  }, [isWorking, label, doneText, fontSize, showTimer]);

  useEffect(() => {
    if (isWorking) {
      setAnnounce(label);
      return;
    }
    setAnnounce(showTimer ? `${doneText} ${spoken(dsRef.current)}` : doneText);
    latest.current.onSettle?.(dsRef.current / 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWorking]);

  const toggle = hasTrace && collapsible;
  const head = (
    <>
      {glyph !== "none" ? (
        <span ref={glyphRef} className="thought-line__glyph" aria-hidden="true">
          {glyph === "sparkle" ? <Icon name="sparkle" size="100%" /> : glyph === "dot" ? <span className="thought-line__dot" /> : glyph}
        </span>
      ) : null}
      <span ref={stackRef} className="thought-line__label" aria-hidden="true">
        <span ref={workRef} className="thought-line__text" data-active={isWorking ? "" : undefined}>
          <span ref={breathRef} className="thought-line__breath">
            {renderLabel ? renderLabel(label, true) : label}
          </span>
        </span>
        <span ref={doneRef} className="thought-line__text thought-line__text--done" data-active={isWorking ? undefined : ""}>
          {renderLabel ? renderLabel(doneText, false) : doneText}
        </span>
      </span>
      {showTimer ? (
        <span ref={timerRef} className="thought-line__timer" data-done={isWorking ? undefined : ""} aria-hidden="true">
          0.0s
        </span>
      ) : null}
      {collapsible ? (
        <span className="thought-line__chevron" data-on={hasTrace ? "" : undefined} aria-hidden="true">
          <Icon name="chevronDown" size="1em" strokeWidth={2.2} />
        </span>
      ) : null}
      <span className="thought-line__sr" role="status">
        {announce}
      </span>
    </>
  );

  return (
    <div
      className={`thought-line${className ? ` ${className}` : ""}`}
      data-working={isWorking ? "" : undefined}
      data-open={open && hasTrace ? "" : undefined}
      style={{
        "--tl-font": `${fontSize}px`,
        "--tl-color": color,
        "--tl-glyph": glyphColor || color,
        "--tl-settle": `${settleDuration}ms`,
        "--tl-blur": `${settleBlur}px`,
        ...style,
      }}
    >
      {collapsible ? (
        <button
          type="button"
          className="thought-line__head"
          data-toggle={toggle ? "" : undefined}
          aria-expanded={toggle ? open : undefined}
          tabIndex={toggle ? 0 : -1}
          onClick={() => {
            if (toggle) setOpen((v) => !v);
          }}
        >
          {head}
        </button>
      ) : (
        <div className="thought-line__head">{head}</div>
      )}
      {hasTrace ? (
        <div className="thought-line__trace" data-open={open ? "" : undefined} aria-hidden={!open}>
          <div className="thought-line__fold">
            <div className="thought-line__steps">
              {steps.map((text, i) => {
                const done = !isWorking || i < steps.length - 1;
                return (
                  <div key={`${i}-${text}`} className="thought-line__step" data-done={done ? "" : undefined}>
                    <span className="thought-line__mark" aria-hidden="true">
                      {done ? <Icon name="check" size="1em" strokeWidth={2.5} /> : <i className="thought-line__pulse" />}
                    </span>
                    <span className="thought-line__step-text">{text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
