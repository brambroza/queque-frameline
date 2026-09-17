import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { LIVE_STATUSES } from '@/lib/booking/status-flow';

const patchSchema = z.object({ status: z.enum(['open', 'completed', 'cancelled']) });

/** One document with its queues. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, profile } = await requireAuthContext({ roles: ['admin', 'staff'] });
    const { id } = await ctx.params;
    const { data: doc, error } = await supabase
      .from('external_documents')
      .select('id,doc_type,doc_no,partner_id,partner_code,partner_name,doc_date,due_date,status,source,items,total_qty,remark,booking_token_expires_at,imported_at,updated_at,customers(full_name,phone,email,code)')
      .eq('id', id)
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .maybeSingle();
    if (error) throw error;
    if (!doc) return NextResponse.json({ error: 'ไม่พบเอกสาร' }, { status: 404 });

    const { data: bookings } = await supabase
      .from('bookings')
      .select('id,queue_number,booking_date,start_time,end_time,status,plate_number,plate_number_actual,resource_name,do_number,services(service_name)')
      .eq('shop_id', profile.shop_id)
      .eq('document_id', id)
      .eq('is_deleted', false)
      .order('booking_date', { ascending: true })
      .order('start_time', { ascending: true });

    return NextResponse.json({ data: { ...doc, bookings: bookings ?? [] } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

/** Close, cancel or reopen a document (admin). Cancelling is refused while a queue is still live. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['admin'] });
    const { id } = await ctx.params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'สถานะไม่ถูกต้อง' }, { status: 400 });

    const { count } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', profile.shop_id)
      .eq('document_id', id)
      .eq('is_deleted', false)
      .in('status', [...LIVE_STATUSES]);
    const live = count ?? 0;
    if (parsed.data.status === 'cancelled' && live > 0) {
      return NextResponse.json({ error: 'เอกสารมีคิวที่ยังไม่ปิด ยกเลิกคิวก่อน', code: 'has_live_bookings' }, { status: 409 });
    }
    // Reopening a document that already has queues keeps it "booked".
    const status = parsed.data.status === 'open' && live > 0 ? 'booked' : parsed.data.status;

    const { data, error } = await supabase
      .from('external_documents')
      .update({ status, updated_by: user.id })
      .eq('id', id)
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0) return NextResponse.json({ error: 'ไม่พบเอกสาร' }, { status: 404 });
    return NextResponse.json({ data: { ok: true, status } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

/** Remove a document that never had a queue (admin). */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['admin'] });
    const { id } = await ctx.params;
    const { count } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', profile.shop_id)
      .eq('document_id', id)
      .eq('is_deleted', false);
    if ((count ?? 0) > 0) return NextResponse.json({ error: 'เอกสารนี้มีคิวแล้ว ลบไม่ได้ (ยกเลิกเอกสารแทน)' }, { status: 409 });

    const { error } = await supabase
      .from('external_documents')
      .update({ is_deleted: true, booking_token_hash: null, updated_by: user.id })
      .eq('id', id)
      .eq('shop_id', profile.shop_id);
    if (error) throw error;
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
