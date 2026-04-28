'use client';

import { useEffect } from 'react';
import { useTheme } from '@/lib/theme-context';
import { COLOR_PRESETS } from '@/lib/theme';

export function DynamicFavicon() {
  const { colorPreset } = useTheme();

  useEffect(() => {
    const hexColor = COLOR_PRESETS[colorPreset].accentHex;

    // Generate SVG favicon with dynamic color
    const svgString = `
      <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="6" fill="${hexColor}"/>
        <ellipse cx="16" cy="21" rx="7.5" ry="6" fill="#fff"/>
        <ellipse cx="7" cy="12.5" rx="2.8" ry="3.2" fill="#fff"/>
        <ellipse cx="12.5" cy="9" rx="2.8" ry="3.2" fill="#fff"/>
        <ellipse cx="19.5" cy="9" rx="2.8" ry="3.2" fill="#fff"/>
        <ellipse cx="25" cy="12.5" rx="2.8" ry="3.2" fill="#fff"/>
      </svg>
    `.trim();

    // Convert SVG to blob and create object URL (avoids browser cache issues with data URLs)
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    // Update favicon
    let link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    if (link) {
      if (link.href.startsWith('blob:')) URL.revokeObjectURL(link.href);
      link.href = url;
    } else {
      link = document.createElement('link');
      link.rel = 'icon';
      link.href = url;
      document.head.appendChild(link);
    }

    // Update apple-touch-icon for iOS
    let appleLink = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement;
    if (appleLink) {
      if (appleLink.href.startsWith('blob:')) URL.revokeObjectURL(appleLink.href);
      appleLink.href = url;
    } else {
      appleLink = document.createElement('link');
      appleLink.rel = 'apple-touch-icon';
      appleLink.href = url;
      document.head.appendChild(appleLink);
    }

    // Cleanup
    return () => {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    };
  }, [colorPreset]);

  return null;
}
