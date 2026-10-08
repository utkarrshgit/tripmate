import { Link } from "react-router-dom";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useSession } from "@/state/session";
import { FOOTER_COLUMNS, visibleTo } from "./navLinks";
import Wordmark from "./Wordmark";
import "./Footer.css";

function FooterLink({ link, openAuth }) {
  if (link.action) {
    return (
      <button type="button" className="footer-link-btn" onClick={() => openAuth(link.action)}>
        {link.label}
      </button>
    );
  }
  if (link.href) return <a href={link.href}>{link.label}</a>;
  return <Link to={link.to}>{link.label}</Link>;
}

// 4-up columns on desktop, 2-up on tablet, tap-to-expand accordion on mobile.
function Column({ title, accordion, children }) {
  const list = <ul className="stack-sm footer-col-list">{children}</ul>;
  if (!accordion) {
    return (
      <div className="footer-col">
        <h2 className="footer-col-title">{title}</h2>
        {list}
      </div>
    );
  }
  return (
    <details className="footer-col">
      <summary className="footer-col-title">{title}</summary>
      {list}
    </details>
  );
}

export default function Footer() {
  const { user, openAuth } = useSession();
  const accordion = useMediaQuery("(max-width: 480px)");
  const show = visibleTo(user);

  return (
    <footer className="footer-section no-print">
      <div className="container">
        <div className="footer-grid">
          {FOOTER_COLUMNS.map((col) => (
            <Column key={col.title} title={col.title} accordion={accordion}>
              {col.links.filter(show).map((link) => (
                <li key={link.label}>
                  <FooterLink link={link} openAuth={openAuth} />
                </li>
              ))}
            </Column>
          ))}
          <Column title="Good to know" accordion={accordion}>
            <li>
              Every price on TripMate is an estimate to help you plan. Check real fares, rates and availability before you
              book.
            </li>
          </Column>
        </div>
        <div className="footer-bottom">
          <Wordmark />
          <span className="t-caption-sm">© {new Date().getFullYear()} TripMate</span>
        </div>
      </div>
    </footer>
  );
}
