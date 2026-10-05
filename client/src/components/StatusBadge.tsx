import { Badge, type BadgeTone } from '@/components/ui/badge';

const STATUS_TONES: Record<string, BadgeTone> = {
  PLACED: 'success',
  SUCCEEDED: 'success',
  AVAILABLE: 'accent',
  REDEEMED: 'neutral',
};

const STATUS_LABELS: Record<string, string> = {
  PLACED: 'Placed',
  SUCCEEDED: 'Paid',
  AVAILABLE: 'Available',
  REDEEMED: 'Redeemed',
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONES[status] ?? 'neutral'}>{STATUS_LABELS[status] ?? status}</Badge>;
}
