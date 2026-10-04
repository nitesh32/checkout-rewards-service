import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'cartId';
const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function write(cartId: string | null): void {
  try {
    if (cartId) localStorage.setItem(STORAGE_KEY, cartId);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode); the cart then lasts only until reload.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

/** The id of the customer's current cart, persisted so it survives reloads. */
export function useCartId(): string | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

export const cartIdStore = { get: read, set: write, clear: () => write(null) };
