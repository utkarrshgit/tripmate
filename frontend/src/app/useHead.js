import { useEffect } from "react";
import { headFor, pageFor } from "@/config/seo";

// The public address, set at build time; the current origin otherwise (e.g. in development).
const siteUrl = () => (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, "");

function setTag(kind, key, value) {
  const selector = kind === "link" ? `link[rel="${key}"]` : `meta[${kind}="${key}"]`;
  let el = document.head.querySelector(selector);
  if (!value) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement(kind === "link" ? "link" : "meta");
    el.setAttribute(kind === "link" ? "rel" : kind, key);
    document.head.append(el);
  }
  el.setAttribute(kind === "link" ? "href" : "content", value);
}

// Every tag any page sets, so tags a page doesn't use get removed on the way in.
const ALL_KEYS = new Map();
for (const page of [pageFor("/"), pageFor("*")]) {
  for (const t of headFor(page, "https://x")) if (t.kind !== "title") ALL_KEYS.set(`${t.kind}:${t.key}`, t);
}

/**
 * Keeps the title, description, canonical link, robots and link-preview tags in step
 * with the current page (`routePath` is the matched route pattern, like "/trips/:id").
 * The build writes the same tags into each public page's HTML (see config/seo.js).
 */
export function useHead(routePath) {
  useEffect(() => {
    const tags = headFor(pageFor(routePath), siteUrl());
    const set = new Set();
    for (const t of tags) {
      if (t.kind === "title") document.title = t.value;
      else {
        setTag(t.kind, t.key, t.value);
        set.add(`${t.kind}:${t.key}`);
      }
    }
    for (const [id, t] of ALL_KEYS) if (!set.has(id)) setTag(t.kind, t.key, null);
  }, [routePath]);
}
