'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { ColorPresetKey, TypographyPairingKey, generateCSSVariables, COLOR_PRESETS, TYPE_PAIRINGS } from './theme';

interface ThemeContextType {
  colorPreset: ColorPresetKey;
  typographyPairing: TypographyPairingKey;
  setColorPreset: (preset: ColorPresetKey) => void;
  setTypographyPairing: (pairing: TypographyPairingKey) => void;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  tenantId?: string | null;
  initialColorPreset?: ColorPresetKey;
  initialTypographyPairing?: TypographyPairingKey;
}

export function ThemeProvider({
  children,
  tenantId,
  initialColorPreset = 'sage',
  initialTypographyPairing = 'modern',
}: ThemeProviderProps) {
  const [colorPreset, setColorPreset] = useState<ColorPresetKey>(initialColorPreset);
  const [typographyPairing, setTypographyPairing] = useState<TypographyPairingKey>(initialTypographyPairing);
  const [isLoading, setIsLoading] = useState(!!tenantId);

  // Load tenant theme preference from database if tenantId is provided
  useEffect(() => {
    if (!tenantId) {
      setIsLoading(false);
      return;
    }

    const loadThemePreference = async () => {
      try {
        const response = await fetch(`/api/tenant/${tenantId}/theme-preference`);
        if (response.ok) {
          const data = await response.json();
          if (data.colorPreset && data.typographyPairing) {
            setColorPreset(data.colorPreset);
            setTypographyPairing(data.typographyPairing);
          }
        }
      } catch (error) {
        console.error('Failed to load theme preference:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadThemePreference();
  }, [tenantId]);

  // Inject CSS variables into root element when theme changes
  useEffect(() => {
    const cssVariables = generateCSSVariables(colorPreset, typographyPairing);
    const style = document.documentElement.style;

    // Parse the CSS variables string and apply to root element
    const vars = cssVariables.split('\n').map((v) => v.trim()).filter(Boolean);
    vars.forEach((varDeclaration) => {
      const [key, value] = varDeclaration.replace(/;$/, '').split(':');
      if (key && value) {
        style.setProperty(key.trim(), value.trim());
      }
    });
  }, [colorPreset, typographyPairing]);

  const value: ThemeContextType = {
    colorPreset,
    typographyPairing,
    setColorPreset,
    setTypographyPairing,
    isLoading,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
