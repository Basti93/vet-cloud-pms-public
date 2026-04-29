'use client';

import { useEffect } from 'react';

interface Props {
  hexColor: string;
}

export function DemoFavicon({ hexColor }: Props) {
  useEffect(() => {
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

    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    // Remove all existing icon links
    document.querySelectorAll("link[rel='icon'], link[rel='shortcut icon']").forEach((link) => {
      const href = (link as HTMLLinkElement).href;
      if (href.startsWith('blob:')) URL.revokeObjectURL(href);
      link.remove();
    });

    // Add new favicon
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = url;
    document.head.appendChild(link);

    // Update apple-touch-icon for iOS
    document.querySelectorAll("link[rel='apple-touch-icon']").forEach((appleLink) => {
      const href = (appleLink as HTMLLinkElement).href;
      if (href.startsWith('blob:')) URL.revokeObjectURL(href);
      appleLink.remove();
    });

    const appleLink = document.createElement('link');
    appleLink.rel = 'apple-touch-icon';
    appleLink.href = url;
    document.head.appendChild(appleLink);

    return () => {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    };
  }, [hexColor]);

  return null;
}
