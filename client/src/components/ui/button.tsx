import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const VARIANT_CLASSES = {
  default: 'bg-accent text-accent-foreground hover:bg-accent/90',
  secondary: 'bg-muted text-foreground hover:bg-muted/70',
  outline: 'border border-input bg-surface hover:bg-muted',
  ghost: 'hover:bg-muted',
  destructive: 'bg-danger text-accent-foreground hover:bg-danger/90',
} as const;

const SIZE_CLASSES = {
  default: 'h-9 px-4 coarse:min-h-11',
  sm: 'h-8 px-3 coarse:min-h-11',
  icon: 'size-9 coarse:size-11',
  iconSm: 'size-8 coarse:size-11',
} as const;

export interface ButtonStyleOptions {
  variant?: keyof typeof VARIANT_CLASSES;
  size?: keyof typeof SIZE_CLASSES;
  className?: string | undefined;
}

/** Exported so links (`<Link>`) can look like buttons without nesting a button in an anchor. */
export function buttonClasses({
  variant = 'default',
  size = 'default',
  className,
}: ButtonStyleOptions = {}): string {
  return cn(
    'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    className,
  );
}

export function Button({
  variant,
  size,
  className,
  type = 'button',
  ...props
}: ComponentProps<'button'> & ButtonStyleOptions) {
  return <button type={type} className={buttonClasses({ variant, size, className })} {...props} />;
}
