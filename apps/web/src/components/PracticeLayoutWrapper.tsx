'use client';

import { ReactNode } from 'react';
import { ThemeProvider } from '@/lib/theme-context';
import type { ColorPresetKey, TypographyPairingKey } from '@/lib/theme';

interface Props {
  children: ReactNode;
  colorPreset: ColorPresetKey;
  typographyPairing: TypographyPairingKey;
  style: React.CSSProperties;
}

export function PracticeLayoutWrapper({
  children,
  colorPreset,
  typographyPairing,
  style,
}: Props) {
  return (
    <ThemeProvider
      initialColorPreset={colorPreset}
      initialTypographyPairing={typographyPairing}
    >
      <div style={style}>{children}</div>
    </ThemeProvider>
  );
}
