/** Public URLs handed to customers, suppliers and drivers. */

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
}

/** Customer / supplier self-booking page for one SO / PO. */
export function bookingUrl(token: string): string {
  return `${appUrl()}/book/${encodeURIComponent(token)}`;
}

/** Driver's read-only DO page for one booking. */
export function driverUrl(token: string): string {
  return `${appUrl()}/driver/${encodeURIComponent(token)}`;
}
