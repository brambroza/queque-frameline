import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';

const schema = z.object({
  full_name: z.string().min(1).max(120),
  phone: z.string().max(30).optional().nullable(),
});

export async function GET() {
  try {
    const { supabase, user } = await requireAuthContext();
    const { data, error } = await supabase
      .from('users_profile')
      .select('id,full_name,email,phone')
      .eq('id', user.id)
      .single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, user } = await requireAuthContext();
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const payload = parsed.data;
    const { error } = await supabase
      .from('users_profile')
      .update({
        full_name: payload.full_name.trim(),
        phone: payload.phone?.trim() || null,
        updated_by: user.id,
      })
      .eq('id', user.id);
    if (error) throw error;
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
