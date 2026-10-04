import { cn } from '@/lib/utils';

interface LogoProps {
  variant?: 'mark' | 'full';
  className?: string;
}

/** A rounded square with an "M" drawn as two strokes, optionally followed by the wordmark. */
export function Logo({ variant = 'full', className }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect width="24" height="24" rx="6" className="fill-accent" />
        <g
          className="stroke-accent-foreground"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6.5 17.5V7l5.5 6.5" />
          <path d="M12 13.5 17.5 7v10.5" />
        </g>
      </svg>
      {variant === 'full' ? (
        <span className="text-xl font-bold leading-none tracking-tight">Margin</span>
      ) : (
        <span className="sr-only">Margin</span>
      )}
    </span>
  );
}
