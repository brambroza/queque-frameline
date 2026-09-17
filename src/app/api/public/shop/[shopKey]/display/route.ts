import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveShopByKeyOrId } from '@/lib/line/shop-resolver';
import { getTodayISOInBangkok } from '@/lib/utils/date-format';
import { loadSignageSettings } from '@/lib/signage/settings';
import { buildSignageData, SIGNAGE_ALL_STATUSES, SIGNAGE_BOOKING_SELECT, type SignageBookingRow } from '@/lib/signage/normalize';

const BranchIdSchema = z.string().uuid();

/**
 * Public feed for the TV signage at `/display/[shopKey]`.
 *
 * Uses the admin client on purpose: the signage runs unauthenticated on a TV and
 * there is no anon RLS path for bookings. This is the documented exception in
 * CLAUDE.md for public display; every query below is pinned to `shop.id`, and
 * customer names are reduced server-side per the shop's `customer_name_mode`.
 */
export async function GET(req: Request, { params }: { params: Promise<{ shopKey: string }> }) {
  const admin = createAdminClient();
  const { shopKey } = await params;
  const { searchParams } = new URL(req.url);

  const shop = await resolveShopByKeyOrId(admin, shopKey);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const branchParam = searchParams.get('branch_id');
  let branch: { id: string; name: string } | null = null;
  if (branchParam) {
    const parsed = BranchIdSchema.safeParse(branchParam);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid branch_id' }, { status: 400 });
    const { data: branchRow } = await admin
      .from('branches')
      .select('id,branch_name')
      .eq('id', parsed.data)
      .eq('shop_id', shop.id)
      .eq('is_deleted', false)
      .maybeSingle<{ id: string; branch_name: string }>();
    if (!branchRow) return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    branch = { id: branchRow.id, name: branchRow.branch_name };
  }

  const headers = { 'Cache-Control': 'no-store' };

  try {
    const { config } = await loadSignageSettings(admin, shop.id, branch?.id ?? null);
    if (!config.enabled) {
      return NextResponse.json({ data: { enabled: false, shop: { name: shop.name } } }, { headers });
    }

    const date = getTodayISOInBangkok();
    let query = admin
      .from('bookings')
      .select(SIGNAGE_BOOKING_SELECT)
      .eq('shop_id', shop.id)
      .eq('booking_date', date)
      .eq('is_deleted', false)
      .eq('signage_display', true)
      .in('status', SIGNAGE_ALL_STATUSES)
      .order('start_time', { ascending: true });
    if (branch) query = query.eq('branch_id', branch.id);

    const { data, error } = await query;
    if (error) throw error;

    const signage = buildSignageData({
      rows: (data ?? []) as unknown as SignageBookingRow[],
      config,
      date,
      shop: {
        name: shop.name,
        logo_url: shop.logo_url,
        demo_mode_enabled: shop.demo_mode_enabled,
        liff_id: shop.liff_id,
      },
      branch,
    });

    return NextResponse.json({ data: { enabled: true, config, signage } }, { headers });
  } catch (e) {
    console.error('[public_display_failed]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'ไม่สามารถโหลดข้อมูลจอคิวได้' }, { status: 500, headers });
  }
}
