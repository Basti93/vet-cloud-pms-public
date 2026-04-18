import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = "", ...props }, ref) => (
    <div
      ref={ref}
      className={`rounded-lg border border-[var(--color-border)] bg-surface shadow-sm ${className}`}
      {...props}
    />
  )
);
Card.displayName = "Card";
