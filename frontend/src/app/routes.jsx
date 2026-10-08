/*
 * Every page in the app. To add a page:
 *   1. create it in src/pages/
 *   2. add an entry here with its path, document title and loading skeleton
 *   3. link to it from components/layout/navLinks.js if it belongs in the nav or footer
 * Pages are code-split: each one downloads the first time it's visited.
 */
import { lazy } from "react";
import { ArticleSkeleton, FormSkeleton, GridSkeleton, HomeSkeleton, MessageSkeleton, TripSkeleton } from "./PageSkeletons";

export const ROUTES = [
  { path: "/", title: "TripMate — plan a trip in one sentence", page: lazy(() => import("@/pages/Home")), skeleton: HomeSkeleton },
  { path: "/plan", title: "Plan a trip", page: lazy(() => import("@/pages/Plan")), skeleton: FormSkeleton },
  { path: "/trip", title: "Your trip plan", page: lazy(() => import("@/pages/TripResult")), skeleton: TripSkeleton },
  { path: "/trip/prices", title: "Exact prices", page: lazy(() => import("@/pages/ExactPrices")), skeleton: FormSkeleton },
  { path: "/trips", title: "My trips", page: lazy(() => import("@/pages/MyTrips")), skeleton: GridSkeleton },
  { path: "/trips/:id", title: "Saved trip", page: lazy(() => import("@/pages/SavedTrip")), skeleton: TripSkeleton },
  { path: "/trips/:id/prices", title: "Exact prices", page: lazy(() => import("@/pages/ExactPrices")), skeleton: FormSkeleton },
  { path: "/account", title: "Account", page: lazy(() => import("@/pages/Account")), skeleton: FormSkeleton },
  { path: "/privacy", title: "Privacy Policy", page: lazy(() => import("@/pages/Privacy")), skeleton: ArticleSkeleton },
  { path: "/terms", title: "Terms and Conditions", page: lazy(() => import("@/pages/Terms")), skeleton: ArticleSkeleton },
  { path: "/unavailable", title: "Service unavailable", page: lazy(() => import("@/pages/ServiceUnavailable")), skeleton: MessageSkeleton },
  { path: "*", title: "Page not found", page: lazy(() => import("@/pages/NotFound")), skeleton: MessageSkeleton },
];

export const documentTitle = (route) => (route.path === "/" ? route.title : `${route.title} · TripMate`);
