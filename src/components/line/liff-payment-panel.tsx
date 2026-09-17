'use client';

import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Divider, Stack, TextField, Typography } from '@mui/material';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import { compressImage } from '@/lib/utils/image-compress';
import { KeyValueList, LiffLabel, LiffSection, LiffSkeleton } from '@/components/line/liff-ui';
import { BankGrid, type BankGridBank } from '@/components/line/bank-grid';
import { isBankAppMethod } from '@/lib/payments/mobile-banking/banks';

interface SlipInfo {
  id: string;
  status: string;
  reject_reason: string | null;
  amount_claimed: number | null;
  transferred_at: string | null;
  created_at: string;
  image_url: string | null;
}

interface DeeplinkBank {
  provider: string;
  display_name: string;
}

interface PaymentState {
  booking_id: string;
  queue_number: string;
  payment_status: string | null;
  payment_method: string | null;
  payment_amount: number | null;
  payment_expires_at: string | null;
  payment_reject_reason: string | null;
  qr_image_url: string | null;
  payee: {
    promptpay_display_name: string | null;
    promptpay_masked: string | null;
    bank_name: string | null;
    bank_account_no: string | null;
    bank_account_name: string | null;
    deeplink_banks?: DeeplinkBank[];
    mobile_banking_banks?: Array<{ code: string; name: string }>;
  } | null;
  bank_provider: string | null;
  bank_provider_name: string | null;
  bank_deeplink_url: string | null;
  return_url: string | null;
  slip: SlipInfo | null;
}

type LiffWindowApi = {
  isInClient?: () => boolean;
  openWindow?: (params: { url: string; external?: boolean }) => void;
};

/** Client-side ceiling before compression — anything larger is a mistake, not a slip. */
const MAX_RAW_BYTES = 12 * 1024 * 1024;
const SLIP_POLL_INTERVAL_MS = 10_000;
const SLIP_MAX_POLLS = 30; // 5 minutes
const DEEPLINK_POLL_INTERVAL_MS = 3_000;
const DEEPLINK_MAX_POLLS = 100; // 5 minutes

function formatTHB(amount: number) {
  return amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function useCountdown(expiresAt: string | null | undefined) {
  const [label, setLabel] = useState('');
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (!expiresAt) {
      setLabel('');
      setExpired(false);
      return;
    }
    const tick = () => {
      const left = new Date(expiresAt).getTime() - Date.now();
      if (left <= 0) {
        setExpired(true);
        return setLabel('หมดเวลาชำระแล้ว');
      }
      setExpired(false);
      const h = Math.floor(left / 3_600_000);
      const m = Math.floor((left % 3_600_000) / 60_000);
      setLabel(h > 0 ? `เหลือเวลา ${h} ชม. ${m} นาที` : `เหลือเวลา ${m} นาที`);
    };
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return { label, expired };
}

/**
 * Open a bank deeplink. Inside LINE the in-app browser cannot hand custom
 * schemes to other apps reliably, so LIFF's openWindow(external) sends it to the
 * system browser, which can. Elsewhere a plain navigation is enough.
 */
export function openBankDeeplink(url: string) {
  const liff = (window as Window & { liff?: LiffWindowApi }).liff;
  if (liff?.isInClient?.() && liff.openWindow) {
    liff.openWindow({ url, external: true });
    return;
  }
  window.location.href = url;
}

/**
 * Payment panel shown after a booking is made with a method that needs the
 * customer to act: bank transfer (QR + slip upload) or a bank-app method
 * (direct bank deeplink / Omise Mobile Banking: open the app, then wait for
 * confirmation).
 */
export function LiffPaymentPanel({
  shopKey,
  bookingId,
  lineUserId,
  idToken,
  onPaid,
}: {
  shopKey: string;
  bookingId: string;
  lineUserId: string;
  /** LIFF ID token — proves the claimed LINE id when the shop verifies tokens. */
  idToken?: string;
  /** @deprecated Colours now come from the MUI theme; the prop is ignored. */
  accent?: string;
  onPaid?: () => void;
}) {
  const [state, setState] = useState<PaymentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [reissuing, setReissuing] = useState(false);
  const [error, setError] = useState('');
  const [amountClaimed, setAmountClaimed] = useState('');
  const [transferredAt, setTransferredAt] = useState('');
  const [pollCount, setPollCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/shop/${shopKey}/payment/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line_user_id: lineUserId, booking_id: bookingId, id_token: idToken || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'โหลดข้อมูลการชำระเงินไม่สำเร็จ');
      setState(json.data as PaymentState);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดข้อมูลการชำระเงินไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [shopKey, bookingId, lineUserId, idToken]);

  useEffect(() => { void load(); }, [load]);

  const isBankApp = isBankAppMethod(state?.payment_method);
  const isOmiseMobile = state?.payment_method === 'omise_mobile_banking';

  // Poll only while a decision is pending, and give up rather than polling forever.
  // Bank-app confirmations arrive within seconds of the bank PIN, so poll faster.
  useEffect(() => {
    const status = state?.payment_status;
    const waiting = isBankApp ? status === 'pending_payment' : status === 'awaiting_verification';
    const maxPolls = isBankApp ? DEEPLINK_MAX_POLLS : SLIP_MAX_POLLS;
    if (!waiting || pollCount >= maxPolls) return;
    const id = setTimeout(() => {
      setPollCount((n) => n + 1);
      void load();
    }, isBankApp ? DEEPLINK_POLL_INTERVAL_MS : SLIP_POLL_INTERVAL_MS);
    return () => clearTimeout(id);
  }, [state?.payment_status, isBankApp, pollCount, load]);

  useEffect(() => {
    if (state?.payment_status === 'paid') onPaid?.();
  }, [state?.payment_status, onPaid]);

  const countdown = useCountdown(state?.payment_expires_at);

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    if (picked.size > MAX_RAW_BYTES) {
      setError('ไฟล์ใหญ่เกินไป กรุณาเลือกรูปสลิปที่เล็กกว่านี้');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    setUploading(true);
    setError('');
    try {
      const compressed = await compressImage(picked);
      const body = new FormData();
      body.append('line_user_id', lineUserId);
      body.append('booking_id', bookingId);
      if (idToken) body.append('id_token', idToken);
      body.append('file', compressed);
      if (amountClaimed) body.append('amount_claimed', amountClaimed);
      if (transferredAt) body.append('transferred_at', new Date(transferredAt).toISOString());

      const res = await fetch(`/api/public/shop/${shopKey}/payment/slip`, { method: 'POST', body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'อัปโหลดสลิปไม่สำเร็จ');
      setPollCount(0);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'อัปโหลดสลิปไม่สำเร็จ');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  /** Ask the server for a fresh bank-app link (bank deeplink or Omise charge) and open it. */
  async function reissueDeeplink(provider: string) {
    setReissuing(true);
    setError('');
    try {
      const endpoint = isOmiseMobile ? 'mobile-banking' : 'deeplink';
      const body = isOmiseMobile
        ? { line_user_id: lineUserId, booking_id: bookingId, id_token: idToken || undefined, bank: provider }
        : { line_user_id: lineUserId, booking_id: bookingId, id_token: idToken || undefined, bank_provider: provider };
      const res = await fetch(`/api/public/shop/${shopKey}/payment/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'ออกลิงก์ชำระเงินไม่สำเร็จ');
      setPollCount(0);
      await load();
      const url = (json.data as { deeplink_url?: string } | undefined)?.deeplink_url;
      if (url) openBankDeeplink(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ออกลิงก์ชำระเงินไม่สำเร็จ');
    } finally {
      setReissuing(false);
    }
  }

  if (loading) {
    return (
      <LiffSection title="ชำระเงิน">
        <LiffSkeleton rows={1} button />
      </LiffSection>
    );
  }
  if (!state || (state.payment_method !== 'bank_transfer' && !isBankApp)) return null;

  const amount = Number(state.payment_amount ?? 0);
  const status = state.payment_status;
  const recheck = () => { setPollCount(0); void load(); };

  const amountBlock = (
    <Stack alignItems="center" sx={{ textAlign: 'center', pt: 0.5 }}>
      <Typography variant="caption" color="text.secondary">ยอดที่ต้องชำระ</Typography>
      <Typography
        variant="h4"
        sx={{ fontWeight: 800, color: 'primary.main', letterSpacing: '-0.02em', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}
      >
        {formatTHB(amount)} บาท
      </Typography>
      {countdown.label ? (
        <Typography variant="caption" sx={{ color: countdown.expired ? 'error.main' : 'text.secondary', mt: 0.25, fontVariantNumeric: 'tabular-nums' }}>
          {countdown.label}
        </Typography>
      ) : null}
    </Stack>
  );

  // ── Paid ──
  if (status === 'paid') {
    return (
      <Alert severity="success" icon={<CheckRoundedIcon fontSize="inherit" />}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>ชำระเงินเรียบร้อยแล้ว</Typography>
        <Typography variant="caption">{formatTHB(amount)} บาท</Typography>
      </Alert>
    );
  }

  // ── Bank app (direct deeplink or Omise Mobile Banking): open the app, wait for confirmation ──
  if (isBankApp) {
    const bankName = state.bank_provider_name ?? 'ธนาคาร';
    // Both bank-app methods share the same button shape: {code, name}.
    const banks: BankGridBank[] = isOmiseMobile
      ? (state.payee?.mobile_banking_banks ?? [])
      : (state.payee?.deeplink_banks ?? []).map((b) => ({ code: b.provider, name: b.display_name }));
    const canOpen = Boolean(state.bank_deeplink_url) && status === 'pending_payment' && !countdown.expired;
    const reissueBanks = banks.length ? banks : state.bank_provider ? [{ code: state.bank_provider, name: bankName }] : [];
    const otherBanks = banks.filter((b) => b.code !== state.bank_provider);
    const polling = status === 'pending_payment' && pollCount < DEEPLINK_MAX_POLLS;
    return (
      <LiffSection title="ชำระเงิน">
        {status === 'failed' && (
          <Alert severity="error">
            <Typography variant="body2" sx={{ fontWeight: 700 }}>การชำระเงินไม่สำเร็จ</Typography>
            <Typography variant="caption">เลือกธนาคารด้านล่างเพื่อลองอีกครั้ง</Typography>
          </Alert>
        )}

        {amountBlock}

        {canOpen ? (
          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={() => state.bank_deeplink_url && openBankDeeplink(state.bank_deeplink_url)}
          >
            เปิดแอป {bankName}
          </Button>
        ) : (
          <Stack spacing={1}>
            <Typography variant="caption" color="text.secondary">
              {status === 'failed' ? 'เลือกธนาคารเพื่อชำระใหม่' : 'ลิงก์ชำระเงินหมดอายุหรือใช้ไม่ได้แล้ว เลือกธนาคารเพื่อออกลิงก์ใหม่'}
            </Typography>
            <BankGrid banks={reissueBanks} disabled={reissuing} onChange={(code) => void reissueDeeplink(code)} />
            {reissuing ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                <CircularProgress size={12} color="inherit" /> กำลังออกลิงก์...
              </Typography>
            ) : null}
          </Stack>
        )}

        <Box sx={{ bgcolor: 'grey.100', borderRadius: '12px', px: 1.5, py: 1.25 }}>
          <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
            ยอดเงินและผู้รับถูกตั้งไว้แล้วในแอป {bankName} ยืนยันด้วย PIN ได้เลย
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {isOmiseMobile ? 'ผู้รับเงินในแอปจะแสดงเป็นชื่อร้านผ่าน Omise · ' : ''}ชำระเสร็จแล้วกลับมาที่หน้านี้ ระบบตรวจสอบอัตโนมัติ
          </Typography>
        </Box>

        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
            {polling ? (
              <Box
                component="span"
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                  '@keyframes liffPulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
                  animation: 'liffPulse 1.4s ease-in-out infinite',
                  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
                }}
              />
            ) : null}
            {polling ? 'กำลังรอธนาคารยืนยัน...' : 'หยุดตรวจสอบอัตโนมัติแล้ว'}
          </Typography>
          <Button size="small" variant="outlined" color="inherit" onClick={recheck}>ตรวจสอบสถานะ</Button>
        </Stack>

        {canOpen && otherBanks.length > 0 && (
          <>
            <Divider />
            <LiffLabel>เปลี่ยนธนาคาร</LiffLabel>
            <BankGrid banks={otherBanks} size="small" disabled={reissuing} onChange={(code) => void reissueDeeplink(code)} />
          </>
        )}

        {error && <Alert severity="error">{error}</Alert>}
      </LiffSection>
    );
  }

  // ── Waiting for the shop to review ──
  if (status === 'awaiting_verification') {
    return (
      <LiffSection title="ชำระเงิน">
        <Alert severity="warning">
          <Typography variant="body2" sx={{ fontWeight: 700 }}>รอร้านตรวจสอบสลิป</Typography>
          <Typography variant="caption">ยอด {formatTHB(amount)} บาท — ร้านจะแจ้งผลผ่าน LINE</Typography>
        </Alert>
        {state.slip?.image_url && (
          <Box
            component="img"
            src={state.slip.image_url}
            alt="สลิปที่อัปโหลด"
            sx={{ display: 'block', mx: 'auto', maxHeight: 208, maxWidth: '100%', borderRadius: '12px', border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
          />
        )}
        <Button variant="outlined" fullWidth onClick={recheck}>ตรวจสอบสถานะอีกครั้ง</Button>
        {pollCount >= SLIP_MAX_POLLS && (
          <Typography variant="caption" sx={{ color: 'warning.dark' }}>หยุดตรวจสอบอัตโนมัติแล้ว กดปุ่มด้านบนเพื่อเช็คใหม่</Typography>
        )}
      </LiffSection>
    );
  }

  // ── pending_payment / rejected: show the QR and the upload form ──
  const payeeRows = state.payee
    ? [
        ...(state.payee.promptpay_display_name ? [{ label: 'ผู้รับ', value: state.payee.promptpay_display_name }] : []),
        ...(state.payee.promptpay_masked ? [{ label: 'PromptPay', value: state.payee.promptpay_masked }] : []),
        ...(state.payee.bank_name && state.payee.bank_account_no
          ? [{ label: 'บัญชี', value: `${state.payee.bank_name} ${state.payee.bank_account_no}` }]
          : []),
        ...(state.payee.bank_account_name ? [{ label: 'ชื่อบัญชี', value: state.payee.bank_account_name }] : []),
      ]
    : [];
  return (
    <LiffSection title="ชำระเงิน">
      {status === 'rejected' && (
        <Alert severity="error">
          <Typography variant="body2" sx={{ fontWeight: 700 }}>สลิปไม่ผ่านการตรวจสอบ</Typography>
          {state.payment_reject_reason && <Typography variant="caption" sx={{ display: 'block' }}>เหตุผล: {state.payment_reject_reason}</Typography>}
          <Typography variant="caption">กรุณาอัปโหลดสลิปใหม่อีกครั้ง</Typography>
        </Alert>
      )}

      {amountBlock}

      {state.qr_image_url && (
        <Stack alignItems="center" spacing={1}>
          <Box
            component="img"
            src={state.qr_image_url}
            alt="PromptPay QR"
            sx={{ width: 224, height: 224, maxWidth: '100%', borderRadius: '16px', border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
          />
          <Typography variant="caption" color="text.secondary">สแกนด้วยแอปธนาคารเพื่อโอนเงิน</Typography>
        </Stack>
      )}

      {payeeRows.length > 0 && (
        <Box sx={{ bgcolor: 'grey.100', borderRadius: '12px', px: 1.5, py: 1.25 }}>
          <KeyValueList rows={payeeRows} dense />
        </Box>
      )}

      <Divider />
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>อัปโหลดสลิปการโอน</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        <TextField
          label="ยอดที่โอน (ไม่บังคับ)"
          type="number"
          placeholder={String(amount)}
          value={amountClaimed}
          onChange={(e) => setAmountClaimed(e.target.value)}
          slotProps={{ htmlInput: { inputMode: 'decimal' }, inputLabel: { shrink: true } }}
        />
        <TextField
          label="เวลาที่โอน (ไม่บังคับ)"
          type="datetime-local"
          value={transferredAt}
          onChange={(e) => setTransferredAt(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Box>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        hidden
        onChange={onFileChange}
        disabled={uploading}
      />
      <Button
        variant="contained"
        size="large"
        fullWidth
        disabled={uploading}
        startIcon={uploading ? <CircularProgress size={16} color="inherit" /> : <PhotoCameraRoundedIcon />}
        onClick={() => fileRef.current?.click()}
      >
        {uploading ? 'กำลังอัปโหลด...' : 'เลือกรูปสลิป'}
      </Button>
      <Typography variant="caption" color="text.disabled">รองรับ JPG, PNG, WebP — ไม่เกิน 5MB (ระบบจะย่อรูปให้อัตโนมัติ)</Typography>

      {error && <Alert severity="error">{error}</Alert>}
    </LiffSection>
  );
}
