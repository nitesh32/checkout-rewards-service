export const queryKeys = {
  products: ['products'] as const,
  cart: (cartId: string) => ['cart', cartId] as const,
  order: (orderId: string) => ['order', orderId] as const,
  rewards: ['rewards'] as const,
  /** Starts with `rewards`, so invalidating the rewards also refreshes the progress. */
  rewardProgress: ['rewards', 'progress'] as const,
  /** `cartVersion` (the cart's `updatedAt`) makes a quote refresh whenever the cart changes. */
  quote: (cartId: string, couponCode: string | null, cartVersion: string) =>
    ['quote', cartId, couponCode, cartVersion] as const,
};
