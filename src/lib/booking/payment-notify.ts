/**
 * "Payment cleared" fan-out shared by the portal payment dialog and the ERP push:
 * once an SO becomes paid / credit, tell the team which pending queues can now be approved.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { PAYMENT_LABEL, isPaymentStatus } from '@/lib/booking/payment';
import { safeCreateNotification } from '@/lib/notifications/createNotification';
import { safeNotifyStaffGroup } from '@/lib/line/notify';

export type PaymentClearedDoc = { id: string; doc_no: string; partner_name: string | null; branch_id: string | null };

/**
 * Notification centre + LINE staff group for every `pending` queue of the document.
 *
 * @param admin Service-role client.
 * @param site Tenant ids.
 * @param doc The SO that just became payable.
 * @param nextStatus The new payment status (`paid` | `credit`).
 * @returns Queue numbers that were unlocked (empty when there was nothing pending).
 */
export async function notifyPaymentCleared(
  admin: SupabaseClient,
  site: { companyId: string; shopId: string },
  doc: PaymentClearedDoc,
  nextStatus: string,
): Promise<string[]> {
  const { data: pending } = await admin
    .from('bookings')
    .select('id,queue_number')
    .eq('shop_id', site.shopId)
    .eq('document_id', doc.id)
    .eq('is_deleted', false)
    .eq('status', 'pending');
  if (!pending || pending.length === 0) return [];

  const unlocked = pending.map((b) => String(b.queue_number));
  const label = isPaymentStatus(nextStatus) ? PAYMENT_LABEL[nextStatus] : nextStatus;
  await safeCreateNotification(admin, {
    companyId: site.companyId, shopId: site.shopId, branchId: doc.branch_id,
    type: 'payment_cleared', category: 'bookings', priority: 'high',
    title: `${doc.doc_no} ${label} — รออนุมัติคิว`,
    message: `คิว ${unlocked.join(', ')} ของ ${doc.partner_name ?? '-'} อนุมัติได้แล้ว`,
    relatedType: 'booking', relatedId: pending[0].id as string, actionUrl: '/portal/bookings', icon: 'Paid', color: '#0B7A4B',
  });
  await safeNotifyStaffGroup(admin, {
    shopId: site.shopId, bookingId: pending[0].id as string,
    event: { kind: 'payment_cleared', docNo: doc.doc_no, partner: String(doc.partner_name ?? '-'), queues: unlocked, status: label },
  });
  return unlocked;
}
