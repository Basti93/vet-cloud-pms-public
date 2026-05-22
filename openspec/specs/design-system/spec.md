# Design System

A tenant-aware design system built on CSS custom properties, OKLch color tokens, and pre-built website templates, enabling each practice to present their own brand while sharing a common component foundation.

## Requirements

### Requirement: Color Presets
The design system SHALL provide six named color presets — Sage, Warm Sand, Klinik Blau, Bordeaux, Forest, and Schiefer — expressed in OKLch color space, each meeting WCAG AA contrast requirements.

#### Scenario: preset applied to tenant
- **WHEN** a `ThemeProvider` is rendered with a `tenantId`
- **THEN** the matching preset's CSS variables MUST be injected into the root `<html>` element

#### Scenario: accent on background contrast
- **WHEN** any color preset is active
- **THEN** the `accent` color on `bg` and `surface` backgrounds SHALL achieve at least 5.5:1 contrast ratio

#### Scenario: foreground on background contrast
- **WHEN** any color preset is active
- **THEN** the `fg` color on `bg` SHALL achieve at least 7:1 contrast ratio

### Requirement: Color Token Structure
Each color preset MUST expose a canonical set of semantic tokens: `accent`, `accentHover`, `accentSoft`, `accentText`, `bg`, `surface`, `border`, `borderStrong`, `fg`, `muted`, and `mutedSoft`.

#### Scenario: CSS variables injected
- **WHEN** `generateCSSVariables(preset, pairing)` is called
- **THEN** it MUST return a string containing all required `--color-*` and `--font-*` CSS custom property declarations

#### Scenario: fallback values present
- **WHEN** a browser does not support OKLch
- **THEN** hex fallback values MUST be available for critical tokens to prevent rendering failure

### Requirement: Typography Pairings
The design system SHALL provide four typography pairings — Modern Sans (Inter), Klassisch (Serif + Sans), Klinisch (IBM Plex), and Freundlich (Public Sans + Inter) — each with heading and body font stacks, weight, and tracking tokens.

#### Scenario: system font fallbacks included
- **WHEN** a typography pairing is applied
- **THEN** the font stack MUST include `system-ui, sans-serif` as fallbacks after the primary font

#### Scenario: German long-word readability
- **WHEN** any typography pairing is used
- **THEN** line height SHALL be at least 1.5 for body text to support long German compound words

### Requirement: CSS Variable Injection via ThemeProvider
Themes SHALL be applied exclusively through CSS custom properties injected by `ThemeProvider`, without hard-coded color values in component classes.

#### Scenario: component uses semantic class
- **WHEN** a button or interactive element is rendered
- **THEN** it SHALL use semantic classes (`bg-primary`, `text-fg`) or CSS variable references rather than static Tailwind color utilities like `bg-blue-600`

#### Scenario: theme inheritance
- **WHEN** a component is rendered inside `ThemeProvider`
- **THEN** all descendant components MUST inherit the active theme through CSS variable cascade without prop drilling

### Requirement: Website Templates
The design system SHALL provide three pre-built public website templates — Modern, Klassik, and Kompakt — accessible under `src/components/website/templates/`, each accepting a standard `TemplateProps` interface.

#### Scenario: template renders with required props
- **WHEN** a template component receives `brandName`, `tagline`, and `monogram`
- **THEN** the template MUST render a complete practice website page without errors

#### Scenario: template renders with optional contact props
- **WHEN** `phone`, `email`, `address`, or `city` are provided
- **THEN** the template MUST display the corresponding contact information

#### Scenario: template uses CSS variable tokens
- **WHEN** any website template renders
- **THEN** all colors MUST reference `var(--color-*)` tokens so the active color preset applies automatically

### Requirement: Template and Preset Extensibility
New color presets and typography pairings MUST be addable by editing `src/lib/theme.ts`, adding to the `ColorPresetKey` / `TypographyPairingKey` union types, and passing WCAG AA validation before deployment.

#### Scenario: new preset registered
- **WHEN** a new entry is added to `COLOR_PRESETS` in `theme.ts` and to the `ColorPresetKey` type
- **THEN** the new preset MUST be selectable by `generateCSSVariables` and `ThemeProvider`

#### Scenario: new template registered
- **WHEN** a new template component is created and registered in `website-generator.ts`
- **THEN** it MUST be available as a `WebsiteTemplateKey` option and renderable in the brand builder preview

### Requirement: Accessibility Compliance
All shipped design tokens and templates SHALL meet WCAG AA accessibility standards for color contrast, font sizing, and motion sensitivity.

#### Scenario: body text minimum size
- **WHEN** any template or dashboard page renders body text
- **THEN** font size SHALL be at least 14px (16px on mobile)

#### Scenario: reduced motion respected
- **WHEN** a user's OS has `prefers-reduced-motion: reduce` set
- **THEN** no decorative animations SHALL play in the UI
