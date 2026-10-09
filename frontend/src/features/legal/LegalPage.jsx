import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BranchedMenu, Notice } from "@/components/ui";
import "./legal.css";

/** Tracks which section is being read. Returns [active, setActive] so a click can move it straight away. */
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
  return [active, setActive];
}

/**
 * Contents menu items: consecutive sections that share a `group` become one folding
 * branch; the rest are single rows. Numbers match the section headings.
 */
function menuItems(sections) {
  const items = [];
  sections.forEach((s, i) => {
    const row = { value: s.id, label: `${i + 1}. ${s.title}` };
    const last = items.at(-1);
    if (!s.group) items.push(row);
    else if (last?.children && last.label === s.group) last.children.push(row);
    else items.push({ label: s.group, children: [row] });
  });
  return items;
}

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  window.history.replaceState(window.history.state, "", `#${id}`);
}

/**
 * Long-form legal document. `doc` is a content module from ./content:
 * { title, updated, intro, related, sections: [{ id, title, body }] }.
 */
export default function LegalPage({ doc }) {
  const ids = useMemo(() => doc.sections.map((s) => s.id), [doc]);
  const [active, setActive] = useActiveSection(ids);
  const items = useMemo(() => menuItems(doc.sections), [doc]);
  // Every group starts open, so the whole document and its branches show at a glance.
  const allGroups = useMemo(() => items.flatMap((item, i) => (item.children ? [i] : [])), [items]);
  const tocRef = useRef(null);

  // When the menu is taller than the screen, keep the section being read in view inside it
  // (scrolling only the menu, never the page).
  useEffect(() => {
    const toc = tocRef.current;
    const row = toc?.querySelector(`[data-active]`);
    if (!toc || !row || toc.scrollHeight <= toc.clientHeight) return;
    const top = row.getBoundingClientRect().top - toc.getBoundingClientRect().top + toc.scrollTop;
    if (top < toc.scrollTop || top + row.offsetHeight > toc.scrollTop + toc.clientHeight) {
      toc.scrollTo({ top: top - toc.clientHeight / 2, behavior: "smooth" });
    }
  }, [active]);

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
        <div ref={tocRef} className="legal-toc no-print">
          <p className="t-body-sm-strong c-ink">On this page</p>
          <BranchedMenu
            key={doc.title}
            label="On this page"
            items={items}
            active={active}
            defaultOpen={allGroups}
            onSelect={(id) => {
              setActive(id); // highlight now; the observer keeps it in step as the page scrolls
              scrollToSection(id);
            }}
            width={280}
            rowHeight={34}
            indent={36}
            className="legal-menu"
          />
        </div>

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
