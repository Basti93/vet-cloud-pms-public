// Stripe pricing configuration (test environment)
export const STRIPE_PRICES = {
  // €30/month - 1 user
  SEATS_1: {
    priceId: "price_1TVoO4Fry6Q2J6YWzYXPFrjD",
    seats: 1,
    monthlyPrice: 3000, // in cents
  },
  // €50/month - 3 users
  SEATS_3: {
    priceId: "price_1TVoO5Fry6Q2J6YWFAA1axxi",
    seats: 3,
    monthlyPrice: 5000,
  },
  // €100/month - 5 users
  SEATS_5: {
    priceId: "price_1TVoO7Fry6Q2J6YWKYI1bQCS",
    seats: 5,
    monthlyPrice: 10000,
  },
  // €200/month - 10 users
  SEATS_10: {
    priceId: "price_1TVoO8Fry6Q2J6YWLsKK5xDQ",
    seats: 10,
    monthlyPrice: 20000,
  },
} as const;

export const TRIAL_DAYS = 90;

export function getPriceBySeats(seats: number) {
  if (seats <= 1) return STRIPE_PRICES.SEATS_1;
  if (seats <= 3) return STRIPE_PRICES.SEATS_3;
  if (seats <= 5) return STRIPE_PRICES.SEATS_5;
  return STRIPE_PRICES.SEATS_10;
}

export function getPriceById(
  priceId: string
): (typeof STRIPE_PRICES)[keyof typeof STRIPE_PRICES] | null {
  return (
    Object.values(STRIPE_PRICES).find((p) => p.priceId === priceId) || null
  );
}
