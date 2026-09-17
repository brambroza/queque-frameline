'use client';

import Link from 'next/link';
import { Box, Button, CircularProgress, Divider, List, ListItem, Stack, Typography } from '@mui/material';
import type { NotificationItem as TNotificationItem } from '@/types/notification';
import { NotificationItem } from '@/components/notifications/NotificationItem';

export function NotificationDropdown({
  loading,
  items,
  onMarkRead,
  onArchive,
  onMarkAllRead,
}: {
  loading: boolean;
  items: TNotificationItem[];
  onMarkRead: (id: string) => void;
  onArchive: (id: string) => void;
  onMarkAllRead: () => void;
}) {
  return (
    <Box sx={{ width: 420, maxWidth: 'calc(100vw - 24px)' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 1.5, py: 1 }}>
        <Typography fontWeight={800}>Notifications</Typography>
        <Button size="small" onClick={onMarkAllRead}>Mark all read</Button>
      </Stack>
      <Divider />
      <Box sx={{ maxHeight: 440, overflowY: 'auto', p: 1 }}>
        {loading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 5 }}><CircularProgress size={24} /></Stack>
        ) : items.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No notifications</Typography>
        ) : (
          <List disablePadding sx={{ display: 'grid', gap: 1 }}>
            {items.map((item) => (
              <ListItem key={item.id} disablePadding>
                <NotificationItem item={item} onMarkRead={onMarkRead} onArchive={onArchive} />
              </ListItem>
            ))}
          </List>
        )}
      </Box>
      <Divider />
      <Stack direction="row" justifyContent="flex-end" sx={{ p: 1 }}>
        <Button size="small" component={Link} href="/portal/notifications">View all</Button>
      </Stack>
    </Box>
  );
}
