import { forwardRef, useId, useState } from "react";
import { Icon } from "@/components/ui";

/**
 * A password input with a show and hide toggle. Matches TextField's label, help and
 * error layout. `autoComplete` is "new-password" when creating one, so browsers offer
 * to generate and save it, or "current-password" when signing in.
 */
const PasswordField = forwardRef(function PasswordField({ label = "Password", help, error, id: idProp, ...inputProps }, ref) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const messageId = `${id}-message`;
  const message = error || help;
  const [shown, setShown] = useState(false);

  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="password-input">
        <input
          ref={ref}
          id={id}
          className="input"
          type={shown ? "text" : "password"}
          aria-invalid={Boolean(error)}
          aria-describedby={message ? messageId : undefined}
          spellCheck={false}
          autoCapitalize="none"
          {...inputProps}
        />
        <button
          type="button"
          className="password-toggle"
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
          aria-controls={id}
          onClick={() => setShown((s) => !s)}
        >
          <Icon name={shown ? "eyeOff" : "eye"} size={20} />
        </button>
      </div>
      {message && (
        <p id={messageId} className={error ? "field-error swap-in" : "field-help"}>
          {message}
        </p>
      )}
    </div>
  );
});

export default PasswordField;
