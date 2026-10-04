import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

interface SwitchProps extends Omit<ComponentProps<'button'>, 'onChange'> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function Switch({ checked, onCheckedChange, className, ...props }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'inline-flex h-5 w-9 coarse:h-7 coarse:w-12 shrink-0 items-center rounded-full border border-transparent p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        checked ? 'bg-accent' : 'bg-input',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'block size-4 coarse:size-6 rounded-full bg-surface shadow-sm transition-transform',
          checked ? 'translate-x-4 coarse:translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  );
}
