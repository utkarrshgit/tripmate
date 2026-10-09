import { List, P } from "../blocks";

/*
 * Privacy Policy content. Text in [square brackets] is a placeholder to replace
 * before launch. Each section needs a unique `id` (used as its anchor). Sections sharing a
 * `group` are listed together under that heading in the contents menu; the rest stand alone.
 */
export default {
  title: "Privacy Policy",
  updated: "[effective date]",
  intro: "This policy explains what information TripMate collects when you plan trips, how we use it, who we share it with, and the choices you have.",
  related: { to: "/terms", label: "Terms and Conditions" },
  sections: [
    {
      id: "who-we-are",
      title: "Who we are",
      body: (
        <P>
          TripMate is operated by [Company name], [registered address]. In this policy, “we,” “us,” and “our” mean
          [Company name]. If you have any questions about your personal data, contact us at [privacy contact email].
        </P>
      ),
    },
    {
      id: "what-we-collect",
      group: "Your information",
      title: "What we collect",
      body: (
        <>
          <P>We only collect what we need to plan and save your trips:</P>
          <List
            items={[
              "Trip requests — the text you type to describe a trip, like the destination, dates, group size, budget, and interests.",
              "Account details — your name and email address, if you create an account.",
              "Saved trips — the plans you choose to save to your account.",
              "Technical information — basic logs, like request times and errors,, used to keep the service running.",
            ]}
          />
          <P>Please do not include sensitive personal information, like health details or ID numbers, in trip requests.</P>
        </>
      ),
    },
    {
      id: "how-we-use",
      group: "Your information",
      title: "How we use your information",
      body: (
        <List
          items={[
            "To read your trip request and produce a plan with estimated costs.",
            "To save, show, and let you manage your trips when you have an account.",
            "To keep TripMate secure, fix problems, and understand how it is used so we can improve it.",
            "To contact you about your account or important changes to the service.",
          ]}
        />
      ),
    },
    {
      id: "automated-planning",
      group: "Your information",
      title: "Automated planning and AI",
      body: (
        <>
          <P>
            Your trip request is processed automatically by a series of software planners. Some of these may use an AI
            language model. [Describe where the model runs — for example, on our own servers or through a named
            third-party provider — and whether requests are retained by that provider.]
          </P>
          <P>Plans are estimates generated automatically. No one at TripMate reads your request unless you contact us for support.</P>
        </>
      ),
    },
    {
      id: "sharing",
      group: "Your information",
      title: "Who we share it with",
      body: (
        <>
          <P>We do not sell your personal data. We share it only with service providers who help us run TripMate, like:</P>
          <List
            items={[
              "Hosting and infrastructure providers that store and serve the app.",
              "AI model providers, if requests are processed outside our own servers.",
              "Travel data providers, when we add live prices and availability in the future.",
            ]}
          />
          <P>We may also disclose information when the law requires it. [List current providers and their locations.]</P>
        </>
      ),
    },
    {
      id: "storage",
      group: "Your information",
      title: "How long we keep it",
      body: (
        <P>
          We keep your account and saved trips until you delete them or close your account. Trip requests made without an
          account are kept for [retention period] for troubleshooting, then deleted. Logs are kept for [log retention
          period].
        </P>
      ),
    },
    {
      id: "cookies",
      group: "Your information",
      title: "Cookies and local storage",
      body: (
        <P>
          TripMate uses your browser's storage to keep you logged in and to remember your most recent plan. We do not
          use advertising cookies. [Update this section if analytics or other cookies are added.]
        </P>
      ),
    },
    {
      id: "your-rights",
      group: "Your rights and safety",
      title: "Your rights",
      body: (
        <>
          <P>
            Depending on where you live — including under India's Digital Personal Data Protection Act, 2023 — you can:
          </P>
          <List
            items={[
              "Access a copy of your data. You can download it any time in Account.",
              "Correct your name or email in Account.",
              "Delete your account and saved trips in Account.",
              "Withdraw consent and raise a grievance with us at [grievance officer contact].",
            ]}
          />
        </>
      ),
    },
    {
      id: "children",
      group: "Your rights and safety",
      title: "Children",
      body: (
        <P>
          TripMate is not intended for children under [18]. We do not knowingly collect personal data from children. If
          you believe a child has given us their data, contact us and we will delete it.
        </P>
      ),
    },
    {
      id: "security",
      group: "Your rights and safety",
      title: "Security",
      body: (
        <P>
          We use reasonable technical and organizational measures to protect your data. No online service is completely
          secure, so please protect access to your email account and tell us right away if you suspect misuse of your account.
        </P>
      ),
    },
    {
      id: "changes",
      title: "Changes to this policy",
      body: (
        <P>
          We will update this page when our practices change and update the date at the top of this page. If the changes are
          significant, we will tell you by email or in the app before they take effect.
        </P>
      ),
    },
  ],
};
