/**
 * PRAXIS (Tenant) preferences — clinic-wide settings.
 * Loaded server-side on every page load via layout.tsx
 * Available immediately on first paint (no client-side loading)
 */
export interface PraxisPreferences {
  tenantId: string;
  tenantName: string;
  monogram: string | null; // e.g., "MVK" for branding
  // Future: add tenantDefaultLocale to allow per-clinic language defaults
  // Users can override this in their own locale preference
}

/**
 * UserPreferences - All user preferences load once on app start.
 *
 * When adding new preferences:
 * 1. Add field to this interface
 * 2. Add to getPreferences query in user router
 * 3. Add to update mutation handler
 * 4. Done - automatically available in context everywhere
 *
 * Why this pattern: Single query on app start. Scales better than individual cookies/localStorage.
 * User preferences can override praxis (tenant) defaults.
 * Example: clinic defaults to German, but a user can set their own to English.
 * See CLAUDE.md "User Preferences Pattern"
 */
export interface UserPreferences {
  locale: "de" | "en";
  // Add new preferences below
}
