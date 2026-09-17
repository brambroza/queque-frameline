'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Box, Button, Stack, Typography } from '@mui/material';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import CancelIcon from '@mui/icons-material/Cancel';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import StarIcon from '@mui/icons-material/Star';
import PaymentsIcon from '@mui/icons-material/Payments';
import InfoIcon from '@mui/icons-material/Info';
import type { NotificationItem as TNotificationItem } from '@/types/notification';
import { NotificationPriorityBadge } from '@/components/notifications/NotificationPriorityBadge';
import { NotificationCategoryChip } from '@/components/notifications/NotificationCategoryChip';

function pickIcon(type: string) {
  if (type.includes('booking') || type.includes('queue')) return <EventAvailableIcon fontSize="small" />;
  if (type.includes('cancel') || type.includes('no_show')) return <CancelIcon fontSize="small" />;
  if (type.includes('warning') || type.includes('conflict')) return <WarningAmberIcon fontSize="small" />;
  if (type.includes('vip')) return <StarIcon fontSize="small" />;
  if (type.includes('payment') || type.includes('quota')) return <PaymentsIcon fontSize="small" />;
  return <InfoIcon fontSize="small" />;
}

function relativeTime(iso: string) {
  const d = new Date(iso).getTime();
  const sec = Math.max(0, Math.floor((Date.now() - d) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const day = Math.floor(h / 24);
  return `${day}d ago`;
}

export function NotificationItem({
  item,
  onMarkRead,
  onArchive,
}: {
  item: TNotificationItem;
  onMarkRead?: (id: string) => void;
  onArchive?: (id: string) => void;
}) {
  const [timeLabel, setTimeLabel] = useState('');

  useEffect(() => {
    setTimeLabel(relativeTime(item.created_at));
    const t = window.setInterval(() => setTimeLabel(relativeTime(item.created_at)), 30000);
    return () => window.clearInterval(t);
  }, [item.created_at]);

  return (
    <Box
      sx={{
        p: 1.2,
        borderRadius: 2,
        border: '1px solid',
        borderColor: item.is_read ? 'divider' : 'primary.light',
        bgcolor: item.is_read ? 'background.paper' : 'rgba(115,192,136,0.08)',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <Box sx={{ mt: 0.2, color: 'text.secondary' }}>{pickIcon(item.type)}</Box>
        <Box sx={{ flex: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
            <Typography fontWeight={700} sx={{ lineHeight: 1.2 }}>{item.title}</Typography>
            <Typography variant="caption" color="text.secondary">{timeLabel}</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>{item.message || item.body || ''}</Typography>
          <Stack direction="row" spacing={0.8} sx={{ mt: 0.8, flexWrap: 'wrap' }}>
            <NotificationPriorityBadge priority={item.priority} />
            <NotificationCategoryChip category={item.category} />
          </Stack>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            {!item.is_read ? (
              <Button size="small" variant="text" onClick={() => onMarkRead?.(item.id)}>Mark Read</Button>
            ) : null}
            {!item.is_archived ? (
              <Button size="small" variant="text" color="inherit" onClick={() => onArchive?.(item.id)}>Archive</Button>
            ) : null}
            {item.action_url ? (
              <Button size="small" component={Link} href={item.action_url}>Open</Button>
            ) : null}
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}
