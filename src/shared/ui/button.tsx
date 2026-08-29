import * as React from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

type ButtonClassNameArgs = Readonly<{
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}>;

const baseStyles =
  "inline-flex w-full items-center justify-center font-semibold rounded-[12px] transition-all focus-visible:outline-none disabled:bg-[var(--color-surface-neutral)] disabled:text-[var(--color-muted)] disabled:border-transparent disabled:pointer-events-none active:scale-[0.99]";

const sizeStyles: Readonly<Record<ButtonSize, string>> = {
  sm: "min-h-[38px] px-3 text-[12px]",
  md: "min-h-[52px] px-4 text-[14px]",
  lg: "min-h-[56px] px-6 text-[16px]",
};

const variantStyles: Readonly<Record<ButtonVariant, string>> = {
  primary: "bg-[var(--color-primary)] hover:bg-[var(--color-primary-strong)] text-white shadow-xs",
  secondary:
    "bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-surface-neutral)] text-[var(--color-text)] shadow-xs",
  ghost: "bg-transparent hover:bg-[var(--color-surface-neutral)] text-[var(--color-text)]",
  danger: "bg-[var(--color-danger)] hover:opacity-90 text-white shadow-xs",
};

export function buttonClassName({
  variant = "primary",
  size = "md",
  className = "",
}: ButtonClassNameArgs = {}): string {
  return `${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`.trim();
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", size = "md", isLoading = false, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={buttonClassName({ variant, size, className })}
        {...props}
      >
        {isLoading ? (
          <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : null}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
