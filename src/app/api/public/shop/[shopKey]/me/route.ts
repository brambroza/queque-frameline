import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveShopByKeyOrId } from '@/lib/line/shop-resolver';
import { NICKNAME_MAX, normalizeNicknameInput } from '@/lib/booking/customer-label';
import { CUSTOMER_ACTIVE_STATUSES } from '@/lib/booking/status-flow';
import { toBangkokStamp } from '@/lib/line/booking-reminder';

const bodySchema = z.object({
  line_user_id: z.string().min(1),
  display_name: z.string().optional(),
  picture_url: z.string().optional(),
  full_name: z.string().optional(),
  phone: z.string().optional(),
  /** Omitted = keep the stored nickname; '' = clear it. */
  nickname: z.string().max(NICKNAME_MAX).optional(),
  mode: z.enum(['view', 'update']).default('view'),
});

const CUSTOMER_SELECT = 'id,full_name,nickname,phone,line_user_id';

export async function POST(req: Request, { params }: { params: Promise<{ shopKey: string }> }) {
  const { shopKey } = await params;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const admin = createAdminClient();
  const shop = await resolveShopByKeyOrId(admin, shopKey);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const payload = parsed.data;
  const { data: lineUser, error: lineUserError } = await admin
    .from('line_users')
    .upsert(
      {
        company_id: shop.company_id,
        shop_id: shop.id,
        line_user_id: payload.line_user_id,
        display_name: payload.display_name ?? null,
        picture_url: payload.picture_url ?? null,
      },
      { onConflict: 'shop_id,line_user_id' },
    )
    .select('id,line_user_id,display_name,picture_url')
    .single();
  if (lineUserError || !lineUser) return NextResponse.json({ error: lineUserError?.message ?? 'Line user upsert failed' }, { status: 400 });

  let customerId: string | null = null;
  const { data: existingCustomers } = await admin
    .from('customers')
    .select(CUSTOMER_SELECT)
    .eq('shop_id', shop.id)
    .eq('line_user_id', lineUser.id)
    .eq('is_deleted', false)
    .order('updated_at', { ascending: false })
    .limit(3);

  let customer = (existingCustomers ?? [])[0] ?? null;

  if (customer) {
    customerId = customer.id;
    const nickname = normalizeNicknameInput(payload.nickname);
    if (payload.mode === 'update' && (payload.full_name || payload.phone || nickname !== undefined)) {
      const { data: updated, error: updateError } = await admin
        .from('customers')
        .update({
          full_name: payload.full_name?.trim() || customer.full_name,
          phone: payload.phone?.trim() || customer.phone,
          // Unlike name/phone, an empty nickname is a deliberate "remove it".
          ...(nickname !== undefined ? { nickname } : {}),
        })
        .eq('id', customer.id)
        .select(CUSTOMER_SELECT)
        .single();
      // Swallowing this let a phone that collides with unique(shop_id, phone)
      // look saved while the old value stayed in the row.
      if (updateError) {
        const duplicate = updateError.code === '23505';
        return NextResponse.json(
          { error: duplicate ? 'เบอร์นี้ถูกใช้กับลูกค้ารายอื่นในร้านแล้ว' : 'บันทึกข้อมูลไม่สำเร็จ' },
          { status: 400 },
        );
      }
      customer = updated ?? customer;
    }
  } else {
    const { data: created, error: customerCreateError } = await admin
      .from('customers')
      .insert({
        company_id: shop.company_id,
        shop_id: shop.id,
        line_user_id: lineUser.id,
        full_name: payload.full_name?.trim() || payload.display_name || 'LINE Customer',
        phone: payload.phone?.trim() || null,
        nickname: normalizeNicknameInput(payload.nickname) ?? null,
      })
      .select(CUSTOMER_SELECT)
      .single();
    if (customerCreateError || !created) {
      return NextResponse.json({ error: customerCreateError?.message ?? 'Customer create failed' }, { status: 400 });
    }
    customer = created;
    customerId = created.id;
  }

  const { data: bookings } = await admin
    .from('bookings')
    // Payment fields let the account tab surface an "upload slip" action, which
    // is the durable way back into payment after localStorage is cleared or the
    // customer switches device.
    .select('id,queue_number,booking_date,start_time,status,note,created_at,resource_id,resource_name,payment_status,payment_method,payment_amount,payment_expires_at,bank_provider,change_notified_at,change_acknowledged_at,checked_in_at,called_at,branches(branch_name),services(service_name)')
    .eq('shop_id', shop.id)
    .eq('line_user_id', lineUser.id)
    .eq('is_deleted', false)
    .order('booking_date', { ascending: false })
    .order('start_time', { ascending: false })
    .limit(50);

  // Booking dates are Bangkok-local; a UTC "today" would hide tonight's queue
  // after 07:00 UTC and let the check-in button show up a day early.
  const nowDate = toBangkokStamp(new Date()).date;
  const activeStatuses = new Set<string>(CUSTOMER_ACTIVE_STATUSES);
  const upcoming = (bookings ?? []).filter((b) => activeStatuses.has(String(b.status)) && String(b.booking_date) >= nowDate);
  const history = (bookings ?? []).filter((b) => !upcoming.find((u) => u.id === b.id));

  return NextResponse.json({
    data: {
      shop: { id: shop.id, name: shop.name, shop_key: shop.shop_key },
      line_user: lineUser,
      customer,
      customer_id: customerId,
      /** Bangkok date, so the LIFF check-in button and the API agree on "today". */
      today: nowDate,
      upcoming,
      history,
    },
  });
}
