import { PackageSearch } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Product } from '@/lib/apiTypes';
import { CATEGORIES, type Category } from '@/lib/productMedia';
import { useDebouncedCallback } from '@/lib/useDebouncedCallback';
import { filterAndSortProducts, SORT_OPTIONS, type SortValue } from './filterProducts';
import { ProductCard } from './ProductCard';
import { useProducts } from './productsApi';
import { QuickViewDialog } from './QuickViewDialog';
import { ShopToolbar } from './ShopToolbar';

function isCategory(value: string | null): value is Category {
  return CATEGORIES.some((category) => category === value);
}

function isSortValue(value: string | null): value is SortValue {
  return SORT_OPTIONS.some((option) => option.value === value);
}

// The first photo is the page's largest paint, so only it is fetched at high priority; giving
// several photos high priority makes them compete for bandwidth and slows that first paint.
const PRIORITY_PHOTOS = 1;

// Typing filters the list instantly; the address bar catches up once the shopper pauses.
const URL_SYNC_DEBOUNCE_MS = 200;

function ProductGrid({ children }: { children: React.ReactNode }) {
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
      {children}
    </ul>
  );
}

function ProductGridSkeleton() {
  return (
    <ProductGrid>
      {Array.from({ length: 8 }, (_, index) => (
        <li
          key={index}
          className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-3"
        >
          <Skeleton className="aspect-[4/5] rounded-xl" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-6 w-1/4" />
        </li>
      ))}
    </ProductGrid>
  );
}

export function ProductsPage() {
  // Every filter lives in the URL, so a filtered view can be bookmarked or shared.
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearchText = searchParams.get('q') ?? '';
  const isInStockOnly = searchParams.get('inStock') === 'true';
  const categoryParam = searchParams.get('category');
  const category = isCategory(categoryParam) ? categoryParam : null;
  const sortParam = searchParams.get('sort');
  const sort = isSortValue(sortParam) ? sortParam : 'featured';

  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const products = useProducts();

  // The search box has its own state so typing never waits on the URL. If the URL changes for
  // another reason (back button, "Clear filters"), the box follows it.
  const [searchText, setSearchText] = useState(urlSearchText);
  const [previousUrlSearchText, setPreviousUrlSearchText] = useState(urlSearchText);
  if (urlSearchText !== previousUrlSearchText) {
    setPreviousUrlSearchText(urlSearchText);
    if (urlSearchText !== searchText.trim()) setSearchText(urlSearchText);
  }

  const setParam = (name: string, value: string | null) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(name, value);
        else next.delete(name);
        return next;
      },
      { replace: true },
    );
  };
  const syncSearchToUrl = useDebouncedCallback(
    (text: string) => setParam('q', text.trim()),
    URL_SYNC_DEBOUNCE_MS,
  );
  const changeSearchText = (text: string) => {
    setSearchText(text);
    syncSearchToUrl(text);
  };
  const clearFilters = () => {
    setSearchText('');
    setSearchParams({}, { replace: true });
  };

  const loadedProducts = products.data?.pages.flatMap((page) => page.data) ?? [];
  const visibleProducts = filterAndSortProducts(loadedProducts, {
    searchText,
    isInStockOnly,
    category,
    sort,
  });
  const hasActiveFilters = searchText.trim() !== '' || isInStockOnly || category !== null;

  return (
    <div className="flex flex-col gap-2">
      <title>Shop · Margin</title>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-[28px] font-bold leading-9 tracking-tight">Shop all</h1>
        {products.isSuccess && (
          <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
            {visibleProducts.length} {visibleProducts.length === 1 ? 'product' : 'products'}
          </p>
        )}
      </div>

      <ShopToolbar
        searchText={searchText}
        category={category}
        sort={sort}
        isInStockOnly={isInStockOnly}
        onSearchTextChange={changeSearchText}
        onCategoryChange={(next) => setParam('category', next)}
        onSortChange={(next) => setParam('sort', next === 'featured' ? null : next)}
        onInStockOnlyChange={(next) => setParam('inStock', next ? 'true' : null)}
      />

      <div className="pt-4">
        {products.isLoading && <ProductGridSkeleton />}
        {products.isError && (
          <ErrorState error={products.error} onRetry={() => void products.refetch()} />
        )}
        {products.isSuccess && visibleProducts.length === 0 && (
          <EmptyState
            icon={PackageSearch}
            title={
              searchText.trim()
                ? `No products match "${searchText.trim()}"`
                : 'No products match these filters'
            }
            description="Try a different search, or clear the filters to see everything."
            action={
              hasActiveFilters && (
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              )
            }
          />
        )}
        {visibleProducts.length > 0 && (
          <ProductGrid>
            {visibleProducts.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                isAboveTheFold={index < PRIORITY_PHOTOS}
                onOpenQuickView={setQuickViewProduct}
              />
            ))}
          </ProductGrid>
        )}
        {products.hasNextPage && (
          <div className="flex justify-center pt-8">
            <Button
              variant="outline"
              disabled={products.isFetchingNextPage}
              onClick={() => void products.fetchNextPage()}
            >
              {products.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </Button>
          </div>
        )}
      </div>

      <QuickViewDialog product={quickViewProduct} onClose={() => setQuickViewProduct(null)} />
    </div>
  );
}
