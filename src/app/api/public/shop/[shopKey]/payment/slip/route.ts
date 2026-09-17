import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { pushMessage } from '@/lib/line/client';
import { slipReceivedFlex } from '@/lib/line/messages-payment';
import { safeCreateNotification } from '@/lib/notifications/createNotification';
import { isOwnerLookupFailure, resolveBookingForLineUser } from '@/lib/payments/liff-auth';
import { sniffImageMime } from '@/lib/utils/image-sniff';
import {
  PAYMENT_SLIP_BUCKET,
  SLIP_ALLOWED_MIME,
  SLIP_MAX_BYTES,
  ensurePaymentSlipBucket,
} from '@/lib/storage/buckets';

/** Statuses from which a customer may (re-)submit a slip. */
const UPLOADABLE_STATUSES = new Set(['pending_payment', 'rejected', 'awaiting_verification']);

const MAX_SLIPS_PER_BOOKING_PER_HOUR = 5;
const MAX_SLIPS_PER_USER_PER_DAY = 20;

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function randomHex(bytes: number) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Accept a customer-uploaded transfer slip and hand it to staff for review.
 * POST multipart: line_user_id, booking_id, file, amount_claimed?, transferred_at?
 */
export async function POST(req: Request, { params }: { params: Promise<{ shopKey: string }> }) {
  const { shopKey } = await params;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const lineUserId = String(form.get('line_user_id') ?? '').trim();
  const bookingId = String(form.get('booking_id') ?? '').trim();
  const idToken = String(form.get('id_token') ?? '').trim() || null;
  const file = form.get('file');
  if (!lineUserId || !bookingId || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const admin = createAdminClient();
  const owner = await resolveBookingForLineUser(admin, shopKey, lineUserId, bookingId, idToken);
  if (isOwnerLookupFailure(owner)) return NextResponse.json({ error: owner.error }, { status: owner.status });

  const { shop, booking, lineUserPk } = owner;

  if (booking.payment_method !== 'bank_transfer' || !UPLOADABLE_STATUSES.has(String(booking.payment_status))) {
    return NextResponse.json({ error: 'ไม่สามารถอัปโหลดสลิปสำหรับคิวนี้ได้' }, { status: 409 });
  }

  if (file.size > SLIP_MAX_BYTES) {
    return NextResponse.json({ error: 'ไฟล์ใหญ่เกิน 5MB' }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  // The declared type and the filename are both client-controlled; the magic
  // bytes are the only trustworthy signal about what this file really is.
  const mime = sniffImageMime(bytes);
  if (!mime || !SLIP_ALLOWED_MIME.includes(mime)) {
    return NextResponse.json({ error: 'รองรับเฉพาะไฟล์รูป JPG, PNG หรือ WebP' }, { status: 400 });
  }

  // ── Rate limits ──
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const [{ count: bookingCount }, { count: userCount }] = await Promise.all([
    admin
      .from('payment_slips')
      .select('id', { count: 'exact', head: true })
      .eq('booking_id', booking.id)
      .gte('created_at', hourAgo),
    admin
      .from('payment_slips')
      .select('id', { count: 'exact', head: true })
      .eq('uploaded_by_line_user', lineUserPk)
      .gte('created_at', dayAgo),
  ]);
  if ((bookingCount ?? 0) >= MAX_SLIPS_PER_BOOKING_PER_HOUR || (userCount ?? 0) >= MAX_SLIPS_PER_USER_PER_DAY) {
    return NextResponse.json({ error: 'อัปโหลดบ่อยเกินไป กรุณารอสักครู่' }, { status: 429 });
  }

  // ── Store ──
  try {
    await ensurePaymentSlipBucket(admin);
  } catch (e) {
    console.error('[slip] bucket error:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'อัปโหลดไม่สำเร็จ' }, { status: 500 });
  }

  const storagePath = `${shop.id}/${booking.id}/${Date.now()}-${randomHex(6)}.${EXT_BY_MIME[mime]}`;
  const { error: uploadError } = await admin.storage
    .from(PAYMENT_SLIP_BUCKET)
    .upload(storagePath, bytes, { contentType: mime, upsert: false });
  if (uploadError) {
    console.error('[slip] upload error:', uploadError.message);
    return NextResponse.json({ error: 'อัปโหลดไม่สำเร็จ' }, { status: 500 });
  }

  const amountClaimedRaw = form.get('amount_claimed');
  const amountClaimed = amountClaimedRaw ? Number(amountClaimedRaw) : null;
  const transferredAtRaw = String(form.get('transferred_at') ?? '').trim();
  const transferredAt = transferredAtRaw ? new Date(transferredAtRaw) : null;

  // Tenant ids come from the resolved booking, never from the request body.
  const { data: slip, error: insertError } = await admin
    .from('payment_slips')
    .insert({
      company_id: shop.company_id,
      shop_id: shop.id,
      booking_id: booking.id,
      storage_path: storagePath,
      file_size: file.size,
      mime_type: mime,
      amount_claimed: amountClaimed !== null && Number.isFinite(amountClaimed) && amountClaimed > 0 ? amountClaimed : null,
      transferred_at: transferredAt && !Number.isNaN(transferredAt.getTime()) ? transferredAt.toISOString() : null,
      status: 'pending',
      uploaded_by_line_user: lineUserPk,
    })
    .select('id')
    .single();

  if (insertError || !slip) {
    console.error('[slip] insert error:', insertError?.message);
    await admin.storage.from(PAYMENT_SLIP_BUCKET).remove([storagePath]);
    return NextResponse.json({ error: 'อัปโหลดไม่สำเร็จ' }, { status: 500 });
  }

  // Any earlier pending slip for this booking is no longer the one under review.
  await admin
    .from('payment_slips')
    .update({ status: 'superseded' })
    .eq('booking_id', booking.id)
    .eq('status', 'pending')
    .neq('id', slip.id);

  await admin
    .from('bookings')
    .update({ payment_status: 'awaiting_verification', payment_reject_reason: null })
    .eq('id', booking.id)
    .eq('shop_id', shop.id);

  const amount = Number(booking.payment_amount ?? 0);

  await admin.from('payment_transactions').insert({
    company_id: shop.company_id,
    shop_id: shop.id,
    booking_id: booking.id,
    method: 'bank_transfer',
    slip_id: slip.id,
    amount,
    currency: 'THB',
    status: 'pending_verification',
    event_type: 'slip.uploaded',
    raw_event: { slip_id: slip.id, amount_claimed: amountClaimed, file_size: file.size, mime_type: mime },
  });

  await safeCreateNotification(admin, {
    companyId: shop.company_id,
    shopId: shop.id,
    type: 'payment_slip_uploaded',
    category: 'billing',
    priority: 'high',
    title: 'สลิปใหม่รอตรวจสอบ',
    message: `คิว ${booking.queue_number} อัปโหลดสลิปแล้ว ยอด ${amount.toLocaleString('th-TH')} บาท`,
    relatedType: 'booking',
    relatedId: booking.id,
    actionUrl: '/portal/payment-verification',
  });

  // Best-effort acknowledgement — a failed push must not fail the upload.
  try {
    const { data: shopLine } = await admin
      .from('shops')
      .select('line_channel_access_token')
      .eq('id', shop.id)
      .maybeSingle();
    const token = shopLine?.line_channel_access_token || process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
    if (token) {
      await pushMessage(token, lineUserId, [
        slipReceivedFlex({ shopName: shop.name ?? 'Queue Booking', queueNumber: booking.queue_number, amountTHB: amount }),
      ]);
    }
  } catch (e) {
    console.error('[slip] line push failed:', e instanceof Error ? e.message : e);
  }

  return NextResponse.json({ data: { slip_id: slip.id, payment_status: 'awaiting_verification' } });
}
