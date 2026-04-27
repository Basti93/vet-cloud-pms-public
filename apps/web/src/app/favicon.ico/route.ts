export async function GET() {
  // SVG favicon with paw icon (neutral gray for cross-theme compatibility)
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
      <rect width="64" height="64" fill="#1f2937" rx="8"/>
      <g fill="white">
        <!-- Paw print: main pad + 4 toes -->
        <ellipse cx="32" cy="42" rx="7" ry="10" opacity="0.9"/>
        <ellipse cx="16" cy="24" rx="5" ry="8" opacity="0.8"/>
        <ellipse cx="26" cy="18" rx="5" ry="8" opacity="0.8"/>
        <ellipse cx="38" cy="18" rx="5" ry="8" opacity="0.8"/>
        <ellipse cx="48" cy="24" rx="5" ry="8" opacity="0.8"/>
      </g>
    </svg>
  `;

  const buffer = Buffer.from(svg);

  return new Response(buffer, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=604800',
    },
  });
}
