'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, IconButton, Popover, Tooltip } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import type { NotificationItem as TNotificationItem } from '@/types/notification';
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';

export function NotificationBell() {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<TNotificationItem[]>([]);

  const open = Boolean(anchorEl);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/notifications?limit=10', { cache: 'no-store' });
      const raw = await res.text();
      let json: unknown = null;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch {
        json = null;
      }

      if (res.ok) {
        const payload = json as { data?: TNotificationItem[] } | null;
        setItems(payload?.data ?? []);
        return;
      }

      const payload = (json ?? {}) as { error?: string; message?: string };
      const reason = payload.error || payload.message || `HTTP ${res.status}`;
      console.error('[notifications_load_failed]', { status: res.status, reason });
    } catch (e) {
      console.error('[notifications_load_failed]', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => { void load(); }, 15000);
    return () => clearInterval(t);
  }, [load]);

  const unread = useMemo(() => items.filter((x) => !x.is_read && !x.read_at).length, [items]);

  async function markRead(id: string) {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read', id }),
      });
      await load();
    } catch (e) {
      console.error('[notification_mark_read_failed]', e);
    }
  }

  async function archive(id: string) {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive', id }),
      });
      await load();
    } catch (e) {
      console.error('[notification_archive_failed]', e);
    }
  }

  async function markAllRead() {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' }),
      });
      await load();
    } catch (e) {
      console.error('[notification_mark_all_failed]', e);
    }
  }

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton aria-label="notifications" onClick={(e) => setAnchorEl(e.currentTarget)}>
          <Badge color="error" badgeContent={unread > 99 ? '99+' : unread}>
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <NotificationDropdown
          loading={loading}
          items={items}
          onMarkRead={(id) => void markRead(id)}
          onArchive={(id) => void archive(id)}
          onMarkAllRead={() => void markAllRead()}
        />
      </Popover>
    </>
  );
}
