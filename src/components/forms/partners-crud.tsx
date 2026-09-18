'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Card, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, Skeleton, Stack, Tab, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Tooltip, Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { TablePaginationControls } from '@/components/ui/table-pagination-controls';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';

type PartnerType = 'customer' | 'supplier';
type Row = { id: string; partner_type: PartnerType; code: string | null; full_name: string; phone: string | null; email: string | null; address: string | null; note: string | null; line_user_id?: string | null; line_users?: { display_name?: string | null } | null };
type Form = { code: string; full_name: string; phone: string; email: string; address: string; note: string };

const EMPTY: Form = { code: '', full_name: '', phone: '', email: '', address: '', note: '' };
const TYPE_LABEL: Record<PartnerType, string> = { customer: 'ลูกค้า', supplier: 'Supplier' };

/** Partners: customers (pick up, SO) and suppliers (deliver, PO). Imports create them automatically by ERP code. */
export function PartnersCrud({ isAdmin }: { isAdmin: boolean }) {
  const { push } = useToast();
  const confirm = useConfirm();
  const [type, setType] = useState<PartnerType>('customer');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => { const id = setTimeout(() => { setQ(search.trim()); setPage(1); }, 300); return () => clearTimeout(id); }, [search]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/partners?${new URLSearchParams({ partner_type: type, page: String(page), page_size: String(pageSize), q })}`, { cache: 'no-store' });
      const j = (await res.json()) as { data?: Row[]; pagination?: { total: number }; error?: string };
      if (!res.ok) throw new Error(j.error ?? 'โหลดคู่ค้าไม่สำเร็จ');
      setRows(j.data ?? []);
      setTotal(j.pagination?.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดคู่ค้าไม่สำเร็จ');
      setRows((prev) => prev ?? []);
    }
  }, [type, page, pageSize, q]);

  useEffect(() => { void load(); }, [load]);

  function openCreate() { setEditingId(null); setForm(EMPTY); setOpen(true); }
  function openEdit(r: Row) {
    setEditingId(r.id);
    setForm({ code: r.code ?? '', full_name: r.full_name, phone: r.phone ?? '', email: r.email ?? '', address: r.address ?? '', note: r.note ?? '' });
    setOpen(true);
  }

  async function save() {
    if (!form.full_name.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/partners', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId ?? undefined, partner_type: type, ...form }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { push(j.error ?? 'บันทึกไม่สำเร็จ', 'error'); return; }
      push(editingId ? 'แก้ไขคู่ค้าแล้ว' : 'เพิ่มคู่ค้าแล้ว');
      setOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function unlinkLine(r: Row) {
    const ok = await confirm({ tone: 'warning', title: 'ยกเลิกการผูก LINE?', description: 'จะไม่ส่งแจ้งเตือนทาง LINE ให้คู่ค้ารายนี้ จนกว่าจะเปิดลิงก์จองผ่าน LINE อีกครั้ง', context: { primary: r.full_name, secondary: r.line_users?.display_name ?? undefined }, confirmLabel: 'ยกเลิกการผูก' });
    if (!ok) return;
    const res = await fetch('/api/partners', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, action: 'unlink_line' }) });
    if (!res.ok) { push('ยกเลิกไม่สำเร็จ', 'error'); return; }
    push('ยกเลิกการผูก LINE แล้ว');
    await load();
  }

  async function remove(r: Row) {
    const ok = await confirm({
      tone: 'error',
      title: `ลบ${TYPE_LABEL[r.partner_type]}รายนี้?`,
      description: 'ประวัติคิวและเอกสารยังอยู่ แต่จะไม่แสดงในรายชื่ออีก',
      context: { primary: r.full_name, secondary: r.code ?? r.phone ?? undefined },
      confirmLabel: 'ลบคู่ค้า',
    });
    if (!ok) return;
    const res = await fetch(`/api/partners?id=${r.id}`, { method: 'DELETE' });
    if (!res.ok) { push('ลบไม่สำเร็จ', 'error'); return; }
    push('ลบคู่ค้าแล้ว');
    await load();
  }

  return (
    <Stack spacing={2}>
      <PageHeader
        title="คู่ค้า"
        description="ลูกค้าที่มารับสินค้า และ Supplier ที่มาส่งสินค้า — การนำเข้า SO/PO สร้างให้อัตโนมัติตามรหัส"
        action={isAdmin ? <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>เพิ่ม{TYPE_LABEL[type]}</Button> : undefined}
      />
      <Card>
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" sx={{ px: 2, pt: 1 }} spacing={1}>
          <Tabs value={type} onChange={(_, v: PartnerType) => { setType(v); setPage(1); setRows(null); }}>
            <Tab value="customer" label="ลูกค้า" />
            <Tab value="supplier" label="Supplier" />
          </Tabs>
          <TextField size="small" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาชื่อ / รหัส / เบอร์โทร"
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" color="disabled" /></InputAdornment> } }} sx={{ minWidth: { sm: 280 } }} />
        </Stack>
        {error ? <Alert severity="error" sx={{ m: 2 }} action={<Button color="inherit" size="small" onClick={() => void load()}>ลองใหม่</Button>}>{error}</Alert> : null}
        {rows === null ? (
          <Stack spacing={1} sx={{ p: 2 }}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={44} />)}</Stack>
        ) : rows.length === 0 ? (
          <EmptyState icon="🤝" title={q ? 'ไม่พบคู่ค้าตามคำค้น' : `ยังไม่มี${TYPE_LABEL[type]}`} description="นำเข้า SO/PO หรือเพิ่มเองได้" actionLabel={isAdmin && !q ? `เพิ่ม${TYPE_LABEL[type]}` : undefined} onAction={isAdmin && !q ? openCreate : undefined} />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>รหัส</TableCell><TableCell>ชื่อ</TableCell><TableCell>เบอร์โทร</TableCell><TableCell>อีเมล</TableCell><TableCell>LINE</TableCell>
                  {isAdmin ? <TableCell align="right">จัดการ</TableCell> : null}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell>{r.code ?? '-'}</TableCell>
                    <TableCell><Typography variant="body2" fontWeight={600}>{r.full_name}</Typography></TableCell>
                    <TableCell>{r.phone ?? '-'}</TableCell>
                    <TableCell>{r.email ?? '-'}</TableCell>
                    <TableCell>{r.line_user_id ? <Chip size="small" color="success" label={r.line_users?.display_name ?? 'ผูกแล้ว'} onDelete={isAdmin ? () => void unlinkLine(r) : undefined} /> : <Typography variant="caption" color="text.disabled">ยังไม่ผูก</Typography>}</TableCell>
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
        <TablePaginationControls page={page} rowsPerPage={pageSize} total={total} onPageChange={setPage} onRowsPerPageChange={(n) => { setPageSize(n); setPage(1); }} />
      </Card>

      <Dialog open={open} onClose={saving ? undefined : () => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{editingId ? 'แก้ไข' : 'เพิ่ม'}{TYPE_LABEL[type]}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField size="small" label="รหัสใน ERP" value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} helperText="ใช้จับคู่ตอนนำเข้า SO/PO" />
            <TextField autoFocus required size="small" label="ชื่อ" value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} />
            <TextField size="small" label="เบอร์โทร" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} slotProps={{ htmlInput: { inputMode: 'tel' } }} />
            <TextField size="small" label="อีเมล" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
            <TextField size="small" label="ที่อยู่" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} multiline minRows={2} />
            <TextField size="small" label="หมายเหตุ" value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setOpen(false)} disabled={saving}>ปิด</Button>
          <Button variant="contained" onClick={() => void save()} disabled={!form.full_name.trim() || saving}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
