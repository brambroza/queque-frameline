'use client';

import { useEffect, useState } from 'react';
import { Box, Button, Card, CardContent, Divider, Drawer, IconButton, Stack, Typography } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import { StatusChip } from '@/components/shared/status-chip';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { formatDateDMY, formatDateTimeDMY } from '@/lib/utils/date-format';
import { AckChip, PaymentChip } from './bookings-table';
import { CANCELLABLE, MOVABLE, NEXT_STATUSES, changeAckState, customerName, customerPhone, hhmm, paymentMethodLabel, type BookingRow } from './booking-types';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ '&:last-child': { pb: 2 } }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>{title}</Typography>
        {children}
      </CardContent>
    </Card>
  );
}

/**
 * Booking detail drawer: summary, payment, status transitions and cancel.
 * Moving the slot / resource lives in the move dialog, opened via `onMove`.
 */
export function BookingEditDrawer({
  booking,
  resourceLabel,
  saving,
  onClose,
  onStatus,
  onMove,
}: {
  booking: BookingRow | null;
  resourceLabel: string;
  saving: boolean;
  onClose: () => void;
  onStatus: (b: BookingRow, status: string) => void;
  onMove: (b: BookingRow) => void;
}) {
  const { t } = useTranslation('bookings');
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => { setConfirmCancel(false); }, [booking?.id]);

  const b = booking;
  const next = b ? NEXT_STATUSES[b.status] ?? [] : [];
  const ack = b ? changeAckState(b) : 'none';

  return (
    <Drawer anchor="right" open={Boolean(b)} onClose={saving ? undefined : onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 460 } } }}>
      {b ? (
        <>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ px: 3, py: 2 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" fontWeight={700}>{t('queue_unit', 'คิว')} {b.queue_number}</Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {customerName(b)}{customerPhone(b) ? ` · ${customerPhone(b)}` : ''}
              </Typography>
            </Box>
            <IconButton onClick={onClose} aria-label={t('close', 'ปิด')} disabled={saving}><CloseRoundedIcon /></IconButton>
          </Stack>
          <Divider />

          <Stack spacing={2} sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2.5 }}>
            <Box sx={{ borderRadius: 2, bgcolor: 'action.hover', p: 2 }}>
              <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                <StatusChip status={b.status} />
                <PaymentChip status={b.payment_status} />
              </Stack>
              <Stack spacing={0.25}>
                <Typography variant="body2"><b>{formatDateDMY(b.booking_date)}</b> {hhmm(b.start_time)}{b.end_time ? ` – ${hhmm(b.end_time)}` : ''}</Typography>
                <Typography variant="body2">{b.services?.service_name ?? '-'}{b.branches?.branch_name ? ` · ${b.branches.branch_name}` : ''}</Typography>
                <Typography variant="body2" color={b.resource_name ? 'text.primary' : 'text.disabled'}>
                  {resourceLabel}: {b.resource_name ?? t('unassigned', 'ยังไม่ระบุ')}
                </Typography>
                {b.note ? <Typography variant="caption" color="text.secondary">{t('note_short', 'หมายเหตุ')}: {b.note}</Typography> : null}
              </Stack>
              {ack !== 'none' ? (
                <Stack spacing={0.5} sx={{ mt: 1.5 }}>
                  <AckChip state={ack} />
                  <Typography variant="caption" color="text.secondary">
                    {t('ack_notified_at', 'แจ้งลูกค้าเมื่อ')} {formatDateTimeDMY(b.change_notified_at)}
                    {ack === 'acked' ? ` · ${t('ack_acked_at', 'รับทราบเมื่อ')} ${formatDateTimeDMY(b.change_acknowledged_at)}` : ''}
                  </Typography>
                </Stack>
              ) : null}
              {MOVABLE.has(b.status) ? (
                <Button size="small" variant="outlined" color="secondary" startIcon={<SwapHorizRoundedIcon />} sx={{ mt: 1.5 }} disabled={saving} onClick={() => onMove(b)}>
                  {t('move_queue', 'โยกย้ายคิว')}
                </Button>
              ) : null}
            </Box>

            {b.payment_method ? (
              <Section title={t('payment', 'การชำระเงิน')}>
                <Stack spacing={0.5}>
                  <Typography variant="body2">{t('payment_method', 'วิธีชำระ')}: <b>{paymentMethodLabel(b.payment_method)}</b></Typography>
                  <Typography variant="body2">{t('amount', 'ยอด')}: <b>{Number(b.payment_amount ?? 0).toLocaleString('th-TH')} {t('baht', 'บาท')}</b></Typography>
                  {b.payment_reject_reason ? <Typography variant="caption" color="error.main">{t('reject_reason', 'เหตุผลที่ปฏิเสธ')}: {b.payment_reject_reason}</Typography> : null}
                  {b.payment_method === 'bank_transfer' ? (
                    <Button size="small" variant="text" href={`/portal/payment-verification?booking_id=${b.id}`} sx={{ alignSelf: 'flex-start', mt: 0.5 }}>
                      {t('view_slip', 'ดูสลิป / ตรวจสอบ')}
                    </Button>
                  ) : null}
                </Stack>
              </Section>
            ) : null}

            {next.length > 0 ? (
              <Section title={t('change_status', 'เปลี่ยนสถานะ')}>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {next.map((o) => (
                    <Button key={o.status} variant={o.primary ? 'contained' : 'outlined'} color={o.primary ? 'primary' : 'inherit'} disabled={saving} onClick={() => onStatus(b, o.status)} sx={{ flex: 1 }}>
                      {o.label}
                    </Button>
                  ))}
                </Stack>
              </Section>
            ) : null}

            {CANCELLABLE.has(b.status) ? (
              <Section title={t('cancel_booking', 'ยกเลิกการจอง')}>
                {!confirmCancel ? (
                  <Button fullWidth variant="outlined" color="error" disabled={saving} onClick={() => setConfirmCancel(true)}>
                    {t('cancel_this', 'ยกเลิกการจองนี้')}
                  </Button>
                ) : (
                  <Stack spacing={1.5}>
                    <Typography variant="body2" color="error.main" fontWeight={600}>{t('cancel_confirm_title', 'ยืนยันการยกเลิก?')}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('cancel_confirm_desc', 'คิวนี้จะถูกยกเลิกและแจ้งเตือนไปยังระบบ')}
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <Button fullWidth variant="contained" color="error" disabled={saving} onClick={() => onStatus(b, 'cancelled')}>
                        {saving ? t('cancelling', 'กำลังยกเลิก…') : t('cancel_yes', 'ใช่ ยกเลิกการจอง')}
                      </Button>
                      <Button fullWidth variant="outlined" color="inherit" disabled={saving} onClick={() => setConfirmCancel(false)}>{t('cancel_no', 'ไม่ใช่')}</Button>
                    </Stack>
                  </Stack>
                )}
              </Section>
            ) : null}
          </Stack>
        </>
      ) : null}
    </Drawer>
  );
}
