import { Suspense, useEffect } from "react";
import { Route, Routes, matchRoutes, useLocation } from "react-router-dom";
import Footer from "@/components/layout/Footer";
import Nav from "@/components/layout/Nav";
import { AuthModal } from "@/features/auth";
import { ROUTES, documentTitle } from "./routes";
import "./app.css";

/** Sets the document title and handles scroll position on navigation. */
function useRouteEffects() {
  const location = useLocation();
  const { pathname, hash } = location;

  useEffect(() => {
    const [match] = matchRoutes(ROUTES, location) ?? [];
    document.title = match ? documentTitle(match.route) : "TripMate";
    if (hash) {
      // Wait a frame so a lazily loaded page has rendered its anchor.
      requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" }));
    } else {
      window.scrollTo(0, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, hash]);
}

export default function Layout() {
  const { pathname } = useLocation();
  useRouteEffects();

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Nav />
      <main id="main">
        {/* Keyed by path so each page plays the enter transition */}
        <div key={pathname} className="page-enter">
          <Routes>
            {ROUTES.map(({ path, page: Page, skeleton: Fallback }) => (
              <Route
                key={path}
                path={path}
                element={
                  <Suspense fallback={<Fallback />}>
                    <Page />
                  </Suspense>
                }
              />
            ))}
          </Routes>
        </div>
      </main>
      <Footer />
      <AuthModal />
    </>
  );
}
