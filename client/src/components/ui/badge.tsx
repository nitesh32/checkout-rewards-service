import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const TONE_CLASSES = {
  neutral: 'border-border bg-muted text-muted-foreground',
  accent: 'border-accent/30 bg-accent/10 text-accent',
  success: 'border-success/30 bg-success/10 text-success',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  danger: 'border-danger/30 bg-danger/10 text-danger',
} as const;

export type BadgeTone = keyof typeof TONE_CLASSES;

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: ComponentProps<'span'> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-xs font-medium',
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    />
  );
}
