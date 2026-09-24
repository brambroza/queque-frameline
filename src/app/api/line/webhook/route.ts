import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getGroupSummary, replyMessage } from '@/lib/line/client';
import { getLineConfig } from '@/lib/line/config';
import { verifyLineSignature } from '@/lib/line/signature';
import { upsertLineUser } from '@/lib/line/bind';
import { GROUP_REGISTER_COMMAND, groupJoinedText, groupRegisteredText, helpText, welcomeText } from '@/lib/line/messages';
import { actionForText, parsePostback, type RichMenuAction } from '@/lib/line/rich-menu';
import { answerRichMenuAction, type Site } from '@/lib/line/self-service';

export const dynamic = 'force-dynamic';

type LineEvent = {
  type: string;
  replyToken?: string;
  source?: { type: 'user' | 'group' | 'room'; userId?: string; groupId?: string; roomId?: string };
  message?: { type: string; text?: string };
  postback?: { data?: string };
  timestamp?: number;
};

/**
 * LINE Messaging API webhook (single OA for the site).
 * The OA is a notification channel plus a small self-service menu: it welcomes
 * new friends, registers the warehouse-team group, answers the rich menu
 * buttons (my queues / SO status / contact) from the user's bindings, and
 * answers everything else with a short "use the link you were given" message.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const admin = createAdminClient();
  const { data: shop } = await admin.from('shops').select('id,company_id,name').eq('shop_key', process.env.SITE_SHOP_KEY || 'fameline').eq('is_deleted', false).maybeSingle();
  if (!shop) return NextResponse.json({ error: 'site not found' }, { status: 500 });
  const site: Site = { shopId: shop.id as string, companyId: shop.company_id as string, name: (shop.name as string) || 'Fameline' };
  const cfg = await getLineConfig(admin, site.shopId);

  // Not configured yet: answer 200 so the console's "Verify" button passes, do nothing.
  if (!cfg.channel_secret || !cfg.channel_access_token) return NextResponse.json({ skipped: 'not_configured' });
  if (!verifyLineSignature(cfg.channel_secret, rawBody, req.headers.get('x-line-signature'))) {
    return NextResponse.json({ error: 'bad signature' }, { status: 401 });
  }

  let events: LineEvent[] = [];
  try {
    events = ((JSON.parse(rawBody) as { events?: LineEvent[] }).events ?? []);
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 });
  }
  await admin.from('line_config').update({ webhook_verified_at: new Date().toISOString() }).eq('shop_id', site.shopId);

  const token = cfg.channel_access_token;
  const reply = async (ev: LineEvent, messages: object[]) => {
    if (!ev.replyToken) return;
    try { await replyMessage(token, ev.replyToken, messages); } catch (e) { console.error('[line] reply failed:', e instanceof Error ? e.message : e); }
  };
  /** Rich menu button (or the same word typed) in a 1:1 chat. A lookup failure still answers with the help text. */
  const answerMenu = async (ev: LineEvent, userId: string, action: RichMenuAction) => {
    await upsertLineUser(admin, site, { userId });
    let messages: object[];
    try {
      messages = await answerRichMenuAction(admin, site, cfg, userId, action);
    } catch (e) {
      console.error('[line] menu answer failed:', action, e instanceof Error ? e.message : e);
      messages = [helpText(site.name)];
    }
    await reply(ev, messages);
  };

  for (const ev of events) {
    const src = ev.source ?? { type: 'user' as const };
    await admin.from('line_events').insert({
      shop_id: site.shopId, event_type: ev.type, source_type: src.type, line_user_id: src.userId ?? null, group_id: src.groupId ?? src.roomId ?? null, payload: ev,
    });

    try {
      if (ev.type === 'follow' && src.userId) {
        await upsertLineUser(admin, site, { userId: src.userId });
        await reply(ev, [welcomeText(shop.name as string)]);
      } else if (ev.type === 'unfollow' && src.userId) {
        await admin.from('line_users').update({ is_deleted: true }).eq('shop_id', site.shopId).eq('line_user_id', src.userId);
      } else if (ev.type === 'join') {
        await reply(ev, [groupJoinedText()]);
      } else if (ev.type === 'postback' && src.type === 'user' && src.userId) {
        // Rich menu buttons. Unknown postback data (e.g. from an older menu) is ignored.
        const action = parsePostback(ev.postback?.data);
        if (action) await answerMenu(ev, src.userId, action);
      } else if (ev.type === 'message' && ev.message?.type === 'text') {
        const text = (ev.message.text ?? '').trim();
        const groupId = src.groupId ?? src.roomId ?? null;
        if (groupId && text.replace(/\s+/g, '') === GROUP_REGISTER_COMMAND) {
          let groupName: string | null = null;
          if (src.groupId) { try { groupName = (await getGroupSummary(token, src.groupId)).groupName; } catch { groupName = null; } }
          await admin.from('line_config').update({ staff_group_id: groupId, staff_group_name: groupName }).eq('shop_id', site.shopId);
          await reply(ev, [groupRegisteredText(groupName)]);
        } else if (!groupId && src.userId) {
          // 1:1 chat: a menu keyword gets the same answer as the button; anything else points at the link flow.
          const action = actionForText(text);
          if (action) await answerMenu(ev, src.userId, action);
          else {
            await upsertLineUser(admin, site, { userId: src.userId });
            await reply(ev, [helpText(site.name)]);
          }
        }
        // Other group chatter is ignored on purpose.
      }
    } catch (e) {
      console.error('[line] event handling failed:', ev.type, e instanceof Error ? e.message : e);
    }
  }
  return NextResponse.json({ ok: true, handled: events.length });
}
