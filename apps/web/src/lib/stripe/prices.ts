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

  // Fetch all active products tagged app=vet-cloud — each product = one seat tier.
  // Product metadata: app=vet-cloud, seats=<n>
  // Each product has exactly one active price.
  const { data: products } = await stripe.products.list({ active: true, limit: 100 });
  const tierProducts = products.filter(
    (p) => p.metadata.app === "vet-cloud" && p.metadata.seats
  );

  if (tierProducts.length === 0) {
    throw new Error(
      "No Stripe products found. Add metadata app=vet-cloud and seats=<n> to each subscription product."
    );
  }

  // For each product fetch its first active price
  const tiers: StripePriceTier[] = (
    await Promise.all(
      tierProducts.map(async (product) => {
        const { data: prices } = await stripe.prices.list({
          product: product.id,
          active: true,
          limit: 1,
        });
        const price = prices[0];
        if (!price || price.unit_amount === null) return null;
        return {
          priceId: price.id,
          seats: parseInt(product.metadata.seats, 10),
          monthlyPrice: price.unit_amount,
        };
      })
    )
  )
    .filter((t): t is StripePriceTier => t !== null)
    .sort((a, b) => a.seats - b.seats);

  if (tiers.length === 0) {
    throw new Error("No active Stripe prices found for vet-cloud products.");
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
