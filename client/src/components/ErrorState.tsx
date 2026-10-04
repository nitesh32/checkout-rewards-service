import { AlertCircle, RotateCw } from 'lucide-react';
import { describeError } from '@/lib/errors';
import { Button } from '@/components/ui/button';

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  const { title, description } = describeError(error);
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4"
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw /> Try again
        </Button>
      )}
    </div>
  );
}
