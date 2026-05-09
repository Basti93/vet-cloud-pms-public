import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
let clerkFrontendOrigin = "";
let clerkAccountsOrigin = "";

try {
  if (appUrl) {
    const { hostname } = new URL(appUrl);
    const isLocalHost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0";

    // Only derive custom Clerk subdomains for real internet domains.
    if (!isLocalHost && hostname.includes(".")) {
      clerkFrontendOrigin = `https://clerk.${hostname}`;
      clerkAccountsOrigin = `https://accounts.${hostname}`;
    }
  }
} catch {
  // Ignore invalid NEXT_PUBLIC_APP_URL and fall back to default Clerk domains only.
}

const clerkScriptSrc = [
  "https://cdn.clerk.com",
  "https://*.clerk.com",
  "https://*.clerk.accounts.dev",
  "https://clerk.example.com",
  "https://va.vercel-scripts.com",
  clerkFrontendOrigin,
]
  .filter(Boolean)
  .join(" ");

const clerkConnectSrc = [
  "https://api.clerk.com",
  "https://*.clerk.com",
  "https://*.clerk.accounts.dev",
  "https://clerk-telemetry.com",
  "https://clerk.example.com",
  "https://accounts.example.com",
  "https://va.vercel-scripts.com",
  clerkFrontendOrigin,
  clerkAccountsOrigin,
]
  .filter(Boolean)
  .join(" ");

const clerkFrameSrc = [
  "https://clerk.com",
  "https://*.clerk.com",
  "https://*.clerk.accounts.dev",
  "https://accounts.example.com",
  clerkAccountsOrigin,
]
  .filter(Boolean)
  .join(" ");

const appContentSecurityPolicy =
  "default-src 'self'; " +
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${clerkScriptSrc}; ` +
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "font-src 'self' https://fonts.gstatic.com; " +
  "img-src 'self' data: https: blob:; " +
  `connect-src 'self' ${clerkConnectSrc} https://neon.tech https://api.resend.com https://vapi.ai https://*.vapi.ai; ` +
  `frame-src 'self' ${clerkFrameSrc}; ` +
  "worker-src 'self' blob:; " +
  "object-src 'none'; " +
  "base-uri 'self'; " +
  "form-action 'self'; " +
  "upgrade-insecure-requests;";

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },

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
            value: appContentSecurityPolicy,
          },
          // X-Content-Type-Options
          { key: "X-Content-Type-Options", value: "nosniff" },
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

export default nextConfig;
