import { useEffect, useRef } from 'react';

/** Calls `callback` once the caller has been quiet for `delayMs`; pending calls die on unmount. */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delayMs: number,
): (...args: Args) => void {
  const latestCallback = useRef(callback);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    latestCallback.current = callback;
  });
  useEffect(() => () => clearTimeout(timer.current), []);

  return (...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => latestCallback.current(...args), delayMs);
  };
}
