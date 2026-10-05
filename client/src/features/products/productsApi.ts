import { infiniteQueryOptions, useInfiniteQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

// The shop searches, filters and sorts in the browser, so it loads the whole catalogue (the API's
// page maximum). Beyond that, "Load more" fetches further pages; see DECISIONS.md.
const PAGE_SIZE = 100;

export const productsQueryOptions = infiniteQueryOptions({
  queryKey: queryKeys.products,
  initialPageParam: undefined as string | undefined,
  queryFn: async ({ pageParam, signal }) => {
    const { data } = await unwrap(
      api.GET('/products', { params: { query: { limit: PAGE_SIZE, cursor: pageParam } }, signal }),
    );
    return data;
  },
  getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
});

/** The product catalogue, one page at a time; `fetchNextPage` loads the next cursor. */
export function useProducts() {
  return useInfiniteQuery(productsQueryOptions);
}
