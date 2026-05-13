import { getStripeClient } from "@/lib/stripe/client";

export interface StripePriceTier {
  priceId: string;
  seats: number;
  monthlyPrice: number; // in cents
}

export const TRIAL_DAYS = 90;

// ── In-memory cache ────────────────────────────────────────────────────────
// Avoids calling Stripe on every request. 1-hour TTL.
// To change pricing: update in Stripe Dashboard — takes effect within 1 hour.
let _cache: StripePriceTier[] | null = null;
let _cacheExpiresAt = 0;
const CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Fetches all active pricing tiers from Stripe.
 *
 * Stripe setup required (one-time, in Stripe Dashboard):
 *   Product metadata:  app = vet-cloud
 *   Price metadata:    seats = <number>   (e.g. 1, 3, 5, 10)
 *
 * Adding/changing prices: edit in Stripe Dashboard — no code deploy needed.
 * Results cached 1 hour in memory.
 */
export async function getStripePrices(): Promise<StripePriceTier[]> {
  if (_cache && Date.now() < _cacheExpiresAt) return _cache;

  const stripe = getStripeClient();

  // Find the product tagged app=vet-cloud
  const products = await stripe.products.list({ active: true, limit: 100 });
  const product = products.data.find((p) => p.metadata.app === "vet-cloud");

  if (!product) {
    throw new Error(
      "Stripe product not found. Add metadata app=vet-cloud to your subscription product."
    );
  }

  // Fetch all active prices for this product
  const { data: prices } = await stripe.prices.list({
    product: product.id,
    active: true,
    limit: 100,
  });

  const tiers: StripePriceTier[] = prices
    .filter((p) => p.metadata.seats && p.unit_amount !== null)
    .map((p) => ({
      priceId: p.id,
      seats: parseInt(p.metadata.seats, 10),
      monthlyPrice: p.unit_amount!,
    }))
    .sort((a, b) => a.seats - b.seats);

  if (tiers.length === 0) {
    throw new Error(
      "No Stripe prices found. Add metadata seats=<n> to each active price."
    );
  }

  _cache = tiers;
  _cacheExpiresAt = Date.now() + CACHE_TTL_MS;

  return tiers;
}

/**
 * Returns the cheapest tier that covers the requested seat count.
 * If seats exceed all tiers, returns the largest tier.
 */
export async function getPriceBySeats(seats: number): Promise<StripePriceTier> {
  const tiers = await getStripePrices();
  return tiers.find((t) => t.seats >= seats) ?? tiers[tiers.length - 1];
}

/**
 * Returns the tier matching priceId, or null if not found.
 * Returns null (instead of throwing) if Stripe product is not yet configured.
 */
export async function getPriceById(
  priceId: string
): Promise<StripePriceTier | null> {
  try {
    const tiers = await getStripePrices();
    return tiers.find((t) => t.priceId === priceId) ?? null;
  } catch {
    return null;
  }
}

/** Invalidates the price cache — useful after Stripe webhook price.updated events. */
export function invalidatePriceCache() {
  _cache = null;
  _cacheExpiresAt = 0;
}
