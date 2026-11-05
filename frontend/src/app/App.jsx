import { BrowserRouter } from "react-router-dom";
import { SessionProvider } from "@/state/session";
import ErrorBoundary from "./ErrorBoundary";
import Layout from "./Layout";

/** Providers wrap the layout here; add new app-wide providers in this file. */
export default function App() {
  return (
    <ErrorBoundary level="app">
      <BrowserRouter>
        <SessionProvider>
          <Layout />
        </SessionProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
