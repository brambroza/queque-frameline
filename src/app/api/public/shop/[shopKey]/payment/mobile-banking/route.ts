import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { BANK_CODES } from '@/types/db';
import { getShopPaymentConfig } from '@/lib/payments/settings';
import { createBookingMobileBankingPayment } from '@/lib/payments/mobile-banking';
import { detectOmisePlatform, isMobileBankingAmountOk } from '@/lib/payments/mobile-banking/banks';
import { isOwnerLookupFailure, resolveBookingForLineUser } from '@/lib/payments/liff-auth';

const schema = z.object({
  line_user_id: z.string().min(1),
  booking_id: z.string().uuid(),
  id_token: z.string().optional(),
  bank: z.enum(BANK_CODES),
});

/** Payment states that must never be replaced by a fresh Omise charge. */
const LOCKED = new Set(['paid', 'awaiting_verification']);

/**
 * (Re)issue an Omise Mobile Banking charge for an existing booking: the
 * previous charge expired, the customer wants a different bank, or they came
 * back through the account tab. Each call creates a new charge; the old one
 * lapses on Omise's side.
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
  if (booking.payment_method && booking.payment_method !== 'omise_mobile_banking') {
    return NextResponse.json({ error: 'การจองนี้ใช้วิธีชำระเงินอื่นอยู่' }, { status: 409 });
  }
  const amountTHB = Number(booking.payment_amount ?? 0);
  if (!(amountTHB > 0)) return NextResponse.json({ error: 'ไม่มียอดที่ต้องชำระ' }, { status: 409 });
  if (!isMobileBankingAmountOk(amountTHB)) {
    return NextResponse.json({ error: 'ยอดนี้ชำระผ่านแอปธนาคารไม่ได้ (20 – 150,000 บาท)' }, { status: 409 });
  }

  const config = await getShopPaymentConfig(admin, shop.id);
  if (!config.enabledMethods.includes('omise_mobile_banking') || !config.mobileBankingBanks.includes(parsed.data.bank)) {
    return NextResponse.json({ error: 'ร้านไม่ได้เปิดรับชำระผ่านแอปธนาคาร' }, { status: 409 });
  }

  try {
    const result = await createBookingMobileBankingPayment({
      bookingId: booking.id,
      shopId: shop.id,
      companyId: shop.company_id,
      shopKey: shop.shop_key,
      shopName: shop.name ?? 'Queue Booking',
      queueNumber: booking.queue_number,
      amountTHB,
      bank: parsed.data.bank,
      platformType: detectOmisePlatform(req.headers.get('user-agent')),
      config,
    });
    if (!result) return NextResponse.json({ error: 'ออกลิงก์ชำระเงินไม่สำเร็จ' }, { status: 502 });

    return NextResponse.json({
      data: {
        provider: result.bank,
        provider_name: result.bankName,
        deeplink_url: result.authorizeUri,
        return_url: result.returnUrl,
        expires_at: result.expiresAt,
        amount: result.amountTHB,
      },
    });
  } catch (e) {
    // Typically "source type not enabled": the shop has not activated this bank on Omise yet.
    console.error('[mobile-banking] reissue failed:', e instanceof Error ? e.message : 'unknown');
    return NextResponse.json({ error: 'ธนาคารนี้ยังใช้ไม่ได้ กรุณาเลือกธนาคารอื่น' }, { status: 502 });
  }
}
