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
          <label htmlFor={inputId} className="text-[12px] font-semibold text-[var(--color-muted)]">
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={`min-h-[48px] w-full rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-[14px] text-[var(--color-text)] placeholder-[var(--color-border-subdued)] transition-all focus:border-[var(--color-primary)] focus:outline-none disabled:bg-[var(--color-surface-neutral)] disabled:opacity-70 ${
            error ? "border-[var(--color-danger)] focus:border-[var(--color-danger)]" : ""
          } ${className}`}
          {...props}
        />
        {error ? (
          <span className="text-[11px] font-medium text-[var(--color-danger)]">{error}</span>
        ) : helperText ? (
          <span className="text-[11px] text-[var(--color-muted)]">{helperText}</span>
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";
