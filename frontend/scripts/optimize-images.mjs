/*
 * Builds web-ready images.
 *
 *   npm run images
 *
 * Reads the originals in images/<set>/ (not served to visitors) and writes, for each
 * image, responsive AVIF and WebP versions plus one JPEG fallback to
 * public/images/<set>/, then records each image's size and files in a manifest
 * under src/data/ for the app to use. The sets:
 *   destinations   City photos for the pin grid → destination-images.json
 *   how-it-works   Home page step illustrations → how-it-works-images.json
 *
 * To add or replace an image: put the original in its images/ folder, add it to
 * `sources` below if the file name differs from the key the app uses, and run the
 * script. Only images whose original changed are rebuilt.
 */
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const SETS = [
  {
    name: "destinations",
    // Destination key → original file name, where they differ.
    sources: { kerala: "kerla.jpg" },
    // Cover a 1-column phone pin (~343px), a 4-column desktop pin at 2× density (~604px), and full size.
    widths: [360, 540, 640, 736],
    manifest: "src/data/destination-images.json",
  },
  {
    name: "how-it-works",
    sources: {},
    // Cover a phone-width row and a half-width desktop row at 2× density (~1100px).
    widths: [480, 720, 960, 1200],
    manifest: "src/data/how-it-works-images.json",
  },
];

const FORMATS = {
  avif: (img) => img.avif({ quality: 50, effort: 6 }),
  webp: (img) => img.webp({ quality: 72, effort: 6 }),
};
const FALLBACK = (img) => img.jpeg({ quality: 74, mozjpeg: true, progressive: true });

const isNewer = async (a, b) => {
  try {
    return (await stat(a)).mtimeMs > (await stat(b)).mtimeMs;
  } catch {
    return true; // output missing
  }
};

async function build({ srcDir, outDir, publicPath, widths }, key, file) {
  const input = path.join(srcDir, file);
  // .rotate() applies the camera's orientation; sharp drops other metadata (GPS, camera info) by default.
  const base = sharp(input).rotate();
  const { width: srcWidth, height: srcHeight } = await base.metadata();
  // Every target width below the original, plus the largest we serve (never upscaled).
  const largest = Math.min(srcWidth, Math.max(...widths));
  const sizes = [...new Set([...widths.filter((w) => w < largest), largest])];

  const entry = { width: largest, height: Math.round((srcHeight * largest) / srcWidth), sources: {}, fallback: "" };
  let written = 0;
  for (const [format, encode] of Object.entries(FORMATS)) {
    entry.sources[format] = [];
    for (const w of sizes) {
      const name = `${key}-${w}.${format}`;
      const out = path.join(outDir, name);
      if (await isNewer(input, out)) {
        await encode(base.clone().resize({ width: w, withoutEnlargement: true })).toFile(out);
        written++;
      }
      entry.sources[format].push({ src: `${publicPath}/${name}`, width: w });
    }
  }
  const fallbackName = `${key}-${largest}.jpg`;
  if (await isNewer(input, path.join(outDir, fallbackName))) {
    await FALLBACK(base.clone().resize({ width: largest, withoutEnlargement: true })).toFile(path.join(outDir, fallbackName));
    written++;
  }
  entry.fallback = `${publicPath}/${fallbackName}`;
  return [entry, written];
}

for (const set of SETS) {
  const dirs = {
    srcDir: path.join(ROOT, "images", set.name),
    outDir: path.join(ROOT, "public/images", set.name),
    publicPath: `/images/${set.name}`,
    widths: set.widths,
  };
  await mkdir(dirs.outDir, { recursive: true });
  const files = (await readdir(dirs.srcDir)).filter((f) => /\.(jpe?g|png|webp|avif|heic)$/i.test(f));
  const keyFor = (file) => Object.entries(set.sources).find(([, f]) => f === file)?.[0] ?? path.parse(file).name.toLowerCase();

  const manifest = {};
  let total = 0;
  console.log(`${set.name}`);
  for (const file of files.sort()) {
    const key = keyFor(file);
    const [entry, written] = await build(dirs, key, file);
    manifest[key] = entry;
    total += written;
    console.log(`  ${written ? "built  " : "cached "} ${key.padEnd(11)} ${entry.width}×${entry.height}`);
  }
  await writeFile(path.join(ROOT, set.manifest), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`  ${files.length} images, ${total} files written → public/images/${set.name}, manifest → ${set.manifest}\n`);
}
