export const queryKeys = {
  products: ['products'] as const,
  cart: (cartId: string) => ['cart', cartId] as const,
  order: (orderId: string) => ['order', orderId] as const,
  availableRewards: ['rewards', 'available'] as const,
};
