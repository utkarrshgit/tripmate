import { List, P } from "../blocks";

/*
 * Terms and Conditions content. Text in [square brackets] is a placeholder to replace
 * before launch. Each section needs a unique `id` (used as its anchor).
 */
export default {
  title: "Terms and Conditions",
  updated: "[effective date]",
  intro: "These terms set out the rules for using TripMate. By using the service or creating an account, you agree to them.",
  related: { to: "/privacy", label: "Privacy Policy" },
  sections: [
    {
      id: "the-service",
      title: "What TripMate is",
      body: (
        <>
          <P>
            TripMate is a planning tool provided by [Company name]. You describe a trip and TripMate produces a suggested
            itinerary with estimated costs.
          </P>
          <P>
            TripMate is not a travel agent. We do not sell, book, or guarantee transport, accommodation, activities, or any other travel service.
          </P>
        </>
      ),
    },
    {
      id: "estimates",
      title: "Prices are estimates",
      body: (
        <P>
          Every cost shown on TripMate is an estimate meant to help you plan. Real fares, room rates, opening hours, and availability change often and may differ a lot from what we show. Always check with the provider before you book
          or pay for anything.
        </P>
      ),
    },
    {
      id: "automated-content",
      title: "Automatically generated plans",
      body: (
        <P>
          Plans are generated automatically and may be incomplete, out of date, or wrong — for example, a destination may be
          misread or an activity may not suit your group. Use your own judgment, check travel advisories and local rules,
          and do not rely on TripMate for safety, health, visa, or legal decisions.
        </P>
      ),
    },
    {
      id: "your-account",
      title: "Your account",
      body: (
        <List
          items={[
            "Give accurate details when you sign up, and keep your email up to date.",
            "You are responsible for activity on your account. Tell us right away if you think someone else has used it.",
            "You can delete your account at any time in Account.",
          ]}
        />
      ),
    },
    {
      id: "acceptable-use",
      title: "Acceptable use",
      body: (
        <>
          <P>When using TripMate, you agree not to:</P>
          <List
            items={[
              "Break any law, or use TripMate to plan anything unlawful.",
              "Submit content that is abusive, harmful, or that infringes someone else's rights.",
              "Scrape, overload, reverse engineer, or interfere with the service, or access it with automated tools without our permission.",
              "Include other people's personal information in requests without their permission.",
            ]}
          />
        </>
      ),
    },
    {
      id: "ip",
      title: "Intellectual property",
      body: (
        <P>
          TripMate's software, design, and branding belong to [Company name]. You may use the plans TripMate generates for
          your own personal travel planning. You keep ownership of the requests you write.
        </P>
      ),
    },
    {
      id: "liability",
      title: "Disclaimers and liability",
      body: (
        <>
          <P>
            TripMate is provided “as is”, without warranties of any kind. To the extent the law allows, [Company name] is
            not liable for any loss arising from your use of, or reliance on, TripMate's plans or estimates — including travel costs, missed bookings, or changed plans.
          </P>
          <P>[Set out any liability cap and the consumer rights that cannot be excluded under applicable law.]</P>
        </>
      ),
    },
    {
      id: "suspension",
      title: "Suspension and termination",
      body: (
        <P>
          We may suspend or close accounts that break these terms. We may also change or stop parts of the service. Where
          we can, we will give you notice first so you can download your saved trips.
        </P>
      ),
    },
    {
      id: "law",
      title: "Governing law and disputes",
      body: (
        <P>
          These terms are governed by the laws of [India]. Disputes will be handled by the courts of [city], unless the law
          where you live gives you the right to bring a claim elsewhere.
        </P>
      ),
    },
    {
      id: "changes",
      title: "Changes to these terms",
      body: (
        <P>
          We may update these terms from time to time. We will update the date at the top of this page and, for significant changes,
          let you know before they take effect. If you keep using TripMate after that, you accept the updated terms.
        </P>
      ),
    },
    {
      id: "contact",
      title: "Contact",
      body: <P>Questions about these terms? Write to us at [legal contact email].</P>,
    },
  ],
};
