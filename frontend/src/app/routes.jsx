/*
 * Every page in the app. To add a page:
 *   1. create it in src/pages/
 *   2. add an entry here with its path and loading skeleton, and its title and search
 *      details in config/seo.js
 *   3. link to it from components/layout/navLinks.js if it belongs in the nav or footer
 * Pages are code-split: each one downloads the first time it's visited.
 */
import { lazy } from "react";
import { ArticleSkeleton, FormSkeleton, GridSkeleton, HomeSkeleton, MessageSkeleton, TripSkeleton } from "./PageSkeletons";

export const ROUTES = [
  { path: "/", page: lazy(() => import("@/pages/Home")), skeleton: HomeSkeleton },
  { path: "/plan", page: lazy(() => import("@/pages/Plan")), skeleton: FormSkeleton },
  { path: "/trip", page: lazy(() => import("@/pages/TripResult")), skeleton: TripSkeleton },
  { path: "/trip/prices", page: lazy(() => import("@/pages/ExactPrices")), skeleton: FormSkeleton },
  { path: "/trips", page: lazy(() => import("@/pages/MyTrips")), skeleton: GridSkeleton },
  { path: "/trips/:id", page: lazy(() => import("@/pages/SavedTrip")), skeleton: TripSkeleton },
  { path: "/trips/:id/prices", page: lazy(() => import("@/pages/ExactPrices")), skeleton: FormSkeleton },
  { path: "/account", page: lazy(() => import("@/pages/Account")), skeleton: FormSkeleton },
  { path: "/privacy", page: lazy(() => import("@/pages/Privacy")), skeleton: ArticleSkeleton },
  { path: "/terms", page: lazy(() => import("@/pages/Terms")), skeleton: ArticleSkeleton },
  { path: "/unavailable", page: lazy(() => import("@/pages/ServiceUnavailable")), skeleton: MessageSkeleton },
  { path: "*", page: lazy(() => import("@/pages/NotFound")), skeleton: MessageSkeleton },
];

