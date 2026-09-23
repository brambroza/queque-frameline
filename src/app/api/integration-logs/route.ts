import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';

const LOG_SELECT = 'id,api_key_id,doc_type,request_id,received_at,duration_ms,status,count_received,count_created,count_updated,count_failed,error_summary,failures,dry_run,source_ip,api_keys(name,key_prefix)';

/** Recent ERP push requests, newest first. Admin only. */
export async function GET(req: Request) {
  try {
    const { supabase, profile } = await requireAuthContext({ roles: ['admin'] });
    const limitRaw = Number(new URL(req.url).searchParams.get('limit') ?? '50');
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 200) : 50;
    const { data, error } = await supabase
      .from('integration_logs')
      .select(LOG_SELECT)
      .eq('shop_id', profile.shop_id)
      .order('received_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return NextResponse.json({
      data: (data ?? []).map(({ api_keys, ...row }) => {
        const key = api_keys as unknown as { name?: string; key_prefix?: string } | null;
        return { ...row, key_name: key?.name ?? null, key_prefix: key?.key_prefix ?? null };
      }),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
