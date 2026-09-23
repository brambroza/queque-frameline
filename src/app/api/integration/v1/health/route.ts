import { handleHealth } from '@/lib/integration/api-handler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** First call for the ERP team: proves TLS, DNS, the header and the key. */
export async function GET(req: Request) {
  return handleHealth(req);
}
