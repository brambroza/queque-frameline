import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveShopByKeyOrId } from '@/lib/line/shop-resolver';
import { pushMessage } from '@/lib/line/client';
import { bookingConfirmFlex } from '@/lib/line/messages';
import { assertFeatureQuota, SubscriptionInactiveError, SubscriptionQuotaError } from '@/lib/subscription/enforcement';
import { createNotification, safeCreateNotification } from '@/lib/notifications/createNotification';
import { resolvePaymentForBooking, type PaymentBankInfo, type PaymentDeeplinkInfo } from '@/lib/payments/resolve';
import { formatThaiDateLabel } from '@/lib/utils/date-format';
import { safeSyncBookingToGoogleCalendar } from '@/lib/google-calendar/sync';
import { resourceBusyMessage, resourceTypeLabel } from '@/lib/booking/resource-types';
import { resourceServesService, resourceServiceMismatchMessage } from '@/lib/booking/resource-service-link';
import { NICKNAME_MAX, normalizeNicknameInput } from '@/lib/booking/customer-label';
import { BANK_CODES, BANK_PROVIDERS, PAYMENT_METHODS } from '@/types/db';
import { detectOmisePlatform, isBankAppMethod } from '@/lib/payments/mobile-banking/banks';
import { resolveInitialBookingStatus } from '@/lib/booking/status-flow';
import { isSlotPast, SLOT_PAST_CODE, SLOT_PAST_MESSAGE } from '@/lib/booking/slot-time';
import { toBangkokStamp } from '@/lib/line/booking-reminder';

const bookSchema = z
  .object({
    branch_id: z.string().uuid(),
    service_id: z.string().uuid(),
    booking_date: z.string(),
    start_time: z.string(),
    // A LINE display name can legitimately be a single character, so length is
    // only there to reject blank names.
    customer_name: z.string().trim().min(1),
    customer_phone: z.string().min(8),
    /** Optional ชื่อเล่น saved on the customer profile; omitted = keep the stored one. */
    nickname: z.string().max(NICKNAME_MAX).optional(),
    line_user_id: z.string().optional(),
    party_size: z.coerce.number().int().min(1).max(200).optional(),
    resource_id: z.string().uuid().optional(),
    payment_method: z.enum(PAYMENT_METHODS).optional(),
    /** Which bank app to open; required with `bank_deeplink` / `omise_mobile_banking`, ignored otherwise. */
    bank_provider: z.enum(BANK_CODES).optional(),
  })
  .superRefine((value, ctx) => {
    if (isBankAppMethod(value.payment_method) && !value.bank_provider) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['bank_provider'], message: 'bank_provider is required' });
    }
    // Direct bank APIs exist for two banks only.
    if (value.payment_method === 'bank_deeplink' && value.bank_provider && !(BANK_PROVIDERS as readonly string[]).includes(value.bank_provider)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['bank_provider'], message: 'bank not supported for bank_deeplink' });
    }
  });

/**
 * Thai label for the first field a customer got wrong. A bare "Invalid payload"
 * leaves them (and support) with no idea which box to fix, but the raw Zod
 * message must not reach the response body either.
 */
function invalidFieldMessage(path: PropertyKey | undefined) {
  const labels: Record<string, string> = {
    customer_name: 'ชื่อผู้จอง',
    customer_phone: 'เบอร์โทร',
    nickname: 'ชื่อเล่น',
    booking_date: 'วันที่จอง',
    start_time: 'เวลาที่จอง',
    branch_id: 'สาขา',
    service_id: 'บริการ',
    resource_id: 'ผู้ให้บริการ',
    payment_method: 'วิธีชำระเงิน',
    bank_provider: 'ธนาคารที่เลือก',
  };
  const label = typeof path === 'string' ? labels[path] : undefined;
  return label ? `ข้อมูลไม่ถูกต้อง: ${label}` : 'ข้อมูลการจองไม่ครบถ้วน';
}

export async function POST(req: Request, { params }: { params: Promise<{ shopKey: string }> }) {
  const { shopKey } = await params;
  const parsed = bookSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: invalidFieldMessage(parsed.error.issues[0]?.path[0]) }, { status: 400 });
  }

  const admin = createAdminClient();
  const shop = await resolveShopByKeyOrId(admin, shopKey);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const payload = parsed.data;

  // The LIFF greys these out, but a grid left open past the hour (or a forged
  // request) still reaches here. Same rule as /slots, same Bangkok clock.
  if (isSlotPast({ date: payload.booking_date, time: payload.start_time }, toBangkokStamp(new Date()))) {
    return NextResponse.json({ error: SLOT_PAST_MESSAGE, code: SLOT_PAST_CODE }, { status: 400 });
  }

  const monthStart = `${payload.booking_date.slice(0, 7)}-01`;
  const monthEnd = `${payload.booking_date.slice(0, 7)}-31`;
  const { count: monthlyCount } = await admin
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('shop_id', shop.id)
    .eq('is_deleted', false)
    .gte('booking_date', monthStart)
    .lte('booking_date', monthEnd);

  // The quota belongs to the shop, not to the person booking. Never surface a
  // plan error (or an unhandled 500) to an end customer on the LIFF screen —
  // tell them politely and alert the shop owner, who is the one who can act.
  try {
    await assertFeatureQuota(shop.id, 'bookings', monthlyCount ?? 0);
  } catch (quotaErr) {
    if (quotaErr instanceof SubscriptionQuotaError || quotaErr instanceof SubscriptionInactiveError) {
      await safeCreateNotification(admin, {
        companyId: shop.company_id,
        shopId: shop.id,
        type: 'quota_exceeded',
        category: 'system',
        priority: 'high',
        title: 'ลูกค้าจองไม่ได้ — โควต้าแพ็กเกจเต็ม',
        message: 'มีลูกค้าพยายามจองคิวแต่ระบบปฏิเสธเพราะโควต้าการจองของแพ็กเกจเต็มแล้ว อัปเกรดแพ็กเกจเพื่อเปิดรับการจองต่อ',
        actionUrl: '/portal/settings',
        metadata: { feature: 'bookings', shop_key: shopKey },
      });
      return NextResponse.json(
        { error: 'ขออภัย ขณะนี้ร้านยังไม่สามารถรับการจองเพิ่มได้ กรุณาติดต่อร้านโดยตรง' },
        { status: 409 }
      );
    }
    throw quotaErr;
  }

  const [{ data: branch }, { data: service }] = await Promise.all([
    admin.from('branches').select('id,branch_name').eq('id', payload.branch_id).eq('shop_id', shop.id).eq('is_deleted', false).maybeSingle(),
    admin.from('services').select('id,service_name,duration_minutes,price,requires_approval,booking_mode').eq('id', payload.service_id).eq('shop_id', shop.id).eq('is_deleted', false).maybeSingle(),
  ]);
  if (!branch || !service) {
    return NextResponse.json({ error: 'Invalid branch or service for this shop' }, { status: 400 });
  }

  const { count } = await admin
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('shop_id', shop.id)
    .eq('branch_id', payload.branch_id)
    .eq('booking_date', payload.booking_date);

  const queueNumber = `A${String((count ?? 0) + 1).padStart(3, '0')}`;

  let lineUserPk: string | null = null;
  if (payload.line_user_id) {
    const { data: lineUser } = await admin
      .from('line_users')
      .upsert({
        company_id: shop.company_id,
        shop_id: shop.id,
        line_user_id: payload.line_user_id,
      }, { onConflict: 'shop_id,line_user_id' })
      .select('id')
      .single();
    lineUserPk = lineUser?.id ?? null;
  }

  let customerId: string | null = null;
  if (lineUserPk) {
    const { data: byLineUser } = await admin
      .from('customers')
      .select('id')
      .eq('shop_id', shop.id)
      .eq('line_user_id', lineUserPk)
      .eq('is_deleted', false)
      .order('updated_at', { ascending: false })
      .limit(1);
    customerId = byLineUser?.[0]?.id ?? null;
  }

  // `undefined` keeps whatever nickname the profile already has; only a value
  // (or an explicit '' → null) sent by the customer changes it.
  const nickname = normalizeNicknameInput(payload.nickname);
  const nicknamePatch = nickname !== undefined ? { nickname } : {};

  if (customerId) {
    await admin
      .from('customers')
      .update({
        full_name: payload.customer_name,
        phone: payload.customer_phone,
        ...nicknamePatch,
        updated_at: new Date().toISOString(),
      })
      .eq('id', customerId)
      .eq('shop_id', shop.id);
  } else {
    const { data: customer, error: customerError } = await admin
      .from('customers')
      .upsert({
        company_id: shop.company_id,
        shop_id: shop.id,
        line_user_id: lineUserPk,
        full_name: payload.customer_name,
        phone: payload.customer_phone,
        ...nicknamePatch,
      }, { onConflict: 'shop_id,phone' })
      .select('id')
      .single();
    if (customerError || !customer) return NextResponse.json({ error: customerError?.message ?? 'Customer upsert failed' }, { status: 400 });
    customerId = customer.id;
  }

  const partySize = payload.party_size ?? null;
  const startLabel = payload.start_time.length === 5 ? `${payload.start_time}:00` : payload.start_time;
  const startAt = new Date(`${payload.booking_date}T${startLabel}+07:00`);
  const durationMin = Math.max(Number(service.duration_minutes ?? 30), 5);
  const endAt = new Date(startAt.getTime() + durationMin * 60000);
  const endTime = `${String(endAt.getHours()).padStart(2, '0')}:${String(endAt.getMinutes()).padStart(2, '0')}:00`;

  let assignedResource: {
    resource_id: string;
    resource_name: string;
    resource_type: string | null;
    capacity: number;
    unit_price: number;
  } | null = null;
  if (payload.resource_id) {
    const { data: selectedResource } = await admin
      .from('booking_resources')
      .select('id,resource_name,resource_type,capacity,unit_price,service_ids')
      .eq('id', payload.resource_id)
      .eq('shop_id', shop.id)
      .eq('active', true)
      .eq('is_deleted', false)
      .maybeSingle();
    if (selectedResource?.id) {
      // A resource linked to specific services can only be booked for those.
      if (!resourceServesService(selectedResource, payload.service_id)) {
        return NextResponse.json(
          { error: resourceServiceMismatchMessage(resourceTypeLabel(selectedResource.resource_type)) },
          { status: 400 },
        );
      }
      // The customer named a specific resource, so slot capacity is not enough —
      // two people can pick the same trainer at the same time between renders.
      const { data: isFree } = await admin.rpc('is_resource_available', {
        p_shop_id: shop.id,
        p_resource_id: selectedResource.id,
        p_start: startAt.toISOString(),
        p_end: endAt.toISOString(),
      });
      if (isFree === false) {
        return NextResponse.json({ error: resourceBusyMessage(selectedResource.resource_type) }, { status: 409 });
      }
      assignedResource = {
        resource_id: selectedResource.id as string,
        resource_name: String(selectedResource.resource_name ?? '-'),
        resource_type: (selectedResource.resource_type as string | null) ?? null,
        capacity: Number(selectedResource.capacity ?? 1),
        unit_price: Number(selectedResource.unit_price ?? 0),
      };
    }
  } else if (partySize && partySize > 0) {
    const { data: candidates } = await admin.rpc('find_available_resources', {
      p_shop_id: shop.id,
      p_branch_id: payload.branch_id,
      p_resource_type: 'table',
      p_party_size: partySize,
      p_start_time: startAt.toISOString(),
      p_end_time: endAt.toISOString(),
    });
    const top = candidates?.[0] as { resource_id?: string; resource_name?: string; capacity?: number } | undefined;
    if (top?.resource_id) {
      const { data: resourcePrice } = await admin
        .from('booking_resources')
        .select('unit_price')
        .eq('id', top.resource_id)
        .eq('shop_id', shop.id)
        .maybeSingle();
      assignedResource = {
        resource_id: top.resource_id,
        resource_name: top.resource_name ?? '-',
        resource_type: 'table',
        capacity: Number(top.capacity ?? 1),
        unit_price: Number(resourcePrice?.unit_price ?? 0),
      };
    }
  }

  // A service that needs approval holds its slot as `pending_approval` until
  // staff confirm it from the portal (which pushes the customer an approval Flex).
  const initialStatus = resolveInitialBookingStatus(service);
  const pendingApproval = initialStatus === 'pending_approval';

  const { data: booking, error } = await admin.from('bookings').insert({
    company_id: shop.company_id,
    shop_id: shop.id,
    branch_id: payload.branch_id,
    service_id: payload.service_id,
    customer_id: customerId,
    line_user_id: lineUserPk,
    booking_date: payload.booking_date,
    start_time: payload.start_time,
    end_time: endTime,
    queue_number: queueNumber,
    status: initialStatus,
    party_size: partySize,
    resource_id: assignedResource?.resource_id ?? null,
    resource_name: assignedResource?.resource_name ?? null,
    resource_capacity: assignedResource?.capacity ?? null,
  }).select('id,queue_number').single();

  if (error || !booking) return NextResponse.json({ error: error?.message ?? 'Create booking failed' }, { status: 400 });

  await admin.from('booking_logs').insert({
    company_id: shop.company_id,
    shop_id: shop.id,
    booking_id: booking.id,
    action: 'create_via_liff',
    description: `Created booking ${queueNumber}`,
  });

  if (assignedResource?.resource_id) {
    await admin.from('booking_resource_assignments').insert({
      company_id: shop.company_id,
      shop_id: shop.id,
      branch_id: payload.branch_id,
      booking_id: booking.id,
      resource_id: assignedResource.resource_id,
      note: payload.resource_id ? 'manual_assign' : 'auto_assign_by_party_size',
    });
  }

  try {
    await createNotification(admin, {
      companyId: shop.company_id,
      shopId: shop.id,
      branchId: payload.branch_id,
      userId: null,
      type: 'booking_created',
      category: 'bookings',
      priority: pendingApproval ? 'high' : 'medium',
      title: pendingApproval ? `${queueNumber} — คำขอจองใหม่ รออนุมัติ` : `New booking ${queueNumber}`,
      message: pendingApproval
        ? `ลูกค้าขอจอง ${payload.booking_date} ${payload.start_time.slice(0, 5)} (${service.service_name}) กรุณากด "อนุมัติ" ในหน้าคิว`
        : `Customer booked ${payload.booking_date} ${payload.start_time.slice(0, 5)}`,
      relatedType: 'booking',
      relatedId: booking.id,
      actionUrl: '/portal/bookings',
      icon: pendingApproval ? 'PendingActions' : 'EventAvailable',
      color: pendingApproval ? '#d97706' : '#2e7d32',
      metadata: { source: 'liff', queue_number: queueNumber, status: initialStatus },
      createdBy: null,
    });
  } catch (e) {
    await admin.from('activity_logs').insert({
      company_id: shop.company_id,
      shop_id: shop.id,
      action: 'notification_create_failed_liff_booking',
      description: e instanceof Error ? e.message : 'unknown error',
      payload: {
        queue_number: queueNumber,
        booking_id: booking.id,
      },
    });
  }

  await safeSyncBookingToGoogleCalendar(shop.id, booking.id);

  let linePushSent = false;
  let linePushError: string | null = null;

  // Non-blocking LINE confirmation message to customer.
  if (payload.line_user_id) {
    const { data: shopLine } = await admin
      .from('shops')
      .select('line_channel_access_token')
      .eq('id', shop.id)
      .maybeSingle();

    const token = shopLine?.line_channel_access_token || process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
    if (token) {
      const dateLabel = formatThaiDateLabel(payload.booking_date);
      const timeLabel = payload.start_time.slice(0, 5);
      const branchName = branch?.branch_name ?? '-';
      const serviceName = service?.service_name ?? '-';
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
      const liffUrl = appUrl ? `${appUrl}/liff/${encodeURIComponent(shop.shop_key)}` : undefined;

      try {
        await pushMessage(token, payload.line_user_id, [
          bookingConfirmFlex({
            shopName: shop.name ?? 'Queue Booking',
            queueNumber,
            branch: branchName,
            service: serviceName,
            date: dateLabel,
            time: timeLabel,
            assignedTo: assignedResource?.resource_name ?? null,
            assignedLabel: assignedResource ? resourceTypeLabel(assignedResource.resource_type) : null,
            liffUrl,
            pendingApproval,
          }),
        /*   bookingConfirmMessage({
            queueNumber,
            branch: branchName,
            service: serviceName,
            date: dateLabel,
            time: timeLabel,
          }), */
        ]);
        linePushSent = true;
      } catch (e) {
        linePushError = e instanceof Error ? e.message : 'unknown error';
        await admin.from('activity_logs').insert({
          company_id: shop.company_id,
          shop_id: shop.id,
          action: 'line_push_booking_failed',
          description: linePushError,
        });
      }
    } else {
      linePushError = 'LINE channel access token is missing';
    }
  }

  // Payment setup — non-blocking, never fails the booking.
  // Runs regardless of line_user_id: the QR and slip upload live on-screen in
  // LIFF now, so a customer without a LINE push still needs a payable invoice.
  let qrPaymentCreated = false;
  let paymentInfo: {
    method: string;
    amount: number;
    qr_image_url: string;
    expires_at: string | null;
    bank: PaymentBankInfo | null;
    deeplink: PaymentDeeplinkInfo | null;
  } | null = null;

  try {
    const resourcePrice = Number(assignedResource?.unit_price ?? 0);
    const servicePrice = Number((service as unknown as { price?: number } | null)?.price ?? 0);
    const paymentPrice = resourcePrice > 0 ? resourcePrice : servicePrice;
    const dateLabel = formatThaiDateLabel(payload.booking_date);
    const payment = await resolvePaymentForBooking({
      bookingId: booking.id,
      shopId: shop.id,
      companyId: shop.company_id,
      shopKey: shop.shop_key,
      amountTHB: paymentPrice,
      shopName: shop.name ?? 'Queue Booking',
      queueNumber,
      serviceName: service.service_name ?? '-',
      branchName: branch.branch_name ?? '-',
      dateLabel,
      timeLabel: payload.start_time.slice(0, 5),
      requestedMethod: payload.payment_method ?? null,
      requestedBankProvider: payload.bank_provider ?? null,
      platformType: detectOmisePlatform(req.headers.get('user-agent')),
    });

    if (payment) {
      paymentInfo = {
        method: payment.method,
        amount: payment.amountTHB,
        qr_image_url: payment.qrImageUrl,
        expires_at: payment.expiresAt,
        bank: payment.bank,
        deeplink: payment.deeplink,
      };

      if (payload.line_user_id) {
        const { data: shopLine } = await admin
          .from('shops')
          .select('line_channel_access_token')
          .eq('id', shop.id)
          .maybeSingle();
        const qrToken = shopLine?.line_channel_access_token || process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
        if (qrToken) {
          await pushMessage(qrToken, payload.line_user_id, [payment.flex]);
          qrPaymentCreated = true;
        }
      }
    }
  } catch (payErr) {
    console.error('[payments] setup error (booking still created):', payErr instanceof Error ? payErr.message : payErr);
  }

  return NextResponse.json({
    data: {
      booking_id: booking.id,
      queue_number: booking.queue_number,
      status: initialStatus,
      booking_date: payload.booking_date,
      booking_time: payload.start_time.slice(0, 5),
      branch_name: branch.branch_name,
      service_name: service.service_name,
      line_push_sent: linePushSent,
      line_push_error: linePushError,
      qr_payment_created: qrPaymentCreated,
      payment: paymentInfo,
    },
  });
}
