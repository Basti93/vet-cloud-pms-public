import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "ghost" | "outline" | "outline-light" | "outline-soft" | "destructive" | "success";
  size?: "xs" | "sm" | "default" | "lg";
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = "",
      variant = "default",
      size = "default",
      loading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const variants = {
      default: "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] active:bg-[var(--color-accent-hover)] shadow-sm",
      ghost: "text-fg hover:bg-[var(--color-accent-soft)] active:bg-muted-soft",
      outline: "border border-[var(--color-border)] bg-surface text-[var(--color-accent-text)] hover:bg-[var(--color-accent-soft)] active:bg-muted-soft shadow-sm",
      "outline-light": "border border-white/50 bg-transparent text-white hover:bg-white/10 active:bg-white/20 shadow-sm",
      "outline-soft": "border border-[var(--color-accent)] bg-transparent text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)] active:bg-[var(--color-accent-soft)] shadow-sm",
      destructive: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm",
      success: "bg-green-600 text-white hover:bg-green-700 active:bg-green-800 shadow-sm",
    };

    const sizes = {
      xs: "px-2.5 py-1 text-xs rounded-lg",
      sm: "px-3 py-1.5 text-sm rounded-lg",
      default: "px-4 py-2.5 text-sm rounded-xl",
      lg: "px-6 py-3 text-base rounded-xl",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
