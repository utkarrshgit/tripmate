import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useInView } from "@/hooks/useInView";
import { cx } from "@/utils/cx";
import Icon from "./Icon";
import "./PinCard.css";

// Masonry pins: full width on phones, then 2, 3 and 4 columns (DESIGN.md › Pin masonry grid).
export const PIN_SIZES = "(max-width: 480px) calc(100vw - 32px), (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 320px";

const srcSet = (list) => list.map((s) => `${s.src} ${s.width}w`).join(", ");

/**
 * `src` is either a URL or a generated photo from data/images.js:
 * { src, alt, width, height, sources: { avif, webp } } — rendered as <picture> so each
 * browser downloads only the best format at the size it needs.
 */
function PinMedia({ src, alt, sizes, near }) {
  const imgRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const photo = src && typeof src === "object" ? src : null;
  const url = photo ? photo.src : src;

  useEffect(() => {
    // Cached images can finish before React attaches onLoad.
    if (imgRef.current?.complete && imgRef.current.naturalWidth) setLoaded(true);
  }, [url]);

  if (!url) {
    // Empty slot: the card's own surface-card fill, until a photo is configured in data/images.js.
    // There's no picture yet, so it's hidden from screen readers rather than announced as an image.
    return (
      <div className="pin-slot" aria-hidden="true">
        <Icon name="image" size={28} strokeWidth={1.5} />
      </div>
    );
  }
  // Off-screen: hold the card's pulse until it's within about a screen of view (see PinCard).
  if (!near) return <span className="pin-loading skeleton" aria-hidden="true" />;

  const img = (
    // `loading` must come before `src`: React sets attributes in prop order, and a src set
    // first starts the download before the browser knows the image is lazy.
    <img
      ref={imgRef}
      loading="lazy"
      decoding="async"
      width={photo?.width}
      height={photo?.height}
      src={url}
      alt={alt ?? photo?.alt ?? ""}
      className={cx("pin-img", loaded && "is-loaded")}
      onLoad={() => setLoaded(true)}
      onError={() => setLoaded(true)}
    />
  );
  return (
    <>
      {!loaded && <span className="pin-loading skeleton" aria-hidden="true" />}
      {photo ? (
        <picture>
          {photo.sources.avif && <source type="image/avif" srcSet={srcSet(photo.sources.avif)} sizes={sizes} />}
          {photo.sources.webp && <source type="image/webp" srcSet={srcSet(photo.sources.webp)} sizes={sizes} />}
          {img}
        </picture>
      ) : (
        img
      )}
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
  alt,
  sizes = PIN_SIZES,
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
  // Load photos only as they approach the screen. Native loading="lazy" alone didn't hold
  // back off-screen pins on the first render of the home page, so this is explicit.
  const [cardRef, near] = useInView({ rootMargin: "800px 0px", threshold: 0 });
  const media = <PinMedia src={src} alt={alt} sizes={sizes} near={near} />;
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
    <div ref={cardRef} className={cx("pin-card", large && "pin-card-large", className)} style={{ aspectRatio: ratio }}>
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
