'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, FormControl, Grid, InputLabel, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import AddAlertRoundedIcon from '@mui/icons-material/AddAlertRounded';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import type { NotificationCategory, NotificationItem as TNotificationItem, NotificationPriority } from '@/types/notification';
import { useToast } from '@/components/ui/toast';

const CATEGORIES: NotificationCategory[] = ['bookings', 'operations', 'customers', 'billing', 'system', 'marketing'];
const PRIORITIES: NotificationPriority[] = ['low', 'medium', 'high', 'critical'];

export default function NotificationsPage() {
  const { push } = useToast();
  const [rows, setRows] = useState<TNotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<NotificationCategory | ''>('');
  const [priority, setPriority] = useState<NotificationPriority | ''>('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const canLoadMore = useMemo(() => offset + rows.length < total, [offset, rows.length, total]);

  const load = useCallback(async (reset = true) => {
    setLoading(true);
    const useOffset = reset ? 0 : offset + limit;
    const params = new URLSearchParams({ limit: String(limit), offset: String(useOffset) });
    if (q.trim()) params.set('q', q.trim());
    if (category) params.set('category', category);
    if (priority) params.set('priority', priority);
    if (unreadOnly) params.set('unread_only', 'true');
    const res = await fetch(`/api/notifications?${params.toString()}`, { cache: 'no-store' });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) return push(json.error ?? 'โหลด notifications ไม่สำเร็จ', 'error');
    setTotal(json.pagination?.total ?? 0);
    if (reset) {
      setOffset(0);
      setRows(json.data ?? []);
      return;
    }
    setOffset(useOffset);
    setRows((prev) => [...prev, ...(json.data ?? [])]);
  }, [q, category, priority, unreadOnly, offset, push]);

  useEffect(() => {
    void load(true);
  }, [load]);

  async function markRead(id: string) {
    const res = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_read', id }),
    });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'mark read ไม่สำเร็จ', 'error');
    await load(true);
  }

  async function archive(id: string) {
    const res = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'archive', id }),
    });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'archive ไม่สำเร็จ', 'error');
    await load(true);
  }

  async function markAllRead() {
    const res = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_all_read' }),
    });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'mark all read ไม่สำเร็จ', 'error');
    push('อ่านทั้งหมดแล้ว');
    await load(true);
  }

  async function createDevNotification() {
    const res = await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dev_test: true,
        type: 'system_info',
        category: 'system',
        priority: 'medium',
        title: 'ทดสอบแจ้งเตือน',
        message: 'ระบบ Notification พร้อมใช้งาน',
      }),
    });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'สร้างแจ้งเตือนไม่สำเร็จ', 'error');
    push('สร้างแจ้งเตือนทดสอบแล้ว');
    await load(true);
  }

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
            <Box>
              <Typography variant="h6" fontWeight={800}>Notification Center</Typography>
              <Typography variant="body2" color="text.secondary">ติดตามการแจ้งเตือนทั้งหมดของร้าน</Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" onClick={() => void markAllRead()}>Mark all read</Button>
              {process.env.NODE_ENV === 'development' ? (
                <Button variant="contained" startIcon={<AddAlertRoundedIcon />} onClick={() => void createDevNotification()}>
                  สร้างแจ้งเตือนทดสอบ
                </Button>
              ) : null}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Grid container spacing={1.2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField size="small" fullWidth label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <FormControl size="small" fullWidth>
                <InputLabel>Category</InputLabel>
                <Select value={category} label="Category" onChange={(e) => setCategory(e.target.value as NotificationCategory | '')}>
                  <MenuItem value="">All</MenuItem>
                  {CATEGORIES.map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <FormControl size="small" fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select value={priority} label="Priority" onChange={(e) => setPriority(e.target.value as NotificationPriority | '')}>
                  <MenuItem value="">All</MenuItem>
                  {PRIORITIES.map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <Button fullWidth variant={unreadOnly ? 'contained' : 'outlined'} onClick={() => setUnreadOnly((v) => !v)}>
                {unreadOnly ? 'Unread Only' : 'All'}
              </Button>
            </Grid>
          </Grid>
          <Stack direction="row" spacing={1} sx={{ mt: 1.2 }}>
            <Button variant="outlined" onClick={() => void load(true)}>Apply</Button>
            <Button variant="text" onClick={() => {
              setQ('');
              setCategory('');
              setPriority('');
              setUnreadOnly(false);
              void load(true);
            }}>Reset</Button>
          </Stack>
        </CardContent>
      </Card>

      {rows.length === 0 && !loading ? <Alert severity="info">No notifications</Alert> : null}

      <Stack spacing={1}>
        {rows.map((item) => (
          <NotificationItem key={item.id} item={item} onMarkRead={(id) => void markRead(id)} onArchive={(id) => void archive(id)} />
        ))}
      </Stack>

      {canLoadMore ? (
        <Stack alignItems="center">
          <Button disabled={loading} variant="outlined" onClick={() => void load(false)}>{loading ? 'Loading...' : 'Load more'}</Button>
        </Stack>
      ) : null}
    </Stack>
  );
}
