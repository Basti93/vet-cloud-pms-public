import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = {
  width: 32,
  height: 32,
};
export const contentType = 'image/png';

export default function Favicon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 24,
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '8px',
        }}
      >
        {/* Paw print */}
        <svg
          viewBox="0 0 100 100"
          width="28"
          height="28"
          style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
        >
          {/* Main pad (center bottom) */}
          <circle cx="50" cy="70" r="15" fill="white" />

          {/* Top left toe */}
          <circle cx="25" cy="30" r="10" fill="white" />

          {/* Top center-left toe */}
          <circle cx="40" cy="15" r="10" fill="white" />

          {/* Top center-right toe */}
          <circle cx="60" cy="15" r="10" fill="white" />

          {/* Top right toe */}
          <circle cx="75" cy="30" r="10" fill="white" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}
