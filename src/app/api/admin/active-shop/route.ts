import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import {
  ADMIN_SHOP_COOKIE,
  adminShopCookieOptions,
  parseAdminShopCookie,
  readAdminShopCookie,
  resolveActingShop,
} from '@/lib/auth/admin-shop-cookie';
import { createAdminClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/lib/audit/activity-log';

const BodySchema = z.object({ shop_id: z.string().uuid() });

type ShopOption = { id: string; name: string | null; shop_key: string | null };

/**
 * Shops a super_admin may act in, plus the one currently selected via cookie.
 * A cookie pointing at a shop that no longer exists is cleared on the way out.
 */
export async function GET() {
  try {
    await requireAuthContext({ roles: ['super_admin'] });
    const admin = createAdminClient();

    const [{ data, error }, cookieShopId] = await Promise.all([
      admin.from('shops').select('id,name,shop_key').eq('is_deleted', false).order('name', { ascending: true }),
      readAdminShopCookie(),
    ]);
    if (error) throw error;

    const shops = (data ?? []) as ShopOption[];
    const currentShopId = cookieShopId && shops.some((s) => s.id === cookieShopId) ? cookieShopId : null;

    const response = NextResponse.json({ data: { shops, current_shop_id: currentShopId } });
    if (cookieShopId && !currentShopId) response.cookies.delete(ADMIN_SHOP_COOKIE);
    return response;
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

/** Select the shop a super_admin acts in. Stored in an httpOnly cookie, never in the profile. */
export async function POST(req: Request) {
  try {
    const { user } = await requireAuthContext({ roles: ['super_admin'] });
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success || !parseAdminShopCookie(parsed.data.shop_id)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const shop = await resolveActingShop(createAdminClient(), parsed.data.shop_id);
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

    const response = NextResponse.json({ data: { shop_id: shop.id } });
    response.cookies.set(ADMIN_SHOP_COOKIE, shop.id, adminShopCookieOptions(new URL(req.url).protocol === 'https:'));

    await writeAuditLog({
      companyId: shop.company_id,
      shopId: shop.id,
      userId: user.id,
      action: 'admin_shop_switched',
      targetTable: 'shops',
      targetId: shop.id,
    });

    return response;
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

/** Clear the acting shop so the super_admin falls back to their own context (if any). */
export async function DELETE() {
  try {
    await requireAuthContext({ roles: ['super_admin'] });
    const response = NextResponse.json({ data: true });
    response.cookies.delete(ADMIN_SHOP_COOKIE);
    return response;
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
