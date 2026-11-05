import { Component } from "react";
import { Button, SystemPage } from "@/components/ui";

// A page whose code didn't download (often after an update while the tab was open).
const isLoadError = (error) => /dynamically imported module|Loading chunk|Importing a module script failed|error loading dynamically/i.test(String(error?.message ?? error));

/**
 * Catches anything that goes wrong while showing a page, so one broken part never blanks the
 * whole site. By default it shows a friendly page with Try again and Go home; `quiet` hides
 * the broken part (nav, footer, a window) and keeps the page; `app` (the outermost) shows a
 * bare message that can't itself fail.
 * Keyed by the address in Layout, so moving to another page starts fresh.
 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("TripMate couldn't show this page", error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const reload = () => window.location.reload();
    if (this.props.level === "quiet") return null; // a side part (nav, footer, a window): leave it out, keep the page


    if (this.props.level === "app") {
      return (
        <div style={{ padding: "48px 16px", maxWidth: 560, margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
          <h1 style={{ fontSize: 28 }}>Something went wrong</h1>
          <p>TripMate couldn't load. Reload the page to try again.</p>
          <button type="button" onClick={reload} style={{ padding: "10px 16px", borderRadius: 16, border: 0, background: "#e60023", color: "#fff", fontWeight: 600 }}>
            Reload
          </button>
        </div>
      );
    }

    const loadError = isLoadError(error);
    return (
      <SystemPage
        icon="alert"
        title={loadError ? "TripMate was updated" : "Something went wrong on this page"}
        actions={
          <>
            <Button variant="primary" onClick={loadError ? reload : () => this.setState({ error: null })}>
              {loadError ? "Reload" : "Try again"}
            </Button>
            <Button as="a" href="/">
              Go home
            </Button>
          </>
        }
      >
        <p className="t-body-md c-body">
          {loadError
            ? "Part of the site changed since this tab opened. Reload to get the latest version."
            : "The rest of TripMate still works. Try again, or go back to the home page. Your saved trips are safe."}
        </p>
      </SystemPage>
    );
  }
}
