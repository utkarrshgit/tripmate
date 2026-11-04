import { useState } from "react";
import { Button, StatusPill } from "@/components/ui";
import { PASSWORD_MIN, PasswordField, validateNewPassword } from "@/features/auth";
import { useSession } from "@/state/session";

/** Change password: current, then new. Every other device is signed out. */
export default function PasswordForm() {
  const { user, changePassword } = useSession();
  const [values, setValues] = useState({ current: "", next: "" });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (field) => (e) => {
    setDone(false);
    setValues((v) => ({ ...v, [field]: e.target.value }));
  };

  async function submit(e) {
    e.preventDefault();
    const next = {};
    if (!values.current) next.current = "Enter your current password.";
    const problem = validateNewPassword(values.next, user.email);
    if (problem) next.next = problem;
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await changePassword({ currentPassword: values.current, newPassword: values.next });
      setValues({ current: "", next: "" });
      setDone(true);
    } catch (err) {
      // The API names the fields current_password / new_password; "password" means the current one.
      const field = { password: "current", current_password: "current", new_password: "next" }[err.field];
      setErrors(field ? { [field]: err.message } : { form: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack-lg" onSubmit={submit} noValidate>
      <PasswordField label="Current password" value={values.current} onChange={set("current")} autoComplete="current-password" error={errors.current} />
      <PasswordField
        label="New password"
        value={values.next}
        onChange={set("next")}
        autoComplete="new-password"
        help={`Use at least ${PASSWORD_MIN} characters.`}
        error={errors.next}
      />
      {errors.form && (
        <p className="field-error swap-in" role="alert">
          {errors.form}
        </p>
      )}
      <div className="row">
        <Button type="submit" variant="primary" disabled={busy || !values.current || !values.next}>
          {busy ? "Changing…" : "Change password"}
        </Button>
        {done && (
          <StatusPill tone="success" icon="check" role="status" className="swap-in">
            Password changed. Other devices are signed out.
          </StatusPill>
        )}
      </div>
    </form>
  );
}
