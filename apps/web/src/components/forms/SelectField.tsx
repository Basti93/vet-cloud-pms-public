"use client";

import { FormField } from "./FormField";

interface SelectOption {
  label: string;
  value: string;
}

interface SelectFieldProps {
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
}

/**
 * Select/dropdown field with FormField wrapper
 * Provides consistent styling and layout for select inputs
 *
 * Usage:
 * ```tsx
 * <SelectField
 *   label="Language"
 *   value={locale}
 *   onChange={setLocale}
 *   options={[
 *     { label: "English", value: "en" },
 *     { label: "Deutsch", value: "de" },
 *   ]}
 * />
 * ```
 */
export function SelectField({
  label,
  description,
  error,
  required,
  value,
  onChange,
  options,
  disabled,
}: SelectFieldProps) {
  return (
    <FormField
      label={label}
      description={description}
      error={error}
      required={required}
    >
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 rounded-lg border text-sm font-medium cursor-pointer"
        style={{
          borderColor: "var(--color-border)",
          backgroundColor: "var(--color-bg)",
          color: "var(--color-fg)",
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FormField>
  );
}
