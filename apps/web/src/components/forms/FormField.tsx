"use client";

interface FormFieldProps {
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

/**
 * Reusable form field wrapper
 * Provides consistent styling for label, help text, error messages
 *
 * Usage:
 * ```tsx
 * <FormField label="Email" description="Your work email" error={emailError}>
 *   <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
 * </FormField>
 * ```
 */
export function FormField({
  label,
  description,
  error,
  required,
  children,
}: FormFieldProps) {
  return (
    <div>
      <label
        className="block text-sm font-medium mb-1.5"
        style={{ color: "var(--color-fg)" }}
      >
        {label}
        {required && <span style={{ color: "var(--color-accent)" }}> *</span>}
      </label>

      {description && (
        <p className="text-xs mb-2" style={{ color: "var(--color-muted)" }}>
          {description}
        </p>
      )}

      {children}

      {error && (
        <p className="text-xs mt-1.5" style={{ color: "#dc2626" }}>
          {error}
        </p>
      )}
    </div>
  );
}
