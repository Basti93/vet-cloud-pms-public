"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle } from "lucide-react";

interface SettingsSectionProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  isDirty: boolean;
  isLoading: boolean;
  error?: string;
  successMessage?: string;
  onSave: () => Promise<void>;
  onReset: () => void;
  children: React.ReactNode;
}

/**
 * Settings section wrapper
 * Handles:
 * - Header with icon, title, description
 * - Field layout
 * - Error/success feedback
 * - Save/Cancel buttons (only when dirty)
 *
 * Usage:
 * ```tsx
 * <SettingsSection
 *   title="Language"
 *   description="Choose your preferred language"
 *   icon={<Globe />}
 *   isDirty={isDirty}
 *   isLoading={isSaving}
 *   error={error}
 *   onSave={handleSave}
 *   onReset={handleReset}
 * >
 *   <SelectField ... />
 * </SettingsSection>
 * ```
 */
export function SettingsSection({
  title,
  description,
  icon,
  isDirty,
  isLoading,
  error,
  successMessage,
  onSave,
  onReset,
  children,
}: SettingsSectionProps) {
  return (
    <Card className="p-6" style={{ borderColor: "var(--color-border)" }}>
      {/* Header */}
      <div className="mb-6 flex items-start gap-4">
        {icon && (
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: "var(--color-accent-soft)" }}
          >
            {icon}
          </div>
        )}
        <div className="flex-1">
          <h2 className="text-base font-semibold mb-1" style={{ color: "var(--color-fg)" }}>
            {title}
          </h2>
          {description && (
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-4">{children}</div>

      {/* Error message */}
      {error && (
        <div
          className="mt-4 p-3 rounded-lg text-sm flex items-start gap-2"
          style={{
            backgroundColor: "#fee2e2",
            color: "#991b1b",
            borderColor: "#fca5a5",
          }}
        >
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Success message */}
      {successMessage && !isDirty && !isLoading && (
        <div
          className="mt-4 p-3 rounded-lg text-sm flex items-start gap-2"
          style={{
            backgroundColor: "#dcfce7",
            color: "#166534",
            borderColor: "#86efac",
          }}
        >
          <CheckCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Action buttons - only show when form is dirty */}
      {isDirty && (
        <div className="mt-6 flex items-center gap-3">
          <Button
            onClick={onSave}
            disabled={isLoading}
            className="gap-2"
          >
            {isLoading ? "Wird gespeichert..." : "Änderungen speichern"}
          </Button>
          <Button
            variant="ghost"
            onClick={onReset}
            disabled={isLoading}
          >
            Abbrechen
          </Button>
        </div>
      )}
    </Card>
  );
}
