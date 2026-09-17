'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Drawer,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TablePagination,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { BookingModeChip } from '@/components/shared/booking-mode-chip';
import { ActionIconGroup } from '@/components/ui/action-icon-group';
import { EmptyState } from '@/components/ui/empty-state';
import { ResponsiveTable } from '@/components/ui/responsive-table';
import { MobileRecordCard } from '@/components/ui/mobile-record-card';

type Service = Record<string, unknown>;
type Template = {
  id: string;
  business_category: string;
  service_name: string;
  booking_mode: 'fixed_slot' | 'flexible_duration' | 'capacity_based' | 'walk_in' | 'request_approval';
  duration_minutes: number | null;
  min_duration_minutes: number | null;
  max_duration_minutes: number | null;
  capacity_per_slot: number | null;
  requires_approval: boolean;
  allow_walk_in: boolean;
};
type Preset = {
  key: string;
  title: string;
  subtitle: string;
  category: string;
  mode: Template['booking_mode'];
  accent: string;
  soft: string;
  text: string;
  defaults: { duration?: string; minDuration?: string; maxDuration?: string; capacity?: string };
};

const BOOKING_MODES = ['fixed_slot', 'flexible_duration', 'capacity_based', 'walk_in', 'request_approval'] as const;
const BOOKING_MODE_LABELS: Record<(typeof BOOKING_MODES)[number], string> = {
  fixed_slot: 'จองตามเวลาที่แน่นอน',
  flexible_duration: 'เวลายืดหยุ่น',
  capacity_based: 'รับจำนวนต่อรอบ',
  walk_in: 'Walk-in',
  request_approval: 'ต้องยืนยันก่อน',
};

/** Human-readable duration for a service row ("30 นาที", "90 - 180 นาที", "-"). */
function durationLabel(r: Service): string {
  if (r.booking_mode === 'flexible_duration') {
    return `${String(r.min_duration_minutes ?? '-')} - ${String(r.max_duration_minutes ?? '-')} นาที`;
  }
  return r.duration_minutes ? `${String(r.duration_minutes)} นาที` : '-';
}

/** Phone-only card for one service (the desktop table is unchanged). */
function ServiceMobileCard({ service, onEdit, onDelete }: { service: Service; onEdit: () => void; onDelete: () => void }) {
  return (
    <MobileRecordCard
      title={String(service.service_name)}
      status={{ active: Boolean(service.active) }}
      tags={<BookingModeChip mode={String(service.booking_mode ?? 'fixed_slot')} />}
      stats={[
        { icon: <AccessTimeRoundedIcon />, value: durationLabel(service), label: 'เวลา' },
        { icon: <GroupsRoundedIcon />, value: String(service.capacity_per_slot ?? 1), label: 'ต่อรอบ' },
        { icon: <PaymentsRoundedIcon />, value: `฿${Number(service.price ?? 0).toLocaleString('th-TH')}`, label: 'ราคา' },
      ]}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  );
}

export function ServicesCrud() {
  const { push } = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState<Service[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [serviceName, setServiceName] = useState('');
  const [bookingMode, setBookingMode] = useState<Template['booking_mode']>('fixed_slot');
  const [duration, setDuration] = useState('30');
  const [minDuration, setMinDuration] = useState('90');
  const [maxDuration, setMaxDuration] = useState('180');
  const [capacity, setCapacity] = useState('1');
  const [price, setPrice] = useState('0');
  const [active, setActive] = useState(true);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [allowWalkIn, setAllowWalkIn] = useState(false);
  /** Shop-wide display flag, not part of the per-service form. Default on. */
  const [showDuration, setShowDuration] = useState(true);
  const [savingDisplay, setSavingDisplay] = useState(false);
  const [category, setCategory] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [presetKey, setPresetKey] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const BUSINESS_PRESETS: Preset[] = [
    {
      key: 'restaurant',
      title: 'ร้านอาหาร',
      subtitle: 'จองโต๊ะ / Walk-in',
      category: 'restaurant',
      mode: 'capacity_based',
      accent: '#4FA56A',
      soft: '#EAF7EF',
      text: '#2B6A3F',
      defaults: { duration: '90', capacity: '10' },
    },
    {
      key: 'buffet',
      title: 'ร้านบุฟเฟ่ต์',
      subtitle: 'จองรอบบุฟเฟ่ต์',
      category: 'buffet',
      mode: 'capacity_based',
      accent: '#4FA56A',
      soft: '#EAF7EF',
      text: '#2B6A3F',
      defaults: { duration: '120', capacity: '50' },
    },
    {
      key: 'meeting_room',
      title: 'ห้องประชุม',
      subtitle: 'รายชั่วโมง / ครึ่งวัน / เต็มวัน',
      category: 'meeting_room',
      mode: 'fixed_slot',
      accent: '#1C7D8D',
      soft: '#E8F6F9',
      text: '#145B67',
      defaults: { duration: '60', capacity: '1' },
    },
    {
      key: 'clinic',
      title: 'คลินิก',
      subtitle: 'ตรวจทั่วไป / แพทย์เฉพาะทาง',
      category: 'คลินิก',
      mode: 'fixed_slot',
      accent: '#5E86D3',
      soft: '#EAF0FD',
      text: '#345695',
      defaults: { duration: '15', capacity: '1' },
    },
    {
      key: 'fitness',
      title: 'ฟิตเนส',
      subtitle: 'คลาสกลุ่ม / เทรนเนอร์ส่วนตัว',
      category: 'fitness',
      mode: 'capacity_based',
      accent: '#E07B39',
      soft: '#FDF0E6',
      text: '#9C4F1B',
      defaults: { duration: '60', capacity: '20' },
    },
  ];

  const CATEGORY_LABELS: Record<string, string> = {
    restaurant: 'ร้านอาหาร',
    buffet: 'ร้านบุฟเฟ่ต์',
    meeting_room: 'ห้องประชุม',
    fitness: 'ฟิตเนส',
    consult: 'ที่ปรึกษา',
  };

  function categoryLabel(input: string) {
    return CATEGORY_LABELS[input] ?? input;
  }

  const categories = useMemo(() => Array.from(new Set(templates.map((t) => t.business_category))).sort(), [templates]);
  const filteredTemplates = useMemo(() => (category ? templates.filter((t) => t.business_category === category) : templates), [templates, category]);
  const pagedRows = useMemo(() => rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage), [rows, page, rowsPerPage]);

  async function load() {
    const [resServices, resTemplates, resDisplay] = await Promise.all([
      fetch('/api/services', { cache: 'no-store' }),
      fetch('/api/service-templates', { cache: 'no-store' }),
      fetch('/api/shop-display-settings', { cache: 'no-store' }),
    ]);
    const [s, t, d] = await Promise.all([resServices.json(), resTemplates.json(), resDisplay.json()]);
    // The display flag is secondary — a failure here must not hide the services.
    if (resDisplay.ok) setShowDuration(d.data?.show_service_duration !== false);
    if (!resServices.ok) return push(s.error ?? 'โหลด services ไม่สำเร็จ', 'error');
    if (!resTemplates.ok) return push(t.error ?? 'โหลด templates ไม่สำเร็จ', 'error');
    setRows(s.data ?? []);
    setTemplates(t.data ?? []);
  }

  /**
   * Save the shop-wide duration display flag straight away — there is no form
   * to submit, so the switch itself is the commit. Revert on failure so the UI
   * never shows a setting the server did not accept.
   */
  async function onToggleShowDuration(next: boolean) {
    setShowDuration(next);
    setSavingDisplay(true);
    const res = await fetch('/api/shop-display-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ show_service_duration: next }),
    });
    const json = await res.json();
    setSavingDisplay(false);
    if (!res.ok) {
      setShowDuration(!next);
      return push(json.error ?? 'บันทึกการตั้งค่าไม่สำเร็จ', 'error');
    }
    push('บันทึกการตั้งค่าแล้ว');
  }

  useEffect(() => { void load(); }, []);

  function resetForm() {
    setEditingId(null);
    setPresetKey('');
    setSelectedTemplateId('');
    setServiceName('');
    setBookingMode('fixed_slot');
    setDuration('30');
    setMinDuration('90');
    setMaxDuration('180');
    setCapacity('1');
    setPrice('0');
    setActive(true);
    setRequiresApproval(false);
    setAllowWalkIn(false);
  }

  function openCreate() {
    resetForm();
    setDrawerOpen(true);
  }

  function openEdit(row: Service) {
    setEditingId(String(row.id));
    setPresetKey('');
    setSelectedTemplateId('');
    setServiceName(String(row.service_name ?? ''));
    setBookingMode(String(row.booking_mode ?? 'fixed_slot') as Template['booking_mode']);
    setDuration(String(row.duration_minutes ?? 30));
    setMinDuration(String(row.min_duration_minutes ?? 90));
    setMaxDuration(String(row.max_duration_minutes ?? 180));
    setCapacity(String(row.capacity_per_slot ?? 1));
    setPrice(String(row.price ?? 0));
    setActive(Boolean(row.active));
    setRequiresApproval(Boolean(row.requires_approval));
    setAllowWalkIn(Boolean(row.allow_walk_in));
    setDrawerOpen(true);
  }

  function applyTemplate(t: Template) {
    setSelectedTemplateId(t.id);
    setServiceName(t.service_name);
    setBookingMode(t.booking_mode);
    setDuration(String(t.duration_minutes ?? 30));
    setMinDuration(String(t.min_duration_minutes ?? 60));
    setMaxDuration(String(t.max_duration_minutes ?? 120));
    setCapacity(String(t.capacity_per_slot ?? 1));
    setRequiresApproval(Boolean(t.requires_approval));
    setAllowWalkIn(Boolean(t.allow_walk_in));
    setCategory(t.business_category);
  }

  function applyPreset(preset: Preset) {
    setPresetKey(preset.key);
    setCategory(preset.category);
    setBookingMode(preset.mode);
    if (preset.defaults.duration) setDuration(preset.defaults.duration);
    if (preset.defaults.minDuration) setMinDuration(preset.defaults.minDuration);
    if (preset.defaults.maxDuration) setMaxDuration(preset.defaults.maxDuration);
    if (preset.defaults.capacity) setCapacity(preset.defaults.capacity);
    setSelectedTemplateId('');
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      id: editingId ?? undefined,
      service_name: serviceName,
      booking_mode: bookingMode,
      duration_minutes: bookingMode === 'fixed_slot' ? Number(duration) : null,
      min_duration_minutes: bookingMode === 'flexible_duration' ? Number(minDuration) : null,
      max_duration_minutes: bookingMode === 'flexible_duration' ? Number(maxDuration) : null,
      capacity_per_slot: Number(capacity) || 1,
      price: Number(price) || 0,
      requires_approval: bookingMode === 'request_approval' ? true : requiresApproval,
      allow_walk_in: bookingMode === 'walk_in' ? true : allowWalkIn,
      active,
    };
    const res = await fetch('/api/services', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) return push(json.error ?? (editingId ? 'แก้ไขบริการไม่สำเร็จ' : 'เพิ่มบริการไม่สำเร็จ'), 'error');
    push(editingId ? 'แก้ไขบริการสำเร็จ' : 'เพิ่มบริการสำเร็จ');
    resetForm();
    setDrawerOpen(false);
    await load();
  }

  async function onDelete(row: Service) {
    const duration = row.duration_minutes != null ? `${row.duration_minutes} นาที` : null;
    const price = typeof row.price === 'number' ? `${row.price.toLocaleString('th-TH')} บาท` : null;
    const ok = await confirm({
      tone: 'error',
      title: 'ลบบริการนี้?',
      description: 'ลูกค้าจะเลือกบริการนี้ตอนจองไม่ได้อีก คิวที่จองไว้แล้วยังอยู่',
      context: {
        primary: String(row.service_name ?? ''),
        secondary: [duration, price].filter(Boolean).join(' · ') || undefined,
      },
      confirmLabel: 'ลบบริการ',
    });
    if (!ok) return;
    const res = await fetch(`/api/services?id=${String(row.id)}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'ลบไม่สำเร็จ', 'error');
    push('ลบบริการแล้ว');
    await load();
  }

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          {/* Phones: title above a full-width add button. sm+: title left, button right (unchanged). */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            justifyContent="space-between"
            spacing={{ xs: 1.5, sm: 0 }}
          >
            <Box>
              <Typography variant="h6" fontWeight={700}>Service Management</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'block', sm: 'none' } }}>
                {rows.length} บริการ
              </Typography>
            </Box>
            <Button startIcon={<AddRoundedIcon />} variant="contained" onClick={openCreate} sx={{ minHeight: { xs: 44, sm: 'auto' } }}>
              เพิ่มบริการ
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <FormControlLabel
            control={
              <Switch
                checked={showDuration}
                disabled={savingDisplay}
                onChange={(e: ChangeEvent<HTMLInputElement>) => void onToggleShowDuration(e.target.checked)}
              />
            }
            label="แสดงระยะเวลาบริการในหน้าจอง LIFF"
          />
          <Typography variant="caption" color="text.secondary" display="block">
            ปิดไว้ถ้าไม่ต้องการให้ลูกค้าเห็นจำนวนนาทีของแต่ละบริการ — มีผลกับการ์ดบริการ สรุปการจอง และรายการเลือกบริการ (ตั้งค่านี้ใช้ทั้งร้าน)
          </Typography>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: 0 }}>
          <ResponsiveTable
            rows={pagedRows}
            rowKey={(r) => String(r.id)}
            minWidth={640}
            renderCard={(r) => <ServiceMobileCard service={r} onEdit={() => openEdit(r)} onDelete={() => void onDelete(r)} />}
            cardListSx={{ p: 1.5, bgcolor: 'action.hover' }}
            columns={[
              { key: 'name', label: 'บริการ', render: (r) => <Box component="span" sx={{ fontWeight: 600 }}>{String(r.service_name)}</Box> },
              { key: 'mode', label: 'ประเภท', render: (r) => <BookingModeChip mode={String(r.booking_mode ?? 'fixed_slot')} /> },
              {
                key: 'duration',
                label: 'เวลา/บริการ',
                render: (r) =>
                  r.booking_mode === 'flexible_duration'
                    ? `${String(r.min_duration_minutes ?? '-')} - ${String(r.max_duration_minutes ?? '-')} min`
                    : `${String(r.duration_minutes ?? '-')}${r.duration_minutes ? ' min' : ''}`,
              },
              { key: 'capacity', label: 'จำนวน', render: (r) => String(r.capacity_per_slot ?? 1) },
              { key: 'price', label: 'ราคา', render: (r) => String(r.price ?? 0) },
              {
                key: 'status',
                label: 'สถาน',
                render: (r) => <Chip size="small" color={Boolean(r.active) ? 'success' : 'default'} label={Boolean(r.active) ? 'active' : 'inactive'} />,
              },
            ]}
            actions={(r) => (
              <ActionIconGroup
                actions={[
                  {
                    key: 'edit',
                    icon: <EditOutlinedIcon fontSize="small" />,
                    labelKey: 'common.edit',
                    fallbackLabel: 'Edit',
                    color: 'primary',
                    onClick: () => openEdit(r),
                  },
                  {
                    key: 'delete',
                    icon: <DeleteOutlineIcon fontSize="small" />,
                    labelKey: 'common.delete',
                    fallbackLabel: 'Delete',
                    color: 'error',
                    onClick: () => void onDelete(r),
                  },
                ]}
              />
            )}
            emptyState={
              <EmptyState
                title="ยังไม่มีบริการ"
                description="เพิ่มบริการแรกเพื่อให้ลูกค้าเลือกได้ตอนจองคิว"
                actionLabel="เพิ่มบริการ"
                onAction={openCreate}
                icon="✂️"
              />
            }
          />
          <TablePagination
            component="div"
            count={rows.length}
            page={page}
            onPageChange={(_, nextPage) => setPage(nextPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 20, 50, 100]}
            sx={{
              // Phones: drop the "rows per page" label so the toolbar fits one line; sm+ unchanged.
              '& .MuiTablePagination-selectLabel': { display: { xs: 'none', sm: 'block' } },
              '& .MuiTablePagination-toolbar': { pl: { xs: 1, sm: 2 } },
            }}
          />
        </CardContent>
      </Card>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', sm: '60%' }, p: { xs: 2, sm: 3 }, pb: { xs: 'calc(16px + env(safe-area-inset-bottom))', sm: 3 } } }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6" fontWeight={700}>{editingId ? 'Edit Service' : 'Add Service'}</Typography>
          <IconButton aria-label="ปิด" onClick={() => setDrawerOpen(false)} sx={{ display: { xs: 'inline-flex', sm: 'none' } }}>
            <CloseRoundedIcon />
          </IconButton>
        </Stack>

        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle2" mb={1}>Business Presets</Typography>
            <Grid container spacing={1.2}>
              {BUSINESS_PRESETS.map((p) => (
                <Grid key={p.key} size={{ xs: 12, sm: 6 }}>
                  <button
                    type="button"
                    className="w-full rounded-xl border px-3 py-2 text-left transition"
                    style={{
                      background: p.soft,
                      borderColor: presetKey === p.key ? p.accent : '#dbe3ea',
                      boxShadow: presetKey === p.key ? `0 0 0 1px ${p.accent} inset` : 'none',
                    }}
                    onClick={() => applyPreset(p)}
                  >
                    <div className="font-semibold" style={{ color: p.text }}>{p.title}</div>
                    <div className="text-xs text-slate-600">{p.subtitle}</div>
                  </button>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle2" mb={1}>Service Templates</Typography>
            <Grid container spacing={1.2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Business Category</InputLabel>
                  <Select value={category} label="Business Category" onChange={(e: SelectChangeEvent) => setCategory(String(e.target.value))}>
                    <MenuItem value="">All</MenuItem>
                    {categories.map((c) => <MenuItem key={c} value={c}>{categoryLabel(c)}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Template</InputLabel>
                  <Select value={selectedTemplateId} label="Template" onChange={(e: SelectChangeEvent) => {
                    setSelectedTemplateId(String(e.target.value));
                    const t = templates.find((x) => x.id === e.target.value);
                    if (t) applyTemplate(t);
                  }}>
                    <MenuItem value="">Select template</MenuItem>
                    {filteredTemplates.map((t) => (
                      <MenuItem key={t.id} value={t.id}>{categoryLabel(t.business_category)} • {t.service_name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <Box component="form" onSubmit={onSubmit}>
          <Grid container spacing={1.5}>
            <Grid size={12}>
              <TextField label="Service Name" value={serviceName} onChange={(e: ChangeEvent<HTMLInputElement>) => setServiceName(e.target.value)} fullWidth size="small" required />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Booking Mode</InputLabel>
                <Select value={bookingMode} label="Booking Mode" onChange={(e: SelectChangeEvent) => setBookingMode(e.target.value as Template['booking_mode'])}>
                  {BOOKING_MODES.map((m) => <MenuItem key={m} value={m}>{BOOKING_MODE_LABELS[m]}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Price" type="number" value={price} onChange={(e: ChangeEvent<HTMLInputElement>) => setPrice(e.target.value)} fullWidth size="small" />
            </Grid>

            {bookingMode === 'fixed_slot' ? (
              <Grid size={{ xs: 12, sm: 6 }}><TextField label="Duration Minutes" type="number" value={duration} onChange={(e: ChangeEvent<HTMLInputElement>) => setDuration(e.target.value)} fullWidth size="small" /></Grid>
            ) : null}
            {bookingMode === 'flexible_duration' ? (
              <>
                <Grid size={{ xs: 12, sm: 6 }}><TextField label="Min Duration" type="number" value={minDuration} onChange={(e: ChangeEvent<HTMLInputElement>) => setMinDuration(e.target.value)} fullWidth size="small" /></Grid>
                <Grid size={{ xs: 12, sm: 6 }}><TextField label="Max Duration" type="number" value={maxDuration} onChange={(e: ChangeEvent<HTMLInputElement>) => setMaxDuration(e.target.value)} fullWidth size="small" /></Grid>
              </>
            ) : null}
            <Grid size={{ xs: 12, sm: 6 }}><TextField label="Capacity / Slot" type="number" value={capacity} onChange={(e: ChangeEvent<HTMLInputElement>) => setCapacity(e.target.value)} fullWidth size="small" /></Grid>

            <Grid size={{ xs: 12, sm: 6 }}><FormControlLabel control={<Switch checked={active} onChange={(e: ChangeEvent<HTMLInputElement>) => setActive(e.target.checked)} />} label="Active" /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><FormControlLabel control={<Switch checked={requiresApproval} onChange={(e: ChangeEvent<HTMLInputElement>) => setRequiresApproval(e.target.checked)} />} label="Require Staff Confirm" /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><FormControlLabel control={<Switch checked={allowWalkIn} onChange={(e: ChangeEvent<HTMLInputElement>) => setAllowWalkIn(e.target.checked)} />} label="Allow Walk-in" /></Grid>
          </Grid>
          {/* Phones: two equal 44px buttons; sm+: natural widths as before. */}
          <Stack direction="row" spacing={1} mt={3}>
            <Button variant="contained" type="submit" disabled={saving} sx={{ flex: { xs: 1, sm: 'none' }, minHeight: { xs: 44, sm: 'auto' } }}>
              {saving ? 'Saving...' : (editingId ? 'Update Service' : 'Save Service')}
            </Button>
            <Button variant="outlined" onClick={() => setDrawerOpen(false)} sx={{ flex: { xs: 1, sm: 'none' }, minHeight: { xs: 44, sm: 'auto' } }}>
              Cancel
            </Button>
          </Stack>
        </Box>
      </Drawer>
    </Stack>
  );
}
