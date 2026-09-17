import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveShopByKeyOrId } from '@/lib/line/shop-resolver';
import { toBangkokStamp } from '@/lib/line/booking-reminder';
import { DATE_PAST_HINT, DAY_OVER_HINT, isSlotPast } from '@/lib/booking/slot-time';

export async function GET(req: Request, { params }: { params: Promise<{ shopKey: string }> }) {
  const { shopKey } = await params;
  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get('branch_id');
  const serviceId = searchParams.get('service_id');
  const date = searchParams.get('date');
  const resourceType = searchParams.get('resource_type');
  const resourceId = searchParams.get('resource_id');
  const partySize = searchParams.get('party_size');

  if (!branchId || !serviceId || !date) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const admin = createAdminClient();
  const shop = await resolveShopByKeyOrId(admin, shopKey);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const weekday = new Date(`${date}T00:00:00+07:00`).getDay();

  const [{ data: holidayRows }, { data: whRows }, { data: anyWhRows }] = await Promise.all([
    admin
      .from('holidays')
      .select('id')
      .eq('shop_id', shop.id)
      .eq('holiday_date', date)
      .eq('is_deleted', false)
      .or(`branch_id.is.null,branch_id.eq.${branchId}`)
      .limit(1),
    admin
      .from('working_hours')
      .select('id')
      .eq('shop_id', shop.id)
      .eq('weekday', weekday)
      .eq('active', true)
      .eq('is_deleted', false)
      .or(`branch_id.eq.${branchId},branch_id.is.null`)
      .limit(1),
    // Any weekday at all — distinguishes "closed today" from "never configured".
    admin
      .from('working_hours')
      .select('id')
      .eq('shop_id', shop.id)
      .eq('is_deleted', false)
      .limit(1),
  ]);

  // Returns full slots too (remaining_capacity = 0) so the LIFF grid can grey
  // them out with "เต็ม N/N" instead of dropping them from the timeline.
  const { data, error } = await admin.rpc('get_slot_availability', {
    p_shop_id: shop.id,
    p_branch_id: branchId,
    p_service_id: serviceId,
    p_date: date,
    p_resource_type: resourceType || null,
    p_party_size: partySize ? Number(partySize) : null,
    p_resource_id: resourceId || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Server clock in Bangkok, never the customer's device: a slot that already
  // started is greyed out here and refused again by /book with the same rule.
  const now = toBangkokStamp(new Date());
  const slots = ((data ?? []) as Array<{ slot_time: string; capacity: number; booked_count: number; remaining_capacity: number }>).map(
    (s) => ({ ...s, is_past: isSlotPast({ date, time: s.slot_time }, now) })
  );
  const openSlots = slots.filter((s) => !s.is_past && s.remaining_capacity > 0).length;
  const allPast = slots.length > 0 && slots.every((s) => s.is_past);
  const isHoliday = Boolean(holidayRows && holidayRows.length > 0);
  const hasWorkingHours = Boolean(whRows && whRows.length > 0);

  const hasAnyWorkingHours = Boolean(anyWhRows && anyWhRows.length > 0);

  let reason: 'ok' | 'holiday' | 'closed' | 'not_configured' | 'full' = 'ok';
  let hint = '';
  if (isHoliday) {
    reason = 'holiday';
    hint = 'วันดังกล่าวเป็นวันหยุดของสาขา';
  } else if (!hasWorkingHours) {
    // A shop with no working hours anywhere is misconfigured, not closed. Saying
    // "ปิดทำการ" sends the owner hunting through the branch form, which does not
    // control this at all.
    reason = hasAnyWorkingHours ? 'closed' : 'not_configured';
    hint = hasAnyWorkingHours
      ? 'สาขานี้ปิดทำการในวันที่เลือก'
      : 'ร้านยังไม่ได้ตั้งเวลาทำการ กรุณาตั้งค่าที่เมนู "เวลาทำการ" ในระบบหลังบ้าน';
  } else if (slots.length === 0) {
    reason = 'full';
    hint = 'ไม่มีช่วงเวลาให้จองในวันที่เลือก';
  } else if (openSlots === 0) {
    reason = 'full';
    hint = date < now.date ? DATE_PAST_HINT : allPast ? DAY_OVER_HINT : 'คิวเต็มทุกช่วงเวลาในวันที่เลือก';
  }

  return NextResponse.json({
    data: slots,
    meta: {
      reason,
      hint,
      open_slots: openSlots,
      /** Bangkok date, so the LIFF date picker's minimum agrees with the server. */
      today: now.date,
      has_working_hours: hasWorkingHours,
      is_holiday: isHoliday,
    },
  });
}
