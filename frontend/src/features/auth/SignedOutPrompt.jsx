import { MessageSkeleton } from "@/app/PageSkeletons";
import { Button, SystemPage } from "@/components/ui";
import { useSession } from "@/state/session";

/** Shown in place of a page that needs an account. Waits quietly while the API checks the session. */
export default function SignedOutPrompt({ title, body }) {
  const { ready, openAuth } = useSession();
  if (!ready) return <MessageSkeleton />;
  return (
    <SystemPage icon="bookmark" title={title} actions={<Button onClick={() => openAuth("login")}>Log in</Button>}>
      <p className="t-body-md c-body">{body}</p>
    </SystemPage>
  );
}
