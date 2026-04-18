/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-accent)',
        'primary-hover': 'var(--color-accent-hover)',
        'primary-soft': 'var(--color-accent-soft)',
        'primary-text': 'var(--color-accent-text)',
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        border: 'var(--color-border)',
        'border-strong': 'var(--color-border-strong)',
        fg: 'var(--color-fg)',
        muted: 'var(--color-muted)',
        'muted-soft': 'var(--color-muted-soft)',
      },
      fontFamily: {
        heading: 'var(--font-heading)',
        body: 'var(--font-body)',
      },
      fontWeight: {
        heading: 'var(--font-heading-weight)',
      },
      letterSpacing: {
        heading: 'var(--font-heading-tracking)',
      },
    },
  },
  plugins: [],
};
