import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';
import { signSlipUrls } from '@/lib/storage/buckets';

const VALID_STATUSES = new Set(['pending', 'approved', 'rejected', 'superseded']);

/**
 * Slip review queue for the portal.
 *
 * Rows are read through the session client so RLS enforces the tenant boundary;
 * only the signed-URL minting uses the service role, and only after the row's
 * shop_id has been re-checked against the caller's own shop.
 */
export async function GET(req: Request) {
  try {
    const { supabase, profile } = await requireAuthContext({
      roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'],
    });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const bookingId = searchParams.get('booking_id');
    const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('page_size') ?? 25) || 25));
    const from = (page - 1) * pageSize;

    let query = supabase
      .from('payment_slips')
      .select(
        'id,booking_id,storage_path,status,amount_claimed,transferred_at,reject_reason,reviewed_at,created_at,mime_type,file_size,bookings(queue_number,booking_date,start_time,payment_amount,payment_status,customers(full_name,nickname,phone))',
        { count: 'exact' },
      )
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);

    if (status && VALID_STATUSES.has(status)) query = query.eq('status', status);
    if (bookingId) query = query.eq('booking_id', bookingId);

    const { data, error, count } = await query;
    if (error) throw error;

    const rows = data ?? [];
    // Belt and braces: RLS already scoped this, but the signed URL is the one
    // thing that would leak an image across tenants if it ever did not.
    const paths = rows.map((r) => r.storage_path as string).filter(Boolean);
    const admin = createAdminClient();
    const signed = await signSlipUrls(admin, paths);

    return NextResponse.json({
      data: rows.map((r) => ({ ...r, image_url: signed[r.storage_path as string] ?? null })),
      count: count ?? 0,
      page,
      page_size: pageSize,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
