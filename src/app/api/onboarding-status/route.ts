import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Reports which setup steps a shop has completed, so the portal can show an
 * activation checklist instead of an empty dashboard. Read-only.
 */
export async function GET() {
  try {
    const { profile } = await requireAuthContext({
      roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'],
    });
    if (!profile.shop_id) return NextResponse.json({ data: null });

    const admin = createAdminClient();
    const shopId = profile.shop_id;

    const countActive = async (table: string) => {
      const { count } = await admin
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('shop_id', shopId)
        .eq('is_deleted', false);
      return count ?? 0;
    };

    const [branches, services, workingHours, bookings, { data: shop }] = await Promise.all([
      countActive('branches'),
      countActive('services'),
      countActive('working_hours'),
      countActive('bookings'),
      admin
        .from('shops')
        .select('shop_key,line_channel_access_token,line_channel_secret,liff_id')
        .eq('id', shopId)
        .maybeSingle(),
    ]);

    const lineConnected = Boolean(
      shop?.line_channel_access_token && shop?.line_channel_secret && shop?.liff_id
    );

    const steps = [
      { key: 'branch', done: branches > 0 },
      { key: 'service', done: services > 0 },
      { key: 'working_hours', done: workingHours > 0 },
      { key: 'line', done: lineConnected },
      { key: 'first_booking', done: bookings > 0 },
    ];

    return NextResponse.json({
      data: {
        steps,
        completed: steps.filter((s) => s.done).length,
        total: steps.length,
        shop_key: shop?.shop_key ?? null,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
