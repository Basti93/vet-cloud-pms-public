'use client';

import { ReactNode } from 'react';
import { ThemeProvider } from '@/lib/theme-context';
import { DemoFavicon } from '@/components/DemoFavicon';
import { COLOR_PRESETS } from '@/lib/theme';
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
  const hexColor = COLOR_PRESETS[colorPreset].accentHex;

  return (
    <ThemeProvider
      initialColorPreset={colorPreset}
      initialTypographyPairing={typographyPairing}
    >
      <DemoFavicon hexColor={hexColor} />
      <div style={style}>{children}</div>
    </ThemeProvider>
  );
}
