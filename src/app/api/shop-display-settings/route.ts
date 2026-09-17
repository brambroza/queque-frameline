import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { isServiceDurationVisible } from '@/lib/booking/display-settings';

const PatchSchema = z.object({
  show_service_duration: z.boolean(),
});

/** Read the shop's customer-facing display flags. */
export async function GET() {
  try {
    const { supabase, profile } = await requireAuthContext({
      roles: ['super_admin', 'shop_owner', 'branch_manager'],
    });
    const showServiceDuration = await isServiceDurationVisible(supabase, profile.shop_id as string);
    return NextResponse.json({ data: { show_service_duration: showServiceDuration } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

/** Update the shop's customer-facing display flags. */
export async function PATCH(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({
      roles: ['super_admin', 'shop_owner'],
    });
    const body = PatchSchema.parse(await req.json());

    const { error } = await supabase
      .from('shops')
      .update({ show_service_duration: body.show_service_duration, updated_by: user.id })
      .eq('id', profile.shop_id);
    if (error) {
      console.error('[shop_display_settings_update_failed]', error.message);
      return NextResponse.json({ error: 'บันทึกการตั้งค่าไม่สำเร็จ' }, { status: 400 });
    }

    return NextResponse.json({ data: { show_service_duration: body.show_service_duration } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
