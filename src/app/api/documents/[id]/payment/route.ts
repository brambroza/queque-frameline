import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';
import { documentPaymentSchema } from '@/lib/booking/schemas';
import { isPaymentCleared } from '@/lib/booking/payment';
import { writeAuditLog } from '@/lib/audit/activity-log';
import { notifyPaymentCleared } from '@/lib/booking/payment-notify';

/**
 * Record the payment status of a Sales Order (admin + warehouse staff).
 * Clearing the payment is what unlocks approval of the SO's pending queues.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { user, profile } = await requireAuthContext({ roles: ['admin', 'staff'] });
    const { id } = await ctx.params;
    const parsed = documentPaymentSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลการชำระเงินไม่ถูกต้อง' }, { status: 400 });

    // Staff have no RLS write on documents; the role check above plus the shop scope below are the guard.
    const admin = createAdminClient();
    const { data: doc } = await admin
      .from('external_documents')
      .select('id,doc_type,doc_no,partner_name,branch_id,payment_status,status')
      .eq('id', id)
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .maybeSingle();
    if (!doc) return NextResponse.json({ error: 'ไม่พบเอกสาร' }, { status: 404 });
    if (doc.doc_type !== 'so') return NextResponse.json({ error: 'บันทึกการชำระเงินได้เฉพาะ SO', code: 'not_so' }, { status: 400 });

    const next = parsed.data.payment_status;
    const prev = String(doc.payment_status ?? 'unpaid');

    // Taking the payment back while a queue is already approved would leave a DO out for unpaid goods.
    if (!isPaymentCleared('so', next)) {
      const { count } = await admin
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('shop_id', profile.shop_id)
        .eq('document_id', id)
        .eq('is_deleted', false)
        .in('status', ['confirmed', 'late', 'checked_in', 'called', 'serving']);
      if ((count ?? 0) > 0) {
        return NextResponse.json({ error: 'SO นี้มีคิวที่อนุมัติแล้ว — ยกเลิกคิวก่อนจึงเปลี่ยนกลับเป็นยังไม่ชำระได้', code: 'has_confirmed_bookings' }, { status: 409 });
      }
    }

    const { error } = await admin
      .from('external_documents')
      .update({
        payment_status: next,
        payment_ref: parsed.data.payment_ref ?? null,
        payment_note: parsed.data.payment_note ?? null,
        payment_updated_at: new Date().toISOString(),
        payment_updated_by: user.id,
        updated_by: user.id,
      })
      .eq('id', id)
      .eq('shop_id', profile.shop_id);
    if (error) throw error;

    await writeAuditLog({
      companyId: profile.company_id, shopId: profile.shop_id, userId: user.id, action: 'data_updated',
      targetTable: 'external_documents', targetId: id,
      payload: { doc_no: doc.doc_no, payment_status: { from: prev, to: next }, payment_ref: parsed.data.payment_ref ?? null },
    });

    // Tell the team which queues are now waiting for approval.
    let unlocked: string[] = [];
    if (!isPaymentCleared('so', prev) && isPaymentCleared('so', next)) {
      unlocked = await notifyPaymentCleared(
        admin,
        { companyId: profile.company_id, shopId: profile.shop_id },
        { id, doc_no: String(doc.doc_no), partner_name: (doc.partner_name as string | null) ?? null, branch_id: (doc.branch_id as string | null) ?? null },
        next,
      );
    }

    return NextResponse.json({ data: { ok: true, payment_status: next, unlocked_queues: unlocked } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
