import { describe, expect, it, vi } from 'vitest';
import { fetchAllPages } from './fetch-all';

/** Simulates a PostgREST-style source that serves `total` rows in inclusive `.range()` windows. */
function source(total: number) {
  const all = Array.from({ length: total }, (_, i) => ({ i }));
  return vi.fn((from: number, to: number) => Promise.resolve({ data: all.slice(from, to + 1), error: null }));
}

describe('fetchAllPages', () => {
  it('returns a single short page without a second request', async () => {
    const build = source(7);
    const res = await fetchAllPages(build, { pageSize: 10 });
    expect(res.data).toHaveLength(7);
    expect(res.truncated).toBe(false);
    expect(build).toHaveBeenCalledTimes(1);
    expect(build).toHaveBeenCalledWith(0, 9);
  });

  it('keeps paging past the server row cap until a short page', async () => {
    const build = source(2500);
    const res = await fetchAllPages(build, { pageSize: 1000 });
    expect(res.data).toHaveLength(2500);
    expect(res.data[2499]).toEqual({ i: 2499 });
    expect(build).toHaveBeenCalledTimes(3);
    expect(build).toHaveBeenNthCalledWith(3, 2000, 2999);
  });

  it('issues one extra request when the total is an exact multiple of the page size', async () => {
    const build = source(2000);
    const res = await fetchAllPages(build, { pageSize: 1000 });
    expect(res.data).toHaveLength(2000);
    expect(build).toHaveBeenCalledTimes(3);
  });

  it('flags truncation when the page budget runs out', async () => {
    const build = source(5000);
    const res = await fetchAllPages(build, { pageSize: 1000, maxPages: 2 });
    expect(res.data).toHaveLength(2000);
    expect(res.truncated).toBe(true);
  });

  it('stops at the first error and hands it back', async () => {
    const err = { message: 'boom' };
    const build = vi.fn((from: number) => Promise.resolve(from === 0 ? { data: Array(10).fill({ i: 0 }), error: null } : { data: null, error: err }));
    const res = await fetchAllPages(build, { pageSize: 10 });
    expect(res.error).toBe(err);
    expect(res.data).toHaveLength(10);
    expect(build).toHaveBeenCalledTimes(2);
  });
});
