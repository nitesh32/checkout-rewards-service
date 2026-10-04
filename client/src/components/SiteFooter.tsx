import { Link } from 'react-router';
import { Logo } from '@/components/Logo';

const LINK_COLUMNS = [
  { title: 'Shop', links: ['Audio', 'Phones', 'Wearables', 'Cameras'] },
  { title: 'Help', links: ['Shipping', 'Returns', 'Contact'] },
  { title: 'Company', links: ['About', 'Journal', 'Stockists'] },
] as const;

const PAYMENT_METHODS = ['UPI', 'Cards', 'Net banking'];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-3">
          <Link
            to="/products"
            aria-label="Margin home"
            className="inline-flex items-center self-start rounded-md coarse:min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Logo />
          </Link>
          <p className="max-w-xs text-muted-foreground">Premium tech, made simple.</p>
        </div>
        {LINK_COLUMNS.map(({ title, links }) => (
          <nav key={title} aria-label={title} className="flex flex-col gap-3">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {title}
            </h2>
            <ul className="flex flex-col gap-2">
              {links.map((label) => (
                <li key={label}>
                  <a
                    href="#top"
                    className="inline-flex items-center rounded-sm py-1 coarse:min-h-11 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-xs text-muted-foreground">
          <p>© 2026 Margin</p>
          <ul className="flex gap-2" aria-label="Accepted payment methods">
            {PAYMENT_METHODS.map((method) => (
              <li key={method} className="rounded-full border border-border px-2.5 py-0.5">
                {method}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
