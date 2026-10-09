import { useState } from "react";
import { Link } from "react-router-dom";
import Wordmark from "@/components/layout/Wordmark";
import { Button, Modal, TextField } from "@/components/ui";
import { useSession } from "@/state/session";
import { validateAccount } from "./validation";

const COPY = {
  signup: {
    title: "Welcome to TripMate",
    body: "Create an account to save your trips.",
    switchPrompt: "Already a member?",
    switchTo: "login",
    switchLabel: "Log in",
  },
  login: {
    title: "Welcome back",
    body: "Log in to view your saved trips.",
    switchPrompt: "New to TripMate?",
    switchTo: "signup",
    switchLabel: "Sign up",
  },
};

function AuthForm({ mode, closeModal }) {
  const { openAuth, signUp, logIn } = useSession();
  const [values, setValues] = useState({ name: "", email: "" });
  const [errors, setErrors] = useState({});
  const isSignup = mode === "signup";
  const copy = COPY[mode];
  const set = (field) => (e) => setValues((v) => ({ ...v, [field]: e.target.value }));

  function submit(e) {
    e.preventDefault();
    const next = validateAccount(values, { requireName: isSignup });
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      if (isSignup) signUp(values);
      else logIn(values);
    } catch (err) {
      setErrors({ form: err.message });
    }
  }

  return (
    <div className="auth-modal" key={mode}>
      <div className="auth-head stack-sm">
        <Wordmark />
        <h2 className="t-heading-lg">{copy.title}</h2>
        <p className="t-body-md c-body">{copy.body}</p>
      </div>

      <form className="stack-lg" onSubmit={submit} noValidate>
        {isSignup && (
          <TextField label="Name" value={values.name} onChange={set("name")} autoComplete="name" error={errors.name} autoFocus />
        )}
        <TextField
          label="Email"
          type="email"
          value={values.email}
          onChange={set("email")}
          autoComplete="email"
          error={errors.email}
          autoFocus={!isSignup}
        />
        {errors.form && (
          <p className="field-error swap-in" role="alert">
            {errors.form}
          </p>
        )}
        <Button type="submit" variant="primary" block>
          Continue
        </Button>
      </form>

      {isSignup && (
        <p className="t-caption-sm c-mute auth-legal">
          By continuing, you agree to TripMate's{" "}
          <Link to="/terms" className="link-inline" onClick={closeModal}>
            Terms and Conditions
          </Link>{" "}
          and acknowledge our{" "}
          <Link to="/privacy" className="link-inline" onClick={closeModal}>
            Privacy Policy
          </Link>
          .
        </p>
      )}

      <p className="t-body-sm c-body auth-switch">
        {copy.switchPrompt}{" "}
        <button type="button" className="link-inline link-button" onClick={() => openAuth(copy.switchTo)}>
          {copy.switchLabel}
        </button>
      </p>
    </div>
  );
}

/** Sign-up / log-in overlay. Opened from anywhere with useSession().openAuth("signup" | "login"). */
export default function AuthModal() {
  const { authModal, closeAuth } = useSession();
  if (!authModal) return null;
  return <Modal onClose={closeAuth}>{({ close }) => <AuthForm mode={authModal} closeModal={close} />}</Modal>;
}
