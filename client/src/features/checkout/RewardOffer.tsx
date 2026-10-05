import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Gift } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Money } from '@/components/Money';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Cart, CheckoutQuote } from '@/lib/apiTypes';
import { describeError } from '@/lib/errors';
import { useAvailableRewards } from '../rewards/rewardsApi';
import { quoteQueryOptions } from './checkoutApi';

interface RewardOfferProps {
  cart: Cart;
  /** The validated quote for the applied code, or null when no code is applied. */
  appliedQuote: CheckoutQuote | null;
  /** Explains why a code is not (or no longer) applied, e.g. it was just used elsewhere. */
  notice: string | null;
  onApply: (code: string) => void;
  onRemove: () => void;
}

const LINK_BUTTON =
  'inline-flex items-center rounded-sm text-sm font-medium underline-offset-2 hover:underline coarse:min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function normalizeRewardCode(code: string): string {
  return code.trim().toUpperCase();
}

function AppliedReward({ quote, onRemove }: { quote: CheckoutQuote; onRemove: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-success/40 bg-success/5 p-3">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
        <div className="flex flex-col gap-0.5">
          <p className="font-medium">
            <span className="font-mono">{quote.coupon?.code}</span> applied
          </p>
          <p className="text-sm text-success">
            You save <Money amountMinor={quote.discountMinor} />
          </p>
        </div>
      </div>
      <button type="button" onClick={onRemove} className={`${LINK_BUTTON} text-muted-foreground`}>
        Remove
      </button>
    </div>
  );
}

/** The best available reward, with its exact saving on this cart and a one-tap Apply. */
function BestOffer({ cart, onApply }: { cart: Cart; onApply: (code: string) => void }) {
  const best = useAvailableRewards().data?.[0] ?? null;
  const quote = useQuery({
    ...quoteQueryOptions(cart, best?.code ?? null),
    enabled: best !== null,
  });
  if (!best || !quote.data || quote.data.discountMinor === 0) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-accent/60 bg-accent/5 p-3">
      <div className="flex items-center gap-3">
        <Gift className="size-5 shrink-0 text-accent" aria-hidden />
        <div className="flex flex-col gap-0.5">
          <p className="font-medium">
            Save <Money amountMinor={quote.data.discountMinor} /> on this order
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="font-mono">{best.code}</span> · {best.percentOff}% off
          </p>
        </div>
      </div>
      <Button size="sm" aria-label={`Apply reward ${best.code}`} onClick={() => onApply(best.code)}>
        Apply
      </Button>
    </div>
  );
}

/** "Have a code?" link that opens a field; the code is checked against the server on Apply. */
function CodeEntry({ cart, onApply }: { cart: Cart; onApply: (code: string) => void }) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const validation = useMutation({
    mutationFn: (code: string) => queryClient.fetchQuery(quoteQueryOptions(cart, code)),
    onSuccess: (quote) => quote.coupon && onApply(quote.coupon.code),
  });

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`${LINK_BUTTON} self-start text-accent`}
      >
        Have a code?
      </button>
    );
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const code = normalizeRewardCode(codeInput);
    if (code) validation.mutate(code);
  };
  const errorMessage = validation.error ? describeError(validation.error).description : null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label htmlFor="reward-code" className="text-sm text-muted-foreground">
        Reward code
      </label>
      <div className="flex gap-2">
        <Input
          id="reward-code"
          value={codeInput}
          onChange={(event) => {
            setCodeInput(event.target.value);
            validation.reset();
          }}
          placeholder="SAVE-XXXXXXXX"
          maxLength={64}
          autoComplete="off"
          // The field only appears after the shopper asks for it, so focusing it is expected.
          autoFocus
          aria-invalid={errorMessage !== null}
          aria-describedby={errorMessage ? 'reward-code-error' : undefined}
          className="max-w-xs font-mono uppercase"
        />
        <Button
          type="submit"
          variant="outline"
          disabled={validation.isPending || !codeInput.trim()}
        >
          {validation.isPending ? 'Applying…' : 'Apply'}
        </Button>
      </div>
      {errorMessage && (
        <p id="reward-code-error" className="text-sm text-danger">
          {errorMessage}
        </p>
      )}
    </form>
  );
}

/**
 * Offers & rewards at checkout. Follows production checkouts: one suggested reward with its
 * exact saving, a collapsed "Have a code?" field, specific inline errors, and once applied a
 * confirmation with the amount saved and a Remove link instead of the field.
 */
export function RewardOffer({ cart, appliedQuote, notice, onApply, onRemove }: RewardOfferProps) {
  return (
    <section
      aria-labelledby="offers-heading"
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
    >
      <h2 id="offers-heading" className="text-[15px] font-medium">
        Offers & rewards
      </h2>
      {notice && (
        <p role="status" className="text-sm text-warning">
          {notice}
        </p>
      )}
      {appliedQuote?.coupon ? (
        <AppliedReward quote={appliedQuote} onRemove={onRemove} />
      ) : (
        <>
          <BestOffer cart={cart} onApply={onApply} />
          <CodeEntry cart={cart} onApply={onApply} />
        </>
      )}
    </section>
  );
}
