const UMAMI_URL = process.env.NEXT_PUBLIC_UMAMI_SRC?.replace("/script.js", "");
const WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;

export async function trackServerEvent(
  name: string,
  data?: Record<string, string | number | boolean>
) {
  if (!UMAMI_URL || !WEBSITE_ID) return;

  try {
    await fetch(`${UMAMI_URL}/api/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "event",
        payload: {
          website: WEBSITE_ID,
          hostname: "example.com",
          url: "/api/internal",
          name,
          data,
        },
      }),
    });
  } catch {
    // Analytics must never break the app
  }
}
