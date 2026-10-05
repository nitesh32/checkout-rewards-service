import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Briefly highlights its children when `value` changes, so live price or stock updates are noticed. */
export function FlashOnChange({
  value,
  children,
}: {
  value: string | number;
  children: ReactNode;
}) {
  const [previousValue, setPreviousValue] = useState(value);
  const [isFlashing, setIsFlashing] = useState(false);

  if (value !== previousValue) {
    setPreviousValue(value);
    setIsFlashing(true);
  }

  return (
    <span
      className={cn('rounded-sm', isFlashing && 'animate-flash')}
      onAnimationEnd={() => setIsFlashing(false)}
    >
      {children}
    </span>
  );
}
