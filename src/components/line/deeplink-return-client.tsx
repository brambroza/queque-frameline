'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Card, CircularProgress, Stack, Typography } from '@mui/material';
import { alpha, darken } from '@mui/material/styles';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { LiffSection, LiffShell, brandSoft } from '@/components/line/liff-ui';
import { lineGreen } from '@/theme/tokens';

interface ReturnState {
  queue_number: string;
  payment_status: string | null;
  payment_amount: number | null;
  payment_expires_at: string | null;
  provider: string | null;
  provider_name: string | null;
  deeplink_url: string | null;
  shop: { name: string | null; shop_key: string; liff_id: string | null; liff_id_login_shop: string | null };
}

const POLL_INTERVAL_MS = 3_000;
const MAX_POLLS = 40; // 2 minutes

function formatTHB(amount: number) {
  return amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizeLiffId(input?: string | null): string {
  if (!input) return '';
  const m = input.trim().match(/liff\.line\.me\/([^/?#]+)/);
  return m?.[1] ?? input.trim();
}

/** Deep link back into the LIFF account tab, so the customer lands where their queue is. */
function buildLineReturnUrl(state: ReturnState | null, shopKey: string) {
  const candidates = [state?.shop.liff_id_login_shop, state?.shop.liff_id, process.env.NEXT_PUBLIC_LIFF_ID]
    .map(normalizeLiffId)
    .filter((v) => /^[0-9]{6,}-[A-Za-z0-9_-]{4,}$/.test(v));
  const liffId = candidates[0];
  if (!liffId) return null;
  const params = new URLSearchParams({ shop_key: shopKey, tab: 'account' });
  return `https://liff.line.me/${encodeURIComponent(liffId)}?${params.toString()}`;
}

export function DeeplinkReturnClient({ shopKey, bookingId, token }: { shopKey: string; bookingId: string; token: string }) {
  const [state, setState] = useState<ReturnState | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [pollCount, setPollCount] = useState(0);

  const load = useCallback(async () => {
    if (!bookingId || !token) {
      setError('ลิงก์ไม่ถูกต้อง');
      setLoading(false);
      return;
    }
    try {
      const qs = new URLSearchParams({ booking_id: bookingId, t: token });
      const res = await fetch(`/api/public/shop/${encodeURIComponent(shopKey)}/payment/deeplink-return?${qs.toString()}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error === 'Not found' ? 'ไม่พบข้อมูลการชำระเงิน' : 'ตรวจสอบสถานะไม่สำเร็จ');
      setState(json.data as ReturnState);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ตรวจสอบสถานะไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [shopKey, bookingId, token]);

  useEffect(() => { void load(); }, [load]);

  // Keep asking while the bank has not confirmed yet, then stop and let the customer retry by hand.
  useEffect(() => {
    if (state?.payment_status !== 'pending_payment' || pollCount >= MAX_POLLS) return;
    const id = setTimeout(() => {
      setPollCount((n) => n + 1);
      void load();
    }, POLL_INTERVAL_MS);
    return () => clearTimeout(id);
  }, [state?.payment_status, pollCount, load]);

  const lineUrl = buildLineReturnUrl(state, shopKey);
  const status = state?.payment_status ?? null;
  const amount = Number(state?.payment_amount ?? 0);

  return (
    <LiffShell shopName={state?.shop.name} title="สถานะการชำระเงิน">
      {loading && (
        <Alert severity="info" icon={<CircularProgress size={16} color="inherit" />}>กำลังตรวจสอบกับธนาคาร...</Alert>
      )}

      {!loading && error && <Alert severity="error">{error}</Alert>}

      {!loading && state && status === 'paid' && (
        <Card>
          <Stack alignItems="center" spacing={0.5} sx={{ px: 2, py: 2.75, textAlign: 'center' }}>
            <Box
              sx={{ width: 56, height: 56, mb: 0.75, borderRadius: '16px', display: 'grid', placeItems: 'center', bgcolor: brandSoft, color: 'primary.main' }}
            >
              <CheckRoundedIcon sx={{ fontSize: 30 }} />
            </Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>ชำระเงินสำเร็จ</Typography>
            <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>คิว {state.queue_number} · {formatTHB(amount)} บาท</Typography>
            <Typography variant="caption" color="text.secondary">ใบเสร็จถูกส่งไปที่ LINE ของคุณแล้ว</Typography>
          </Stack>
        </Card>
      )}

      {!loading && state && status === 'pending_payment' && (
        <LiffSection title="รอธนาคารยืนยัน">
          <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>คิว {state.queue_number} · ยอด {formatTHB(amount)} บาท</Typography>
          <Typography variant="caption" color="text.secondary">
            {pollCount < MAX_POLLS
              ? 'ระบบตรวจสอบอัตโนมัติทุก 3 วินาที หากชำระแล้วสถานะจะเปลี่ยนเอง'
              : 'หยุดตรวจสอบอัตโนมัติแล้ว กดปุ่มด้านล่างเพื่อเช็คใหม่'}
          </Typography>
          <Button variant="outlined" fullWidth onClick={() => { setPollCount(0); void load(); }}>ตรวจสอบอีกครั้ง</Button>
          {state.deeplink_url && (
            <Button variant="contained" fullWidth href={state.deeplink_url}>
              เปิดแอป {state.provider_name ?? 'ธนาคาร'} อีกครั้ง
            </Button>
          )}
        </LiffSection>
      )}

      {!loading && state && status !== 'paid' && status !== 'pending_payment' && (
        <Alert severity="error">
          <Typography variant="body2" sx={{ fontWeight: 700 }}>การชำระเงินไม่สำเร็จ</Typography>
          <Typography variant="caption">คิว {state.queue_number} — กลับไปที่ LINE เพื่อออกลิงก์ชำระเงินใหม่</Typography>
        </Alert>
      )}

      {lineUrl && (
        <Button
          variant="contained"
          size="large"
          fullWidth
          href={lineUrl}
          sx={{ bgcolor: lineGreen, boxShadow: `0 8px 24px ${alpha(lineGreen, 0.28)}`, '&:hover': { bgcolor: darken(lineGreen, 0.12) } }}
        >
          กลับไป LINE
        </Button>
      )}
      {!lineUrl && !loading && (
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
          ปิดหน้านี้แล้วกลับไปที่ LINE เพื่อดูคิวของคุณ
        </Typography>
      )}
    </LiffShell>
  );
}
