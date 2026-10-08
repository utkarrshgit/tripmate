import { Button, SystemPage } from "@/components/ui";
import { useSession } from "@/state/session";

/** Shown in place of a page that needs an account. */
export default function SignedOutPrompt({ title, body }) {
  const { openAuth } = useSession();
  return (
    <SystemPage icon="bookmark" title={title} actions={<Button onClick={() => openAuth("login")}>Log in</Button>}>
      <p className="t-body-md c-body">{body}</p>
    </SystemPage>
  );
}
