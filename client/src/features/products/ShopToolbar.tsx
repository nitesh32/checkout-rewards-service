import { Search } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { CATEGORIES, type Category } from '@/lib/productMedia';
import { cn } from '@/lib/utils';
import { SORT_OPTIONS, type SortValue } from './filterProducts';

interface ShopToolbarProps {
  searchText: string;
  category: Category | null;
  sort: SortValue;
  isInStockOnly: boolean;
  onSearchTextChange: (text: string) => void;
  onCategoryChange: (category: Category | null) => void;
  onSortChange: (sort: SortValue) => void;
  onInStockOnlyChange: (isInStockOnly: boolean) => void;
}

function isTypingInField(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function ShopToolbar(props: ShopToolbarProps) {
  const searchInput = useRef<HTMLInputElement>(null);

  // "/" or Cmd/Ctrl+K jumps to the search box.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isShortcut =
        event.key === '/' || (event.key === 'k' && (event.metaKey || event.ctrlKey));
      if (!isShortcut || isTypingInField(event.target)) return;
      event.preventDefault();
      searchInput.current?.focus();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="sticky top-16 z-20 -mx-4 flex flex-col gap-3 bg-background/80 px-4 py-3 backdrop-blur">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative md:w-80">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            ref={searchInput}
            type="search"
            aria-label="Search products"
            placeholder="Search products"
            value={props.searchText}
            onChange={(event) => props.onSearchTextChange(event.target.value)}
            className="rounded-full pl-9 pr-10"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border px-1.5 text-xs text-muted-foreground max-md:hidden">
            /
          </kbd>
        </div>

        <div className="flex flex-wrap items-center gap-4 md:ml-auto">
          <label className="flex items-center gap-2 text-sm coarse:min-h-11">
            <Switch checked={props.isInStockOnly} onCheckedChange={props.onInStockOnlyChange} />
            In stock only
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Sort</span>
            <select
              value={props.sort}
              onChange={(event) => props.onSortChange(event.target.value as SortValue)}
              className="h-9 coarse:h-11 rounded-full border border-input bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {SORT_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div role="group" aria-label="Category" className="flex gap-2 overflow-x-auto pb-1">
        {[null, ...CATEGORIES].map((category) => {
          const isSelected = props.category === category;
          return (
            <button
              key={category ?? 'all'}
              type="button"
              aria-pressed={isSelected}
              onClick={() => props.onCategoryChange(category)}
              className={cn(
                'inline-flex shrink-0 items-center rounded-full border px-3.5 py-1.5 coarse:min-h-11 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isSelected
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-surface text-muted-foreground hover:text-foreground',
              )}
            >
              {category ?? 'All'}
            </button>
          );
        })}
      </div>
    </div>
  );
}
