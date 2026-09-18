/**
 * Token → row resolution for the public (no-login) routes.
 *
 * These routes use the service-role client, so THE TOKEN IS THE ONLY GATE:
 * resolve it first, then scope every further query by the `shop_id` of the
 * row it returned. Never query by an id taken from the request alone.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { hashToken, isWellFormedToken, tokenState } from '@/lib/tokens';

export type TokenFailure = { ok: false; status: 404 | 410; error: string };

export type ResolvedDocument = {
  ok: true;
  doc: {
    id: string; company_id: string; shop_id: string; branch_id: string | null; doc_type: 'so' | 'po'; doc_no: string; status: string;
    partner_id: string | null; partner_name: string | null; due_date: string | null; remark: string | null;
    items: Array<{ sku?: string | null; name: string; qty: number; uom?: string | null }>;
  };
};

const NOT_FOUND: TokenFailure = { ok: false, status: 404, error: 'ไม่พบลิงก์นี้ กรุณาขอลิงก์ใหม่จากเจ้าหน้าที่' };
const EXPIRED: TokenFailure = { ok: false, status: 410, error: 'ลิงก์หมดอายุแล้ว กรุณาขอลิงก์ใหม่จากเจ้าหน้าที่' };

/** Customer / supplier booking link → its SO / PO. */
export async function resolveBookingToken(admin: SupabaseClient, token: string, now = new Date()): Promise<ResolvedDocument | TokenFailure> {
  if (!isWellFormedToken(token)) return NOT_FOUND;
  const { data } = await admin
    .from('external_documents')
    .select('id,company_id,shop_id,branch_id,doc_type,doc_no,status,partner_id,partner_name,due_date,remark,items,booking_token_expires_at')
    .eq('booking_token_hash', hashToken(token))
    .eq('is_deleted', false)
    .maybeSingle();
  if (!data) return NOT_FOUND;
  if (tokenState(data.booking_token_expires_at as string | null, now) === 'expired') return EXPIRED;
  const { booking_token_expires_at: _exp, ...doc } = data;
  void _exp;
  return { ok: true, doc: doc as ResolvedDocument['doc'] };
}

export type ResolvedDriverBooking = { ok: true; booking: { id: string; company_id: string; shop_id: string; status: string; booking_date: string } };

/** Driver link → its booking (ids only; the route selects what it shows). */
export async function resolveDriverToken(admin: SupabaseClient, token: string, now = new Date()): Promise<ResolvedDriverBooking | TokenFailure> {
  if (!isWellFormedToken(token)) return NOT_FOUND;
  const { data } = await admin
    .from('bookings')
    .select('id,company_id,shop_id,status,booking_date,driver_token_expires_at')
    .eq('driver_token_hash', hashToken(token))
    .eq('is_deleted', false)
    .maybeSingle();
  if (!data) return NOT_FOUND;
  if (tokenState(data.driver_token_expires_at as string | null, now) === 'expired') return EXPIRED;
  return { ok: true, booking: { id: data.id as string, company_id: data.company_id as string, shop_id: data.shop_id as string, status: String(data.status), booking_date: String(data.booking_date) } };
}

/** Public shape of a booking — no ids of other tables, no internal notes beyond the customer's own. */
export const PUBLIC_BOOKING_SELECT =
  'id,queue_number,status,direction,booking_date,start_time,end_time,resource_name,plate_number,plate_number_actual,driver_name,driver_phone,receiver_name,receiver_phone,note,do_number,do_issued_at,called_at,call_count,driver_token_version,services(service_name),external_documents(doc_no,doc_type,partner_name,items)';
