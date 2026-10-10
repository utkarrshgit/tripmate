import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { cx } from "@/utils/cx";
import { IconButton } from "./Button";
import "./Modal.css";

const EXIT_MS = 160;
const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * modal-card over a 50% scrim (a bottom sheet on mobile). Traps focus, closes on
 * Escape or a scrim click, and plays an exit animation before calling onClose.
 * `children` may be a function: ({ close }) => …, so inner buttons can close
 * with the same animation. Without a `title`, pass `labelledBy`: the id of the
 * heading inside that names the dialog.
 */
export default function Modal({ title, labelledBy, onClose, children }) {
  const titleId = useId();
  const cardRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const [closing, setClosing] = useState(false);
  const reduceMotion = usePrefersReducedMotion();
  onCloseRef.current = onClose;

  const close = useCallback(() => {
    if (reduceMotion) {
      onCloseRef.current();
      return;
    }
    setClosing(true);
    setTimeout(() => onCloseRef.current(), EXIT_MS);
  }, [reduceMotion]);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const card = cardRef.current;
    (card.querySelector("[autofocus]") || card.querySelector(FOCUSABLE))?.focus();

    function onKey(e) {
      if (e.key === "Escape") close();
      if (e.key !== "Tab") return;
      const items = [...card.querySelectorAll(FOCUSABLE)];
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [close]);

  return createPortal(
    <div className={cx("modal-scrim", closing && "is-closing")} onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div
        ref={cardRef}
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : labelledBy}
      >
        <IconButton icon="close" label="Close" className="modal-close" onClick={close} />
        {title && (
          <h2 id={titleId} className="t-heading-lg modal-title">
            {title}
          </h2>
        )}
        {typeof children === "function" ? children({ close }) : children}
      </div>
    </div>,
    document.body,
  );
}
