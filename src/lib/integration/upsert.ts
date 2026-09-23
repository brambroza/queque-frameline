/**
 * Writes one SO / PO into `external_documents`, creating or refreshing its
 * partner on the way. Single entry point for CSV import, the portal form and
 * the ERP push API, so all three behave the same.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DocumentSource, DocumentType } from '@/types/db';
import { totalQty, type DocumentUpsert } from '@/lib/integration/schemas';
import { CONFIRMED_STATUSES, decidePaymentWrite, resolveBranch, type BranchRow } from '@/lib/integration/rules';
import { LIVE_STATUSES } from '@/lib/booking/status-flow';

export type UpsertWarning = 'payment_downgrade_ignored' | 'completed_kept' | 'no_items';

export type UpsertFailureCode = 'has_live_bookings' | 'unknown_branch' | 'branch_locked' | 'db_error';

export type UpsertOutcome =
  | {
      ok: true;
      id: string;
      doc_no: string;
      created: boolean;
      warnings: UpsertWarning[];
      /** Set when the SO's payment status actually changed (e.g. `unpaid` → `credit`). */
      payment_changed?: { from: string; to: string };
      branch_id: string | null;
      partner_name: string;
    }
  | { ok: false; doc_no: string; code: UpsertFailureCode; message: string };

type Site = { shopId: string; companyId: string };

const UNIQUE_VIOLATION = '23505';

/** Find or create the partner. Matches on ERP code first, then on exact name. */
async function upsertPartner(
  client: SupabaseClient,
  site: Site,
  partnerType: 'customer' | 'supplier',
  partner: DocumentUpsert['partner'],
  actorId: string | null,
): Promise<string> {
  const base = () => client.from('customers').select('id').eq('shop_id', site.shopId).eq('partner_type', partnerType).eq('is_deleted', false);
  const findByCode = () => base().eq('code', partner.code as string).limit(1).maybeSingle();
  const { data: found } = partner.code
    ? await findByCode()
    : await base().eq('full_name', partner.name).is('code', null).limit(1).maybeSingle();

  if (found?.id) {
    const patch: Record<string, unknown> = { full_name: partner.name, updated_by: actorId };
    if (partner.phone) patch.phone = partner.phone;
    if (partner.email) patch.email = partner.email;
    let { error } = await client.from('customers').update(patch).eq('id', found.id).eq('shop_id', site.shopId);
    if (error && error.code === UNIQUE_VIOLATION && patch.phone) {
      // The phone already belongs to another partner of this type: keep the rest of the update.
      delete patch.phone;
      ({ error } = await client.from('customers').update(patch).eq('id', found.id).eq('shop_id', site.shopId));
    }
    if (error) throw error;
    return found.id as string;
  }

  const insertRow = {
    company_id: site.companyId,
    shop_id: site.shopId,
    partner_type: partnerType,
    code: partner.code ?? null,
    full_name: partner.name,
    phone: partner.phone ?? null,
    email: partner.email ?? null,
    created_by: actorId,
    updated_by: actorId,
  };
  let { data: created, error } = await client.from('customers').insert(insertRow).select('id').single();
  if (error && error.code === UNIQUE_VIOLATION && insertRow.code) {
    // Lost a race with a concurrent import of the same partner code: adopt that row.
    const { data: raced } = await findByCode();
    if (raced?.id) return raced.id as string;
  }
  if (error && error.code === UNIQUE_VIOLATION && insertRow.phone) {
    // Same phone already belongs to another partner of this type: keep the partner, drop the phone.
    ({ data: created, error } = await client.from('customers').insert({ ...insertRow, phone: null }).select('id').single());
  }
  if (error || !created) throw error ?? new Error('partner insert failed');
  return created.id as string;
}

async function loadBranches(client: SupabaseClient, shopId: string): Promise<BranchRow[]> {
  const { data } = await client.from('branches').select('id,code,branch_name').eq('shop_id', shopId).eq('is_deleted', false);
  return (data ?? []) as BranchRow[];
}

/**
 * @param client Session client (portal) or service-role client (API key route).
 * @param site Site ids — every query is scoped by them.
 * @param docType `so` (customer pickup) or `po` (supplier delivery).
 * @param source Where the row came from.
 * @param doc Validated payload.
 * @param actorId Portal user, or null for the API.
 * @param opts.raw Original payload kept for support/debugging.
 * @param opts.forceCancel Cancel even while live queues exist (portal only; never from the API).
 * @param opts.branchId Explicit branch (portal form); wins over `doc.branch`.
 * @param opts.branches Branch list loaded once by a batch caller, so 100 documents do not mean 100 queries.
 */
export async function upsertDocument(
  client: SupabaseClient,
  site: Site,
  docType: DocumentType,
  source: DocumentSource,
  doc: DocumentUpsert,
  actorId: string | null,
  opts: { raw?: unknown; forceCancel?: boolean; branchId?: string | null; branches?: BranchRow[] } = {},
): Promise<UpsertOutcome> {
  try {
    // Branch: explicit id (portal form) wins, else the code / name carried by the payload (CSV, ERP).
    let branchId = opts.branchId ?? null;
    if (!branchId && doc.branch) {
      const branches = opts.branches ?? (await loadBranches(client, site.shopId));
      const hit = resolveBranch(branches, doc.branch);
      if (!hit) return { ok: false, doc_no: doc.doc_no, code: 'unknown_branch', message: `ไม่พบสาขา "${doc.branch}"` };
      branchId = hit.id;
    }

    const partnerId = await upsertPartner(client, site, docType === 'so' ? 'customer' : 'supplier', doc.partner, actorId);

    const { data: existing } = await client
      .from('external_documents')
      .select('id,status,payment_status,branch_id')
      .eq('shop_id', site.shopId)
      .eq('doc_type', docType)
      .eq('doc_no', doc.doc_no)
      .maybeSingle();

    const warnings: UpsertWarning[] = [];
    if (doc.items.length === 0 && !existing && doc.status !== 'cancelled') warnings.push('no_items');

    const fields: Record<string, unknown> = {
      partner_id: partnerId,
      partner_code: doc.partner.code ?? null,
      partner_name: doc.partner.name,
      doc_date: doc.doc_date ?? null,
      due_date: doc.due_date ?? null,
      items: doc.items,
      total_qty: totalQty(doc.items),
      ...(branchId ? { branch_id: branchId } : {}),
      remark: doc.remark ?? null,
      source,
      raw: opts.raw ?? doc,
      imported_at: new Date().toISOString(),
      is_deleted: false,
      updated_by: actorId,
    };

    // Queues still on the board decide whether a cancel, a branch move or a payment downgrade may go through.
    const branchChanged = Boolean(existing && branchId && existing.branch_id && existing.branch_id !== branchId);
    const wantsCancel = doc.status === 'cancelled' && Boolean(existing);
    const mayDowngrade = docType === 'so' && Boolean(existing) && doc.payment_status === 'unpaid' && source !== 'api';
    let liveStatuses: string[] = [];
    if (existing && (wantsCancel || branchChanged || mayDowngrade)) {
      const { data: live } = await client
        .from('bookings')
        .select('status')
        .eq('shop_id', site.shopId)
        .eq('document_id', existing.id)
        .eq('is_deleted', false)
        .in('status', [...LIVE_STATUSES]);
      liveStatuses = (live ?? []).map((b) => String(b.status));
    }
    const hasLive = liveStatuses.length > 0;
    const hasConfirmed = liveStatuses.some((s) => (CONFIRMED_STATUSES as readonly string[]).includes(s));

    if (branchChanged && hasLive) {
      return { ok: false, doc_no: doc.doc_no, code: 'branch_locked', message: 'เอกสารมีคิวที่ยังไม่ปิดอยู่ที่สาขาเดิม ยกเลิกหรือย้ายคิวก่อนจึงเปลี่ยนสาขาได้' };
    }

    // Payment is only written when the source says so: a re-import must not undo what the warehouse recorded.
    let paymentChanged: { from: string; to: string } | undefined;
    if (docType === 'so' && doc.payment_status) {
      const decision = decidePaymentWrite({ source, incoming: doc.payment_status, existing: existing?.payment_status as string | null | undefined, hasConfirmedBookings: hasConfirmed });
      if (decision === 'write') {
        const from = existing ? String(existing.payment_status ?? 'unpaid') : 'unpaid';
        fields.payment_status = doc.payment_status;
        fields.payment_updated_at = new Date().toISOString();
        fields.payment_updated_by = actorId;
        if (existing && from !== doc.payment_status) paymentChanged = { from, to: doc.payment_status };
      } else if (decision === 'skip_downgrade') {
        warnings.push('payment_downgrade_ignored');
      }
    }

    if (wantsCancel && existing) {
      if (existing.status === 'completed') {
        warnings.push('completed_kept');
      } else if (hasLive && !opts.forceCancel) {
        return { ok: false, doc_no: doc.doc_no, code: 'has_live_bookings', message: 'เอกสารมีคิวที่ยังไม่ปิด ยกเลิกคิวก่อน' };
      } else {
        fields.status = 'cancelled';
      }
    } else if (doc.status === 'open' && existing?.status === 'cancelled') {
      fields.status = 'open';
    }

    if (existing) {
      const { error } = await client.from('external_documents').update(fields).eq('id', existing.id).eq('shop_id', site.shopId);
      if (error) throw error;
      return { ok: true, id: existing.id as string, doc_no: doc.doc_no, created: false, warnings, payment_changed: paymentChanged, branch_id: branchId ?? (existing.branch_id as string | null), partner_name: doc.partner.name };
    }

    const insertRow = {
      ...fields,
      company_id: site.companyId,
      shop_id: site.shopId,
      doc_type: docType,
      doc_no: doc.doc_no,
      status: doc.status === 'cancelled' ? 'cancelled' : 'open',
      created_by: actorId,
    };
    const { data: created, error } = await client.from('external_documents').insert(insertRow).select('id').single();
    if (error && error.code === UNIQUE_VIOLATION) {
      // Lost a race with a concurrent push of the same doc_no: fall through to the update path.
      const { data: raced } = await client
        .from('external_documents')
        .select('id')
        .eq('shop_id', site.shopId)
        .eq('doc_type', docType)
        .eq('doc_no', doc.doc_no)
        .maybeSingle();
      if (raced?.id) {
        const { error: upErr } = await client.from('external_documents').update(fields).eq('id', raced.id).eq('shop_id', site.shopId);
        if (upErr) throw upErr;
        return { ok: true, id: raced.id as string, doc_no: doc.doc_no, created: false, warnings, branch_id: branchId, partner_name: doc.partner.name };
      }
    }
    if (error || !created) throw error ?? new Error('document insert failed');
    return { ok: true, id: created.id as string, doc_no: doc.doc_no, created: true, warnings, branch_id: branchId, partner_name: doc.partner.name };
  } catch (e) {
    console.error('[document-upsert]', doc.doc_no, e instanceof Error ? e.message : e);
    return { ok: false, doc_no: doc.doc_no, code: 'db_error', message: 'บันทึกเอกสารไม่สำเร็จ' };
  }
}
