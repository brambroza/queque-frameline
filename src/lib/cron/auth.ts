/**
 * Shared bearer check for every `/api/cron/*` route.
 *
 * Vercel Cron and the Supabase pg_cron trigger both send
 * `Authorization: Bearer <CRON_SECRET>`. With the secret unset the routes
 * refuse everything, so a deploy that forgot the env cannot be triggered
 * from the open internet.
 *
 * @param req - Incoming request.
 * @returns true when the bearer token matches `CRON_SECRET`.
 */
export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization') ?? '';
  return header === `Bearer ${secret}`;
}
