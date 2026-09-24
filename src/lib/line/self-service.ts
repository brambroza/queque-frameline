/**
 * Rich menu self-service: answer "คิวของฉัน" / "สถานะ SO" / "ติดต่อคลัง" for a
 * LINE user. The only identity input is the `userId` LINE put in the signed
 * webhook event; everything else is looked up through the bindings made when
 * the user opened a booking / driver link through LIFF.
 *
 * Replies are free (they do not count against the OA's push quota), so this
 * is the cheap way for customers to check status without a push per change.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BookingDirection } from '@/types/db';
import { LIVE_STATUSES } from '@/lib/booking/status-flow';
import { getSiteSettings, type SiteSettings } from '@/lib/booking/server';
import { toBangkokStamp } from '@/lib/booking/slot-time';
import { effectivePlate } from '@/lib/booking/plate';
import { isPaymentCleared } from '@/lib/booking/payment';
import { deriveLinkToken, expiryFromNow, hashToken, tokenState } from '@/lib/tokens';
import { bookingUrl, driverUrl } from '@/lib/links';
import { liffUrl, type LineConfig } from './config';
import { contactText, moreItemsText, myDocsFlex, myQueuesFlex, noDocsText, noQueuesText, notLinkedText, REPLY_LIST_LIMIT, type MyDocItem, type MyQueueItem } from './messages';
import type { RichMenuAction } from './rich-menu';

export type Site = { shopId: string; companyId: string; name: string };

/** Everything the LINE user is bound to. `null` = not linked to anything yet. */
export type LineIdentity = {
  /** `line_users.id` */
  rowId: string;
  /** Partners (customers / suppliers) whose LINE this is. */
  partnerIds: string[];
  /** Bookings this user drives (`bookings.driver_line_user_id`). */
  driverBookingIds: string[];
  /** Documents whose queues this user booked (`bookings.line_user_id`). */
  bookedDocIds: string[];
};

export async function resolveLineIdentity(admin: SupabaseClient, shopId: string, lineUserId: string): Promise<LineIdentity | null> {
  const { data: lu } = await admin.from('line_users').select('id').eq('shop_id', shopId).eq('line_user_id', lineUserId).eq('is_deleted', false).maybeSingle();
  if (!lu) return null;
  const rowId = lu.id as string;
  const [{ data: partners }, { data: bookings }] = await Promise.all([
    admin.from('customers').select('id').eq('shop_id', shopId).eq('line_user_id', rowId).eq('is_deleted', false),
    admin.from('bookings').select('id,document_id,line_user_id,driver_line_user_id').eq('shop_id', shopId).eq('is_deleted', false).or(`line_user_id.eq.${rowId},driver_line_user_id.eq.${rowId}`),
  ]);
  const partnerIds = (partners ?? []).map((p) => p.id as string);
  const rows = (bookings ?? []) as Array<{ id: string; document_id: string | null; line_user_id: string | null; driver_line_user_id: string | null }>;
  const driverBookingIds = rows.filter((b) => b.driver_line_user_id === rowId).map((b) => b.id);
  const bookedDocIds = Array.from(new Set(rows.filter((b) => b.line_user_id === rowId && b.document_id).map((b) => b.document_id as string)));
  if (partnerIds.length === 0 && driverBookingIds.length === 0 && bookedDocIds.length === 0) return null;
  return { rowId, partnerIds, driverBookingIds, bookedDocIds };
}

type DocTokenRow = { id: string; status: string; booking_token_hash: string | null; booking_token_version: number | null; booking_token_expires_at: string | null };

/**
 * Self-booking page URL for a document the user is entitled to. Issues the
 * token when the document never had one or it expired (same rule as the
 * portal's booking-link route) so a partner can reach every open document of
 * theirs from the menu, not only the ones a link was sent for.
 */
async function bookingPageUrl(admin: SupabaseClient, cfg: LineConfig, shopId: string, doc: DocTokenRow, now: Date, settings: () => Promise<SiteSettings>): Promise<string | null> {
  if (doc.status === 'cancelled' || doc.status === 'completed') return null;
  const version = Number(doc.booking_token_version ?? 0);
  const expired = Boolean(doc.booking_token_hash) && tokenState(doc.booking_token_expires_at, now) === 'expired';
  const token = deriveLinkToken('booking', doc.id, version);
  if (!doc.booking_token_hash || expired) {
    const s = await settings();
    const { error } = await admin
      .from('external_documents')
      .update({ booking_token_hash: hashToken(token), booking_token_version: version, booking_token_expires_at: expiryFromNow(now, s.booking_token_ttl_days) })
      .eq('id', doc.id).eq('shop_id', shopId).eq('is_deleted', false);
    if (error) { console.error('[line] issue booking token failed:', error.message); return null; }
  }
  return liffUrl(cfg, `/book/${token}`) ?? bookingUrl(token);
}

/** `or=` filter that limits documents to the user's partners and the documents they booked. */
function docScopeFilter(id: LineIdentity): string | null {
  const parts: string[] = [];
  if (id.partnerIds.length > 0) parts.push(`partner_id.in.(${id.partnerIds.join(',')})`);
  if (id.bookedDocIds.length > 0) parts.push(`id.in.(${id.bookedDocIds.join(',')})`);
  return parts.length > 0 ? parts.join(',') : null;
}

const QUEUE_SELECT =
  'id,queue_number,status,direction,booking_date,start_time,end_time,resource_name,plate_number,plate_number_actual,do_number,customer_id,document_id,line_user_id,driver_line_user_id,driver_token_hash,driver_token_version,driver_token_expires_at,external_documents(id,doc_no,doc_type,status,payment_status,booking_token_hash,booking_token_version,booking_token_expires_at)';

type QueueRow = {
  id: string; queue_number: string; status: string; direction: BookingDirection; booking_date: string; start_time: string; end_time: string | null;
  resource_name: string | null; plate_number: string | null; plate_number_actual: string | null; do_number: string | null; customer_id: string | null; document_id: string | null;
  line_user_id: string | null; driver_line_user_id: string | null; driver_token_hash: string | null; driver_token_version: number | null; driver_token_expires_at: string | null;
  external_documents: (DocTokenRow & { doc_no: string; doc_type: 'so' | 'po'; payment_status: string | null }) | null;
};

/** Live queues (today onwards) the user booked, owns through their partner, or drives. */
async function loadMyQueues(admin: SupabaseClient, cfg: LineConfig, site: Site, id: LineIdentity, now: Date): Promise<MyQueueItem[]> {
  const today = toBangkokStamp(now).date;
  const ors = [`line_user_id.eq.${id.rowId}`, `driver_line_user_id.eq.${id.rowId}`];
  if (id.partnerIds.length > 0) ors.push(`customer_id.in.(${id.partnerIds.join(',')})`);
  const { data } = await admin
    .from('bookings')
    .select(QUEUE_SELECT)
    .eq('shop_id', site.shopId).eq('is_deleted', false)
    .in('status', LIVE_STATUSES as unknown as string[])
    .gte('booking_date', today)
    .or(ors.join(','))
    .order('booking_date', { ascending: true }).order('start_time', { ascending: true })
    .limit(REPLY_LIST_LIMIT + 20);
  const rows = ((data ?? []) as unknown as QueueRow[]);
  let settingsPromise: Promise<SiteSettings> | null = null;
  const settings = () => (settingsPromise ??= getSiteSettings(admin, site.shopId));

  const items: MyQueueItem[] = [];
  for (const b of rows) {
    const isPartner = b.line_user_id === id.rowId || (b.customer_id !== null && id.partnerIds.includes(b.customer_id));
    const role: MyQueueItem['role'] = isPartner ? 'partner' : 'driver';
    let url: string | null = null;
    if (role === 'partner' && b.external_documents) url = await bookingPageUrl(admin, cfg, site.shopId, b.external_documents, now, settings);
    else if (b.driver_token_hash && tokenState(b.driver_token_expires_at, now) === 'ok') {
      const t = deriveLinkToken('driver', b.id, Number(b.driver_token_version ?? 0));
      url = liffUrl(cfg, `/driver/${t}`) ?? driverUrl(t);
    }
    items.push({
      queueNo: b.queue_number, status: b.status, direction: b.direction, date: String(b.booking_date), startTime: String(b.start_time), endTime: b.end_time ? String(b.end_time) : null,
      dock: b.resource_name, plate: effectivePlate(b) || '-', doNo: b.do_number, docNo: b.external_documents?.doc_no ?? null, url, role,
      paymentPending: !isPaymentCleared(b.external_documents?.doc_type, b.external_documents?.payment_status),
    });
  }
  return items;
}

type DocRow = DocTokenRow & { doc_no: string; doc_type: 'so' | 'po'; partner_name: string | null; due_date: string | null; payment_status: string | null; item_count: number | null; created_at: string };

/** Open / booked documents of the user's partners plus the ones they booked, with their live queues. */
async function loadMyDocs(admin: SupabaseClient, cfg: LineConfig, site: Site, id: LineIdentity, now: Date): Promise<MyDocItem[]> {
  const scope = docScopeFilter(id);
  if (!scope) return [];
  const { data } = await admin
    .from('external_documents')
    .select('id,doc_no,doc_type,status,partner_name,due_date,payment_status,item_count,booking_token_hash,booking_token_version,booking_token_expires_at,created_at')
    .eq('shop_id', site.shopId).eq('is_deleted', false)
    .in('status', ['open', 'booked'])
    .or(scope)
    .order('due_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false })
    .limit(REPLY_LIST_LIMIT + 20);
  const docs = ((data ?? []) as unknown as DocRow[]);
  if (docs.length === 0) return [];

  const { data: queues } = await admin
    .from('bookings')
    .select('document_id,queue_number,status,booking_date,start_time')
    .eq('shop_id', site.shopId).eq('is_deleted', false)
    .in('document_id', docs.map((d) => d.id))
    .in('status', LIVE_STATUSES as unknown as string[])
    .order('booking_date', { ascending: true }).order('start_time', { ascending: true });
  const byDoc = new Map<string, MyDocItem['queues']>();
  for (const q of (queues ?? []) as Array<{ document_id: string; queue_number: string; status: string; booking_date: string; start_time: string }>) {
    const list = byDoc.get(q.document_id) ?? [];
    list.push({ queueNo: q.queue_number, status: q.status, date: String(q.booking_date), startTime: String(q.start_time) });
    byDoc.set(q.document_id, list);
  }

  let settingsPromise: Promise<SiteSettings> | null = null;
  const settings = () => (settingsPromise ??= getSiteSettings(admin, site.shopId));
  const items: MyDocItem[] = [];
  // Only the documents that will be shown get a link (issuing a token writes a row).
  for (const [i, d] of docs.entries()) {
    const url = i < REPLY_LIST_LIMIT ? await bookingPageUrl(admin, cfg, site.shopId, d, now, settings) : null;
    const pay = d.doc_type === 'so' ? ((d.payment_status as MyDocItem['paymentStatus']) ?? 'unpaid') : null;
    items.push({ docNo: d.doc_no, docType: d.doc_type, partnerName: d.partner_name, status: d.status, dueDate: d.due_date, itemCount: Number(d.item_count ?? 0), paymentStatus: pay, queues: byDoc.get(d.id) ?? [], url });
  }
  return items;
}

async function loadContact(admin: SupabaseClient, site: Site) {
  const [{ data: shop }, { data: branches }] = await Promise.all([
    admin.from('shops').select('phone,address').eq('id', site.shopId).maybeSingle(),
    admin.from('branches').select('branch_name,phone,address').eq('shop_id', site.shopId).eq('is_deleted', false).eq('active', true).order('branch_name', { ascending: true }),
  ]);
  return contactText({
    siteName: site.name,
    phone: (shop?.phone as string | null) ?? null,
    address: (shop?.address as string | null) ?? null,
    branches: ((branches ?? []) as Array<{ branch_name: string; phone: string | null; address: string | null }>).map((b) => ({ name: b.branch_name, phone: b.phone, address: b.address })),
  });
}

/**
 * Messages to reply for a rich menu button (≤ 5, LINE's reply limit).
 * Never throws: on any failure the caller falls back to the help text.
 */
export async function answerRichMenuAction(admin: SupabaseClient, site: Site, cfg: LineConfig, lineUserId: string, action: RichMenuAction, now = new Date()): Promise<object[]> {
  if (action === 'contact') return [await loadContact(admin, site)];
  const id = await resolveLineIdentity(admin, site.shopId, lineUserId);
  if (!id) return [notLinkedText(site.name)];
  if (action === 'my_queues') {
    const items = await loadMyQueues(admin, cfg, site, id, now);
    if (items.length === 0) return [noQueuesText()];
    const msgs: object[] = [myQueuesFlex(items)];
    if (items.length > REPLY_LIST_LIMIT) msgs.push(moreItemsText(items.length - REPLY_LIST_LIMIT, 'คิว'));
    return msgs;
  }
  const docs = await loadMyDocs(admin, cfg, site, id, now);
  if (docs.length === 0) return [noDocsText()];
  const msgs: object[] = [myDocsFlex(docs)];
  if (docs.length > REPLY_LIST_LIMIT) msgs.push(moreItemsText(docs.length - REPLY_LIST_LIMIT, 'เอกสาร'));
  return msgs;
}
