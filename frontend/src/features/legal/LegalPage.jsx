import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Notice } from "@/components/ui";
import { cx } from "@/utils/cx";
import "./legal.css";

/** Tracks which section is currently being read, for the contents list. */
function useActiveSection(ids) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -60% 0px" },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [ids]);
  return active;
}

/**
 * Long-form legal document. `doc` is a content module from ./content:
 * { title, updated, intro, related, sections: [{ id, title, body }] }.
 */
export default function LegalPage({ doc }) {
  const ids = useMemo(() => doc.sections.map((s) => s.id), [doc]);
  const active = useActiveSection(ids);

  return (
    <div className="container section legal-page">
      <header className="legal-head stack-md">
        <p className="t-body-sm-strong c-mute">Legal</p>
        <h1 className="t-display-lg">{doc.title}</h1>
        <p className="t-body-sm c-mute">Last updated {doc.updated}</p>
        <p className="t-body-md c-body legal-intro">{doc.intro}</p>
        <Notice className="legal-draft no-print">
          <p className="t-body-sm">
            Draft for review. Text in [square brackets] is a placeholder, and this page should be checked by a legal
            professional before TripMate launches.
          </p>
        </Notice>
      </header>

      <div className="legal-layout">
        <nav className="legal-toc no-print" aria-label="On this page">
          <p className="t-body-sm-strong c-ink">On this page</p>
          <ol className="stack-xs">
            {doc.sections.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className={cx("legal-toc-link t-body-sm", active === s.id && "is-active")}
                  aria-current={active === s.id ? "location" : undefined}
                >
                  {i + 1}. {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="legal-body">
          {doc.sections.map((s, i) => (
            <section key={s.id} id={s.id} className="legal-section stack-md">
              <h2 className="t-heading-lg">
                {i + 1}. {s.title}
              </h2>
              {s.body}
            </section>
          ))}
          {doc.related && (
            <p className="t-body-md c-body legal-related">
              Read our{" "}
              <Link to={doc.related.to} className="link-inline">
                {doc.related.label}
              </Link>
              .
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
