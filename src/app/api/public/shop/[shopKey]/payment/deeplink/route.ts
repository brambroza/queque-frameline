import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { BANK_PROVIDERS } from '@/types/db';
import { getShopPaymentConfig } from '@/lib/payments/settings';
import { createBookingDeeplinkPayment } from '@/lib/payments/deeplink';
import { DeeplinkProviderError } from '@/lib/payments/deeplink/types';
import { isOwnerLookupFailure, resolveBookingForLineUser } from '@/lib/payments/liff-auth';

const schema = z.object({
  line_user_id: z.string().min(1),
  booking_id: z.string().uuid(),
  id_token: z.string().optional(),
  bank_provider: z.enum(BANK_PROVIDERS),
});

/** Payment states that must never be replaced by a fresh bank transaction. */
const LOCKED = new Set(['paid', 'awaiting_verification']);

/**
 * (Re)issue a bank deeplink for an existing booking: the previous session
 * expired, the customer wants a different bank, or they came back through the
 * account tab. Each call creates a new bank transaction with a new reference.
 */
export async function POST(req: Request, { params }: { params: Promise<{ shopKey: string }> }) {
  const { shopKey } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const admin = createAdminClient();
  const owner = await resolveBookingForLineUser(admin, shopKey, parsed.data.line_user_id, parsed.data.booking_id, parsed.data.id_token);
  if (isOwnerLookupFailure(owner)) return NextResponse.json({ error: owner.error }, { status: owner.status });

  const { booking, shop } = owner;
  if (LOCKED.has(String(booking.payment_status))) {
    return NextResponse.json({ error: 'การจองนี้ชำระเงินแล้วหรืออยู่ระหว่างตรวจสอบ' }, { status: 409 });
  }
  if (booking.payment_method && booking.payment_method !== 'bank_deeplink') {
    return NextResponse.json({ error: 'การจองนี้ใช้วิธีชำระเงินอื่นอยู่' }, { status: 409 });
  }
  const amountTHB = Number(booking.payment_amount ?? 0);
  if (!(amountTHB > 0)) return NextResponse.json({ error: 'ไม่มียอดที่ต้องชำระ' }, { status: 409 });

  const config = await getShopPaymentConfig(admin, shop.id);
  const providerConfig = config.deeplinkProviders.find((p) => p.provider === parsed.data.bank_provider);
  if (!providerConfig) return NextResponse.json({ error: 'ร้านไม่ได้เปิดรับชำระผ่านธนาคารนี้' }, { status: 409 });

  try {
    const result = await createBookingDeeplinkPayment({
      bookingId: booking.id,
      shopId: shop.id,
      companyId: shop.company_id,
      shopKey: shop.shop_key,
      shopName: shop.name ?? 'Queue Booking',
      queueNumber: booking.queue_number,
      amountTHB,
      providerConfig,
    });
    if (!result) return NextResponse.json({ error: 'ออกลิงก์ชำระเงินไม่สำเร็จ' }, { status: 502 });

    return NextResponse.json({
      data: {
        provider: result.provider,
        provider_name: result.providerName,
        deeplink_url: result.deeplinkUrl,
        return_url: result.returnUrl,
        expires_at: result.expiresAt,
        amount: result.amountTHB,
      },
    });
  } catch (e) {
    const message = e instanceof DeeplinkProviderError ? e.message : 'unknown';
    console.error('[deeplink] reissue failed:', message);
    return NextResponse.json({ error: 'ธนาคารไม่ตอบรับ กรุณาลองใหม่อีกครั้ง' }, { status: 502 });
  }
}
