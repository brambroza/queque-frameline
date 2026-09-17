import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveShopByKeyOrId } from '@/lib/line/shop-resolver';
import { resolveLoginChannelId, verifyLiffIdToken } from '@/lib/line/verify-id-token';

export interface ResolvedBookingOwner {
  shop: { id: string; company_id: string; name: string | null; shop_key: string };
  lineUserPk: string;
  booking: {
    id: string;
    queue_number: string;
    payment_status: string | null;
    payment_method: string | null;
    payment_amount: number | null;
    payment_expires_at: string | null;
    payment_reject_reason: string | null;
    bank_provider: string | null;
    bank_txn_id: string | null;
    bank_deeplink_url: string | null;
    omise_charge_id: string | null;
  };
}

export type OwnerLookupFailure = { error: string; status: number };

/**
 * Resolve shop → LINE user → booking, asserting that the caller owns the booking.
 *
 * This mirrors how cancel-booking and /me already authenticate: the caller is
 * trusted on the strength of a claimed line_user_id. That is weaker than a real
 * token — see the LIFF ID-token work — so every lookup here is additionally
 * scoped by shop_id and line_user_id, and tenant ids are taken from the resolved
 * rows rather than from the request body.
 */
export async function resolveBookingForLineUser(
  admin: SupabaseClient,
  shopKey: string,
  lineUserId: string,
  bookingId: string,
  idToken?: string | null,
): Promise<ResolvedBookingOwner | OwnerLookupFailure> {
  const shop = await resolveShopByKeyOrId(admin, shopKey);
  if (!shop) return { error: 'Shop not found', status: 404 };

  // When the shop has a LINE Login channel configured, the claimed id must be
  // backed by a token LINE actually issued. Shops without one keep the older,
  // weaker behaviour rather than breaking.
  const { data: shopAuth } = await admin
    .from('shops')
    .select('line_login_channel_id')
    .eq('id', shop.id)
    .maybeSingle();
  const channelId = resolveLoginChannelId(shopAuth?.line_login_channel_id ?? null);
  if (channelId) {
    const verifiedSub = idToken ? await verifyLiffIdToken(idToken, channelId) : null;
    if (verifiedSub !== lineUserId) {
      return { error: 'ยืนยันตัวตนไม่สำเร็จ กรุณาเปิดหน้านี้ผ่าน LINE อีกครั้ง', status: 401 };
    }
  }

  const { data: lineUser } = await admin
    .from('line_users')
    .select('id')
    .eq('shop_id', shop.id)
    .eq('line_user_id', lineUserId)
    .eq('is_deleted', false)
    .maybeSingle();
  if (!lineUser) return { error: 'Line user not found', status: 404 };

  const { data: booking } = await admin
    .from('bookings')
    .select('id,queue_number,payment_status,payment_method,payment_amount,payment_expires_at,payment_reject_reason,bank_provider,bank_txn_id,bank_deeplink_url,omise_charge_id')
    .eq('id', bookingId)
    .eq('shop_id', shop.id)
    .eq('line_user_id', lineUser.id)
    .eq('is_deleted', false)
    .maybeSingle();
  if (!booking) return { error: 'Booking not found', status: 404 };

  return {
    shop: { id: shop.id, company_id: shop.company_id, name: shop.name ?? null, shop_key: shop.shop_key },
    lineUserPk: lineUser.id,
    booking: booking as ResolvedBookingOwner['booking'],
  };
}

export function isOwnerLookupFailure(v: unknown): v is OwnerLookupFailure {
  return typeof v === 'object' && v !== null && 'status' in v && 'error' in v;
}
