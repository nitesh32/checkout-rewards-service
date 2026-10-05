import { Minus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** The API's per-line limit; the stepper never offers more than this or the available stock. */
export const MAX_LINE_QUANTITY = 100;

interface QuantityStepperProps {
  itemName: string;
  quantity: number;
  availableStock: number;
  isBusy: boolean;
  onChange: (quantity: number) => void;
  onRemove: () => void;
  /** `filled` on product cards (strong "in your cart" signal), `outline` in the cart drawer. */
  tone?: 'filled' | 'outline';
}

/**
 * A compact `− qty +` control. At quantity 1 the minus becomes a bin and removes the item,
 * as in most shopping apps, instead of being disabled.
 */
export function QuantityStepper({
  itemName,
  quantity,
  availableStock,
  isBusy,
  onChange,
  onRemove,
  tone = 'outline',
}: QuantityStepperProps) {
  const isLastUnit = quantity <= 1;
  const isAtMaximum = quantity >= Math.min(MAX_LINE_QUANTITY, availableStock);
  const isFilled = tone === 'filled';
  const buttonClassName = isFilled ? 'text-accent-foreground hover:bg-accent-foreground/15' : '';

  return (
    <div
      role="group"
      aria-label={`Quantity of ${itemName}`}
      className={cn(
        'inline-flex items-center rounded-lg',
        isFilled ? 'bg-accent text-accent-foreground' : 'border border-border bg-surface',
      )}
    >
      <Button
        variant="ghost"
        size="iconSm"
        aria-label={
          isLastUnit ? `Remove ${itemName} from cart` : `Decrease quantity of ${itemName}`
        }
        disabled={isBusy}
        onClick={() => (isLastUnit ? onRemove() : onChange(quantity - 1))}
        className={buttonClassName}
      >
        {isLastUnit ? <Trash2 /> : <Minus />}
      </Button>
      <span className="min-w-8 text-center text-sm font-semibold tabular-nums">{quantity}</span>
      <Button
        variant="ghost"
        size="iconSm"
        aria-label={`Increase quantity of ${itemName}`}
        title={isAtMaximum ? `Only ${availableStock} available` : undefined}
        disabled={isBusy || isAtMaximum}
        onClick={() => onChange(quantity + 1)}
        className={buttonClassName}
      >
        <Plus />
      </Button>
    </div>
  );
}
