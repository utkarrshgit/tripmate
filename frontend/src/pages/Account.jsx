import { Avatar, Section } from "@/components/ui";
import { DataControls, ProfileForm } from "@/features/account";
import { SignedOutPrompt } from "@/features/auth";
import { useSession } from "@/state/session";
import { formatDate, plural } from "@/utils/format";

export default function Account() {
  const { user, trips } = useSession();
  if (!user) return <SignedOutPrompt title="Your account" body="Log in to manage your details and data." />;

  return (
    <div className="container container-narrow section">
      <div className="account-head">
        <Avatar name={user.name} size="lg" />
        <div>
          <h1 className="t-heading-xl">{user.name}</h1>
          <p className="t-body-sm c-mute">
            Member since {formatDate(user.createdAt)} · {plural(trips.length, "saved trip")}
          </p>
        </div>
      </div>
      <Section title="Profile" intro="The name and email on your account." headingClass="t-heading-lg">
        <ProfileForm />
      </Section>
      <Section title="Your data" headingClass="t-heading-lg">
        <DataControls />
      </Section>
    </div>
  );
}
