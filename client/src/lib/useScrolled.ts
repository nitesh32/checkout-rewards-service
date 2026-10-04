import { useSyncExternalStore } from 'react';

const SCROLL_THRESHOLD_PX = 4;

function subscribe(listener: () => void): () => void {
  window.addEventListener('scroll', listener, { passive: true });
  return () => window.removeEventListener('scroll', listener);
}

/** True once the page has been scrolled; drives the header's hairline border. */
export function useScrolled(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.scrollY > SCROLL_THRESHOLD_PX,
    () => false,
  );
}
