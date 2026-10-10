import { useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Wordmark from "@/components/layout/Wordmark";
import { Button, Modal, TextField } from "@/components/ui";
import { checkResetCode, requestPasswordReset, resendCode } from "@/state/authApi";
import { useSession } from "@/state/session";
import CodeStep from "./CodeStep";
import PasswordField from "./PasswordField";
import { PASSWORD_MIN, validateAccount, validateEmail, validateNewPassword } from "./validation";

/** Runs an async submit, collecting { field: message } errors from validation or the API. */
function useSubmit() {
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  async function run(validationErrors, action) {
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) return;
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setErrors(err.field ? { [err.field]: err.message } : { form: err.message });
    } finally {
      setBusy(false);
    }
  }
  return { errors, setErrors, busy, run };
}

const FormError = ({ message }) =>
  message ? (
    <p className="field-error swap-in" role="alert">
      {message}
    </p>
  ) : null;

function Head({ titleId, title, body }) {
  return (
    <div className="auth-head stack-sm">
      <Wordmark />
      <h2 id={titleId} className="t-heading-lg">
        {title}
      </h2>
      {body && <p className="t-body-md c-body">{body}</p>}
    </div>
  );
}

function SignUpStep({ titleId, initial, closeModal }) {
  const { signUp, goToStep } = useSession();
  const [values, setValues] = useState({ name: initial?.name ?? "", email: initial?.email ?? "", password: "" });
  const { errors, busy, run } = useSubmit();
  const set = (field) => (e) => setValues((v) => ({ ...v, [field]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    run(validateAccount(values, { newPassword: true }), async () => {
      const sent = await signUp(values);
      goToStep("code", { ...sent, name: values.name });
    });
  };

  return (
    <>
      <Head titleId={titleId} title="Welcome to TripMate" body="Create an account to save your trips." />
      <form className="stack-lg" onSubmit={submit} noValidate>
        <TextField label="Name" value={values.name} onChange={set("name")} autoComplete="name" error={errors.name} autoFocus />
        <TextField label="Email" type="email" value={values.email} onChange={set("email")} autoComplete="email" error={errors.email} />
        <PasswordField
          value={values.password}
          onChange={set("password")}
          autoComplete="new-password"
          help={`Use at least ${PASSWORD_MIN} characters.`}
          error={errors.password}
        />
        <FormError message={errors.form} />
        <Button type="submit" variant="primary" block disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="t-caption-sm c-mute auth-legal">
        By creating an account, you agree to TripMate's{" "}
        <Link to="/terms" className="link-inline" onClick={closeModal}>
          Terms and Conditions
        </Link>{" "}
        and acknowledge our{" "}
        <Link to="/privacy" className="link-inline" onClick={closeModal}>
          Privacy Policy
        </Link>
        .
      </p>
      <p className="t-body-sm c-body auth-switch">
        Already a member?{" "}
        <button type="button" className="link-inline link-button" onClick={() => goToStep("login", { email: values.email })}>
          Log in
        </button>
      </p>
    </>
  );
}

function LogInStep({ titleId, initial }) {
  const { logIn, goToStep, finishAuth } = useSession();
  const [values, setValues] = useState({ email: initial?.email ?? "", password: "" });
  const { errors, busy, run } = useSubmit();
  const set = (field) => (e) => setValues((v) => ({ ...v, [field]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    run(validateAccount(values, { requireName: false, requirePassword: true }), async () => {
      const result = await logIn(values);
      if (result.verify) goToStep("code", { ...result.verify, fromLogin: true });
      else finishAuth();
    });
  };

  return (
    <>
      <Head titleId={titleId} title="Welcome back" body="Log in to view your saved trips." />
      <form className="stack-lg" onSubmit={submit} noValidate>
        <TextField label="Email" type="email" value={values.email} onChange={set("email")} autoComplete="email" error={errors.email} autoFocus />
        <div className="stack-sm">
          <PasswordField value={values.password} onChange={set("password")} autoComplete="current-password" error={errors.password} />
          <button type="button" className="link-inline link-button t-body-sm auth-forgot" onClick={() => goToStep("forgot", { email: values.email })}>
            Forgot password?
          </button>
        </div>
        <FormError message={errors.form} />
        <Button type="submit" variant="primary" block disabled={busy}>
          {busy ? "Logging in…" : "Log in"}
        </Button>
      </form>
      <p className="t-body-sm c-body auth-switch">
        New to TripMate?{" "}
        <button type="button" className="link-inline link-button" onClick={() => goToStep("signup", { email: values.email })}>
          Sign up
        </button>
      </p>
    </>
  );
}

function ForgotStep({ titleId, initial }) {
  const { goToStep } = useSession();
  const [email, setEmail] = useState(initial?.email ?? "");
  const { errors, busy, run } = useSubmit();

  const submit = (e) => {
    e.preventDefault();
    const message = validateEmail(email);
    run(message ? { email: message } : {}, async () => {
      const sent = await requestPasswordReset({ email });
      goToStep("code", sent);
    });
  };

  return (
    <>
      <Head titleId={titleId} title="Reset your password" body="Enter your email and we'll send you a 6-digit code." />
      <form className="stack-lg" onSubmit={submit} noValidate>
        <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" error={errors.email} autoFocus />
        <FormError message={errors.form} />
        <Button type="submit" variant="primary" block disabled={busy}>
          {busy ? "Sending…" : "Send code"}
        </Button>
      </form>
      <p className="t-body-sm c-body auth-switch">
        Remembered it?{" "}
        <button type="button" className="link-inline link-button" onClick={() => goToStep("login", { email })}>
          Log in
        </button>
      </p>
    </>
  );
}

// What the code step says, by why the code was sent.
const CODE_COPY = {
  verify_email: {
    intro: (email) => `Enter the 6-digit code we sent to ${email}. It expires in 10 minutes.`,
    introFromLogin: (email) => `Verify your email to log in. We sent a 6-digit code to ${email}.`,
    success: "Email verified. You're signed in.",
    submit: "Verify email",
  },
  reset_password: {
    intro: (email) => `If an account uses ${email}, we sent a 6-digit code to it. It expires in 10 minutes.`,
    success: "Code accepted.",
    submit: "Continue",
  },
};

function CodeStepView({ titleId, details }) {
  const { verifyEmail, goToStep, finishAuth } = useSession();
  const { email, purpose } = details;
  const copy = CODE_COPY[purpose];
  const isReset = purpose === "reset_password";
  const accepted = useRef(null); // the reset code, carried to the new-password step

  return (
    <>
      <Head titleId={titleId} title="Check your email" />
      <CodeStep
        email={email}
        intro={details.fromLogin ? copy.introFromLogin(email) : copy.intro(email)}
        resendAt={details.resendAt}
        devCode={details.devCode}
        submitLabel={copy.submit}
        successMessage={copy.success}
        onVerify={async (code) => {
          if (isReset) {
            await checkResetCode({ email, code });
            accepted.current = code;
          } else {
            await verifyEmail({ email, code });
          }
        }}
        onVerified={() => (isReset ? goToStep("newPassword", { email, code: accepted.current }) : finishAuth())}
        onResend={() => resendCode({ email, purpose })}
        onChangeEmail={() => goToStep(isReset ? "forgot" : "signup", { email, name: details.name })}
      />
    </>
  );
}

function NewPasswordStep({ titleId, details }) {
  const { resetPassword, finishAuth, goToStep } = useSession();
  const [password, setPassword] = useState("");
  const { errors, busy, run } = useSubmit();

  const submit = (e) => {
    e.preventDefault();
    const message = validateNewPassword(password, details.email);
    run(message ? { password: message } : {}, async () => {
      try {
        await resetPassword({ email: details.email, code: details.code, password });
        finishAuth();
      } catch (err) {
        // The code has expired or been used up since it was checked: start the reset again.
        if (err.field === "code") goToStep("forgot", { email: details.email });
        throw err;
      }
    });
  };

  return (
    <>
      <Head titleId={titleId} title="Create a new password" body={`For ${details.email}. You'll be signed in when you save it.`} />
      <form className="stack-lg" onSubmit={submit} noValidate>
        <PasswordField
          label="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          help={`Use at least ${PASSWORD_MIN} characters.`}
          error={errors.password}
          autoFocus
        />
        <FormError message={errors.form} />
        <Button type="submit" variant="primary" block disabled={busy}>
          {busy ? "Saving…" : "Save password"}
        </Button>
      </form>
    </>
  );
}

const STEPS = { signup: SignUpStep, login: LogInStep, forgot: ForgotStep, code: CodeStepView, newPassword: NewPasswordStep };

/**
 * The sign-up and log-in window. Opened from anywhere with
 * useSession().openAuth("signup" | "login", { then }) — `then` runs once signed in.
 */
export default function AuthModal() {
  const { authModal, closeAuth } = useSession();
  const titleId = useId();
  if (!authModal) return null;
  const { step, ...details } = authModal;
  const Step = STEPS[step] ?? SignUpStep;
  return (
    <Modal onClose={closeAuth} labelledBy={titleId}>
      {({ close }) => (
        // Keyed by step so each one starts fresh and plays the enter animation.
        <div className="auth-modal" key={`${step}-${details.email ?? ""}`}>
          <Step titleId={titleId} details={details} initial={details} closeModal={close} />
        </div>
      )}
    </Modal>
  );
}
