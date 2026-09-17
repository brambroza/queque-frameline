'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Card, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, MenuItem, Skeleton,
  Stack, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Tooltip, Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import QrCode2RoundedIcon from '@mui/icons-material/QrCode2Rounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { QrCode } from '@/components/ui/qr-code';
import { TablePaginationControls } from '@/components/ui/table-pagination-controls';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { formatDateDMY, formatDateTimeDMY } from '@/lib/utils/date-format';

type DocType = 'so' | 'po';
type DocRow = {
  id: string; doc_type: DocType; doc_no: string; partner_name: string | null; partner_code: string | null; doc_date: string | null; due_date: string | null;
  status: 'open' | 'booked' | 'completed' | 'cancelled'; source: string; items: Array<{ name: string; qty: number; uom?: string }>; has_link: boolean; booking_count: number;
};
type ItemDraft = { sku: string; name: string; qty: string; uom: string };
type ImportSummary = {
  rows: number; documents: number; created: number; updated: number; truncated: boolean;
  errors: Array<{ line: number; doc_no: string | null; message: string }>;
  failed: Array<{ doc_no: string; message: string }>;
  preview: Array<{ doc_no: string; partner: string; items: number; due_date: string | null }>;
};

const STATUS: Record<DocRow['status'], { label: string; color: 'default' | 'primary' | 'success' | 'error' }> = {
  open: { label: 'รอจองคิว', color: 'default' },
  booked: { label: 'มีคิวแล้ว', color: 'primary' },
  completed: { label: 'ปิดแล้ว', color: 'success' },
  cancelled: { label: 'ยกเลิก', color: 'error' },
};
const TYPE_META: Record<DocType, { label: string; partner: string; hint: string }> = {
  so: { label: 'Sales Order (ลูกค้ารับสินค้า)', partner: 'ลูกค้า', hint: 'ส่งลิงก์ให้ลูกค้าเลือกวันเวลามารับสินค้า' },
  po: { label: 'Purchase Order (Supplier ส่งสินค้า)', partner: 'Supplier', hint: 'ส่งลิงก์ให้ Supplier เลือกวันเวลามาส่งสินค้า' },
};
const EMPTY_ITEM: ItemDraft = { sku: '', name: '', qty: '1', uom: '' };

/** SO / PO: import, create by hand, hand out the self-booking link, close or cancel. */
export function DocumentsCrud({ isAdmin }: { isAdmin: boolean }) {
  const { push } = useToast();
  const confirm = useConfirm();
  const [docType, setDocType] = useState<DocType>('so');
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState<DocRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [linkDoc, setLinkDoc] = useState<DocRow | null>(null);
  const [link, setLink] = useState<{ url: string; expires_at: string | null } | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ doc_no: '', partner_code: '', partner_name: '', partner_phone: '', due_date: '', remark: '' });
  const [items, setItems] = useState<ItemDraft[]>([{ ...EMPTY_ITEM }]);
  const [saving, setSaving] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvName, setCsvName] = useState('');
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { const id = setTimeout(() => { setQ(search.trim()); setPage(1); }, 300); return () => clearTimeout(id); }, [search]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const qs = new URLSearchParams({ doc_type: docType, page: String(page), page_size: String(pageSize), q });
      if (status) qs.set('status', status);
      const res = await fetch(`/api/documents?${qs}`, { cache: 'no-store' });
      const j = (await res.json()) as { data?: DocRow[]; pagination?: { total: number }; error?: string };
      if (!res.ok) throw new Error(j.error ?? 'โหลดเอกสารไม่สำเร็จ');
      setRows(j.data ?? []);
      setTotal(j.pagination?.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดเอกสารไม่สำเร็จ');
      setRows((prev) => prev ?? []);
    }
  }, [docType, status, page, pageSize, q]);

  useEffect(() => { void load(); }, [load]);

  // ── booking link ───────────────────────────────────────────────────────────
  async function openLink(doc: DocRow, regenerate = false) {
    setLinkDoc(doc);
    if (!regenerate) setLink(null);
    setLinkBusy(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}/booking-link`, { method: regenerate ? 'POST' : 'GET', cache: 'no-store' });
      const j = (await res.json()) as { data?: { url: string; expires_at: string | null }; error?: string };
      if (!res.ok || !j.data) { push(j.error ?? 'ออกลิงก์ไม่สำเร็จ', 'error'); if (!regenerate) setLinkDoc(null); return; }
      setLink(j.data);
      if (regenerate) push('สร้างลิงก์ใหม่แล้ว ลิงก์เดิมใช้ไม่ได้แล้ว');
      void load();
    } finally {
      setLinkBusy(false);
    }
  }

  async function regenerateLink() {
    if (!linkDoc) return;
    const ok = await confirm({
      tone: 'warning',
      title: 'สร้างลิงก์จองใหม่?',
      description: 'ลิงก์ที่ส่งให้คู่ค้าไปแล้วจะใช้ไม่ได้ทันที ต้องส่งลิงก์ใหม่ให้อีกครั้ง',
      context: { primary: linkDoc.doc_no, secondary: linkDoc.partner_name ?? undefined },
      confirmLabel: 'สร้างลิงก์ใหม่',
    });
    if (ok) await openLink(linkDoc, true);
  }

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); push('คัดลอกแล้ว'); } catch { push('คัดลอกไม่สำเร็จ', 'error'); }
  }

  // ── status / delete ────────────────────────────────────────────────────────
  async function setDocStatus(doc: DocRow, next: 'open' | 'completed' | 'cancelled') {
    if (next !== 'open') {
      const ok = await confirm({
        tone: next === 'cancelled' ? 'error' : 'warning',
        title: next === 'cancelled' ? 'ยกเลิกเอกสารนี้?' : 'ปิดเอกสารนี้?',
        description: next === 'cancelled' ? 'ลิงก์จองจะใช้ไม่ได้ และสร้างคิวจากเอกสารนี้ไม่ได้อีก' : 'ใช้เมื่อรับ/ส่งสินค้าครบแล้ว — ลิงก์จองจะใช้ไม่ได้อีก',
        context: { primary: doc.doc_no, secondary: doc.partner_name ?? undefined },
        confirmLabel: next === 'cancelled' ? 'ยกเลิกเอกสาร' : 'ปิดเอกสาร',
        cancelLabel: next === 'cancelled' ? 'ไม่ยกเลิก' : undefined,
      });
      if (!ok) return;
    }
    const res = await fetch(`/api/documents/${doc.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }) });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) { push(j.error ?? 'บันทึกไม่สำเร็จ', 'error'); return; }
    push('อัปเดตเอกสารแล้ว');
    await load();
  }

  async function remove(doc: DocRow) {
    const ok = await confirm({ tone: 'error', title: 'ลบเอกสารนี้?', description: 'ลบได้เฉพาะเอกสารที่ยังไม่มีคิว', context: { primary: doc.doc_no, secondary: doc.partner_name ?? undefined }, confirmLabel: 'ลบเอกสาร' });
    if (!ok) return;
    const res = await fetch(`/api/documents/${doc.id}`, { method: 'DELETE' });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) { push(j.error ?? 'ลบไม่สำเร็จ', 'error'); return; }
    push('ลบเอกสารแล้ว');
    await load();
  }

  // ── manual create ──────────────────────────────────────────────────────────
  const formValid = form.doc_no.trim() && form.partner_name.trim();
  async function saveDoc() {
    if (!formValid || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc_type: docType,
          doc_no: form.doc_no,
          partner: { code: form.partner_code, name: form.partner_name, phone: form.partner_phone },
          due_date: form.due_date,
          remark: form.remark,
          items: items.filter((i) => i.name.trim()).map((i) => ({ sku: i.sku, name: i.name, qty: i.qty || '1', uom: i.uom })),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; data?: { created?: boolean } };
      if (!res.ok) { push(j.error ?? 'บันทึกไม่สำเร็จ', 'error'); return; }
      push(j.data?.created ? 'เพิ่มเอกสารแล้ว' : 'อัปเดตเอกสารเดิมแล้ว (เลขที่ซ้ำ)');
      setFormOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  // ── CSV import ─────────────────────────────────────────────────────────────
  function resetImport() { setCsvText(''); setCsvName(''); setSummary(null); setImportError(null); setImported(false); if (fileRef.current) fileRef.current.value = ''; }

  async function runImport(text: string, dryRun: boolean) {
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch('/api/documents/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ doc_type: docType, csv: text, dry_run: dryRun }) });
      const j = (await res.json().catch(() => ({}))) as { data?: ImportSummary; error?: string };
      if (!res.ok || !j.data) { setImportError(j.error ?? 'อ่านไฟล์ไม่สำเร็จ'); setSummary(null); return; }
      setSummary(j.data);
      if (!dryRun) { setImported(true); push(`นำเข้าแล้ว: ใหม่ ${j.data.created} · อัปเดต ${j.data.updated}`); await load(); }
    } finally {
      setImporting(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setImportError('ไฟล์ใหญ่เกิน 2 MB'); return; }
    const text = await file.text();
    setCsvName(file.name);
    setCsvText(text);
    setImported(false);
    await runImport(text, true);
  }

  const meta = TYPE_META[docType];

  return (
    <Stack spacing={2}>
      <PageHeader
        title="เอกสาร SO / PO"
        description="นำเข้าหรือเพิ่มเอกสาร แล้วส่งลิงก์ / QR ให้คู่ค้าจองคิวเอง"
        action={isAdmin ? (
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<UploadFileRoundedIcon />} onClick={() => { resetImport(); setImportOpen(true); }}>นำเข้า CSV</Button>
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => { setForm({ doc_no: '', partner_code: '', partner_name: '', partner_phone: '', due_date: '', remark: '' }); setItems([{ ...EMPTY_ITEM }]); setFormOpen(true); }}>เพิ่ม {docType.toUpperCase()}</Button>
          </Stack>
        ) : undefined}
      />
      <Card>
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} justifyContent="space-between" spacing={1} sx={{ px: 2, pt: 1 }}>
          <Tabs value={docType} onChange={(_, v: DocType) => { setDocType(v); setPage(1); setRows(null); }}>
            <Tab value="so" label="SO · ลูกค้ารับสินค้า" />
            <Tab value="po" label="PO · Supplier ส่งสินค้า" />
          </Tabs>
          <Stack direction="row" spacing={1}>
            <TextField select size="small" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} slotProps={{ select: { displayEmpty: true } }} sx={{ minWidth: 140 }}>
              <MenuItem value="">ทุกสถานะ</MenuItem>
              {(Object.keys(STATUS) as Array<DocRow['status']>).map((s) => <MenuItem key={s} value={s}>{STATUS[s].label}</MenuItem>)}
            </TextField>
            <TextField size="small" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`ค้นหาเลขที่ / ${meta.partner}`}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" color="disabled" /></InputAdornment> } }} sx={{ minWidth: { sm: 260 } }} />
          </Stack>
        </Stack>
        {error ? <Alert severity="error" sx={{ m: 2 }} action={<Button color="inherit" size="small" onClick={() => void load()}>ลองใหม่</Button>}>{error}</Alert> : null}
        {rows === null ? (
          <Stack spacing={1} sx={{ p: 2 }}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={44} />)}</Stack>
        ) : rows.length === 0 ? (
          <EmptyState icon="📄" title={q || status ? 'ไม่พบเอกสารตามเงื่อนไข' : `ยังไม่มี ${docType.toUpperCase()}`} description={meta.hint} actionLabel={isAdmin && !q && !status ? 'นำเข้า CSV' : undefined} onAction={isAdmin && !q && !status ? () => { resetImport(); setImportOpen(true); } : undefined} />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>เลขที่</TableCell><TableCell>{meta.partner}</TableCell><TableCell>กำหนดส่ง</TableCell><TableCell align="right">รายการ</TableCell>
                  <TableCell align="right">คิว</TableCell><TableCell>สถานะ</TableCell><TableCell align="right">จัดการ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((d) => {
                  const live = d.status === 'open' || d.status === 'booked';
                  return (
                    <TableRow key={d.id} hover>
                      <TableCell><Typography variant="body2" fontWeight={700}>{d.doc_no}</Typography><Typography variant="caption" color="text.secondary">{d.source}</Typography></TableCell>
                      <TableCell sx={{ maxWidth: 260 }}><Typography variant="body2" noWrap>{d.partner_name ?? '-'}</Typography><Typography variant="caption" color="text.secondary">{d.partner_code ?? ''}</Typography></TableCell>
                      <TableCell>{d.due_date ? formatDateDMY(d.due_date) : '-'}</TableCell>
                      <TableCell align="right">{d.items?.length ?? 0}</TableCell>
                      <TableCell align="right">{d.booking_count > 0 ? <Button size="small" href={`/portal/bookings?doc=${d.id}`}>{d.booking_count}</Button> : 0}</TableCell>
                      <TableCell><Chip size="small" color={STATUS[d.status].color} variant={d.status === 'open' ? 'outlined' : 'filled'} label={STATUS[d.status].label} /></TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        {isAdmin && live ? <Button size="small" variant={d.has_link ? 'text' : 'contained'} startIcon={<QrCode2RoundedIcon />} onClick={() => void openLink(d)}>{d.has_link ? 'ดูลิงก์' : 'ส่งลิงก์จอง'}</Button> : null}
                        {isAdmin && live ? <Button size="small" color="inherit" onClick={() => void setDocStatus(d, 'completed')}>ปิด</Button> : null}
                        {isAdmin && live ? <Button size="small" color="error" onClick={() => void setDocStatus(d, 'cancelled')}>ยกเลิก</Button> : null}
                        {isAdmin && !live ? <Button size="small" color="inherit" onClick={() => void setDocStatus(d, 'open')}>เปิดใหม่</Button> : null}
                        {isAdmin && d.booking_count === 0 ? <Tooltip title="ลบ"><IconButton size="small" color="error" onClick={() => void remove(d)} aria-label="ลบ"><DeleteOutlineRoundedIcon fontSize="small" /></IconButton></Tooltip> : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        <TablePaginationControls page={page} rowsPerPage={pageSize} total={total} onPageChange={setPage} onRowsPerPageChange={(n) => { setPageSize(n); setPage(1); }} />
      </Card>

      {/* Booking link */}
      <Dialog open={Boolean(linkDoc)} onClose={() => setLinkDoc(null)} fullWidth maxWidth="xs">
        <DialogTitle>ลิงก์จองคิว · {linkDoc?.doc_no}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} alignItems="center" sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary" textAlign="center">{linkDoc ? TYPE_META[linkDoc.doc_type].hint : ''} — ส่งทาง LINE / อีเมล หรือให้สแกน QR</Typography>
            {link ? (
              <>
                <Box sx={{ p: 1.5, bgcolor: '#fff', borderRadius: 2, border: 1, borderColor: 'divider' }}><QrCode value={link.url} size={220} alt="ลิงก์จองคิว" /></Box>
                <TextField fullWidth size="small" value={link.url} slotProps={{ input: { readOnly: true } }} />
                {link.expires_at ? <Typography variant="caption" color="text.secondary">ใช้ได้ถึง {formatDateTimeDMY(link.expires_at)}</Typography> : null}
              </>
            ) : <Skeleton variant="rounded" width={220} height={220} />}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" disabled={linkBusy || !link} onClick={() => void regenerateLink()}>สร้างลิงก์ใหม่</Button>
          <Button variant="contained" startIcon={<ContentCopyRoundedIcon />} disabled={!link} onClick={() => link && void copy(link.url)}>คัดลอกลิงก์</Button>
        </DialogActions>
      </Dialog>

      {/* Manual create */}
      <Dialog open={formOpen} onClose={saving ? undefined : () => setFormOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>เพิ่ม {meta.label}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField autoFocus required fullWidth size="small" label={`เลขที่ ${docType.toUpperCase()}`} value={form.doc_no} onChange={(e) => setForm((p) => ({ ...p, doc_no: e.target.value }))} helperText="เลขที่ซ้ำ = อัปเดตเอกสารเดิม" />
              <TextField fullWidth size="small" type="date" label="กำหนดส่ง" value={form.due_date} onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))} slotProps={{ inputLabel: { shrink: true } }} />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField size="small" label={`รหัส${meta.partner}`} value={form.partner_code} onChange={(e) => setForm((p) => ({ ...p, partner_code: e.target.value }))} sx={{ width: { sm: 160 } }} />
              <TextField required fullWidth size="small" label={`ชื่อ${meta.partner}`} value={form.partner_name} onChange={(e) => setForm((p) => ({ ...p, partner_name: e.target.value }))} />
              <TextField size="small" label="เบอร์โทร" value={form.partner_phone} onChange={(e) => setForm((p) => ({ ...p, partner_phone: e.target.value }))} sx={{ width: { sm: 170 } }} />
            </Stack>
            <Typography variant="subtitle2" fontWeight={700}>รายการสินค้า (ไม่บังคับ)</Typography>
            {items.map((it, idx) => (
              <Stack key={idx} direction="row" spacing={1}>
                <TextField size="small" label="รหัส" value={it.sku} onChange={(e) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, sku: e.target.value } : x)))} sx={{ width: 110 }} />
                <TextField fullWidth size="small" label="ชื่อสินค้า" value={it.name} onChange={(e) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))} />
                <TextField size="small" type="number" label="จำนวน" value={it.qty} onChange={(e) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, qty: e.target.value } : x)))} sx={{ width: 100 }} />
                <TextField size="small" label="หน่วย" value={it.uom} onChange={(e) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, uom: e.target.value } : x)))} sx={{ width: 90 }} />
                <IconButton size="small" aria-label="ลบรายการ" disabled={items.length === 1} onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>
              </Stack>
            ))}
            <Button size="small" startIcon={<AddRoundedIcon />} onClick={() => setItems((p) => [...p, { ...EMPTY_ITEM }])} sx={{ alignSelf: 'flex-start' }}>เพิ่มรายการ</Button>
            <TextField size="small" label="หมายเหตุ" value={form.remark} onChange={(e) => setForm((p) => ({ ...p, remark: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setFormOpen(false)} disabled={saving}>ปิด</Button>
          <Button variant="contained" onClick={() => void saveDoc()} disabled={!formValid || saving}>{saving ? 'กำลังบันทึก…' : 'บันทึกเอกสาร'}</Button>
        </DialogActions>
      </Dialog>

      {/* CSV import */}
      <Dialog open={importOpen} onClose={importing ? undefined : () => setImportOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>นำเข้า {docType.toUpperCase()} จาก CSV</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">
              1 บรรทัด = 1 รายการสินค้า, บรรทัดที่เลขที่เอกสารเดียวกันรวมเป็นเอกสารเดียว. คอลัมน์ที่ต้องมี: <b>doc_no</b>, <b>partner_name</b> (รองรับหัวคอลัมน์ไทย เช่น เลขที่เอกสาร, ชื่อลูกค้า). ไม่บังคับ: partner_code, phone, due_date, sku, item_name, qty, uom, remark. บันทึกไฟล์เป็น CSV UTF-8
            </Alert>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Button variant="outlined" component="label" startIcon={<UploadFileRoundedIcon />} disabled={importing}>
                เลือกไฟล์ CSV
                <input ref={fileRef} hidden type="file" accept=".csv,text/csv" onChange={(e) => void onFile(e.target.files?.[0])} />
              </Button>
              <Typography variant="body2" color="text.secondary">{csvName || 'ยังไม่ได้เลือกไฟล์ (สูงสุด 2 MB)'}</Typography>
            </Stack>
            {importing ? <Skeleton variant="rounded" height={80} /> : null}
            {importError ? <Alert severity="error">{importError}</Alert> : null}
            {summary && !importing ? (
              <>
                <Alert severity={summary.errors.length + summary.failed.length > 0 ? 'warning' : 'success'}>
                  {imported
                    ? `นำเข้าแล้ว — ใหม่ ${summary.created} · อัปเดต ${summary.updated} · ไม่สำเร็จ ${summary.failed.length + summary.errors.length}`
                    : `อ่านได้ ${summary.rows} บรรทัด → ${summary.documents} เอกสารพร้อมนำเข้า · ข้าม ${summary.errors.length} บรรทัด`}
                  {summary.truncated ? ' · ไฟล์ยาวเกิน 5,000 บรรทัด ส่วนเกินถูกตัด' : ''}
                </Alert>
                {summary.errors.length + summary.failed.length > 0 ? (
                  <Box sx={{ maxHeight: 140, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}>
                    {summary.errors.map((e, i) => <Typography key={`e${i}`} variant="caption" display="block" color="error.main">บรรทัด {e.line}{e.doc_no ? ` (${e.doc_no})` : ''}: {e.message}</Typography>)}
                    {summary.failed.map((f, i) => <Typography key={`f${i}`} variant="caption" display="block" color="error.main">{f.doc_no}: {f.message}</Typography>)}
                  </Box>
                ) : null}
                {summary.preview.length > 0 ? (
                  <TableContainer sx={{ maxHeight: 260, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    <Table size="small" stickyHeader>
                      <TableHead><TableRow><TableCell>เลขที่</TableCell><TableCell>{meta.partner}</TableCell><TableCell>กำหนดส่ง</TableCell><TableCell align="right">รายการ</TableCell></TableRow></TableHead>
                      <TableBody>
                        {summary.preview.map((p) => <TableRow key={p.doc_no}><TableCell>{p.doc_no}</TableCell><TableCell>{p.partner}</TableCell><TableCell>{p.due_date ? formatDateDMY(p.due_date) : '-'}</TableCell><TableCell align="right">{p.items}</TableCell></TableRow>)}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : null}
              </>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setImportOpen(false)} disabled={importing}>ปิด</Button>
          {!imported ? (
            <Button variant="contained" disabled={importing || !summary || summary.documents === 0} onClick={() => void runImport(csvText, false)}>
              {importing ? 'กำลังนำเข้า…' : `นำเข้า ${summary?.documents ?? 0} เอกสาร`}
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
