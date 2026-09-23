/**
 * ERP push handler behind `POST /api/integration/v1/{sales-orders,purchase-orders}`.
 *
 * One request = one batch of documents. Every item is validated and written on
 * its own, so a bad line in one document never blocks the others, and the
 * response is HTTP 200 with a per-document result whenever the batch was
 * processed at all (the AX side treats any non-2xx as "retry later").
 */
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DocumentType } from '@/types/db';
import { IntegrationError, clientIp, integrationErrorResponse, requireApiKey, type ApiKeyContext } from '@/lib/integration/auth';
import { apiDocumentUpsertSchema } from '@/lib/integration/schemas';
import { upsertDocument, type UpsertOutcome } from '@/lib/integration/upsert';
import type { BranchRow } from '@/lib/integration/rules';
import { API_MAX_BODY_BYTES, API_MAX_DOCUMENTS, formatZodIssues, normalizeApiItem, peekDocNo, summarizeBatch, type BatchSummary, type DocumentResult } from '@/lib/integration/batch';
import { notifyPaymentCleared } from '@/lib/booking/payment-notify';
import { isPaymentCleared } from '@/lib/booking/payment';
import { safeCreateNotification } from '@/lib/notifications/createNotification';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

type Envelope = { documents: unknown[] };

/** Read and shape-check the body without trusting Content-Type (X++ often sends `text/json`). */
async function readEnvelope(req: Request): Promise<Envelope> {
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > API_MAX_BODY_BYTES) throw new IntegrationError(413, 'payload_too_large', `Body exceeds ${API_MAX_BODY_BYTES} bytes`);
  const text = await req.text();
  if (Buffer.byteLength(text, 'utf8') > API_MAX_BODY_BYTES) throw new IntegrationError(413, 'payload_too_large', `Body exceeds ${API_MAX_BODY_BYTES} bytes`);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new IntegrationError(400, 'invalid_body', 'Body is not valid JSON');
  }
  const docs = json && typeof json === 'object' && !Array.isArray(json) ? (json as { documents?: unknown }).documents : undefined;
  if (!Array.isArray(docs)) throw new IntegrationError(400, 'invalid_body', 'Expected { "documents": [ ... ] }');
  if (docs.length === 0) throw new IntegrationError(400, 'invalid_body', 'documents is empty');
  if (docs.length > API_MAX_DOCUMENTS) throw new IntegrationError(400, 'invalid_body', `At most ${API_MAX_DOCUMENTS} documents per request`);
  return { documents: docs };
}

function requestIdOf(req: Request): string {
  const given = req.headers.get('x-request-id')?.trim();
  return given && given.length <= 100 ? given : randomUUID();
}

/** Skip a second unread alert about the same document, so a nightly retry does not pile them up. */
async function hasUnreadAlert(admin: SupabaseClient, shopId: string, type: string, relatedId: string): Promise<boolean> {
  const { count } = await admin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('shop_id', shopId)
    .eq('type', type)
    .eq('related_id', relatedId)
    .eq('is_read', false)
    .eq('is_archived', false);
  return (count ?? 0) > 0;
}

async function afterUpsert(ctx: ApiKeyContext, docType: DocumentType, doc: { doc_no: string }, outcome: UpsertOutcome) {
  const { admin, site } = ctx;
  if (outcome.ok) {
    if (outcome.payment_changed && !isPaymentCleared('so', outcome.payment_changed.from) && isPaymentCleared('so', outcome.payment_changed.to)) {
      await notifyPaymentCleared(admin, site, { id: outcome.id, doc_no: outcome.doc_no, partner_name: outcome.partner_name, branch_id: outcome.branch_id }, outcome.payment_changed.to);
    }
    return;
  }
  if (outcome.code !== 'has_live_bookings' && outcome.code !== 'branch_locked') return;

  // The ERP wants a change we refused because queues are still on the board: staff must act.
  const { data: row } = await admin
    .from('external_documents')
    .select('id,branch_id,partner_name')
    .eq('shop_id', site.shopId)
    .eq('doc_type', docType)
    .eq('doc_no', doc.doc_no)
    .maybeSingle();
  if (!row) return;
  const type = outcome.code === 'has_live_bookings' ? 'document_cancel_blocked' : 'document_branch_locked';
  if (await hasUnreadAlert(admin, site.shopId, type, row.id as string)) return;
  const label = docType.toUpperCase();
  await safeCreateNotification(admin, {
    companyId: site.companyId, shopId: site.shopId, branchId: (row.branch_id as string | null) ?? null,
    type, category: 'operations', priority: 'high',
    title: outcome.code === 'has_live_bookings' ? `ERP ยกเลิก ${label} ${doc.doc_no} แต่ยังมีคิวค้าง` : `ERP ย้าย ${label} ${doc.doc_no} ไปสาขาอื่น แต่ยังมีคิวค้าง`,
    message: `${row.partner_name ?? '-'} — ${outcome.message} ERP จะส่งซ้ำอัตโนมัติเมื่อจัดการคิวแล้ว`,
    relatedType: 'document', relatedId: row.id as string, actionUrl: '/portal/documents', icon: 'SyncProblem', color: '#B71C1C',
    metadata: { doc_type: docType, doc_no: doc.doc_no, code: outcome.code, source: 'erp' },
  });
}

async function writeLog(ctx: ApiKeyContext, req: Request, args: {
  docType: DocumentType; requestId: string; startedAt: number; dryRun: boolean;
  summary?: BatchSummary; rejected?: { code: string; message: string };
}) {
  const { admin, site } = ctx;
  const s = args.summary;
  try {
    await admin.from('integration_logs').insert({
      company_id: site.companyId,
      shop_id: site.shopId,
      api_key_id: ctx.keyId,
      doc_type: args.docType,
      request_id: args.requestId,
      duration_ms: Date.now() - args.startedAt,
      status: args.rejected ? 'rejected' : s?.status ?? 'ok',
      count_received: s?.received ?? 0,
      count_created: s?.created ?? 0,
      count_updated: s?.updated ?? 0,
      count_failed: s?.failed ?? 0,
      error_summary: args.rejected ? `${args.rejected.code}: ${args.rejected.message}` : s && s.failed > 0 ? `${s.failed} เอกสารไม่สำเร็จ` : null,
      failures: s && s.failures.length > 0 ? s.failures : null,
      dry_run: args.dryRun,
      source_ip: clientIp(req.headers),
      user_agent: req.headers.get('user-agent')?.slice(0, 200) ?? null,
    });
  } catch (e) {
    console.error('[integration] log write failed', e instanceof Error ? e.message : e);
  }
}

/**
 * Process one batch for `docType`.
 *
 * @param req Incoming request (`X-API-Key`, optional `X-Request-Id`, optional `?dry_run=1`).
 * @param docType `so` for sales orders, `po` for purchase orders.
 */
export async function handleDocumentBatch(req: Request, docType: DocumentType): Promise<NextResponse> {
  const startedAt = Date.now();
  const requestId = requestIdOf(req);
  const dryRun = ['1', 'true'].includes(new URL(req.url).searchParams.get('dry_run') ?? '');

  let ctx: ApiKeyContext;
  try {
    ctx = await requireApiKey(req, 'documents:write');
  } catch (e) {
    return integrationErrorResponse(e);
  }

  try {
    let envelope: Envelope;
    try {
      envelope = await readEnvelope(req);
    } catch (e) {
      if (e instanceof IntegrationError) await writeLog(ctx, req, { docType, requestId, startedAt, dryRun, rejected: { code: e.code, message: e.message } });
      throw e;
    }

    const { admin, site } = ctx;
    const { data: branchRows } = await admin.from('branches').select('id,code,branch_name').eq('shop_id', site.shopId).eq('is_deleted', false);
    const branches = (branchRows ?? []) as BranchRow[];

    const results: DocumentResult[] = [];
    for (const raw of envelope.documents) {
      const parsed = apiDocumentUpsertSchema.safeParse(normalizeApiItem(raw));
      if (!parsed.success) {
        const { message, fields } = formatZodIssues(parsed.error);
        results.push({ doc_no: peekDocNo(raw), status: 'failed', code: 'validation_error', message, fields });
        continue;
      }
      const doc = parsed.data;
      if (dryRun) {
        const branchKnown = branches.some((b) => [b.code, b.branch_name].some((v) => String(v ?? '').toLowerCase() === doc.branch.toLowerCase()));
        results.push(branchKnown
          ? { doc_no: doc.doc_no, status: 'valid', warnings: doc.items.length === 0 ? ['no_items'] : undefined }
          : { doc_no: doc.doc_no, status: 'failed', code: 'unknown_branch', message: `ไม่พบสาขา "${doc.branch}"` });
        continue;
      }
      const outcome = await upsertDocument(admin, site, docType, 'api', doc, null, { raw, branches });
      await afterUpsert(ctx, docType, doc, outcome);
      results.push(outcome.ok
        ? { doc_no: outcome.doc_no, status: outcome.created ? 'created' : 'updated', id: outcome.id, warnings: outcome.warnings.length ? outcome.warnings : undefined }
        : { doc_no: outcome.doc_no, status: 'failed', code: outcome.code, message: outcome.message });
    }

    const summary = summarizeBatch(results);
    await writeLog(ctx, req, { docType, requestId, startedAt, dryRun, summary });

    if (!dryRun && summary.created + summary.failed > 0) {
      const label = docType.toUpperCase();
      await safeCreateNotification(admin, {
        companyId: site.companyId, shopId: site.shopId,
        type: 'document_imported', category: 'system', priority: summary.failed > 0 ? 'medium' : 'low',
        title: `ERP ส่ง ${label} ${summary.received} รายการ`,
        message: `ใหม่ ${summary.created} · อัปเดต ${summary.updated} · ไม่สำเร็จ ${summary.failed}`,
        actionUrl: summary.failed > 0 ? '/portal/api-keys' : '/portal/documents',
        icon: 'CloudSync', color: summary.failed > 0 ? '#B71C1C' : '#1565c0',
        metadata: { doc_type: docType, request_id: requestId, created: summary.created, updated: summary.updated, failed: summary.failed, api_key_id: ctx.keyId },
      });
    }

    return NextResponse.json(
      { data: { request_id: requestId, doc_type: docType, dry_run: dryRun, received: summary.received, created: summary.created, updated: summary.updated, failed: summary.failed, results } },
      { status: 200, headers: { ...NO_STORE, 'X-Request-Id': requestId } },
    );
  } catch (e) {
    return integrationErrorResponse(e);
  }
}

/** Connectivity + key check for the ERP team. */
export async function handleHealth(req: Request): Promise<NextResponse> {
  try {
    const ctx = await requireApiKey(req);
    return NextResponse.json(
      {
        data: {
          ok: true,
          version: 'v1',
          key_name: ctx.keyName,
          key_prefix: ctx.keyPrefix,
          scopes: ctx.scopes,
          server_time: new Date().toISOString(),
          limits: { max_documents: API_MAX_DOCUMENTS, max_body_bytes: API_MAX_BODY_BYTES },
        },
      },
      { headers: NO_STORE },
    );
  } catch (e) {
    return integrationErrorResponse(e);
  }
}
