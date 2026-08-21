import * as React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", size = "md", isLoading = false, disabled, children, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center font-semibold rounded-md transition-colors focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]";
    
    const sizeStyles = {
      sm: "min-h-[36px] px-3 text-xs",
      md: "min-h-[44px] px-4 text-sm", // Touch target mínimo de 44px
      lg: "min-h-[52px] px-6 text-base",
    };

    const variantStyles = {
      primary: "bg-[var(--color-primary)] hover:bg-[var(--color-primary-strong)] text-white shadow-sm",
      secondary: "bg-[var(--color-surface-neutral)] hover:bg-[var(--color-border)] text-[var(--color-text)]",
      ghost: "bg-transparent hover:bg-[var(--color-surface-neutral)] text-[var(--color-text)]",
      danger: "bg-[var(--color-danger)] hover:opacity-90 text-white shadow-sm",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
