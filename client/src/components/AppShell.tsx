import { Gift, Moon, ShoppingBag, Sun } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router';
import { Toaster } from 'sonner';
import { AnnouncementBar } from '@/components/AnnouncementBar';
import { Logo } from '@/components/Logo';
import { Money } from '@/components/Money';
import { SiteFooter } from '@/components/SiteFooter';
import { Button } from '@/components/ui/button';
import { CartSheet } from '@/features/cart/CartSheet';
import { useCartSheet } from '@/features/cart/CartSheetContext';
import { useCart } from '@/features/cart/cartApi';
import { useAvailableRewards } from '@/features/rewards/rewardsApi';
import { useTheme } from '@/lib/theme';
import { useScrolled } from '@/lib/useScrolled';
import { cn } from '@/lib/utils';

function navLinkClasses({ isActive }: { isActive: boolean }): string {
  return cn(
    'inline-flex items-center rounded-full px-3 py-1.5 coarse:min-h-11 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    isActive ? 'text-foreground' : 'text-muted-foreground',
  );
}

function RewardsPill() {
  const rewards = useAvailableRewards();
  const count = rewards.data?.length ?? 0;
  return (
    <Link
      to="/rewards"
      aria-label={count > 0 ? `Rewards, ${count} available` : 'Rewards'}
      className="hidden items-center gap-1.5 rounded-full bg-highlight px-3 py-1.5 coarse:min-h-11 text-sm font-semibold text-highlight-foreground transition-colors hover:bg-highlight/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
    >
      <Gift className="size-4" aria-hidden />
      Rewards
      {count > 0 && <span className="tabular-nums">· {count}</span>}
    </Link>
  );
}

function CartButton() {
  const { setOpen } = useCartSheet();
  const cart = useCart();
  const itemCount = cart.data?.lines.reduce((total, line) => total + line.quantity, 0) ?? 0;

  return (
    <Button className="relative gap-2 px-3" onClick={() => setOpen(true)} aria-label="Open cart">
      <ShoppingBag />
      {itemCount > 0 && cart.data ? (
        // The key restarts the pop animation whenever the count changes.
        <span
          key={itemCount}
          className="flex animate-pop items-center gap-1.5 font-semibold tabular-nums"
        >
          {itemCount}
          <span aria-hidden className="opacity-60">
            ·
          </span>
          <Money amountMinor={cart.data.subtotalMinor} />
        </span>
      ) : (
        <span className="font-semibold">Cart</span>
      )}
      <span className="sr-only" aria-live="polite">
        {itemCount} items in cart
      </span>
    </Button>
  );
}

function SiteHeader() {
  const { theme, toggleTheme } = useTheme();
  const isScrolled = useScrolled();

  return (
    <header
      className={cn(
        'sticky top-0 z-30 border-b bg-surface/90 backdrop-blur transition-colors',
        isScrolled ? 'border-border' : 'border-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link
            to="/products"
            aria-label="Margin home"
            className="inline-flex items-center rounded-md coarse:min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Logo />
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
            <NavLink to="/products" className={navLinkClasses}>
              Shop
            </NavLink>
            <NavLink to="/rewards" className={navLinkClasses}>
              Rewards
            </NavLink>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <RewardsPill />
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? <Sun /> : <Moon />}
          </Button>
          <CartButton />
        </div>
      </div>
    </header>
  );
}

export function AppShell() {
  const { theme } = useTheme();

  return (
    <div id="top" className="flex min-h-screen flex-col">
      <AnnouncementBar />
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <SiteFooter />
      <CartSheet />
      <Toaster
        position="bottom-right"
        theme={theme}
        // The "added to cart" toast shows a 40px product thumbnail; Sonner's icon slot defaults to
        // 16px and its own stylesheet wins over plain CSS, so the size is set with !important utilities.
        toastOptions={{ classNames: { icon: '!mr-3 !ml-0 !size-10' } }}
      />
    </div>
  );
}
