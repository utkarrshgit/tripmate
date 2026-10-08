import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { cx } from "@/utils/cx";
import Icon from "./Icon";
import "./PinCard.css";

function PinMedia({ src, alt }) {
  const imgRef = useRef(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Cached images can finish before React attaches onLoad.
    if (imgRef.current?.complete && imgRef.current.naturalWidth) setLoaded(true);
  }, [src]);

  if (!src) {
    // Empty slot: the card's own surface-card fill, until a photo is configured in data/images.js.
    return (
      <div className="pin-slot" role={alt ? "img" : undefined} aria-label={alt || undefined}>
        <Icon name="image" size={28} strokeWidth={1.5} />
      </div>
    );
  }
  return (
    <>
      {!loaded && <span className="pin-loading skeleton" aria-hidden="true" />}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading="lazy"
        className={cx("pin-img", loaded && "is-loaded")}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
      />
    </>
  );
}

/*
 * pin-card / pin-card-large. The photo IS the card: no internal padding, and any
 * metadata floats over the image as pin-overlay-pills in the four corners.
 * Give it `to` (route) or `onClick` to make the whole image the target.
 */
export default function PinCard({
  src,
  alt = "",
  ratio = "3 / 4",
  large = false,
  to,
  onClick,
  label,
  topLeft,
  topRight,
  bottomLeft,
  bottomRight,
  className,
  children,
}) {
  const media = <PinMedia src={src} alt={alt} />;
  let target = media;
  if (to) {
    target = (
      <Link to={to} className="pin-card-target" aria-label={label}>
        {media}
      </Link>
    );
  } else if (onClick) {
    target = (
      <button type="button" className="pin-card-target" onClick={onClick} aria-label={label}>
        {media}
      </button>
    );
  }

  const hasOverlays = topLeft || topRight || bottomLeft || bottomRight;
  return (
    <div className={cx("pin-card", large && "pin-card-large", className)} style={{ aspectRatio: ratio }}>
      {target}
      {hasOverlays && (
        <div className="pin-overlays">
          <div className="pin-overlay-row is-top">
            <span>{topLeft}</span>
            <span>{topRight}</span>
          </div>
          <div className="pin-overlay-row">
            <span>{bottomLeft}</span>
            <span>{bottomRight}</span>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

/** pin-overlay-pill */
export function OverlayPill({ children }) {
  return <span className="pin-overlay-pill">{children}</span>;
}
