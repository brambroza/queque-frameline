import { handleDocumentBatch } from '@/lib/integration/api-handler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/** ERP push of Sales Orders (customer pickups). Header `X-API-Key`; body `{ documents: [...] }`. */
export async function POST(req: Request) {
  return handleDocumentBatch(req, 'so');
}
