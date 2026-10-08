# TripMate frontend

React 19 + Vite, styled strictly from [`/DESIGN.md`](../DESIGN.md) (Pinterest-based).

```bash
npm install
npm run dev      # http://localhost:5173 — expects the API on http://localhost:8000
npm run build
```

Set `VITE_API_URL` to point at a different API.

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
    planner/          request form, interest chips, detail checklist,
                      planning progress, usePlanRequest, requestDetails.js
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
| Add a page | Create `pages/X.jsx`, add it to `app/routes.jsx` (path, title, skeleton). Add it to `components/layout/navLinks.js` if it belongs in the nav or footer. |
| Add a section to the trip plan | Create a component in `features/trips/sections/` that takes `{ plan, query, onEditRequest }` and returns `null` when it has no data, then add it to `TRIP_SECTIONS` in `sections/index.js`. |
| Add photos | Put files in `public/images/` and set their paths in `data/images.js`. Empty slots render as cream cards at the right ratio. |
| Change legal text | Edit `features/legal/content/*.jsx`. |
| Add a destination or interest | `data/catalog.js`. Interests must match the backend parser's keywords. |
| Show AI activity somewhere new | Use `<AgentOrb state="…">` (or `<PlannerOrb planner={…}>` for a backend planner) from `@/components/ui`. Each planner's state lives in `PLANNERS` in `data/catalog.js`. |
| Hook up real auth / saved trips | Replace the localStorage functions in `state/session.jsx`; components only use `useSession()`. |

## Design and motion rules

- Use only tokens from `styles/tokens.css`. They mirror `DESIGN.md`, which wins any conflict.
- No hover states, no card shadows, no gradients (DESIGN.md policy). Pinterest Red is reserved for primary CTAs, the wordmark and the active-tab marker.
- Motion lives in `styles/motion.css`: short durations, one easing curve, triggered by entering, pressing, opening or loading — never by hover. Wrap anything that should animate in on scroll with `<Reveal>` (or use `Masonry`/`TileGrid`, which do it for you).
- Everything respects `prefers-reduced-motion`.
- AI activity is shown with Thinking Orbs, only through `components/ui/AgentOrb.jsx`, which is the single import point for the library. A working orb is accent-purple (DESIGN.md's colour for predictive/recommendation callouts), so purple always means "AI is working". A finished or idle orb holds still in ink. Orbs are never Pinterest Red, which stays reserved for CTAs.
- Anything that loads should show a skeleton shaped like what's coming (`Skeleton`, `SkeletonText`, `SkeletonScreen`).
