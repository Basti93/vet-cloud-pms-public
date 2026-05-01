/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Security & Rate Limiting Headers
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // HSTS - Force HTTPS for 1 year + include subdomains
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          // CSP - Prevent XSS/script injection
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; " +
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.clerk.com https://clerk.com; " +
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
              "font-src 'self' https://fonts.gstatic.com; " +
              "img-src 'self' data: https:; " +
              "connect-src 'self' https://api.clerk.com https://*.clerk.com https://neon.tech https://api.resend.com https://vapi.ai https://*.vapi.ai; " +
              "frame-src 'self' https://clerk.com https://*.clerk.com; " +
              "object-src 'none'; " +
              "base-uri 'self'; " +
              "form-action 'self'; " +
              "upgrade-insecure-requests;",
          },
          // X-Content-Type-Options
          { key: "X-Content-Type-Options", value: "nosniff" },
          // X-Frame-Options - Prevent clickjacking
          { key: "X-Frame-Options", value: "DENY" },
          // X-XSS-Protection
          { key: "X-XSS-Protection", value: "1; mode=block" },
          // Referrer-Policy
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Permissions-Policy (formerly Feature-Policy)
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
          },
        ],
      },
      {
        source: "/api/trpc/:path*",
        headers: [
          // Rate Limiting for tRPC endpoints
          { key: "X-RateLimit-Limit", value: "100" }, // 100 requests
          { key: "X-RateLimit-Window", value: "60" }, // per 60 seconds
        ],
      },
      {
        source: "/api/vapi/webhook",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
