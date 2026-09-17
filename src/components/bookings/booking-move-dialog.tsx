'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import NotificationsOffRoundedIcon from '@mui/icons-material/NotificationsOffRounded';
import { StatusChip } from '@/components/shared/status-chip';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { formatDateDMY, getTodayISOInBangkok } from '@/lib/utils/date-format';
import { addDays, customerName, hhmm, shiftTime, type BookingRow, type Resource } from './booking-types';
import { resourceServesService } from '@/lib/booking/resource-service-link';

export type MoveDraft = { date: string; time: string; resourceId: string };

const TIME_SHIFTS = [-30, -15, 15, 30] as const;

/**
 * "โยกย้ายคิว" — move a booking to another date / time and, when the shop has
 * resources, hand it to another trainer / table in the same step.
 * The parent performs the API calls; this dialog only collects the target.
 */
export function BookingMoveDialog({
  booking,
  resources,
  resourceLabel,
  saving,
  onClose,
  onSubmit,
}: {
  booking: BookingRow | null;
  resources: Resource[];
  resourceLabel: string;
  saving: boolean;
  onClose: () => void;
  onSubmit: (draft: MoveDraft) => void;
}) {
  const { t } = useTranslation('bookings');
  const [draft, setDraft] = useState<MoveDraft>({ date: '', time: '', resourceId: '' });

  useEffect(() => {
    if (!booking) return;
    setDraft({ date: booking.booking_date, time: hhmm(booking.start_time), resourceId: booking.resource_id ?? '' });
  }, [booking]);

  const candidates = useMemo(
    () =>
      resources
        // Keep the current one even if deactivated so the select never renders blank.
        .filter((r) => r.active !== false || r.id === booking?.resource_id)
        .filter((r) => !r.branch_id || r.branch_id === booking?.branch_id)
        // Keep the current one even if it no longer serves this service.
        .filter((r) => r.id === booking?.resource_id || resourceServesService(r, booking?.service_id)),
    [resources, booking],
  );

  if (!booking) return null;

  const originalTime = hhmm(booking.start_time);
  const slotChanged = draft.date !== booking.booking_date || draft.time !== originalTime;
  const resourceChanged = draft.resourceId !== (booking.resource_id ?? '');
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(draft.date) && /^\d{2}:\d{2}$/.test(draft.time);
  const canSubmit = valid && (slotChanged || resourceChanged) && !saving;
  const today = getTodayISOInBangkok();

  const targetResourceName = draft.resourceId ? resources.find((r) => r.id === draft.resourceId)?.resource_name ?? '-' : t('unassigned', 'ยังไม่ระบุ');

  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 0.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <SwapHorizRoundedIcon color="secondary" />
          <Typography component="span" variant="h6" fontWeight={700}>
            {t('move_queue', 'โยกย้ายคิว')} {booking.queue_number}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
          <StatusChip status={booking.status} />
          <Typography variant="body2" color="text.secondary" noWrap>
            {customerName(booking)} · {booking.services?.service_name ?? '-'}
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1.5 }}>
          <Stack spacing={1}>
            <Typography variant="subtitle2">{t('move_slot', 'วันและเวลาใหม่')}</Typography>
            <Stack direction="row" spacing={1}>
              <TextField
                id="move-date"
                type="date"
                size="small"
                fullWidth
                label={t('date', 'วันที่')}
                value={draft.date}
                onChange={(e) => setDraft((p) => ({ ...p, date: e.target.value }))}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                id="move-time"
                type="time"
                size="small"
                fullWidth
                label={t('time', 'เวลา')}
                value={draft.time}
                onChange={(e) => setDraft((p) => ({ ...p, time: e.target.value }))}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              {TIME_SHIFTS.map((m) => (
                <Chip
                  key={m}
                  size="small"
                  variant="outlined"
                  label={`${m > 0 ? '+' : ''}${m} ${t('minutes_short', 'นาที')}`}
                  onClick={() => setDraft((p) => ({ ...p, time: shiftTime(p.time, m) }))}
                />
              ))}
              <Chip size="small" variant="outlined" label={t('range_today', 'วันนี้')} onClick={() => setDraft((p) => ({ ...p, date: today }))} />
              <Chip size="small" variant="outlined" label={t('range_tomorrow', 'พรุ่งนี้')} onClick={() => setDraft((p) => ({ ...p, date: addDays(today, 1) }))} />
              <Chip size="small" variant="outlined" label={t('next_day', '+1 วัน')} onClick={() => setDraft((p) => ({ ...p, date: addDays(p.date || today, 1) }))} />
            </Stack>
          </Stack>

          {candidates.length > 0 ? (
            <Stack spacing={1}>
              <Typography variant="subtitle2">{resourceLabel}</Typography>
              <TextField
                id="move-resource"
                select
                size="small"
                fullWidth
                value={draft.resourceId}
                onChange={(e) => setDraft((p) => ({ ...p, resourceId: e.target.value }))}
                slotProps={{ select: { displayEmpty: true } }}
              >
                <MenuItem value="">{`${t('filter_unassigned', 'ยังไม่ระบุ')}${resourceLabel}`}</MenuItem>
                {candidates.map((r) => (
                  <MenuItem key={r.id} value={r.id}>
                    {r.resource_code ? `${r.resource_code} · ` : ''}{r.resource_name}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          ) : null}

          <Alert severity={slotChanged || resourceChanged ? 'info' : 'warning'} icon={false} sx={{ py: 0.5 }}>
            <Typography variant="body2">
              <Typography component="span" variant="body2" color="text.secondary">{t('move_from', 'จาก')} </Typography>
              {formatDateDMY(booking.booking_date)} {originalTime}
              {booking.resource_name ? ` · ${booking.resource_name}` : ''}
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              <Typography component="span" variant="body2" color="text.secondary" fontWeight={400}>{t('move_to', 'ไปยัง')} </Typography>
              {valid ? `${formatDateDMY(draft.date)} ${draft.time}` : '-'}
              {candidates.length > 0 ? ` · ${targetResourceName}` : ''}
            </Typography>
            {!slotChanged && !resourceChanged ? (
              <Typography variant="caption" color="text.secondary">{t('move_no_change', 'ยังไม่ได้เปลี่ยนแปลงอะไร')}</Typography>
            ) : null}
          </Alert>

          <Stack direction="row" spacing={1} alignItems="flex-start">
            {booking.line_user_id ? <NotificationsActiveRoundedIcon fontSize="small" color="success" /> : <NotificationsOffRoundedIcon fontSize="small" color="disabled" />}
            <Typography variant="caption" color="text.secondary">
              {booking.line_user_id
                ? t('move_line_hint', 'ลูกค้าจะได้รับแจ้งทาง LINE พร้อมปุ่ม "รับทราบ" — คิวยังคงยืนยันอยู่ ไม่ต้องรอลูกค้าตอบ')
                : t('move_no_line_hint', 'คิวนี้ไม่ได้ผูก LINE — กรุณาแจ้งลูกค้าด้วยตัวเอง')}
            </Typography>
          </Stack>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving} color="inherit">{t('cancel', 'ยกเลิก')}</Button>
        <Button variant="contained" disabled={!canSubmit} onClick={() => onSubmit(draft)} startIcon={<SwapHorizRoundedIcon />}>
          {saving ? t('moving', 'กำลังย้าย…') : t('move_confirm', 'ย้ายคิว')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
