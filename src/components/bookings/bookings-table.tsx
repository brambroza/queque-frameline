'use client';

import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import EventRoundedIcon from '@mui/icons-material/EventRounded';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import MeetingRoomRoundedIcon from '@mui/icons-material/MeetingRoomRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import { MobileCardList } from '@/components/ui/responsive-table';
import { MobileRecordCard } from '@/components/ui/mobile-record-card';
import { useConfirm } from '@/components/ui/confirm-dialog';
import MarkChatUnreadRoundedIcon from '@mui/icons-material/MarkChatUnreadRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import HourglassBottomRoundedIcon from '@mui/icons-material/HourglassBottomRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded';
import PersonOffRoundedIcon from '@mui/icons-material/PersonOffRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import ThumbUpAltRoundedIcon from '@mui/icons-material/ThumbUpAltRounded';
import HowToRegRoundedIcon from '@mui/icons-material/HowToRegRounded';
import { StatusChip } from '@/components/shared/status-chip';
import { ActionIconGroup } from '@/components/ui/action-icon-group';
import { EmptyState } from '@/components/ui/empty-state';
import { TablePaginationControls } from '@/components/ui/table-pagination-controls';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { formatDateDMY } from '@/lib/utils/date-format';
import {
  CANCELLABLE,
  MOVABLE,
  NEXT_STATUSES,
  changeAckState,
  customerName,
  customerPhone,
  hhmm,
  type BookingRow,
  type ChangeAckState,
  type NextStatusKind,
} from './booking-types';

const NEXT_ICON: Record<NextStatusKind, React.ReactNode> = {
  approve: <ThumbUpAltRoundedIcon fontSize="small" />,
  confirm: <CheckRoundedIcon fontSize="small" />,
  wait: <HourglassBottomRoundedIcon fontSize="small" />,
  call: <CampaignRoundedIcon fontSize="small" />,
  recall: <NotificationsActiveRoundedIcon fontSize="small" />,
  serve: <PlayArrowRoundedIcon fontSize="small" />,
  done: <DoneAllRoundedIcon fontSize="small" />,
  no_show: <PersonOffRoundedIcon fontSize="small" />,
};

const NEXT_COLOR: Record<NextStatusKind, 'primary' | 'warning' | 'info' | 'success' | 'default'> = {
  approve: 'primary',
  confirm: 'primary',
  wait: 'warning',
  call: 'info',
  recall: 'warning',
  serve: 'info',
  done: 'success',
  no_show: 'default',
};

/** `HH:MM` in Bangkok time from an ISO timestamp, for the check-in / called chips. */
function hhmmFromIso(iso: string): string {
  return new Date(iso).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });
}

/**
 * Tiny chip under the status: when the customer checked in (LIFF), or how many
 * times the shop has called this queue. Renders nothing when neither applies.
 */
export function ArrivalChip({ booking }: { booking: Pick<BookingRow, 'status' | 'checked_in_at' | 'called_at' | 'call_count'> }) {
  const { t } = useTranslation('bookings');
  const chipSx = { height: 20, '& .MuiChip-label': { px: 0.75, fontSize: 11 } };
  if (booking.status === 'called' && booking.called_at) {
    const n = Number(booking.call_count ?? 1);
    return (
      <Chip
        size="small"
        variant="outlined"
        color={n > 1 ? 'warning' : 'info'}
        icon={<CampaignRoundedIcon />}
        label={`${t('called_at', 'เรียกเมื่อ')} ${hhmmFromIso(booking.called_at)}${n > 1 ? ` · ${t('call_count', 'ครั้งที่')} ${n}` : ''}`}
        sx={chipSx}
      />
    );
  }
  if (booking.checked_in_at && (booking.status === 'checked_in' || booking.status === 'waiting')) {
    return (
      <Chip
        size="small"
        variant="outlined"
        color="secondary"
        icon={<HowToRegRoundedIcon />}
        label={`${t('arrived_at', 'มาถึงเมื่อ')} ${hhmmFromIso(booking.checked_in_at)}`}
        sx={chipSx}
      />
    );
  }
  return null;
}

/**
 * Tiny chip under the status showing whether the customer acknowledged the
 * last shop-initiated change. Renders nothing when there is nothing to acknowledge.
 */
export function AckChip({ state }: { state: ChangeAckState }) {
  const { t } = useTranslation('bookings');
  if (state === 'none') return null;
  return state === 'pending' ? (
    <Chip size="small" variant="outlined" color="warning" icon={<MarkChatUnreadRoundedIcon />} label={t('ack_pending', 'รอลูกค้ารับทราบ')} sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: 11 } }} />
  ) : (
    <Chip size="small" variant="outlined" color="success" icon={<TaskAltRoundedIcon />} label={t('ack_done', 'ลูกค้ารับทราบแล้ว')} sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: 11 } }} />
  );
}

/**
 * Phone-only booking card (same look as the services / resources cards):
 * queue-number badge, customer, status + payment chips, date / time / resource
 * tiles, then a footer with the primary transition, edit, and an overflow menu
 * for move / secondary transitions / cancel.
 */
function BookingMobileCard({
  booking: b,
  busy,
  resourceLabel,
  onStatus,
  onMove,
  onEdit,
}: {
  booking: BookingRow;
  busy: boolean;
  resourceLabel: string;
  onStatus: (b: BookingRow, status: string) => void;
  onMove: (b: BookingRow) => void;
  onEdit: (b: BookingRow) => void;
}) {
  const { t } = useTranslation('bookings');
  const confirm = useConfirm();
  const [menuEl, setMenuEl] = useState<HTMLElement | null>(null);

  const next = NEXT_STATUSES[b.status] ?? [];
  const primary = next.find((o) => o.primary);
  const secondary = next.filter((o) => !o.primary);
  const canMove = MOVABLE.has(b.status);
  const canCancel = CANCELLABLE.has(b.status);
  const hasMenu = canMove || secondary.length > 0 || canCancel;

  async function cancelBooking() {
    setMenuEl(null);
    const ok = await confirm({
      tone: 'warning',
      title: t('cancel_confirm_title', 'ยกเลิกคิวนี้?'),
      description: t('cancel_confirm_desc', 'ลูกค้าจะได้รับข้อความแจ้งยกเลิกทาง LINE ทันที และคิวนี้จะไม่นับในรายงาน'),
      context: {
        avatar: b.queue_number,
        avatarSquare: true,
        primary: [customerName(b), b.services?.service_name].filter(Boolean).join(' · '),
        secondary: [formatDateDMY(b.booking_date), hhmm(b.start_time), b.resource_name].filter(Boolean).join(' · '),
      },
      confirmLabel: t('cancel_yes_short', 'ยกเลิกคิว'),
      cancelLabel: t('cancel_no', 'ไม่ยกเลิก'),
    });
    if (ok) onStatus(b, 'cancelled');
  }

  const footerButtonSx = { minHeight: 44, borderRadius: 0, fontWeight: 600 } as const;
  const timeRange = b.end_time ? `${hhmm(b.start_time)}–${hhmm(b.end_time)}` : hhmm(b.start_time);
  /** Button colour for the primary transition; the chip palette's `default` maps to `inherit`. */
  const paletteColor = primary ? NEXT_COLOR[primary.kind] : 'default';
  const primaryColor = paletteColor === 'default' ? 'inherit' : paletteColor;

  return (
    <MobileRecordCard
      leading={
        <Box
          sx={{
            minWidth: 48,
            height: 48,
            px: 1,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            fontWeight: 800,
            fontSize: 16,
            letterSpacing: '-0.01em',
          }}
        >
          {b.queue_number}
        </Box>
      }
      title={customerName(b)}
      subtitle={[customerPhone(b), b.services?.service_name ?? '-', b.branches?.branch_name].filter(Boolean).join(' · ')}
      badge={<StatusChip status={b.status} />}
      tags={
        <>
          <AckChip state={changeAckState(b)} />
          <ArrivalChip booking={b} />
        </>
      }
      note={b.note ? `${t('note', 'หมายเหตุ')}: ${b.note}` : undefined}
      stats={[
        { icon: <EventRoundedIcon />, value: formatDateDMY(b.booking_date), label: t('col_date', 'วันที่') },
        { icon: <AccessTimeRoundedIcon />, value: timeRange, label: t('col_time', 'เวลา') },
        { icon: <MeetingRoomRoundedIcon />, value: b.resource_name ?? t('unassigned', 'ยังไม่ระบุ'), label: resourceLabel },
      ]}
      footer={
        <>
          {primary ? (
            <Button
              fullWidth
              color={primaryColor}
              startIcon={NEXT_ICON[primary.kind]}
              disabled={busy}
              onClick={() => onStatus(b, primary.status)}
              sx={footerButtonSx}
            >
              {primary.label}
            </Button>
          ) : null}
          {primary ? <Box sx={{ width: '1px', bgcolor: 'divider' }} /> : null}
          <Button fullWidth color="inherit" startIcon={<EditRoundedIcon />} disabled={busy} onClick={() => onEdit(b)} sx={footerButtonSx}>
            {t('edit_short', 'รายละเอียด')}
          </Button>
          {hasMenu ? (
            <>
              <Box sx={{ width: '1px', bgcolor: 'divider' }} />
              <IconButton
                aria-label={t('more_actions', 'เพิ่มเติม')}
                disabled={busy}
                onClick={(e) => setMenuEl(e.currentTarget)}
                sx={{ width: 52, minHeight: 44, borderRadius: 0, flexShrink: 0 }}
              >
                <MoreHorizRoundedIcon />
              </IconButton>
              <Menu anchorEl={menuEl} open={Boolean(menuEl)} onClose={() => setMenuEl(null)}>
                {canMove ? (
                  <MenuItem onClick={() => { setMenuEl(null); onMove(b); }}>
                    <ListItemIcon><SwapHorizRoundedIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>{t('move_queue', 'โยกย้ายคิว')}</ListItemText>
                  </MenuItem>
                ) : null}
                {secondary.map((o) => (
                  <MenuItem key={o.status} onClick={() => { setMenuEl(null); onStatus(b, o.status); }}>
                    <ListItemIcon>{NEXT_ICON[o.kind]}</ListItemIcon>
                    <ListItemText>{o.label}</ListItemText>
                  </MenuItem>
                ))}
                {canCancel ? (
                  <>
                    {canMove || secondary.length > 0 ? <Divider /> : null}
                    <MenuItem onClick={() => void cancelBooking()} sx={{ color: 'error.main' }}>
                      <ListItemIcon sx={{ color: 'inherit' }}><PersonOffRoundedIcon fontSize="small" /></ListItemIcon>
                      <ListItemText>{t('cancel_booking', 'ยกเลิกการจอง')}</ListItemText>
                    </MenuItem>
                  </>
                ) : null}
              </Menu>
            </>
          ) : null}
        </>
      }
    />
  );
}

/**
 * Bookings list. Row actions: primary next-status, move (date / time / resource),
 * edit, and secondary transitions in the overflow menu.
 */
export function BookingsTable({
  rows,
  total,
  page,
  pageSize,
  loading,
  busy,
  resourceLabel,
  onPageChange,
  onPageSizeChange,
  onStatus,
  onMove,
  onEdit,
  onCreate,
}: {
  rows: BookingRow[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  /** True while a row mutation is in flight; disables row actions. */
  busy: boolean;
  resourceLabel: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onStatus: (b: BookingRow, status: string) => void;
  onMove: (b: BookingRow) => void;
  onEdit: (b: BookingRow) => void;
  onCreate: () => void;
}) {
  const { t } = useTranslation('bookings');

  return (
    <Card>
      <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
        {/* Phones: card list (same style as /portal/services). sm+: the table below, unchanged. */}
        <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
          {loading && rows.length === 0 ? (
            <Stack spacing={1.5} sx={{ p: 1.5 }}>
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={`skc-${i}`} variant="rounded" height={196} sx={{ borderRadius: 3 }} />
              ))}
            </Stack>
          ) : rows.length === 0 ? (
            <EmptyState
              title={t('empty_title', 'ยังไม่มีคิวในช่วงที่เลือก')}
              description={t('empty_desc', 'ส่งลิงก์ LIFF ให้ลูกค้าจองเอง หรือเพิ่มคิวหน้าร้านด้วยตัวเอง')}
              actionLabel={t('add_queue', 'เพิ่มคิวใหม่')}
              onAction={onCreate}
              icon="🎫"
            />
          ) : (
            <MobileCardList
              rows={rows}
              rowKey={(b) => b.id}
              columns={[]}
              renderCard={(b) => (
                <BookingMobileCard booking={b} busy={busy} resourceLabel={resourceLabel} onStatus={onStatus} onMove={onMove} onEdit={onEdit} />
              )}
              sx={{ p: 1.5, bgcolor: 'action.hover', opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }}
            />
          )}
        </Box>
        <Box sx={{ display: { xs: 'none', sm: 'block' }, overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 760 }}>
            <TableHead>
              <TableRow>
                <TableCell>{t('col_queue', 'คิว')}</TableCell>
                <TableCell>{t('col_datetime', 'วันที่ · เวลา')}</TableCell>
                <TableCell>{t('col_customer', 'ลูกค้า')}</TableCell>
                <TableCell>{t('col_service', 'บริการ / สาขา')}</TableCell>
                <TableCell>{resourceLabel}</TableCell>
                <TableCell>{t('col_status', 'สถานะ')}</TableCell>
                <TableCell align="right">{t('col_actions', 'จัดการ')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && rows.length === 0 ? (
                Array.from({ length: 6 }, (_, i) => (
                  <TableRow key={`sk-${i}`}>
                    {Array.from({ length: 8 }, (__, j) => (
                      <TableCell key={j}><Skeleton width={j === 7 ? 96 : '80%'} /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} sx={{ borderBottom: 0 }}>
                    <EmptyState
                      title={t('empty_title', 'ยังไม่มีคิวในช่วงที่เลือก')}
                      description={t('empty_desc', 'ส่งลิงก์ LIFF ให้ลูกค้าจองเอง หรือเพิ่มคิวหน้าร้านด้วยตัวเอง')}
                      actionLabel={t('add_queue', 'เพิ่มคิวใหม่')}
                      onAction={onCreate}
                      icon="🎫"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((b) => {
                  const next = NEXT_STATUSES[b.status] ?? [];
                  const primary = next.find((o) => o.primary);
                  const secondary = next.filter((o) => !o.primary);
                  return (
                    <TableRow key={b.id} hover sx={{ opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700}>{b.queue_number}</Typography>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography component="span" variant="body2" fontWeight={600}>{formatDateDMY(b.booking_date)}</Typography>{' '}
                        <Typography component="span" variant="body2" color="text.secondary">{hhmm(b.start_time)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{customerName(b)}</Typography>
                        {customerPhone(b) ? <Typography variant="caption" color="text.secondary">{customerPhone(b)}</Typography> : null}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{b.services?.service_name ?? '-'}</Typography>
                        {b.branches?.branch_name ? <Typography variant="caption" color="text.secondary">{b.branches.branch_name}</Typography> : null}
                      </TableCell>
                      <TableCell>
                        {b.resource_name ? (
                          <Typography variant="body2">{b.resource_name}</Typography>
                        ) : (
                          <Typography variant="caption" color="text.disabled">{t('unassigned', 'ยังไม่ระบุ')}</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.5} alignItems="flex-start">
                          <StatusChip status={b.status} />
                          <AckChip state={changeAckState(b)} />
                          <ArrivalChip booking={b} />
                        </Stack>
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        <ActionIconGroup
                          actions={[
                            {
                              key: 'primary',
                              hidden: !primary,
                              icon: primary ? NEXT_ICON[primary.kind] : null,
                              fallbackLabel: primary?.label ?? '',
                              color: primary ? NEXT_COLOR[primary.kind] : 'default',
                              disabled: busy,
                              onClick: () => { if (primary) onStatus(b, primary.status); },
                            },
                            {
                              key: 'move',
                              hidden: !MOVABLE.has(b.status),
                              icon: <SwapHorizRoundedIcon fontSize="small" />,
                              fallbackLabel: t('move_queue', 'โยกย้ายคิว'),
                              color: 'secondary',
                              disabled: busy,
                              onClick: () => onMove(b),
                            },
                            {
                              key: 'edit',
                              icon: <EditRoundedIcon fontSize="small" />,
                              fallbackLabel: t('edit', 'รายละเอียด / แก้ไข'),
                              disabled: busy,
                              onClick: () => onEdit(b),
                            },
                            ...secondary.map((o) => ({
                              key: o.status,
                              icon: NEXT_ICON[o.kind],
                              fallbackLabel: o.label,
                              disabled: busy,
                              onClick: () => onStatus(b, o.status),
                            })),
                            {
                              key: 'cancel',
                              hidden: !CANCELLABLE.has(b.status),
                              icon: <PersonOffRoundedIcon fontSize="small" />,
                              fallbackLabel: t('cancel_booking', 'ยกเลิกการจอง'),
                              color: 'error',
                              disabled: busy,
                              confirm: {
                                tone: 'warning',
                                title: t('cancel_confirm_title', 'ยกเลิกคิวนี้?'),
                                description: t('cancel_confirm_desc', 'ลูกค้าจะได้รับข้อความแจ้งยกเลิกทาง LINE ทันที และคิวนี้จะไม่นับในรายงาน'),
                                context: {
                                  avatar: b.queue_number,
                                  avatarSquare: true,
                                  primary: [customerName(b), b.services?.service_name].filter(Boolean).join(' · '),
                                  secondary: [formatDateDMY(b.booking_date), hhmm(b.start_time), b.resource_name].filter(Boolean).join(' · '),
                                },
                                confirmLabel: t('cancel_yes_short', 'ยกเลิกคิว'),
                                cancelLabel: t('cancel_no', 'ไม่ยกเลิก'),
                              },
                              onClick: () => onStatus(b, 'cancelled'),
                            },
                          ]}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Box>
        {total > 0 ? (
          <TablePaginationControls
            page={page}
            rowsPerPage={pageSize}
            total={total}
            rowsPerPageOptions={[20, 50, 100]}
            onPageChange={onPageChange}
            onRowsPerPageChange={onPageSizeChange}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
