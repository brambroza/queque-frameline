import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { bookingResourceBulkSchema } from '@/lib/booking/schemas';

function padNumber(n: number, length: number) {
  if (length <= 0) return String(n);
  return String(n).padStart(length, '0');
}

function getErrorPayload(e: unknown) {
  if (e && typeof e === 'object') {
    const obj = e as { message?: string; code?: string; details?: string; hint?: string };
    return {
      error: obj.message ?? 'Unexpected error',
      code: obj.code ?? null,
      details: obj.details ?? null,
      hint: obj.hint ?? null,
    };
  }
  return { error: e instanceof Error ? e.message : 'Unexpected error', code: null, details: null, hint: null };
}

export async function POST(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager'] });
    const body = await req.json();
    const normalizedBody = {
      ...body,
      branch_id: typeof body.branch_id === 'string' && body.branch_id.trim() === '' ? null : body.branch_id,
      floor: typeof body.floor === 'string' && body.floor.trim() === '' ? null : body.floor,
      zone: typeof body.zone === 'string' && body.zone.trim() === '' ? null : body.zone,
      prefix: typeof body.prefix === 'string' && body.prefix.trim() === '' ? null : body.prefix,
      name_prefix: typeof body.name_prefix === 'string' && body.name_prefix.trim() === '' ? null : body.name_prefix,
    };
    const parsed = bookingResourceBulkSchema.safeParse(normalizedBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? 'Invalid payload',
          issues: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    const payload = parsed.data;
    if (payload.branch_id) {
      const { data: branch, error: branchError } = await supabase
        .from('branches')
        .select('id')
        .eq('id', payload.branch_id)
        .eq('shop_id', profile.shop_id)
        .eq('is_deleted', false)
        .maybeSingle();
      if (branchError) throw branchError;
      if (!branch) return NextResponse.json({ error: 'branch_id ไม่ถูกต้องหรือไม่อยู่ในร้านนี้' }, { status: 400 });
    }

    // Optional service link, shared by every generated row. Ids must be live
    // services of this shop; empty = serves every service.
    const serviceIds = Array.from(new Set(payload.service_ids ?? []));
    if (serviceIds.length > 0) {
      const { data: knownServices, error: serviceError } = await supabase
        .from('services')
        .select('id')
        .eq('shop_id', profile.shop_id)
        .eq('is_deleted', false)
        .in('id', serviceIds);
      if (serviceError) throw serviceError;
      const known = new Set((knownServices ?? []).map((s) => s.id as string));
      if (serviceIds.some((id) => !known.has(id))) {
        return NextResponse.json({ error: 'service_ids มีบริการที่ไม่อยู่ในร้านนี้' }, { status: 400 });
      }
    }

    const namePrefix = payload.name_prefix?.trim() || (payload.resource_type === 'meeting_room' ? 'Room' : 'โต๊ะ');
    const codes: string[] = [];

    if (payload.mode === 'range') {
      const start = payload.start_number ?? 1;
      const end = payload.end_number ?? start;
      const prefix = payload.prefix?.trim();
      if (!prefix || end < start) return NextResponse.json({ error: 'Invalid range setup' }, { status: 400 });
      for (let i = start; i <= end; i += 1) {
        codes.push(`${prefix}${padNumber(i, payload.pad_length ?? 2)}`);
      }
    } else {
      const fromList = payload.code_list ?? [];
      if (fromList.length === 0) return NextResponse.json({ error: 'code_list is required for list mode' }, { status: 400 });
      fromList.forEach((c) => codes.push(c.trim()));
    }

    const rows = codes.map((code, idx) => ({
      company_id: profile.company_id,
      shop_id: profile.shop_id,
      branch_id: payload.branch_id ?? null,
      resource_type: payload.resource_type,
      resource_code: code,
      resource_name: `${namePrefix} ${idx + 1}`,
      capacity: payload.capacity,
      unit_price: payload.unit_price,
      floor: payload.floor ?? null,
      zone: payload.zone ?? null,
      active: payload.active,
      service_ids: serviceIds.length > 0 ? serviceIds : null,
      created_by: user.id,
      updated_by: user.id,
    }));

    const { error } = await supabase.from('booking_resources').insert(rows);
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'resource_code ซ้ำในสาขาเดียวกัน (บางรายการอาจซ้ำ)' }, { status: 400 });
      }
      if (error.code === '23503') {
        return NextResponse.json({ error: 'ข้อมูลอ้างอิงไม่ถูกต้อง (branch/company/shop)' }, { status: 400 });
      }
      throw error;
    }
    return NextResponse.json({ data: { created: rows.length } });
  } catch (e) {
    return NextResponse.json(getErrorPayload(e), { status: getErrorStatus(e) });
  }
}
