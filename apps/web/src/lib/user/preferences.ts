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
 * See CLAUDE.md "User Preferences Pattern"
 */
export interface UserPreferences {
  locale: "de" | "en";
  // Add new preferences below
}
