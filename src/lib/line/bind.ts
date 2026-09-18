/**
 * Bind a LINE user to a partner or a booking. The only input trusted is the
 * LIFF ID token, verified with LINE; the row ids come from the resolved link
 * token, never from the request.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getLineConfig } from './config';
import { verifyLiffIdToken } from './verify-id-token';

export type BindTarget =
  | { kind: 'partner'; partnerId: string | null; documentId: string }
  | { kind: 'driver'; bookingId: string };

export type BindResult =
  | { ok: true; lineUserRowId: string; displayName: string | null }
  | { ok: false; reason: 'not_configured' | 'invalid_token' | 'db_error' };

/** Upsert `line_users` for this site and return the row id. */
export async function upsertLineUser(
  admin: SupabaseClient,
  site: { shopId: string; companyId: string },
  profile: { userId: string; displayName?: string | null; pictureUrl?: string | null },
): Promise<string | null> {
  const { data, error } = await admin
    .from('line_users')
    .upsert(
      {
        company_id: site.companyId,
        shop_id: site.shopId,
        line_user_id: profile.userId,
        ...(profile.displayName ? { display_name: profile.displayName } : {}),
        ...(profile.pictureUrl ? { picture_url: profile.pictureUrl } : {}),
        is_deleted: false,
      },
      { onConflict: 'shop_id,line_user_id' },
    )
    .select('id')
    .single();
  if (error || !data) {
    console.error('[line] line_users upsert failed:', error?.message);
    return null;
  }
  return data.id as string;
}

/**
 * @param admin Service-role client.
 * @param site Site ids taken from the resolved token row.
 * @param idToken LIFF `liff.getIDToken()`.
 * @param target What the LINE user should be attached to.
 */
export async function bindLineUser(
  admin: SupabaseClient,
  site: { shopId: string; companyId: string },
  idToken: string,
  target: BindTarget,
): Promise<BindResult> {
  const cfg = await getLineConfig(admin, site.shopId);
  if (!cfg.login_channel_id) return { ok: false, reason: 'not_configured' };
  const verified = await verifyLiffIdToken(idToken, cfg.login_channel_id);
  if (!verified) return { ok: false, reason: 'invalid_token' };

  const rowId = await upsertLineUser(admin, site, { userId: verified.userId, displayName: verified.name, pictureUrl: verified.picture });
  if (!rowId) return { ok: false, reason: 'db_error' };

  if (target.kind === 'partner') {
    if (target.partnerId) {
      await admin.from('customers').update({ line_user_id: rowId }).eq('id', target.partnerId).eq('shop_id', site.shopId);
    }
    // The person who opened the link is the one to notify about this document's queues.
    await admin.from('bookings').update({ line_user_id: rowId }).eq('document_id', target.documentId).eq('shop_id', site.shopId).eq('is_deleted', false);
  } else {
    await admin.from('bookings').update({ driver_line_user_id: rowId }).eq('id', target.bookingId).eq('shop_id', site.shopId);
  }
  return { ok: true, lineUserRowId: rowId, displayName: verified.name ?? null };
}
