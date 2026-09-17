import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: Request) {
  try {
    await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');

    const admin = createAdminClient();
    let query = admin
      .from('service_templates')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true });

    if (category) query = query.eq('business_category', category);
    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ data: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
