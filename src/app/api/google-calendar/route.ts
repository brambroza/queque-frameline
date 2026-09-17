import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getGoogleOAuthPlatformConfig,
  revokeGoogleCalendarConnection,
  type GoogleCalendarConnection,
} from '@/lib/google-calendar/oauth';

const MANAGER_ROLES = new Set(['super_admin', 'shop_owner', 'branch_manager']);

export async function GET() {
  try {
    const { profile, roles } = await requireAuthContext({
      roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'],
    });
    const platformConfig = getGoogleOAuthPlatformConfig();
    const admin = createAdminClient();
    const { data: connection, error: connectionError } = await admin
      .from('google_calendar_connections')
      .select('calendar_id,last_synced_at,last_error,updated_at')
      .eq('company_id', profile.company_id)
      .eq('shop_id', profile.shop_id)
      .maybeSingle();
    const connectionTableMissing = connectionError?.code === 'PGRST205';
    if (connectionError && !connectionTableMissing) throw new Error(connectionError.message);
    return NextResponse.json({
      data: {
        platform_configured: platformConfig.configured,
        sync_schema_ready: !connectionTableMissing,
        shop_id: profile.shop_id,
        can_manage: roles.some((role) => MANAGER_ROLES.has(role)),
        connected: Boolean(connection),
        calendar_id: connection?.calendar_id ?? null,
        last_synced_at: connection?.last_synced_at ?? null,
        last_error: connection?.last_error ?? null,
        updated_at: connection?.updated_at ?? null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to read Google Calendar settings' },
      { status: getErrorStatus(error) },
    );
  }
}

export async function DELETE() {
  try {
    const { profile } = await requireAuthContext({
      roles: ['super_admin', 'shop_owner', 'branch_manager'],
    });
    const admin = createAdminClient();
    const { data } = await admin
      .from('google_calendar_connections')
      .select('id,company_id,shop_id,calendar_id,access_token_encrypted,refresh_token_encrypted,token_expires_at')
      .eq('company_id', profile.company_id)
      .eq('shop_id', profile.shop_id)
      .maybeSingle();

    if (data) {
      await revokeGoogleCalendarConnection(data as GoogleCalendarConnection).catch(() => undefined);
      const { error } = await admin
        .from('google_calendar_connections')
        .delete()
        .eq('id', data.id)
        .eq('company_id', profile.company_id)
        .eq('shop_id', profile.shop_id);
      if (error) throw error;
    }

    return NextResponse.json({ data: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to disconnect Google Calendar' },
      { status: getErrorStatus(error) },
    );
  }
}
