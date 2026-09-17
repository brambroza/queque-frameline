import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { applyBranchScope } from '@/lib/auth/branch-scope';
import { getTodayISOInBangkok } from '@/lib/utils/date-format';
import { loadSignageSettings } from '@/lib/signage/settings';
import { buildSignageData, SIGNAGE_ALL_STATUSES, SIGNAGE_BOOKING_SELECT, type SignageBookingRow } from '@/lib/signage/normalize';

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const BranchIdSchema = z.string().uuid();

type BranchRow = { id: string; branch_name: string; active: boolean };
type ShopRow = {
  name: string | null;
  shop_key: string | null;
  logo_url: string | null;
  liff_id: string | null;
  demo_mode_enabled: boolean | null;
  demo_business_type: string | null;
};

/**
 * Portal preview feed for the signage designer. Same normalisation as the public
 * TV route so what staff see in the portal is what the TV shows.
 */
export async function GET(req: Request) {
  try {
    const { supabase, profile, branchScope } = await requireAuthContext({
      roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'],
    });
    if (!profile.shop_id) return NextResponse.json({ error: 'No shop in profile' }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const branchParam = searchParams.get('branch_id');
    const branchId = branchParam ? BranchIdSchema.safeParse(branchParam) : null;
    if (branchParam && !branchId?.success) return NextResponse.json({ error: 'Invalid branch_id' }, { status: 400 });
    const resolvedBranchId = branchId?.success ? branchId.data : null;
    const dateParam = searchParams.get('date');
    const date = dateParam && DateSchema.safeParse(dateParam).success ? dateParam : getTodayISOInBangkok();

    const [{ data: branches, error: branchesError }, { data: shopMeta, error: shopError }, loaded] = await Promise.all([
      applyBranchScope(
        supabase.from('branches').select('id,branch_name,active').eq('shop_id', profile.shop_id).eq('is_deleted', false),
        branchScope,
        null,
        'id',
      ).order('branch_name', { ascending: true }),
      supabase
        .from('shops')
        .select('name,shop_key,logo_url,liff_id,demo_mode_enabled,demo_business_type')
        .eq('id', profile.shop_id)
        .maybeSingle<ShopRow>(),
      loadSignageSettings(supabase, profile.shop_id, resolvedBranchId),
    ]);
    if (branchesError) throw branchesError;
    if (shopError) throw shopError;

    let query = supabase
      .from('bookings')
      .select(SIGNAGE_BOOKING_SELECT)
      .eq('shop_id', profile.shop_id)
      .eq('booking_date', date)
      .eq('is_deleted', false)
      .eq('signage_display', true)
      .in('status', SIGNAGE_ALL_STATUSES)
      .order('start_time', { ascending: true });
    query = applyBranchScope(query, branchScope, resolvedBranchId);

    const { data, error } = await query;
    if (error) throw error;

    const branchRows = (branches ?? []) as BranchRow[];
    const branch = resolvedBranchId
      ? (() => {
          const b = branchRows.find((x) => x.id === resolvedBranchId);
          return b ? { id: b.id, name: b.branch_name } : null;
        })()
      : null;

    const signage = buildSignageData({
      rows: (data ?? []) as unknown as SignageBookingRow[],
      config: loaded.config,
      date,
      shop: {
        name: shopMeta?.name ?? '',
        logo_url: shopMeta?.logo_url ?? null,
        demo_mode_enabled: shopMeta?.demo_mode_enabled ?? false,
        liff_id: shopMeta?.liff_id ?? null,
      },
      branch,
    });

    return NextResponse.json({
      data: {
        date,
        branches: branchRows,
        shop: {
          name: shopMeta?.name ?? null,
          shop_key: shopMeta?.shop_key ?? null,
          logo_url: shopMeta?.logo_url ?? null,
          demo_mode_enabled: Boolean(shopMeta?.demo_mode_enabled),
          demo_business_type: shopMeta?.demo_business_type ?? null,
        },
        config: loaded.config,
        scope: { branch_id: resolvedBranchId, source: loaded.source, settings_id: loaded.settings_id },
        signage,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
