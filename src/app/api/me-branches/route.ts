import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { applyBranchScope } from '@/lib/auth/branch-scope';

/**
 * Branches the signed-in user may act on, plus whether they see the whole shop.
 * Drives the portal's branch switcher and every branch picker in the forms.
 */
export async function GET() {
  try {
    const { supabase, profile, branchScope } = await requireAuthContext({
      roles: ['admin', 'staff'],
    });

    // A super_admin who has not picked a shop yet has no branches to offer.
    if (!profile.shop_id) return NextResponse.json({ data: { scope: 'shop', branches: [] } });

    const { data, error } = await applyBranchScope(
      supabase
        .from('branches')
        .select('id,branch_name,active')
        .eq('shop_id', profile.shop_id)
        .eq('is_deleted', false),
      branchScope,
      null,
      'id',
    ).order('branch_name', { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      data: {
        // 'shop' = sees every branch and may pick "all branches";
        // 'branch' = bound to the listed branches only.
        scope: branchScope === null ? 'shop' : 'branch',
        branches: data ?? [],
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
