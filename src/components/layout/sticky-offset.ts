/**
 * Sticky offsets for portal page elements that pin below the app bar.
 *
 * The portal app bar is `position: sticky` and its height varies (safe-area
 * inset, wrapped breadcrumbs on phones). `PortalFrame` measures it and writes
 * the value to `--portal-appbar-h` on `<html>`, so any sticky card inside a
 * page can sit just below the bar instead of sliding underneath it.
 */

/** CSS custom property that holds the live app bar height in px. */
export const PORTAL_APPBAR_HEIGHT_VAR = '--portal-appbar-h';

/** Fallback used before the first measurement (Toolbar minHeight 72 + border). */
export const PORTAL_APPBAR_FALLBACK_PX = 73;

/**
 * `top` value for a sticky element inside a portal page.
 *
 * @param gapPx Extra space between the app bar and the element.
 */
export function stickyBelowAppBar(gapPx = 8): string {
  return `calc(var(${PORTAL_APPBAR_HEIGHT_VAR}, ${PORTAL_APPBAR_FALLBACK_PX}px) + ${gapPx}px)`;
}
