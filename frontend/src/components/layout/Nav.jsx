import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Button, IconButton } from "@/components/ui";
import { useSession } from "@/state/session";
import { cx } from "@/utils/cx";
import AccountMenu from "./AccountMenu";
import { DRAWER_LINKS, PRIMARY_LINKS, SECONDARY_LINKS, visibleTo } from "./navLinks";
import PlannerSearch from "./PlannerSearch";
import Wordmark from "./Wordmark";
import "./Nav.css";

// Pages that are themselves the planner don't need the nav's search bar.
const HIDE_SEARCH_ON = ["/plan"];

/** Route links get the active-tab marker; in-page anchors ("/#…") never do. */
function TabLink({ link }) {
  const Component = link.to.includes("#") ? Link : NavLink;
  return (
    <Component to={link.to} className="nav-link nav-desktop">
      {link.label}
    </Component>
  );
}

export default function Nav() {
  const { user, openAuth } = useSession();
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const showSearch = !HIDE_SEARCH_ON.includes(pathname);
  const show = visibleTo(user);

  useEffect(() => {
    setDrawerOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  return (
    <header className={cx("primary-nav", pathname !== "/" && "has-rule")}>
      <div className="primary-nav-inner">
        <IconButton
          icon={drawerOpen ? "close" : "menu"}
          label={drawerOpen ? "Close menu" : "Open menu"}
          aria-expanded={drawerOpen}
          aria-controls="nav-drawer"
          className="nav-mobile"
          onClick={() => setDrawerOpen((o) => !o)}
        />

        <div className="nav-left">
          <Link to="/" aria-label="TripMate home">
            <Wordmark />
          </Link>
          {PRIMARY_LINKS.map((link) => (
            <TabLink key={link.to} link={link} />
          ))}
        </div>

        {showSearch && (
          <div className="nav-center">
            <PlannerSearch className="nav-search" />
          </div>
        )}

        <div className="nav-right">
          {showSearch && (
            <IconButton
              icon={searchOpen ? "close" : "search"}
              label={searchOpen ? "Close trip search" : "Search for a trip"}
              aria-expanded={searchOpen}
              className="nav-mobile"
              onClick={() => setSearchOpen((o) => !o)}
            />
          )}
          {SECONDARY_LINKS.filter(show).map((link) => (
            <TabLink key={link.to} link={link} />
          ))}
          {user ? (
            <AccountMenu />
          ) : (
            <>
              <Button variant="tertiary" className="nav-desktop" onClick={() => openAuth("login")}>
                Log in
              </Button>
              {/* DESIGN.md: the red Sign-up CTA stays visible at every breakpoint */}
              <Button variant="primary" onClick={() => openAuth("signup")}>
                Sign up
              </Button>
            </>
          )}
        </div>
      </div>

      {searchOpen && (
        <div className="nav-search-overlay">
          <PlannerSearch autoFocus onSubmitted={() => setSearchOpen(false)} className="nav-search" />
        </div>
      )}

      {drawerOpen && (
        <nav id="nav-drawer" className="nav-drawer" aria-label="Main">
          <ul className="divided">
            {DRAWER_LINKS.filter(show).map((link, i) => (
              <li key={link.to} style={{ "--i": i }}>
                <Link to={link.to} className="drawer-link">
                  {link.label}
                </Link>
              </li>
            ))}
            {!user && (
              <li style={{ "--i": DRAWER_LINKS.length }}>
                <button type="button" className="drawer-link" onClick={() => openAuth("login")}>
                  Log in
                </button>
              </li>
            )}
          </ul>
        </nav>
      )}
    </header>
  );
}
