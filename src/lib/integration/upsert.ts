/**
 * Writes one SO / PO into `external_documents`, creating or refreshing its
 * partner on the way. Single entry point for CSV import, the portal form and
 * (Phase 2) the ERP push API, so all three behave the same.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DocumentSource, DocumentType } from '@/types/db';
import { totalQty, type DocumentUpsert } from '@/lib/integration/schemas';
import { LIVE_STATUSES } from '@/lib/booking/status-flow';

export type UpsertOutcome =
  | { ok: true; id: string; doc_no: string; created: boolean }
  | { ok: false; doc_no: string; code: 'has_live_bookings' | 'unknown_branch' | 'db_error'; message: string };

type Site = { shopId: string; companyId: string };

/** Find or create the partner. Matches on ERP code first, then on exact name. */
async function upsertPartner(
  client: SupabaseClient,
  site: Site,
  partnerType: 'customer' | 'supplier',
  partner: DocumentUpsert['partner'],
  actorId: string | null,
): Promise<string> {
  const base = client.from('customers').select('id').eq('shop_id', site.shopId).eq('partner_type', partnerType).eq('is_deleted', false);
  const { data: found } = partner.code
    ? await base.eq('code', partner.code).limit(1).maybeSingle()
    : await base.eq('full_name', partner.name).is('code', null).limit(1).maybeSingle();

  if (found?.id) {
    const patch: Record<string, unknown> = { full_name: partner.name, updated_by: actorId };
    if (partner.phone) patch.phone = partner.phone;
    if (partner.email) patch.email = partner.email;
    await client.from('customers').update(patch).eq('id', found.id).eq('shop_id', site.shopId);
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
  if (error && error.code === '23505' && insertRow.phone) {
    // Same phone already belongs to another partner of this type: keep the partner, drop the phone.
    ({ data: created, error } = await client.from('customers').insert({ ...insertRow, phone: null }).select('id').single());
  }
  if (error || !created) throw error ?? new Error('partner insert failed');
  return created.id as string;
}

/**
 * @param client Session client (portal) or service-role client (API key route).
 * @param site Site ids — every query is scoped by them.
 * @param docType `so` (customer pickup) or `po` (supplier delivery).
 * @param source Where the row came from.
 * @param doc Validated payload.
 * @param actorId Portal user, or null for the API.
 * @param opts.raw Original payload kept for support/debugging.
 */
export async function upsertDocument(
  client: SupabaseClient,
  site: Site,
  docType: DocumentType,
  source: DocumentSource,
  doc: DocumentUpsert,
  actorId: string | null,
  opts: { raw?: unknown; forceCancel?: boolean; branchId?: string | null } = {},
): Promise<UpsertOutcome> {
  try {
    // Branch: explicit id (portal form) wins, else the code / name carried by the payload (CSV, ERP).
    let branchId = opts.branchId ?? null;
    if (!branchId && doc.branch) {
      const { data: branches } = await client.from('branches').select('id,code,branch_name').eq('shop_id', site.shopId).eq('is_deleted', false);
      const key = doc.branch.trim().toLowerCase();
      const hit = (branches ?? []).find((b) => String(b.code ?? '').toLowerCase() === key || String(b.branch_name ?? '').toLowerCase() === key);
      if (!hit) return { ok: false, doc_no: doc.doc_no, code: 'unknown_branch', message: `ไม่พบสาขา "${doc.branch}"` };
      branchId = hit.id as string;
    }

    const partnerId = await upsertPartner(client, site, docType === 'so' ? 'customer' : 'supplier', doc.partner, actorId);

    const { data: existing } = await client
      .from('external_documents')
      .select('id,status')
      .eq('shop_id', site.shopId)
      .eq('doc_type', docType)
      .eq('doc_no', doc.doc_no)
      .maybeSingle();

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

    if (doc.status === 'cancelled' && existing) {
      const { count } = await client
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('shop_id', site.shopId)
        .eq('document_id', existing.id)
        .eq('is_deleted', false)
        .in('status', [...LIVE_STATUSES]);
      if ((count ?? 0) > 0 && !opts.forceCancel) {
        return { ok: false, doc_no: doc.doc_no, code: 'has_live_bookings', message: 'เอกสารมีคิวที่ยังไม่ปิด ยกเลิกคิวก่อน' };
      }
      fields.status = 'cancelled';
    } else if (doc.status === 'open' && existing?.status === 'cancelled') {
      fields.status = 'open';
    }

    if (existing) {
      const { error } = await client.from('external_documents').update(fields).eq('id', existing.id).eq('shop_id', site.shopId);
      if (error) throw error;
      return { ok: true, id: existing.id as string, doc_no: doc.doc_no, created: false };
    }

    const { data: created, error } = await client
      .from('external_documents')
      .insert({ ...fields, company_id: site.companyId, shop_id: site.shopId, doc_type: docType, doc_no: doc.doc_no, status: fields.status ?? 'open', created_by: actorId })
      .select('id')
      .single();
    if (error || !created) throw error ?? new Error('document insert failed');
    return { ok: true, id: created.id as string, doc_no: doc.doc_no, created: true };
  } catch (e) {
    console.error('[document-upsert]', doc.doc_no, e instanceof Error ? e.message : e);
    return { ok: false, doc_no: doc.doc_no, code: 'db_error', message: 'บันทึกเอกสารไม่สำเร็จ' };
  }
}
