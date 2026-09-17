/** Rows per request. PostgREST caps a single response at `max-rows` (1000 on Supabase). */
export const FETCH_PAGE_SIZE = 1000;
/** Upper bound on pages per call so one dashboard request cannot scan a shop's whole history. */
export const FETCH_MAX_PAGES = 20;

export type PageResult<T> = { data: T[] | null; error: unknown };

/**
 * Collect every row of a query by paging with `.range()` until a short page.
 *
 * `build(from, to)` must return a fresh query for the inclusive row window; the
 * caller is responsible for a stable `.order()` so pages do not overlap. Stops
 * at the first error (returned, not thrown) or after `maxPages` pages, in
 * which case `truncated` is set so the caller can decide whether to trust the
 * aggregate.
 */
export async function fetchAllPages<T>(
  build: (from: number, to: number) => PromiseLike<PageResult<T>>,
  opts: { pageSize?: number; maxPages?: number } = {},
): Promise<{ data: T[]; error: unknown; truncated: boolean }> {
  const pageSize = Math.max(1, opts.pageSize ?? FETCH_PAGE_SIZE);
  const maxPages = Math.max(1, opts.maxPages ?? FETCH_MAX_PAGES);
  const rows: T[] = [];
  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize;
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) return { data: rows, error, truncated: false };
    const chunk = data ?? [];
    rows.push(...chunk);
    if (chunk.length < pageSize) return { data: rows, error: null, truncated: false };
  }
  return { data: rows, error: null, truncated: true };
}
