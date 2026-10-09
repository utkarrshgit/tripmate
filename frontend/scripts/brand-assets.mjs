/*
 * Builds the brand files browsers, home screens and link previews ask for.
 *
 *   npm run brand
 *
 * Writes to public/:
 *   favicon.svg, favicon.ico          Tab icon: the wordmark's red pin mark
 *   apple-touch-icon.png              iOS home screen (180px)
 *   icon-192.png, icon-512.png        Web app manifest icons, plus a maskable 512px
 *   site.webmanifest                  Name, colors and icons for "Add to home screen"
 *   og/<page>.png                     1200×630 link-preview images, one per public page
 *
 * The preview images use the "How it works" illustrations in images/how-it-works/ and
 * the Inter font, which must be installed on the machine running this (DESIGN.md names
 * Inter as the substitute for Pin Sans). The output is committed, so this only needs
 * running when the brand, the copy below or an illustration changes.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { OG_SIZE, SITE } from "../src/config/seo.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PUBLIC = path.join(ROOT, "public");
const ILLUSTRATIONS = path.join(ROOT, "images/how-it-works");

// DESIGN.md tokens
const C = { primary: "#e60023", ink: "#000000", mute: "#62625b", canvas: "#ffffff", card: "#f6f6f3" };

// The Icon "pin" glyph (24×24, stroked), as used in the wordmark.
const PIN = `<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>`;
const pinGlyph = (x, y, size, stroke = 2.4) =>
  `<g transform="translate(${x} ${y}) scale(${size / 24})" fill="none" stroke="${C.canvas}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${PIN}</g>`;

/** The red circle with the pin, filling a size×size square; `inset` shrinks the circle (for maskable icons). */
const markSvg = (size, { inset = 0, square = false } = {}) => {
  const r = size / 2 - inset;
  const glyph = r * 1.5;
  const bg = square ? `<rect width="${size}" height="${size}" fill="${C.primary}"/>` : `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="${C.primary}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${bg}${pinGlyph(size / 2 - glyph / 2, size / 2 - glyph / 2, glyph)}</svg>`;
};

const png = (svg, size) => sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

/** A PNG-in-ICO file with the given sizes. */
async function ico(sizes) {
  const images = await Promise.all(sizes.map((s) => png(markSvg(s), s)));
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach((img, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(sizes[i] % 256, e);
    header.writeUInt8(sizes[i] % 256, e + 1);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(img.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += img.length;
  });
  return Buffer.concat([header, ...images]);
}

// Link-preview images. Lines are broken by hand so each one fits the text column.
const OG_PAGES = [
  {
    name: "home",
    title: ["Plan the trip", "you keep", "dreaming about"],
    body: ["Describe your trip in one sentence.", "Get a day-by-day plan with the", "costs worked out."],
    art: "step-1.png",
  },
  {
    name: "plan",
    title: ["Plan a trip in", "one sentence"],
    body: ["Say where, how long, who's going,", "and your budget. Get a plan you", "can change and save."],
    art: "step-3.png",
  },
  { name: "privacy", title: ["Privacy Policy"], body: ["What we collect, how we use it,", "and the choices you have."] },
  { name: "terms", title: ["Terms and", "Conditions"], body: ["How TripMate works, including", "estimated prices and generated plans."] },
];

const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

async function ogImage({ title, body, art }) {
  const { width: W, height: H } = OG_SIZE;
  const pad = 72;
  const panel = { x: 640, y: 56, w: W - 640 - 56, h: H - 112 };
  const titleSize = 62;
  const titleLead = 70;
  const bodySize = 26;
  const bodyLead = 38;
  const textTop = 200;
  const bodyTop = textTop + titleLead * (title.length - 1) + 64;

  // Illustration: trimmed to its drawing, then fitted into the panel with room around it.
  let panelFill = C.card;
  let artLayer = null;
  if (art) {
    const src = sharp(path.join(ILLUSTRATIONS, art));
    const { data } = await src.clone().extract({ left: 4, top: 4, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
    panelFill = `rgb(${data[0]}, ${data[1]}, ${data[2]})`; // the illustration's own background, so the panel is seamless
    const inner = { w: panel.w - 64, h: panel.h - 64 };
    const fitted = await src.trim({ threshold: 40 }).resize(inner.w, inner.h, { fit: "inside" }).png().toBuffer({ resolveWithObject: true });
    artLayer = {
      input: fitted.data,
      left: Math.round(panel.x + (panel.w - fitted.info.width) / 2),
      top: Math.round(panel.y + (panel.h - fitted.info.height) / 2),
      // Generated art has a slightly uneven background; "darken" lets the panel show through it.
      blend: "darken",
    };
  }
  // Without an illustration, the panel holds a large brand mark.
  const mark = art ? "" : `<circle cx="${panel.x + panel.w / 2}" cy="${panel.y + panel.h / 2}" r="96" fill="${C.primary}"/>${pinGlyph(panel.x + panel.w / 2 - 72, panel.y + panel.h / 2 - 72, 144, 2.2)}`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${C.canvas}"/>
  <rect x="${panel.x}" y="${panel.y}" width="${panel.w}" height="${panel.h}" rx="32" fill="${panelFill}"/>
  ${mark}
  <circle cx="${pad + 20}" cy="${pad + 20}" r="20" fill="${C.primary}"/>
  ${pinGlyph(pad + 7, pad + 7, 26)}
  <text x="${pad + 52}" y="${pad + 30}" font-family="Inter" font-weight="700" font-size="30" letter-spacing="-0.6" fill="${C.primary}">${SITE.name}</text>
  <text font-family="Inter" font-weight="700" font-size="${titleSize}" letter-spacing="-1.6" fill="${C.ink}">
    ${title.map((line, i) => `<tspan x="${pad}" y="${textTop + i * titleLead}">${escape(line)}</tspan>`).join("")}
  </text>
  <text font-family="Inter" font-weight="400" font-size="${bodySize}" fill="${C.mute}">
    ${body.map((line, i) => `<tspan x="${pad}" y="${bodyTop + i * bodyLead}">${escape(line)}</tspan>`).join("")}
  </text>
</svg>`;
  let img = sharp(Buffer.from(svg));
  if (artLayer) img = sharp(await img.png().toBuffer()).composite([artLayer]);
  return img.png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer();
}

await mkdir(path.join(PUBLIC, "og"), { recursive: true });
const files = {
  "favicon.svg": markSvg(32),
  "favicon.ico": await ico([16, 32, 48]),
  "apple-touch-icon.png": await png(markSvg(180, { square: true }), 180),
  "icon-192.png": await png(markSvg(192), 192),
  "icon-512.png": await png(markSvg(512), 512),
  "icon-maskable-512.png": await png(markSvg(512, { square: true }), 512),
  "site.webmanifest":
    JSON.stringify(
      {
        name: `${SITE.name} — ${SITE.tagline.toLowerCase()}`,
        short_name: SITE.name,
        description: SITE.description,
        start_url: "/",
        display: "standalone",
        background_color: C.canvas,
        theme_color: SITE.themeColor,
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      null,
      2,
    ) + "\n",
};
for (const page of OG_PAGES) files[`og/${page.name}.png`] = await ogImage(page);

for (const [name, data] of Object.entries(files)) {
  await writeFile(path.join(PUBLIC, name), data);
  console.log(`  ${name.padEnd(24)} ${(Buffer.byteLength(data) / 1024).toFixed(1)} KB`);
}
