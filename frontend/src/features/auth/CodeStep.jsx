import { useEffect, useId, useRef, useState } from "react";
import { Button, CodeSlots, Icon, Notice } from "@/components/ui";
import { CODE_LENGTH } from "@/state/authApi";

const SUCCESS_HOLD_MS = 1100;

/** "0:45" for a number of seconds. */
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Whole seconds until `time`, counting down once a second. */
function useSecondsUntil(time) {
  const [, tick] = useState(0);
  const left = time ? Math.max(0, Math.ceil((time - Date.now()) / 1000)) : 0;
  useEffect(() => {
    if (!left) return undefined;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [time, left > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  return left;
}

/**
 * "Check your email": six code slots, a resend link with a countdown, and the result.
 * Used for sign-up, logging in before verifying, password resets and email changes.
 *
 *   email, intro       Where the code went, and the sentence above the slots
 *   resendAt, devCode  From the last send. devCode is shown only while email isn't connected.
 *   onVerify(code)     Checks the code; throws an AuthError when it's wrong
 *   onResend()         Sends a new code; resolves to { resendAt, devCode }
 *   onVerified()       Runs after the success state has shown for a moment
 *   successMessage     Announced when the code is accepted
 *   submitLabel        The button, for anyone who'd rather not rely on auto-submit
 *   onChangeEmail      Optional "Use a different email" link
 */
export default function CodeStep({
  email,
  intro,
  resendAt: initialResendAt,
  devCode: initialDevCode,
  onVerify,
  onResend,
  onVerified,
  successMessage,
  submitLabel = "Verify email",
  onChangeEmail,
}) {
  const id = useId();
  const slotsRef = useRef(null);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("idle"); // idle | checking | error | success
  const [message, setMessage] = useState(null); // { tone: "error" | "info", text }
  const [resendAt, setResendAt] = useState(initialResendAt);
  const [devCode, setDevCode] = useState(initialDevCode);
  const [resending, setResending] = useState(false);
  const wait = useSecondsUntil(resendAt);
  const messageId = `${id}-message`;

  async function verify(value = code) {
    if (status === "checking" || status === "success") return;
    if (value.length < CODE_LENGTH) {
      setMessage({ tone: "error", text: `Enter all ${CODE_LENGTH} digits.` });
      slotsRef.current?.focus();
      return;
    }
    setStatus("checking");
    setMessage(null);
    try {
      await onVerify(value);
      setStatus("success");
      setMessage({ tone: "success", text: successMessage });
      setTimeout(onVerified, SUCCESS_HOLD_MS);
    } catch (err) {
      setStatus("error");
      setMessage({ tone: "error", text: err.message });
    }
  }

  async function resend() {
    setResending(true);
    try {
      const sent = await onResend();
      setResendAt(sent.resendAt);
      setDevCode(sent.devCode);
      setStatus("idle");
      setMessage({ tone: "info", text: `We sent a new code to ${email}.` });
      slotsRef.current?.focus();
    } catch (err) {
      if (err.resendAt) setResendAt(err.resendAt);
      setMessage({ tone: "error", text: err.message });
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="stack-lg">
      <p className="t-body-md c-body">{intro}</p>

      {devCode && (
        <Notice icon="mail" className="code-dev-notice">
          <p className="t-body-sm">
            Email isn't connected yet, so here's your code: <span className="code-dev-value">{devCode}</span>
          </p>
        </Notice>
      )}

      <form
        className="stack-md"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          verify();
        }}
      >
        <label className="field-label" htmlFor={`${id}-code`}>
          Verification code
        </label>
        <CodeSlots
          ref={slotsRef}
          id={`${id}-code`}
          length={CODE_LENGTH}
          status={status === "checking" ? "idle" : status}
          disabled={status === "checking"}
          describedBy={message ? messageId : undefined}
          autoFocus
          onChange={(value) => {
            setCode(value);
            // Typing again clears the last error; the clear after an error keeps it on screen.
            if (value) {
              if (status === "error") setStatus("idle");
              setMessage((m) => (m?.tone === "error" ? null : m));
            } else if (status === "error") setStatus("idle");
          }}
          onComplete={verify}
        />
        <p
          id={messageId}
          className={message?.tone === "error" ? "field-error swap-in" : message?.tone === "success" ? "code-success swap-in" : "field-help"}
          role={message?.tone === "error" ? "alert" : "status"}
        >
          {message?.tone === "success" && <Icon name="check" size={16} />}
          {message?.text}
        </p>
        <Button type="submit" variant="primary" block disabled={status === "checking" || status === "success"}>
          {status === "checking" ? "Checking…" : submitLabel}
        </Button>
      </form>

      <div className="code-step-links">
        {wait > 0 ? (
          <p className="t-body-sm c-mute" aria-live="off">
            Send a new code in {clock(wait)}
          </p>
        ) : (
          <button type="button" className="link-inline link-button t-body-sm" onClick={resend} disabled={resending || status === "success"}>
            {resending ? "Sending…" : "Send a new code"}
          </button>
        )}
        {onChangeEmail && status !== "success" && (
          <button type="button" className="link-inline link-button t-body-sm" onClick={onChangeEmail}>
            Use a different email
          </button>
        )}
      </div>
    </div>
  );
}
