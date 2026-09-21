'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Card, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, MenuItem, Skeleton,
  Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { PLATE_FORMATS, PLATE_FORMAT_INFO, toPlateFormat, type PlateFormat } from '@/lib/booking/plate';

type Row = { id: string; service_name: string; duration_minutes: number; buffer_minutes: number; direction: 'inbound' | 'outbound' | null; sort_order: number; active: boolean; plate_format?: PlateFormat | null };
type Form = { service_name: string; duration_minutes: string; buffer_minutes: string; direction: '' | 'inbound' | 'outbound'; sort_order: string; active: boolean; plate_format: PlateFormat };

const EMPTY: Form = { service_name: '', duration_minutes: '30', buffer_minutes: '0', direction: '', sort_order: '0', active: true, plate_format: 'any' };
export const DIRECTION_LABEL = { '': 'รับ + ส่ง', outbound: 'รับสินค้าเท่านั้น', inbound: 'ส่งสินค้าเท่านั้น' } as const;

/**
 * Vehicle types (stored in `services`). Duration = time at the dock, buffer =
 * turnaround blocked after the vehicle leaves. Both drive slot availability.
 */
export function VehicleTypesCrud({ isAdmin }: { isAdmin: boolean }) {
  const { push } = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/services?page_size=200', { cache: 'no-store' });
      const j = (await res.json()) as { data?: Row[]; error?: string };
      if (!res.ok) throw new Error(j.error ?? 'โหลดประเภทรถไม่สำเร็จ');
      setRows(j.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดประเภทรถไม่สำเร็จ');
      setRows((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function openCreate() { setEditingId(null); setForm({ ...EMPTY, sort_order: String((rows?.length ?? 0) + 1) }); setOpen(true); }
  function openEdit(r: Row) {
    setEditingId(r.id);
    setForm({ service_name: r.service_name, duration_minutes: String(r.duration_minutes), buffer_minutes: String(r.buffer_minutes ?? 0), direction: r.direction ?? '', sort_order: String(r.sort_order ?? 0), active: r.active, plate_format: toPlateFormat(r.plate_format) });
    setOpen(true);
  }

  const duration = Number(form.duration_minutes);
  const buffer = Number(form.buffer_minutes);
  const valid = form.service_name.trim().length >= 2 && Number.isInteger(duration) && duration >= 5 && duration <= 480 && Number.isInteger(buffer) && buffer >= 0 && buffer <= 240;

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/services', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId ?? undefined,
          service_name: form.service_name.trim(),
          duration_minutes: duration,
          buffer_minutes: buffer,
          direction: form.direction || null,
          sort_order: Number(form.sort_order) || 0,
          active: form.active,
          plate_format: form.plate_format,
          price: 0,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { push(j.error ?? 'บันทึกไม่สำเร็จ', 'error'); return; }
      push(editingId ? 'แก้ไขประเภทรถแล้ว' : 'เพิ่มประเภทรถแล้ว');
      setOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(r: Row) {
    const ok = await confirm({
      tone: 'error',
      title: 'ลบประเภทรถนี้?',
      description: 'คิวเดิมยังอยู่ แต่จะเลือกประเภทนี้ในการจองใหม่ไม่ได้',
      context: { primary: r.service_name, secondary: `${r.duration_minutes} นาที` },
      confirmLabel: 'ลบประเภทรถ',
    });
    if (!ok) return;
    const res = await fetch(`/api/services?id=${r.id}`, { method: 'DELETE' });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) { push(j.error ?? 'ลบไม่สำเร็จ', 'error'); return; }
    push('ลบประเภทรถแล้ว');
    await load();
  }

  return (
    <Stack spacing={2}>
      <PageHeader
        title="ประเภทรถ"
        description="กำหนดเวลาที่ใช้ท่าของรถแต่ละประเภท — ระบบใช้ค่านี้คำนวณช่วงเวลาที่ว่าง"
        action={isAdmin ? <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>เพิ่มประเภทรถ</Button> : undefined}
      />
      {error ? <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void load()}>ลองใหม่</Button>}>{error}</Alert> : null}
      <Card>
        {rows === null ? (
          <Stack spacing={1} sx={{ p: 2 }}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={44} />)}</Stack>
        ) : rows.length === 0 ? (
          <EmptyState icon="🚚" title="ยังไม่มีประเภทรถ" description="เพิ่มอย่างน้อย 1 ประเภท ลูกค้าจึงจะจองคิวได้" actionLabel={isAdmin ? 'เพิ่มประเภทรถ' : undefined} onAction={isAdmin ? openCreate : undefined} />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ประเภทรถ</TableCell>
                  <TableCell align="right">เวลาที่ท่า</TableCell>
                  <TableCell align="right">เผื่อหลังเสร็จ</TableCell>
                  <TableCell>ใช้กับ</TableCell>
                  <TableCell>รูปแบบทะเบียน</TableCell>
                  <TableCell>สถานะ</TableCell>
                  {isAdmin ? <TableCell align="right">จัดการ</TableCell> : null}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell><Typography variant="body2" fontWeight={600}>{r.service_name}</Typography></TableCell>
                    <TableCell align="right">{r.duration_minutes} นาที</TableCell>
                    <TableCell align="right">{r.buffer_minutes ?? 0} นาที</TableCell>
                    <TableCell>{DIRECTION_LABEL[r.direction ?? '']}</TableCell>
                    <TableCell>{PLATE_FORMAT_INFO[toPlateFormat(r.plate_format)].label}</TableCell>
                    <TableCell><Chip size="small" color={r.active ? 'success' : 'default'} variant={r.active ? 'filled' : 'outlined'} label={r.active ? 'ใช้งาน' : 'ปิด'} /></TableCell>
                    {isAdmin ? (
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        <Tooltip title="แก้ไข"><IconButton size="small" onClick={() => openEdit(r)} aria-label="แก้ไข"><EditRoundedIcon fontSize="small" /></IconButton></Tooltip>
                        <Tooltip title="ลบ"><IconButton size="small" color="error" onClick={() => void remove(r)} aria-label="ลบ"><DeleteOutlineRoundedIcon fontSize="small" /></IconButton></Tooltip>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <Dialog open={open} onClose={saving ? undefined : () => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{editingId ? 'แก้ไขประเภทรถ' : 'เพิ่มประเภทรถ'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField autoFocus required size="small" label="ชื่อประเภทรถ" value={form.service_name} onChange={(e) => setForm((p) => ({ ...p, service_name: e.target.value }))} placeholder="เช่น รถ 6 ล้อ" />
            <Stack direction="row" spacing={2}>
              <TextField required fullWidth size="small" type="number" label="เวลาที่ท่า (นาที)" value={form.duration_minutes} onChange={(e) => setForm((p) => ({ ...p, duration_minutes: e.target.value }))} slotProps={{ htmlInput: { min: 5, max: 480, step: 5 } }} helperText="5–480" />
              <TextField fullWidth size="small" type="number" label="เผื่อหลังเสร็จ (นาที)" value={form.buffer_minutes} onChange={(e) => setForm((p) => ({ ...p, buffer_minutes: e.target.value }))} slotProps={{ htmlInput: { min: 0, max: 240, step: 5 } }} helperText="ท่าถูกกันไว้ต่อ" />
            </Stack>
            <TextField select size="small" label="ใช้กับคิวประเภท" value={form.direction} onChange={(e) => setForm((p) => ({ ...p, direction: e.target.value as Form['direction'] }))}>
              <MenuItem value="">{DIRECTION_LABEL['']}</MenuItem>
              <MenuItem value="outbound">{DIRECTION_LABEL.outbound}</MenuItem>
              <MenuItem value="inbound">{DIRECTION_LABEL.inbound}</MenuItem>
            </TextField>
            <TextField select size="small" label="รูปแบบทะเบียนที่ลูกค้ากรอกได้" value={form.plate_format} onChange={(e) => setForm((p) => ({ ...p, plate_format: toPlateFormat(e.target.value) }))} helperText={PLATE_FORMAT_INFO[form.plate_format].hint}>
              {PLATE_FORMATS.map((f) => <MenuItem key={f} value={f}>{PLATE_FORMAT_INFO[f].label}</MenuItem>)}
            </TextField>
            <TextField size="small" type="number" label="ลำดับการแสดง" value={form.sort_order} onChange={(e) => setForm((p) => ({ ...p, sort_order: e.target.value }))} />
            <FormControlLabel control={<Switch checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} />} label="เปิดให้จอง" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setOpen(false)} disabled={saving}>ปิด</Button>
          <Button variant="contained" onClick={() => void save()} disabled={!valid || saving}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
