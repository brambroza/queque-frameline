'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Autocomplete, Button, Card, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, MenuItem,
  Skeleton, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { DIRECTION_LABEL } from './vehicle-types-crud';

type Dock = { id: string; resource_type: string; resource_code: string | null; resource_name: string; direction: 'inbound' | 'outbound' | null; service_ids: string[] | null; active: boolean; description: string | null };
type Vehicle = { id: string; service_name: string };
type Form = { resource_code: string; resource_name: string; direction: '' | 'inbound' | 'outbound'; service_ids: string[]; description: string; active: boolean };

const EMPTY: Form = { resource_code: '', resource_name: '', direction: '', service_ids: [], description: '', active: true };

/**
 * Docks (stored in `booking_resources`, type `dock`). The number of docks that
 * match a booking's direction and vehicle type is the capacity of every slot.
 */
export function DocksCrud({ isAdmin }: { isAdmin: boolean }) {
  const { push } = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState<Dock[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [rRes, vRes] = await Promise.all([fetch('/api/resources?page_size=500', { cache: 'no-store' }), fetch('/api/services?page_size=200', { cache: 'no-store' })]);
      const [r, v] = (await Promise.all([rRes.json(), vRes.json()])) as [{ data?: Dock[]; error?: string }, { data?: Vehicle[] }];
      if (!rRes.ok) throw new Error(r.error ?? 'โหลดท่าไม่สำเร็จ');
      setRows((r.data ?? []).filter((d) => d.resource_type === 'dock'));
      setVehicles(v.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดท่าไม่สำเร็จ');
      setRows((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function openCreate() { setEditingId(null); setForm(EMPTY); setOpen(true); }
  function openEdit(d: Dock) {
    setEditingId(d.id);
    setForm({ resource_code: d.resource_code ?? '', resource_name: d.resource_name, direction: d.direction ?? '', service_ids: d.service_ids ?? [], description: d.description ?? '', active: d.active });
    setOpen(true);
  }

  const valid = form.resource_name.trim().length >= 1;

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/resources', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId ?? undefined,
          resource_type: 'dock',
          resource_code: form.resource_code.trim() || null,
          resource_name: form.resource_name.trim(),
          capacity: 1,
          unit_price: 0,
          direction: form.direction || null,
          service_ids: form.service_ids.length > 0 ? form.service_ids : null,
          description: form.description.trim() || null,
          active: form.active,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { push(j.error ?? 'บันทึกไม่สำเร็จ', 'error'); return; }
      push(editingId ? 'แก้ไขท่าแล้ว' : 'เพิ่มท่าแล้ว');
      setOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(d: Dock) {
    const ok = await confirm({
      tone: 'error',
      title: 'ลบท่านี้?',
      description: 'ช่วงเวลาที่จองได้จะลดลงทันที คิวที่ผูกกับท่านี้อยู่แล้วไม่ถูกแก้ — ตรวจและเลื่อนคิวเหล่านั้นเอง',
      context: { primary: d.resource_name, secondary: d.resource_code ?? undefined },
      confirmLabel: 'ลบท่า',
    });
    if (!ok) return;
    const res = await fetch(`/api/resources?id=${d.id}`, { method: 'DELETE' });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) { push(j.error ?? 'ลบไม่สำเร็จ', 'error'); return; }
    push('ลบท่าแล้ว');
    await load();
  }

  const vehicleName = (id: string) => vehicles.find((v) => v.id === id)?.service_name ?? '—';

  return (
    <Stack spacing={2}>
      <PageHeader
        title="ท่ารับ-ส่งสินค้า"
        description="จำนวนท่าที่รองรับประเภทคิวและประเภทรถ คือจำนวนรถที่รับได้พร้อมกันในแต่ละช่วงเวลา"
        action={isAdmin ? <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>เพิ่มท่า</Button> : undefined}
      />
      {error ? <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void load()}>ลองใหม่</Button>}>{error}</Alert> : null}
      <Card>
        {rows === null ? (
          <Stack spacing={1} sx={{ p: 2 }}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={44} />)}</Stack>
        ) : rows.length === 0 ? (
          <EmptyState icon="🏭" title="ยังไม่มีท่า" description="ไม่มีท่า = ไม่มีช่วงเวลาให้จอง เพิ่มอย่างน้อย 1 ท่า" actionLabel={isAdmin ? 'เพิ่มท่า' : undefined} onAction={isAdmin ? openCreate : undefined} />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>รหัส</TableCell>
                  <TableCell>ชื่อท่า</TableCell>
                  <TableCell>ใช้กับ</TableCell>
                  <TableCell>ประเภทรถที่เข้าได้</TableCell>
                  <TableCell>สถานะ</TableCell>
                  {isAdmin ? <TableCell align="right">จัดการ</TableCell> : null}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((d) => (
                  <TableRow key={d.id} hover>
                    <TableCell>{d.resource_code ?? '-'}</TableCell>
                    <TableCell><Typography variant="body2" fontWeight={600}>{d.resource_name}</Typography></TableCell>
                    <TableCell>{DIRECTION_LABEL[d.direction ?? '']}</TableCell>
                    <TableCell>
                      {!d.service_ids || d.service_ids.length === 0 ? 'ทุกประเภท' : (
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>{d.service_ids.map((id) => <Chip key={id} size="small" variant="outlined" label={vehicleName(id)} />)}</Stack>
                      )}
                    </TableCell>
                    <TableCell><Chip size="small" color={d.active ? 'success' : 'default'} variant={d.active ? 'filled' : 'outlined'} label={d.active ? 'ใช้งาน' : 'ปิด'} /></TableCell>
                    {isAdmin ? (
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        <Tooltip title="แก้ไข"><IconButton size="small" onClick={() => openEdit(d)} aria-label="แก้ไข"><EditRoundedIcon fontSize="small" /></IconButton></Tooltip>
                        <Tooltip title="ลบ"><IconButton size="small" color="error" onClick={() => void remove(d)} aria-label="ลบ"><DeleteOutlineRoundedIcon fontSize="small" /></IconButton></Tooltip>
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
        <DialogTitle>{editingId ? 'แก้ไขท่า' : 'เพิ่มท่า'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Stack direction="row" spacing={2}>
              <TextField size="small" label="รหัส" value={form.resource_code} onChange={(e) => setForm((p) => ({ ...p, resource_code: e.target.value }))} placeholder="D1" sx={{ width: 120 }} />
              <TextField autoFocus required fullWidth size="small" label="ชื่อท่า" value={form.resource_name} onChange={(e) => setForm((p) => ({ ...p, resource_name: e.target.value }))} placeholder="ท่า 1" helperText="ชื่อนี้แสดงบนจอเรียกคิวและ DO" />
            </Stack>
            <TextField select size="small" label="ใช้กับคิวประเภท" value={form.direction} onChange={(e) => setForm((p) => ({ ...p, direction: e.target.value as Form['direction'] }))}>
              <MenuItem value="">{DIRECTION_LABEL['']}</MenuItem>
              <MenuItem value="outbound">{DIRECTION_LABEL.outbound}</MenuItem>
              <MenuItem value="inbound">{DIRECTION_LABEL.inbound}</MenuItem>
            </TextField>
            <Autocomplete
              multiple
              size="small"
              options={vehicles.map((v) => v.id)}
              value={form.service_ids}
              getOptionLabel={vehicleName}
              onChange={(_, v) => setForm((p) => ({ ...p, service_ids: v }))}
              renderInput={(params) => <TextField {...params} label="ประเภทรถที่เข้าได้" placeholder={form.service_ids.length === 0 ? 'ว่าง = ทุกประเภท' : ''} />}
            />
            <TextField size="small" label="หมายเหตุ" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            <FormControlLabel control={<Switch checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} />} label="เปิดใช้งาน" />
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
