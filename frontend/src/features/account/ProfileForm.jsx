import { useState } from "react";
import { Button, StatusPill, TextField } from "@/components/ui";
import { validateAccount } from "@/features/auth";
import { useSession } from "@/state/session";

export default function ProfileForm() {
  const { user, updateProfile } = useSession();
  const [values, setValues] = useState({ name: user.name, email: user.email });
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(false);
  const dirty = values.name.trim() !== user.name || values.email.trim().toLowerCase() !== user.email;
  const set = (field) => (e) => {
    setSaved(false);
    setValues((v) => ({ ...v, [field]: e.target.value }));
  };

  function submit(e) {
    e.preventDefault();
    const next = validateAccount(values);
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      updateProfile(values);
      setSaved(true);
    } catch (err) {
      setErrors({ form: err.message });
    }
  }

  return (
    <form className="stack-lg" onSubmit={submit} noValidate>
      <TextField label="Name" value={values.name} onChange={set("name")} autoComplete="name" error={errors.name} />
      <TextField label="Email" type="email" value={values.email} onChange={set("email")} autoComplete="email" error={errors.email} />
      {errors.form && (
        <p className="field-error swap-in" role="alert">
          {errors.form}
        </p>
      )}
      <div className="row">
        <Button type="submit" variant="primary" disabled={!dirty}>
          Save changes
        </Button>
        {saved && !dirty && (
          <StatusPill tone="success" icon="check" role="status" className="swap-in">
            Saved
          </StatusPill>
        )}
      </div>
    </form>
  );
}
