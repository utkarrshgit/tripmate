import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { PAGES, headHtml, pageFor } from "./src/config/seo.js";

/**
 * Search and link-preview tags (see src/config/seo.js). Fills index.html's <!--seo-->
 * marker with the home page's tags, and at build time also writes:
 *   dist/<page>/index.html   each other public page, with its own tags, so crawlers and
 *                            link previews that don't run JavaScript still see them
 *   dist/sitemap.xml         the public pages (needs VITE_SITE_URL)
 *   dist/robots.txt          points crawlers at the sitemap
 * VITE_SITE_URL is the public address, like https://tripmate.example. Without it, tags
 * that need a full URL (canonical, og:url, og:image) and the sitemap are left out.
 */
function seo(siteUrl) {
  let outDir = "dist";
  const publicPages = PAGES.filter((p) => p.index);
  return {
    name: "tripmate-seo",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
      if (config.command === "build" && !siteUrl) {
        config.logger.warn("\nVITE_SITE_URL isn't set: building without canonical links, og:image or a sitemap. See frontend/.env.example.\n");
      }
    },
    transformIndexHtml: {
      order: "pre",
      handler: (html) => html.replace("    <!--seo-->", headHtml(pageFor("/"), siteUrl)),
    },
    writeBundle(_, bundle) {
      const html = bundle["index.html"]?.source;
      if (!html) return;
      const homeHead = headHtml(pageFor("/"), siteUrl);
      for (const page of publicPages.filter((p) => p.path !== "/")) {
        const dir = path.join(outDir, page.path);
        mkdirSync(dir, { recursive: true });
        writeFileSync(path.join(dir, "index.html"), html.replace(homeHead, headHtml(page, siteUrl)));
      }
      const robots = ["User-agent: *", "Allow: /", ...(siteUrl ? ["", `Sitemap: ${siteUrl}/sitemap.xml`] : [])];
      writeFileSync(path.join(outDir, "robots.txt"), robots.join("\n") + "\n");
      if (siteUrl) {
        const urls = publicPages.map(
          (p) =>
            `  <url>\n    <loc>${siteUrl}${p.path}</loc>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`,
        );
        writeFileSync(
          path.join(outDir, "sitemap.xml"),
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`,
        );
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const siteUrl = (env.VITE_SITE_URL ?? "").replace(/\/$/, "");
  return {
    plugins: [react(), seo(siteUrl)],
    resolve: {
      // Import from src with "@/..." instead of long relative paths.
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
  };
});
