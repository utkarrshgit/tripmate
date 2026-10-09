/*
 * Search and link-preview details for every page, shared by the app (app/useHead.js
 * updates the tags on navigation) and the build (vite.config.js writes them into each
 * public page's HTML, plus sitemap.xml and robots.txt, so crawlers and link previews
 * see them without running JavaScript).
 *
 * Plain data and string helpers only: vite.config.js imports this file directly.
 *
 * Pages are matched by `path` (same patterns as app/routes.jsx). `index: false` keeps a
 * page out of search results and the sitemap: anything personal to one visitor, or
 * that only makes sense mid-flow. Social images are built by `npm run brand`.
 */

export const SITE = {
  name: "TripMate",
  tagline: "Plan a trip in one sentence",
  description: "Describe your trip in one sentence and get a day-by-day plan for India, with travel, stays, food, and costs worked out.",
  themeColor: "#ffffff",
  locale: "en_IN",
};

const OG = {
  home: { src: "/og/home.png", alt: "TripMate: Plan the trip you keep dreaming about. Describe your trip in one sentence." },
  plan: { src: "/og/plan.png", alt: "TripMate: Plan a trip in one sentence. Get a day-by-day plan you can change and save." },
  privacy: { src: "/og/privacy.png", alt: "TripMate Privacy Policy." },
  terms: { src: "/og/terms.png", alt: "TripMate Terms and Conditions." },
};
export const OG_SIZE = { width: 1200, height: 630 };

export const PAGES = [
  {
    path: "/",
    title: "TripMate — plan a trip in one sentence",
    description: SITE.description,
    image: OG.home,
    index: true,
    changefreq: "weekly",
    priority: "1.0",
  },
  {
    path: "/plan",
    title: "Plan a trip",
    description: "Say where, how long, who's going, and your budget. TripMate plans travel, stays, activities, and food day by day, with estimated costs.",
    image: OG.plan,
    index: true,
    changefreq: "monthly",
    priority: "0.9",
  },
  {
    path: "/privacy",
    title: "Privacy Policy",
    description: "What information TripMate collects when you plan trips, how we use it, who we share it with, and the choices you have.",
    image: OG.privacy,
    index: true,
    changefreq: "yearly",
    priority: "0.3",
  },
  {
    path: "/terms",
    title: "Terms and Conditions",
    description: "The terms for using TripMate, including how estimated prices and automatically generated plans work.",
    image: OG.terms,
    index: true,
    changefreq: "yearly",
    priority: "0.3",
  },
  { path: "/trip", title: "Your trip plan", index: false },
  { path: "/trip/prices", title: "Exact prices", index: false },
  { path: "/trips", title: "Your trips", index: false },
  { path: "/trips/:id", title: "Saved trip", index: false },
  { path: "/trips/:id/prices", title: "Exact prices", index: false },
  { path: "/account", title: "Account", index: false },
  { path: "/unavailable", title: "Service unavailable", index: false },
  { path: "*", title: "Page not found", index: false },
];

// A route missing from PAGES still gets a sensible title, and stays out of search until it's added.
export const pageFor = (path) => PAGES.find((p) => p.path === path) ?? { path, title: SITE.name, index: false };

export const documentTitle = (page) => (page.path === "/" || page.title === SITE.name ? page.title : `${page.title} · ${SITE.name}`);

/**
 * Every head tag that varies by page, as { kind, key, value } records. `siteUrl` is the
 * public origin (no trailing slash); without it, tags that need an absolute URL are left out.
 */
export function headFor(page, siteUrl = "") {
  const title = documentTitle(page);
  const description = page.description ?? SITE.description;
  const image = page.image ?? OG.home;
  const abs = (p) => (siteUrl ? `${siteUrl}${p}` : null);
  const url = page.index ? abs(page.path) : null;
  const imageUrl = abs(image.src);
  return [
    { kind: "title", value: title },
    { kind: "name", key: "description", value: description },
    { kind: "name", key: "robots", value: page.index ? "index, follow, max-image-preview:large" : "noindex, follow" },
    { kind: "link", key: "canonical", value: url },
    { kind: "property", key: "og:type", value: "website" },
    { kind: "property", key: "og:site_name", value: SITE.name },
    { kind: "property", key: "og:locale", value: SITE.locale },
    { kind: "property", key: "og:title", value: page.path === "/" ? title : page.title },
    { kind: "property", key: "og:description", value: description },
    { kind: "property", key: "og:url", value: url },
    { kind: "property", key: "og:image", value: imageUrl },
    { kind: "property", key: "og:image:type", value: imageUrl && "image/png" },
    { kind: "property", key: "og:image:width", value: imageUrl && String(OG_SIZE.width) },
    { kind: "property", key: "og:image:height", value: imageUrl && String(OG_SIZE.height) },
    { kind: "property", key: "og:image:alt", value: imageUrl && image.alt },
    { kind: "name", key: "twitter:card", value: "summary_large_image" },
    { kind: "name", key: "twitter:title", value: page.path === "/" ? title : page.title },
    { kind: "name", key: "twitter:description", value: description },
    { kind: "name", key: "twitter:image", value: imageUrl },
    { kind: "name", key: "twitter:image:alt", value: imageUrl && image.alt },
  ].filter((t) => t.value);
}

/** Structured data for the home page: the site and the app it offers. */
export function structuredData(siteUrl = "") {
  const url = siteUrl ? `${siteUrl}/` : undefined;
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", name: SITE.name, url, description: SITE.description, inLanguage: "en" },
      {
        "@type": "WebApplication",
        name: SITE.name,
        url,
        description: SITE.description,
        applicationCategory: "TravelApplication",
        operatingSystem: "Any",
        browserRequirements: "Requires JavaScript",
        image: siteUrl ? `${siteUrl}${OG.home.src}` : undefined,
      },
    ],
  };
}

const escape = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The page's head tags as HTML, for writing into index.html at build time. */
export function headHtml(page, siteUrl = "") {
  const tags = headFor(page, siteUrl).map((t) => {
    if (t.kind === "title") return `<title>${escape(t.value)}</title>`;
    if (t.kind === "link") return `<link rel="${t.key}" href="${escape(t.value)}" />`;
    const attr = t.kind === "property" ? "property" : "name";
    return `<meta ${attr}="${t.key}" content="${escape(t.value)}" />`;
  });
  if (page.path === "/") {
    // "<" is escaped so the JSON can't close the script element.
    tags.push(`<script type="application/ld+json">${JSON.stringify(structuredData(siteUrl)).replace(/</g, "\\u003c")}</script>`);
  }
  return tags.map((t) => `    ${t}`).join("\n");
}
