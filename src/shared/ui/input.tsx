import * as React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", label, error, helperText, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;

    return (
      <div className="flex w-full flex-col gap-1.5">
        {label ? (
          <label htmlFor={inputId} className="text-xs font-semibold text-[var(--color-text)]">
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={`min-h-[44px] w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] placeholder-[var(--color-muted)] transition-colors focus:border-[var(--color-primary)] focus:outline-none disabled:opacity-50 ${
            error ? "border-[var(--color-danger)] focus:border-[var(--color-danger)]" : ""
          } ${className}`}
          {...props}
        />
        {error ? (
          <span className="text-xs font-medium text-[var(--color-danger)]">{error}</span>
        ) : helperText ? (
          <span className="text-xs text-[var(--color-muted)]">{helperText}</span>
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";
