import { BrowserRouter } from "react-router-dom";
import { SessionProvider } from "@/state/session";
import Layout from "./Layout";

/** Providers wrap the layout here; add new app-wide providers in this file. */
export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <Layout />
      </SessionProvider>
    </BrowserRouter>
  );
}
