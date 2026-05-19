import { getStripeClient } from "@/lib/stripe/client";

export type TierName = "solo" | "praxis" | "klinik";
export type BillingInterval = "monthly" | "annual";

export const TRIAL_DAYS = 90;

export const TIER_SEATS: Record<TierName, number> = {
  solo: 3,
  praxis: 7,
  klinik: 15,
};

export const TIER_ORDER: TierName[] = ["solo", "praxis", "klinik"];

export interface StripeTier {
  priceId: string;
  tier: TierName;
  seats: number;
  unitAmount: number; // in cents
  interval: BillingInterval;
}

export interface StripeAddon {
  priceId: string;
  addon: "website-builder";
  unitAmount: number;
  interval: BillingInterval;
}

// ── In-memory cache ────────────────────────────────────────────────────────
// 1-hour TTL. To change pricing: update in Stripe Dashboard.
let _tierCache: StripeTier[] | null = null;
let _addonCache: StripeAddon[] | null = null;
let _cacheExpiresAt = 0;
const CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Fetches all active tier prices from Stripe.
 *
 * Stripe setup required (one-time, in Stripe Dashboard):
 *   Product metadata:  app = vet-cloud, tier = solo|praxis|klinik, seats = <n>
 *   Price metadata:    billing_interval = monthly|annual
 *
 * Returns monthly + annual prices for all tiers, sorted by tier order + interval.
 */
export async function getStripePrices(): Promise<StripeTier[]> {
  if (_tierCache && Date.now() < _cacheExpiresAt) return _tierCache;
  await _refreshCache();
  return _tierCache!;
}

export async function getStripeAddons(): Promise<StripeAddon[]> {
  if (_addonCache && Date.now() < _cacheExpiresAt) return _addonCache;
  await _refreshCache();
  return _addonCache!;
}

type RawPrice = { id: string; unit_amount: number | null; recurring?: { interval: string } | null; metadata?: Record<string, string> };

async function _refreshCache(): Promise<void> {
  const stripe = getStripeClient();

  const { data: products } = await stripe.products.list({ active: true, limit: 100 });
  const tierProducts = products.filter(
    (p) => p.metadata.app === "vet-cloud" && p.metadata.tier
  );
  const addonProducts = products.filter(
    (p) => p.metadata.app === "vet-cloud" && p.metadata.type === "addon"
  );

  if (tierProducts.length === 0) {
    throw new Error(
      "No Stripe tier products found. Add metadata app=vet-cloud and tier=solo|praxis|klinik to each product."
    );
  }

  const fetchAllPrices = async (prods: typeof tierProducts): Promise<Array<{ product: typeof tierProducts[0]; price: RawPrice }>> => {
    const results = await Promise.all(
      prods.map(async (product) => {
        const { data: prices } = await stripe.prices.list({ product: product.id, active: true, limit: 10 });
        return prices.map((price) => ({ product, price: price as RawPrice }));
      })
    );
    return results.flat();
  };

  const resolveInterval = (price: RawPrice): BillingInterval =>
    price.metadata?.billing_interval === "annual" || price.recurring?.interval === "year"
      ? "annual"
      : "monthly";

  const tierEntries = await fetchAllPrices(tierProducts);
  const tiers: StripeTier[] = tierEntries
    .map(({ product, price }) => {
      if (price.unit_amount === null) return null;
      const tier = product.metadata.tier as TierName;
      if (!TIER_ORDER.includes(tier)) return null;
      const seats = parseInt(product.metadata.seats ?? "0", 10) || TIER_SEATS[tier];
      return { priceId: price.id, tier, seats, unitAmount: price.unit_amount, interval: resolveInterval(price) } satisfies StripeTier;
    })
    .filter((t): t is StripeTier => t !== null)
    .sort((a, b) => {
      const tierDiff = TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier);
      return tierDiff !== 0 ? tierDiff : a.interval === "monthly" ? -1 : 1;
    });

  const addonEntries = await fetchAllPrices(addonProducts);
  const addons: StripeAddon[] = addonEntries
    .map(({ product, price }) => {
      if (price.unit_amount === null) return null;
      if (product.metadata.addon !== "website-builder") return null;
      return { priceId: price.id, addon: "website-builder" as const, unitAmount: price.unit_amount, interval: resolveInterval(price) } satisfies StripeAddon;
    })
    .filter((a): a is StripeAddon => a !== null);

  _tierCache = tiers;
  _addonCache = addons;
  _cacheExpiresAt = Date.now() + CACHE_TTL_MS;
}

/** Returns the price for the given tier + interval. Throws if not found. */
export async function getPriceByTier(tier: TierName, interval: BillingInterval): Promise<StripeTier> {
  const tiers = await getStripePrices();
  const match = tiers.find((t) => t.tier === tier && t.interval === interval);
  if (!match) throw new Error(`No active Stripe price for tier=${tier} interval=${interval}`);
  return match;
}

/** Returns the Website Builder add-on price for the given interval. Throws if not found. */
export async function getWebsiteBuilderPrice(interval: BillingInterval): Promise<StripeAddon> {
  const addons = await getStripeAddons();
  const match = addons.find((a) => a.addon === "website-builder" && a.interval === interval);
  if (!match) throw new Error(`No active Stripe price for Website Builder interval=${interval}`);
  return match;
}

/** Returns the StripeTier for a priceId, or null if not found. */
export async function getTierByPriceId(priceId: string): Promise<StripeTier | null> {
  try {
    const tiers = await getStripePrices();
    return tiers.find((t) => t.priceId === priceId) ?? null;
  } catch {
    return null;
  }
}

/** Returns the StripeAddon for a priceId, or null if not found. */
export async function getAddonByPriceId(priceId: string): Promise<StripeAddon | null> {
  try {
    const addons = await getStripeAddons();
    return addons.find((a) => a.priceId === priceId) ?? null;
  } catch {
    return null;
  }
}

/** Invalidates the price cache — useful after Stripe webhook price.updated events. */
export function invalidatePriceCache() {
  _tierCache = null;
  _addonCache = null;
  _cacheExpiresAt = 0;
}
