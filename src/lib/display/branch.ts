/**
 * Pure rules for which branch a yard TV shows (`/display?branch=…`).
 * Kept out of the route so the matching and the URL shape can be unit-tested
 * and shared by the feed, the TV page and the portal's link list.
 */

export type DisplayBranch = { id: string; code: string | null; name: string };

/** `?branch=all`: one screen for every branch (control room). */
export const ALL_BRANCHES = 'all';

export type DisplayBranchPick =
  | { kind: 'branch'; branch: DisplayBranch }
  /** Every branch on one screen. */
  | { kind: 'all' }
  /** Several branches and none named: the TV asks which one. */
  | { kind: 'choose' }
  | { kind: 'not_found' };

/**
 * Resolve the `branch` query value against the site's active branches.
 *
 * Without a value a single-branch site shows that branch, and a site with
 * several branches gets the chooser — a gate TV must never mix another
 * warehouse's queue in by accident. The value matches a branch id exactly or a
 * branch code case-insensitively.
 *
 * @param branches Active branches of the site.
 * @param param Raw `branch` query value.
 */
export function pickDisplayBranch(branches: DisplayBranch[], param: string | null | undefined): DisplayBranchPick {
  const want = (param ?? '').trim();
  if (!want) {
    if (branches.length > 1) return { kind: 'choose' };
    return branches.length === 1 ? { kind: 'branch', branch: branches[0] } : { kind: 'all' };
  }
  const lower = want.toLowerCase();
  const branch = branches.find((b) => b.id === want) ?? branches.find((b) => (b.code ?? '').trim().toLowerCase() === lower);
  if (branch) return { kind: 'branch', branch };
  return lower === ALL_BRANCHES ? { kind: 'all' } : { kind: 'not_found' };
}

/** Value that names a branch in the TV URL: its code when it has one, else its id. */
export function displayBranchKey(branch: Pick<DisplayBranch, 'id' | 'code'>): string {
  return (branch.code ?? '').trim() || branch.id;
}

/**
 * Query string (`?branch=…&key=…`, or '') shared by the TV page and its feed.
 *
 * @param branch Branch key from `displayBranchKey`, `ALL_BRANCHES`, or '' for none.
 * @param key `DISPLAY_KEY` value (or a placeholder) — omitted when empty.
 */
export function displayQuery(branch: string, key = ''): string {
  const parts: string[] = [];
  if (branch) parts.push(`branch=${encodeURIComponent(branch)}`);
  if (key) parts.push(`key=${encodeURIComponent(key)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

/** TV path for one branch (or `ALL_BRANCHES`, or '' for the bare page), carrying the shared key when there is one. */
export function displayPath(branch: string, key = ''): string {
  return `/display${displayQuery(branch, key)}`;
}
