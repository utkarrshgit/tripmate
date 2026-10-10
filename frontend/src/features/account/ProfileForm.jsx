import { useId, useState } from "react";
import { Button, Modal, StatusPill, TextField } from "@/components/ui";
import { CodeStep, validateAccount } from "@/features/auth";
import { requestEmailChange, resendCode } from "@/state/authApi";
import { useSession } from "@/state/session";

/** Confirms a new email address with the code sent to it. */
function EmailCodeModal({ pending, onClose, onDone }) {
  const { confirmEmailChange } = useSession();
  const titleId = useId();
  return (
    <Modal onClose={onClose} labelledBy={titleId}>
      {({ close }) => (
        <div className="stack-lg">
          <h2 id={titleId} className="t-heading-lg modal-title">
            Check your email
          </h2>
          <CodeStep
            email={pending.email}
            intro={`Enter the 6-digit code we sent to ${pending.email} to use it for your account.`}
            resendAt={pending.resendAt}
            devCode={pending.devCode}
            submitLabel="Update email"
            successMessage="Email updated."
            onVerify={(code) => confirmEmailChange({ newEmail: pending.email, code })}
            onResend={() => resendCode({ email: pending.email, purpose: "change_email" })}
            onVerified={() => {
              onDone();
              close();
            }}
          />
        </div>
      )}
    </Modal>
  );
}

export default function ProfileForm() {
  const { user, updateName } = useSession();
  const [values, setValues] = useState({ name: user.name, email: user.email });
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingEmail, setPendingEmail] = useState(null); // { email, resendAt, devCode } while a code is out
  const nameChanged = values.name.trim() !== user.name;
  const emailChanged = values.email.trim().toLowerCase() !== user.email;
  const dirty = nameChanged || emailChanged;
  const set = (field) => (e) => {
    setSaved(false);
    setValues((v) => ({ ...v, [field]: e.target.value }));
  };

  async function submit(e) {
    e.preventDefault();
    const next = validateAccount(values);
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      if (nameChanged) await updateName(values.name);
      if (emailChanged) setPendingEmail(await requestEmailChange({ currentEmail: user.email, newEmail: values.email }));
      else setSaved(true);
    } catch (err) {
      setErrors(err.field ? { [err.field]: err.message } : { form: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form className="stack-lg" onSubmit={submit} noValidate>
        <TextField label="Name" value={values.name} onChange={set("name")} autoComplete="name" error={errors.name} />
        <TextField
          label="Email"
          type="email"
          value={values.email}
          onChange={set("email")}
          autoComplete="email"
          help={emailChanged ? "We'll send a code to the new address to confirm it." : undefined}
          error={errors.email}
        />
        {errors.form && (
          <p className="field-error swap-in" role="alert">
            {errors.form}
          </p>
        )}
        <div className="row">
          <Button type="submit" variant="primary" disabled={!dirty || busy}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
          {saved && !dirty && (
            <StatusPill tone="success" icon="check" role="status" className="swap-in">
              Saved
            </StatusPill>
          )}
        </div>
      </form>
      {pendingEmail && (
        <EmailCodeModal
          pending={pendingEmail}
          onClose={() => setPendingEmail(null)}
          onDone={() => {
            setValues((v) => ({ ...v, email: pendingEmail.email }));
            setSaved(true);
          }}
        />
      )}
    </>
  );
}
