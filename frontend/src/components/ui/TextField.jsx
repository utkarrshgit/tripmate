import { forwardRef, useId } from "react";
import "./TextField.css";

/**
 * text-input with label, helper text and error. `multiline` renders a textarea.
 * Error text replaces helper text and is wired up with aria-describedby.
 */
const TextField = forwardRef(function TextField(
  { label, help, error, multiline = false, id: idProp, ...inputProps },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const messageId = `${id}-message`;
  const message = error || help;
  const Control = multiline ? "textarea" : "input";

  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <Control
        ref={ref}
        id={id}
        className="input"
        aria-invalid={Boolean(error)}
        aria-describedby={message ? messageId : undefined}
        {...inputProps}
      />
      {message && (
        <p id={messageId} className={error ? "field-error swap-in" : "field-help"}>
          {message}
        </p>
      )}
    </div>
  );
});

export default TextField;
