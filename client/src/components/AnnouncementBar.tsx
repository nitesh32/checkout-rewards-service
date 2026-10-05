import { X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

const STORAGE_KEY = 'announcementDismissed';

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function AnnouncementBar() {
  const [isDismissed, setIsDismissed] = useState(wasDismissed);
  if (isDismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Not remembered; the bar returns on the next visit.
    }
    setIsDismissed(true);
  };

  return (
    <div className="relative flex h-8 coarse:h-11 items-center justify-center bg-accent px-10 text-xs font-medium text-accent-foreground">
      <p className="truncate">
        Every few orders unlock a reward.{' '}
        <Link to="/rewards" className="underline underline-offset-2 hover:no-underline">
          See rewards
        </Link>
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss announcement"
        className="absolute right-2 flex items-center justify-center rounded-sm p-1 coarse:size-11 hover:bg-accent-foreground/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
