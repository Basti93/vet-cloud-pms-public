/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Security & Rate Limiting Headers
  async headers() {
    return [
      {
        source: "/api/trpc/:path*",
        headers: [
          // Rate Limiting (Vercel enforces these)
          { key: "X-RateLimit-Limit", value: "100" }, // 100 requests
          { key: "X-RateLimit-Window", value: "60" }, // per 60 seconds

          // Security Headers
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
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
