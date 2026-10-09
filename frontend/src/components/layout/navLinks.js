/*
 * Navigation and footer links in one place. Add a page to the nav or footer
 * here; `auth` limits a link to signed-in ("user") or signed-out ("guest") visitors.
 */
export const PRIMARY_LINKS = [{ to: "/plan", label: "Plan a trip" }];

export const SECONDARY_LINKS = [
  { to: "/#how-it-works", label: "How it works", auth: "guest" },
  { to: "/trips", label: "Your trips", auth: "user" },
];

export const DRAWER_LINKS = [
  { to: "/plan", label: "Plan a trip" },
  { to: "/#how-it-works", label: "How it works" },
  { to: "/trips", label: "Your trips", auth: "user" },
  { to: "/account", label: "Account", auth: "user" },
  { to: "/privacy", label: "Privacy Policy" },
  { to: "/terms", label: "Terms and Conditions" },
];

export const FOOTER_COLUMNS = [
  {
    title: "Plan",
    links: [
      { to: "/plan", label: "Plan a trip" },
      { to: "/#how-it-works", label: "How it works" },
      { to: "/#destinations", label: "Destination ideas" },
    ],
  },
  {
    title: "Your account",
    links: [
      { to: "/trips", label: "Your trips", auth: "user" },
      { to: "/account", label: "Account", auth: "user" },
      { action: "signup", label: "Sign up", auth: "guest" },
      { action: "login", label: "Log in", auth: "guest" },
    ],
  },
  {
    title: "About",
    links: [
      { to: "/privacy", label: "Privacy Policy" },
      { to: "/terms", label: "Terms and Conditions" },
      { href: "mailto:hello@tripmate.example", label: "Email us" },
    ],
  },
];

export const visibleTo = (user) => (link) => !link.auth || (link.auth === "user" ? Boolean(user) : !user);
