import { useId } from "react";
import { IconButton } from "./Button";
import Icon from "./Icon";
import "./SearchBar.css";

/** search-bar / search-bar-focused: pill input with a leading glyph and a submit button. */
export default function SearchBar({ label, value, onChange, onSubmit, submitLabel, placeholder, autoFocus, className = "" }) {
  const id = useId();
  return (
    <form
      className={`search-bar ${className}`.trim()}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value);
      }}
    >
      <Icon name="search" size={18} className="search-bar-glyph" />
      <label htmlFor={id} className="visually-hidden">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
      />
      <IconButton type="submit" icon="arrowRight" size={18} label={submitLabel} className="is-bare search-bar-submit" />
    </form>
  );
}
