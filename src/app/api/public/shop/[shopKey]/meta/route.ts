import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveShopByKeyOrId } from '@/lib/line/shop-resolver';
import { getShopPaymentConfig, toPublicPaymentInfo } from '@/lib/payments/settings';
import { isBookingEchoEnabled } from '@/lib/line/booking-echo';
import { isServiceDurationVisible } from '@/lib/booking/display-settings';

export async function GET(_: Request, { params }: { params: Promise<{ shopKey: string }> }) {
  const { shopKey } = await params;
  const admin = createAdminClient();
  const shop = await resolveShopByKeyOrId(admin, shopKey);

  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  // `price` is needed so LIFF can tell whether a booking costs anything and
  // therefore whether to show the payment method picker at all.
  const [
    { data: branches },
    { data: services },
    { data: resources },
    paymentConfig,
    bookingEchoEnabled,
    showServiceDuration,
  ] = await Promise.all([
    admin.from('branches').select('id,branch_name').eq('shop_id', shop.id).eq('active', true).eq('is_deleted', false),
    admin.from('services').select('id,service_name,duration_minutes,price').eq('shop_id', shop.id).eq('active', true).eq('is_deleted', false),
    admin
      .from('booking_resources')
      .select('id,branch_id,resource_name,resource_code,resource_type,capacity,unit_price,service_ids')
      .eq('shop_id', shop.id)
      .eq('active', true)
      .eq('is_deleted', false)
      .order('resource_name', { ascending: true }),
    getShopPaymentConfig(admin, shop.id),
    isBookingEchoEnabled(admin, shop.id),
    isServiceDurationVisible(admin, shop.id),
  ]);

  return NextResponse.json({
    data: {
      shop: { ...shop, booking_echo_enabled: bookingEchoEnabled, show_service_duration: showServiceDuration },
      branches: branches ?? [],
      services: services ?? [],
      resources: resources ?? [],
      payment: toPublicPaymentInfo(paymentConfig),
    },
  });
}
