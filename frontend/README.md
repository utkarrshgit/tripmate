# TripMate frontend

React 19 + Vite, styled strictly from [`/DESIGN.md`](../DESIGN.md) (Pinterest-based).

```bash
npm install
npm run dev      # http://localhost:5173 — expects the API on http://localhost:8000
npm run build
npm run images   # rebuild optimised images from images/destinations/ and images/how-it-works/
npm run brand    # rebuild favicons, app icons, the web manifest and link-preview images
```

Set `VITE_API_URL` to point at a different API. For a public build, set `VITE_SITE_URL` to the site's address (see `.env.example`): it's used for canonical links, link-preview images and the sitemap.

## Search and link previews

- Every page's title, description, link-preview image and whether search engines may index it live in `src/config/seo.js`. Private or mid-flow pages (trips, account, prices) are `noindex`.
- The build writes those tags into the HTML of each public page (`dist/plan/index.html` and so on), so search engines and link previews see them without running JavaScript. It also writes `sitemap.xml` and `robots.txt`. In the app, `app/useHead.js` keeps the tags in step as people move between pages.
- Link-preview images (1200×630) are in `public/og/`, built by `npm run brand` from the "How it works" illustrations. Change their wording in `scripts/brand-assets.mjs`. The script needs the Inter font installed.
- The home page also carries structured data (schema.org `WebSite` and `WebApplication`).
- Host on anything that serves `dist/<path>/index.html` for `/<path>` and falls back to `dist/index.html` for other routes.

## Structure

```
src/
  app/              App shell
    App.jsx           providers (router, session)
    Layout.jsx        nav, footer, auth modal, page transition, route rendering
    routes.jsx        ← every page: path, title, lazy component, loading skeleton
    PageSkeletons.jsx route-level loading placeholders
  components/
    ui/             Design-system primitives — one per DESIGN.md component
                    (Button, Chip, TextField, SearchBar, PinCard, Masonry, Tile,
                    FeatureRow, Section, Modal, Skeleton, Reveal, …).
                    Import from "@/components/ui".
    layout/         Nav, Footer, Wordmark, PlannerSearch, AccountMenu
                    navLinks.js ← nav, drawer and footer links
  features/         One folder per area; each owns its components, logic and CSS
    home/             home page sections + content.js (copy)
    planner/          request form, date range (dateParsing.js reads dates from text),
                      interest chips, detail checklist, planning progress, usePlanRequest
    pricing/          exact-prices step: origin form, quote lists, estimate vs exact
    trips/            TripPlanView + sections/, TripCard, skeletons
    auth/             sign-up/log-in modal, SignedOutPrompt, validation
    account/          profile form, data controls
    legal/            LegalPage + content/privacy.jsx, content/terms.jsx
    system/           404 and service-unavailable views
  pages/            Thin route components that compose features — no styling
  hooks/            useInView, useMediaQuery, useClipboard, useDismiss
  api/client.js     All HTTP calls
  state/session.jsx Accounts + saved trips (local stand-in until the API has auth)
  data/             catalog.js (destinations, interests, planners), images.js
  styles/           tokens.css (DESIGN.md tokens), motion.css, base.css (globals only)
```

Import from `src` with the `@/` alias, e.g. `import { Button } from "@/components/ui"`.

## Common changes

| To… | Do this |
|---|---|
| Add a page | Create `pages/X.jsx`, add it to `app/routes.jsx` (path, skeleton) and to `config/seo.js` (title, description, `index`). Add it to `components/layout/navLinks.js` if it belongs in the nav or footer. |
| Add a section to the trip plan | Create a component in `features/trips/sections/` that takes `{ plan, query, onEditRequest }` and returns `null` when it has no data, then add it to `TRIP_SECTIONS` in `sections/index.js`. |
| Add or replace a destination photo | Put the original in `images/destinations/` (named after the destination, e.g. `goa.jpg`), run `npm run images`, and add its alt text in `src/data/images.js`. The script makes AVIF, WebP and JPEG versions in several sizes; only changed photos are rebuilt. Destinations without a photo show an empty cream card. |
| Replace a "How it works" illustration | Replace `images/how-it-works/step-1.png` (or 2, 3) and run `npm run images`. Alt text is in `src/data/images.js`. Illustrations show at their own shape, uncropped. |
| Change legal text | Edit `features/legal/content/*.jsx`. |
| Change how dates are read from text | `features/planner/dateParsing.js`: pure functions; add a rule to `RULES`. |
| Add a destination or interest | `data/catalog.js`. Interests must match the backend parser's keywords. |
| Show AI activity somewhere new | Use `<ThoughtLine>` from `@/components/ui`: `working` while it runs, `steps` for the trace, `doneLabel` for the settled sentence. Planner step wording (`doing`, `did`) lives in `PLANNERS` in `data/catalog.js`. |
| Hook up real auth | Replace each function in `state/authApi.js` with a call to its endpoint (each is named after one). They already follow the planned rules: 6-digit email codes for sign-up, password reset and email changes, valid 10 minutes, 5 tries, a new code after 60 seconds. Drop `devCode`, which only exists because there's no email yet. |
| Hook up saved trips | Replace the localStorage trip functions in `state/session.jsx`; components only use `useSession()`. |

## Design and motion rules

- Use only tokens from `styles/tokens.css`. They mirror `DESIGN.md`, which wins any conflict.
- No hover states, no card shadows, no gradients (DESIGN.md policy). Pinterest Red is reserved for primary CTAs, the wordmark and the active-tab marker.
- Motion lives in `styles/motion.css`: short durations, one easing curve, triggered by entering, pressing, opening or loading — never by hover. Wrap anything that should animate in on scroll with `<Reveal>` (or use `Masonry`/`TileGrid`, which do it for you).
- Everything respects `prefers-reduced-motion`.
- AI activity is shown with `ThoughtLine` (adapted from React Bits, no extra dependencies). Its sparkle is accent-purple while the AI is working (DESIGN.md's colour for predictive callouts) and ink once it settles. Never Pinterest Red, which stays reserved for CTAs.
- Anything that loads should show a skeleton shaped like what's coming (`Skeleton`, `SkeletonText`, `SkeletonScreen`).
