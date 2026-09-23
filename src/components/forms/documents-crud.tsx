'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Card, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, MenuItem, Skeleton,
  Stack, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Tooltip, Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import QrCode2RoundedIcon from '@mui/icons-material/QrCode2Rounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { QrCode } from '@/components/ui/qr-code';
import { TablePaginationControls } from '@/components/ui/table-pagination-controls';
import { useToast } from '@/components/ui/toast';
import { PaymentDialog, type PaymentTarget } from '@/components/bookings/booking-action-dialogs';
import { STATUS_LABEL as BOOKING_STATUS_LABEL, hhmm } from '@/components/bookings/booking-types';
import { PAYMENT_COLOR, PAYMENT_LABEL, PAYMENT_STATUSES, isPaymentStatus, type PaymentStatus } from '@/lib/booking/payment';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { formatDateDMY, formatDateTimeDMY } from '@/lib/utils/date-format';
import { useBranchScope } from '@/components/layout/branch-scope-provider';

type DocType = 'so' | 'po';
type DocRow = {
  id: string; doc_type: DocType; doc_no: string; branch_id: string | null; branches?: { branch_name?: string | null; code?: string | null } | null; partner_name: string | null; partner_code: string | null; doc_date: string | null; due_date: string | null;
  status: 'open' | 'booked' | 'completed' | 'cancelled'; source: string; items: Array<{ name: string; qty: number; uom?: string }>; has_link: boolean; booking_count: number;
  partner_line_linked?: boolean; partner_line_name?: string | null;
  payment_status?: string | null; payment_ref?: string | null; payment_note?: string | null;
};
/** Anything unknown counts as unpaid, the same way the server treats it. */
function paymentStatusOf(d: Pick<DocRow, 'payment_status'>): PaymentStatus {
  return isPaymentStatus(d.payment_status) ? d.payment_status : 'unpaid';
}

/** `GET /api/documents/[id]` — the row plus its partner and every queue raised on it. */
type DocDetail = {
  id: string; doc_type: DocType; doc_no: string; branch_id: string | null; branches?: { branch_name?: string | null; code?: string | null } | null;
  partner_id: string | null; partner_code: string | null; partner_name: string | null; doc_date: string | null; due_date: string | null;
  status: DocRow['status']; source: string; items: Array<{ sku?: string; name: string; qty: number; uom?: string }>; total_qty: number | null; remark: string | null;
  booking_token_expires_at: string | null; imported_at: string | null; updated_at: string | null;
  customers?: { full_name?: string | null; phone?: string | null; email?: string | null; code?: string | null } | null;
  bookings: Array<{ id: string; queue_number: string | null; booking_date: string; start_time: string | null; end_time: string | null; status: string; plate_number: string | null; plate_number_actual: string | null; resource_name: string | null; do_number: string | null; services?: { service_name?: string | null } | null }>;
};

type PartnerOption = { id: string; code: string | null; full_name: string; phone: string | null };
type ItemDraft = { sku: string; name: string; qty: string; uom: string };
type DocForm = { doc_no: string; branch_id: string; partner_code: string; partner_name: string; partner_phone: string; doc_date: string; due_date: string; remark: string; payment_status: string };
type ImportSummary = {
  rows: number; documents: number; created: number; updated: number; truncated: boolean;
  errors: Array<{ line: number; doc_no: string | null; message: string }>;
  failed: Array<{ doc_no: string; message: string }>;
  preview: Array<{ doc_no: string; partner: string; items: number; due_date: string | null; branch?: string | null }>;
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
const EMPTY_FORM: DocForm = { doc_no: '', branch_id: '', partner_code: '', partner_name: '', partner_phone: '', doc_date: '', due_date: '', remark: '', payment_status: 'unpaid' };
const SOURCE_LABEL: Record<string, string> = { api: 'ERP', csv: 'CSV', manual: 'กรอกเอง' };

/** SO / PO: import, create or edit by hand, view detail, hand out the self-booking link, close or cancel. */
export function DocumentsCrud({ isAdmin }: { isAdmin: boolean }) {
  const { push } = useToast();
  const confirm = useConfirm();
  const { branches, branchId: scopedBranch, branchQuery } = useBranchScope();
  const [docType, setDocType] = useState<DocType>('so');
  const [status, setStatus] = useState('');
  const [payment, setPayment] = useState('');
  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget | null>(null);
  const [rows, setRows] = useState<DocRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [linkDoc, setLinkDoc] = useState<DocRow | null>(null);
  const [link, setLink] = useState<{ url: string; liff_url?: string | null; expires_at: string | null } | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [sendingLine, setSendingLine] = useState(false);

  const [viewDoc, setViewDoc] = useState<DocRow | null>(null);
  const [detail, setDetail] = useState<DocDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DocForm>(EMPTY_FORM);
  const [importBranch, setImportBranch] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([{ ...EMPTY_ITEM }]);
  const [saving, setSaving] = useState(false);
  const [partnerOptions, setPartnerOptions] = useState<PartnerOption[]>([]);
  const [partnerLoading, setPartnerLoading] = useState(false);
  const [pickedPartner, setPickedPartner] = useState<PartnerOption | null>(null);

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
      if (payment && docType === 'so') qs.set('payment', payment);
      const res = await fetch(`/api/documents?${qs}${branchQuery ? `&${branchQuery}` : ''}`, { cache: 'no-store' });
      const j = (await res.json()) as { data?: DocRow[]; pagination?: { total: number }; error?: string };
      if (!res.ok) throw new Error(j.error ?? 'โหลดเอกสารไม่สำเร็จ');
      setRows(j.data ?? []);
      setTotal(j.pagination?.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดเอกสารไม่สำเร็จ');
      setRows((prev) => prev ?? []);
    }
  }, [docType, status, payment, page, pageSize, q, branchQuery]);

  useEffect(() => { void load(); }, [load]);

  // Partner suggestions for the create form: matches name / code / phone, so one pick fills all three.
  useEffect(() => {
    if (!formOpen) return undefined;
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      setPartnerLoading(true);
      try {
        const qs = new URLSearchParams({ partner_type: docType === 'so' ? 'customer' : 'supplier', page_size: '10', q: form.partner_name.trim() });
        const res = await fetch(`/api/partners?${qs}`, { cache: 'no-store', signal: ctrl.signal });
        const j = (await res.json()) as { data?: PartnerOption[] };
        if (res.ok) setPartnerOptions(j.data ?? []);
      } catch {
        // aborted or offline — the field still accepts free text
      } finally {
        if (!ctrl.signal.aborted) setPartnerLoading(false);
      }
    }, 250);
    return () => { clearTimeout(id); ctrl.abort(); };
  }, [formOpen, docType, form.partner_name]);

  // ── booking link ───────────────────────────────────────────────────────────
  async function openLink(doc: DocRow, regenerate = false) {
    setLinkDoc(doc);
    if (!regenerate) setLink(null);
    setLinkBusy(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}/booking-link`, { method: regenerate ? 'POST' : 'GET', cache: 'no-store' });
      const j = (await res.json()) as { data?: { url: string; liff_url?: string | null; expires_at: string | null }; error?: string };
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

  async function sendLine() {
    if (!linkDoc || sendingLine) return;
    setSendingLine(true);
    try {
      const res = await fetch(`/api/documents/${linkDoc.id}/booking-link/send-line`, { method: 'POST' });
      const j = (await res.json().catch(() => ({}))) as { data?: { to_name?: string | null }; error?: string };
      if (!res.ok) { push(j.error ?? 'ส่ง LINE ไม่สำเร็จ', 'error'); return; }
      push(`ส่งลิงก์จองทาง LINE ให้ ${j.data?.to_name ?? 'คู่ค้า'} แล้ว`);
      void load();
    } finally {
      setSendingLine(false);
    }
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

  // ── detail ─────────────────────────────────────────────────────────────────
  /** One document with partner and queues; the list row is shown while it loads. */
  async function fetchDetail(id: string): Promise<DocDetail | null> {
    const res = await fetch(`/api/documents/${id}`, { cache: 'no-store' });
    const j = (await res.json().catch(() => ({}))) as { data?: DocDetail; error?: string };
    if (!res.ok || !j.data) throw new Error(j.error ?? 'โหลดเอกสารไม่สำเร็จ');
    return j.data;
  }

  async function openDetail(doc: DocRow) {
    setViewDoc(doc);
    setDetail(null);
    setDetailError(null);
    try {
      setDetail(await fetchDetail(doc.id));
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : 'โหลดเอกสารไม่สำเร็จ');
    }
  }

  // ── manual create / edit ───────────────────────────────────────────────────
  const needBranch = branches.length > 1;
  const formValid = form.doc_no.trim() && form.partner_name.trim() && (!needBranch || form.branch_id);
  const defaultBranch = scopedBranch || (branches.length === 1 ? branches[0].id : '');

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, branch_id: defaultBranch });
    setItems([{ ...EMPTY_ITEM }]);
    setPickedPartner(null);
    setPartnerOptions([]);
    setFormOpen(true);
  }

  /** Prefill the form from the server row so a save never drops a field the list does not carry (phone, doc_date). */
  async function openEdit(doc: DocRow) {
    let d: DocDetail | null = detail && detail.id === doc.id ? detail : null;
    if (!d) {
      try {
        d = await fetchDetail(doc.id);
      } catch (e) {
        push(e instanceof Error ? e.message : 'โหลดเอกสารไม่สำเร็จ', 'error');
        return;
      }
    }
    if (!d) return;
    setEditingId(d.id);
    setForm({
      doc_no: d.doc_no,
      branch_id: d.branch_id ?? defaultBranch,
      partner_code: d.partner_code ?? d.customers?.code ?? '',
      partner_name: d.partner_name ?? d.customers?.full_name ?? '',
      partner_phone: d.customers?.phone ?? '',
      doc_date: d.doc_date ?? '',
      due_date: d.due_date ?? '',
      remark: d.remark ?? '',
      payment_status: paymentStatusOf(doc),
    });
    setItems(d.items.length > 0 ? d.items.map((i) => ({ sku: i.sku ?? '', name: i.name, qty: String(i.qty), uom: i.uom ?? '' })) : [{ ...EMPTY_ITEM }]);
    setPickedPartner(null);
    setPartnerOptions([]);
    setViewDoc(null);
    setFormOpen(true);
  }

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
          branch_id: form.branch_id || null,
          partner: { code: form.partner_code, name: form.partner_name, phone: form.partner_phone },
          doc_date: form.doc_date,
          due_date: form.due_date,
          remark: form.remark,
          ...(docType === 'so' ? { payment_status: form.payment_status } : {}),
          items: items.filter((i) => i.name.trim()).map((i) => ({ sku: i.sku, name: i.name, qty: i.qty || '1', uom: i.uom })),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; data?: { created?: boolean; warnings?: string[] } };
      if (!res.ok) { push(j.error ?? 'บันทึกไม่สำเร็จ', 'error'); return; }
      if (j.data?.warnings?.includes('payment_downgrade_ignored')) push('เอกสารมีคิวที่อนุมัติแล้ว จึงเปลี่ยนกลับเป็นยังไม่ชำระไม่ได้ — ส่วนอื่นบันทึกแล้ว', 'error');
      else if (editingId) push('บันทึกการแก้ไขแล้ว');
      else push(j.data?.created ? 'เพิ่มเอกสารแล้ว' : 'อัปเดตเอกสารเดิมแล้ว (เลขที่ซ้ำ)');
      setFormOpen(false);
      setEditingId(null);
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
      const res = await fetch('/api/documents/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ doc_type: docType, csv: text, dry_run: dryRun, branch_id: importBranch || null }) });
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
            <Button variant="outlined" startIcon={<UploadFileRoundedIcon />} onClick={() => { resetImport(); setImportBranch(scopedBranch || (branches.length === 1 ? branches[0].id : '')); setImportOpen(true); }}>นำเข้า CSV</Button>
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>เพิ่ม {docType.toUpperCase()}</Button>
          </Stack>
        ) : undefined}
      />
      <Card>
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} justifyContent="space-between" spacing={1} sx={{ px: 2, pt: 1 }}>
          <Tabs value={docType} onChange={(_, v: DocType) => { setDocType(v); setPage(1); setRows(null); }}>
            <Tab value="so" label="SO · ลูกค้ารับสินค้า" />
            <Tab value="po" label="PO · Supplier ส่งสินค้า" />
          </Tabs>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {docType === 'so' ? (
              <TextField id="doc-payment-filter" select size="small" value={payment} onChange={(e) => { setPayment(e.target.value); setPage(1); }} slotProps={{ select: { displayEmpty: true } }} sx={{ minWidth: 150 }}>
                <MenuItem value="">ทุกการชำระเงิน</MenuItem>
                {PAYMENT_STATUSES.map((p) => <MenuItem key={p} value={p}>{PAYMENT_LABEL[p]}</MenuItem>)}
              </TextField>
            ) : null}
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
                  <TableCell>เลขที่</TableCell><TableCell>{meta.partner}</TableCell><TableCell>สาขา</TableCell><TableCell>กำหนดส่ง</TableCell><TableCell align="right">รายการ</TableCell>
                  <TableCell align="right">คิว</TableCell>{docType === 'so' ? <TableCell>ชำระเงิน</TableCell> : null}<TableCell>สถานะ</TableCell><TableCell align="right">จัดการ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((d) => {
                  const live = d.status === 'open' || d.status === 'booked';
                  return (
                    <TableRow key={d.id} hover>
                      <TableCell>
                        <Typography component="button" type="button" variant="body2" fontWeight={700} onClick={() => void openDetail(d)} sx={{ p: 0, border: 0, bgcolor: 'transparent', color: 'primary.main', cursor: 'pointer', textAlign: 'left', '&:hover': { textDecoration: 'underline' } }}>{d.doc_no}</Typography>
                        <Typography variant="caption" color="text.secondary" display="block">{SOURCE_LABEL[d.source] ?? d.source}</Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 260 }}><Typography variant="body2" noWrap>{d.partner_name ?? '-'}</Typography><Typography variant="caption" color="text.secondary">{d.partner_code ?? ''}</Typography></TableCell>
                      <TableCell>{d.branches?.branch_name ?? <Typography variant="caption" color="text.disabled">ค่าเริ่มต้น</Typography>}</TableCell>
                      <TableCell>{d.due_date ? formatDateDMY(d.due_date) : '-'}</TableCell>
                      <TableCell align="right">{d.items?.length ?? 0}</TableCell>
                      <TableCell align="right">{d.booking_count > 0 ? <Button size="small" href={`/portal/bookings?doc=${d.id}`}>{d.booking_count}</Button> : 0}</TableCell>
                      {docType === 'so' ? (
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Tooltip title={d.payment_ref ? `อ้างอิง ${d.payment_ref}` : live ? 'คลิกเพื่อบันทึกการชำระเงิน' : ''}>
                            <Chip
                              size="small"
                              color={PAYMENT_COLOR[paymentStatusOf(d)]}
                              variant={paymentStatusOf(d) === 'unpaid' ? 'filled' : 'outlined'}
                              label={PAYMENT_LABEL[paymentStatusOf(d)]}
                              onClick={live ? () => setPaymentTarget(d) : undefined}
                            />
                          </Tooltip>
                        </TableCell>
                      ) : null}
                      <TableCell><Chip size="small" color={STATUS[d.status].color} variant={d.status === 'open' ? 'outlined' : 'filled'} label={STATUS[d.status].label} /></TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        {docType === 'so' && live && paymentStatusOf(d) === 'unpaid' ? <Button size="small" color="success" variant="outlined" sx={{ mr: 0.5 }} onClick={() => setPaymentTarget(d)}>บันทึกชำระเงิน</Button> : null}
                        {isAdmin && live ? <Button size="small" variant={d.has_link ? 'text' : 'contained'} startIcon={<QrCode2RoundedIcon />} onClick={() => void openLink(d)}>{d.has_link ? 'ดูลิงก์' : 'ส่งลิงก์จอง'}</Button> : null}
                        {isAdmin && live ? <Tooltip title="แก้ไข"><IconButton size="small" onClick={() => void openEdit(d)} aria-label="แก้ไข"><EditRoundedIcon fontSize="small" /></IconButton></Tooltip> : null}
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

      <PaymentDialog
        target={paymentTarget}
        onClose={() => setPaymentTarget(null)}
        onSaved={(r) => {
          push(r.unlocked.length > 0 ? `บันทึกการชำระเงินแล้ว — คิว ${r.unlocked.join(', ')} อนุมัติได้แล้ว` : 'บันทึกการชำระเงินแล้ว');
          setPaymentTarget(null);
          void load();
        }}
      />

      {/* Booking link */}
      <Dialog open={Boolean(linkDoc)} onClose={() => setLinkDoc(null)} fullWidth maxWidth="xs">
        <DialogTitle>ลิงก์จองคิว · {linkDoc?.doc_no}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} alignItems="center" sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary" textAlign="center">{linkDoc ? TYPE_META[linkDoc.doc_type].hint : ''} — ส่งทาง LINE / อีเมล หรือให้สแกน QR</Typography>
            {linkDoc?.partner_line_linked ? <Chip size="small" color="success" label={`คู่ค้าผูก LINE แล้ว: ${linkDoc.partner_line_name ?? ''}`} /> : <Chip size="small" variant="outlined" label="คู่ค้ายังไม่ได้ผูก LINE — จะผูกเองเมื่อเปิดลิงก์ผ่าน LINE ครั้งแรก" />}
            {link ? (
              <>
                <Box sx={{ p: 1.5, bgcolor: '#fff', borderRadius: 2, border: 1, borderColor: 'divider' }}><QrCode value={link.liff_url ?? link.url} size={220} alt="ลิงก์จองคิว" /></Box>
                {link.liff_url ? <TextField fullWidth size="small" label="ลิงก์สำหรับส่งใน LINE (ผูกบัญชีอัตโนมัติ)" value={link.liff_url} slotProps={{ input: { readOnly: true } }} /> : null}
                <TextField fullWidth size="small" label={link.liff_url ? 'ลิงก์เว็บ (อีเมล / SMS / ช่องทางอื่น)' : 'ลิงก์จอง'} value={link.url} slotProps={{ input: { readOnly: true } }} />
                {link.expires_at ? <Typography variant="caption" color="text.secondary">ใช้ได้ถึง {formatDateTimeDMY(link.expires_at)}</Typography> : null}
              </>
            ) : <Skeleton variant="rounded" width={220} height={220} />}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 0.5 }}>
          <Button color="inherit" disabled={linkBusy || !link} onClick={() => void regenerateLink()}>สร้างลิงก์ใหม่</Button>
          {linkDoc?.partner_line_linked ? <Button variant="outlined" color="success" disabled={sendingLine || !link} onClick={() => void sendLine()}>{sendingLine ? 'กำลังส่ง…' : 'ส่งทาง LINE'}</Button> : null}
          <Button variant="contained" startIcon={<ContentCopyRoundedIcon />} disabled={!link} onClick={() => link && void copy(link.liff_url ?? link.url)}>คัดลอกลิงก์</Button>
        </DialogActions>
      </Dialog>

      {/* Manual create / edit */}
      <Dialog open={formOpen} onClose={saving ? undefined : () => setFormOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingId ? `แก้ไข ${docType.toUpperCase()} ${form.doc_no}` : `เพิ่ม ${meta.label}`}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {editingId && detail?.source === 'api' ? <Alert severity="warning">เอกสารนี้มาจาก ERP — ค่าที่แก้ที่นี่จะถูกทับเมื่อ ERP ส่งเอกสารเลขนี้มาอีกครั้ง</Alert> : null}
            <TextField select required={needBranch} size="small" label="สาขา / คลังที่รับ-ส่งสินค้า" value={form.branch_id} onChange={(e) => setForm((p) => ({ ...p, branch_id: e.target.value }))} helperText={editingId ? 'เปลี่ยนสาขาไม่ได้ขณะมีคิวที่ยังไม่ปิด' : 'ลูกค้าจะเห็นเฉพาะท่าและเวลาทำการของสาขานี้'}>
              {branches.map((b) => <MenuItem key={b.id} value={b.id}>{b.branch_name}{b.active === false ? ' (ปิด)' : ''}</MenuItem>)}
            </TextField>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField autoFocus={!editingId} required fullWidth size="small" label={`เลขที่ ${docType.toUpperCase()}`} value={form.doc_no} onChange={(e) => setForm((p) => ({ ...p, doc_no: e.target.value }))} disabled={Boolean(editingId)} helperText={editingId ? 'เปลี่ยนเลขที่ไม่ได้' : 'เลขที่ซ้ำ = อัปเดตเอกสารเดิม'} />
              <TextField fullWidth size="small" type="date" label="วันที่เอกสาร" value={form.doc_date} onChange={(e) => setForm((p) => ({ ...p, doc_date: e.target.value }))} slotProps={{ inputLabel: { shrink: true } }} />
              <TextField fullWidth size="small" type="date" label="กำหนดส่ง" value={form.due_date} onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))} slotProps={{ inputLabel: { shrink: true } }} />
            </Stack>
            {docType === 'so' ? (
              <TextField id="doc-payment-status" select fullWidth size="small" label="สถานะการชำระเงิน" value={form.payment_status} onChange={(e) => setForm((p) => ({ ...p, payment_status: e.target.value }))} helperText={editingId ? 'เปลี่ยนกลับเป็นยังไม่ชำระได้เฉพาะเมื่อยังไม่มีคิวที่อนุมัติแล้ว' : 'ยังไม่ชำระ = ลูกค้าจองได้ แต่อนุมัติคิวไม่ได้'}>
                {PAYMENT_STATUSES.map((p) => <MenuItem key={p} value={p}>{PAYMENT_LABEL[p]}</MenuItem>)}
              </TextField>
            ) : null}
            <Autocomplete<PartnerOption, false, false, true>
              freeSolo
              fullWidth
              size="small"
              options={partnerOptions}
              loading={partnerLoading}
              filterOptions={(x) => x}
              inputValue={form.partner_name}
              getOptionLabel={(o) => (typeof o === 'string' ? o : o.full_name)}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              loadingText="กำลังค้นหา…"
              onInputChange={(_, v, reason) => { if (reason === 'reset' && !v) return; setForm((p) => ({ ...p, partner_name: v })); }}
              onChange={(_, v) => {
                if (!v || typeof v === 'string') { setPickedPartner(null); return; }
                setPickedPartner(v);
                setForm((p) => ({ ...p, partner_name: v.full_name, partner_code: v.code ?? '', partner_phone: v.phone ?? '' }));
              }}
              renderOption={(props, o) => {
                // MUI puts `key` inside props; React refuses a spread key, so take it out first.
                const rest: Record<string, unknown> = { ...props };
                delete rest.key;
                return (
                  <Box component="li" key={o.id} {...rest}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" noWrap>{o.full_name}</Typography>
                      <Typography variant="caption" color="text.secondary">{[o.code, o.phone].filter(Boolean).join(' · ') || 'ไม่มีรหัส / เบอร์โทร'}</Typography>
                    </Box>
                  </Box>
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  required
                  label={`ชื่อ${meta.partner}`}
                  placeholder="พิมพ์ชื่อ รหัส หรือเบอร์โทรเพื่อค้นหา"
                  helperText={
                    pickedPartner && pickedPartner.full_name === form.partner_name
                      ? `${meta.partner}เดิมในระบบ — เติมรหัสและเบอร์โทรให้แล้ว`
                      : form.partner_name.trim()
                        ? `ไม่ได้เลือกจากรายการ = บันทึกเป็น${meta.partner}ใหม่ให้อัตโนมัติ`
                        : `เลือก${meta.partner}เดิมจากรายการ ไม่ต้องกรอกรหัส / เบอร์โทรซ้ำ`
                  }
                />
              )}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField fullWidth size="small" label={`รหัส${meta.partner}`} value={form.partner_code} onChange={(e) => setForm((p) => ({ ...p, partner_code: e.target.value }))} />
              <TextField fullWidth size="small" type="tel" label="เบอร์โทร" placeholder="08x-xxx-xxxx" value={form.partner_phone} onChange={(e) => setForm((p) => ({ ...p, partner_phone: e.target.value }))} slotProps={{ htmlInput: { inputMode: 'tel' } }} />
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
          <Button variant="contained" onClick={() => void saveDoc()} disabled={!formValid || saving}>{saving ? 'กำลังบันทึก…' : editingId ? 'บันทึกการแก้ไข' : 'บันทึกเอกสาร'}</Button>
        </DialogActions>
      </Dialog>

      {/* Detail */}
      <Dialog open={Boolean(viewDoc)} onClose={() => setViewDoc(null)} fullWidth maxWidth="md">
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
            <span>{viewDoc?.doc_type.toUpperCase()} {viewDoc?.doc_no}</span>
            {viewDoc ? <Chip size="small" color={STATUS[viewDoc.status].color} variant={viewDoc.status === 'open' ? 'outlined' : 'filled'} label={STATUS[viewDoc.status].label} /> : null}
            {viewDoc?.doc_type === 'so' ? <Chip size="small" color={PAYMENT_COLOR[paymentStatusOf(viewDoc)]} variant="outlined" label={PAYMENT_LABEL[paymentStatusOf(viewDoc)]} /> : null}
          </Stack>
        </DialogTitle>
        <DialogContent>
          {detailError ? <Alert severity="error" action={viewDoc ? <Button color="inherit" size="small" onClick={() => void openDetail(viewDoc)}>ลองใหม่</Button> : undefined}>{detailError}</Alert> : null}
          {!detail && !detailError ? <Stack spacing={1} sx={{ pt: 1 }}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={40} />)}</Stack> : null}
          {detail ? (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 1.5 }}>
                {([
                  [viewDoc ? TYPE_META[viewDoc.doc_type].partner : 'คู่ค้า', detail.partner_name ?? detail.customers?.full_name ?? '-'],
                  ['รหัสคู่ค้า', detail.partner_code ?? detail.customers?.code ?? '-'],
                  ['เบอร์โทร', detail.customers?.phone ?? '-'],
                  ['อีเมล', detail.customers?.email ?? '-'],
                  ['สาขา', detail.branches?.branch_name ?? 'ค่าเริ่มต้น'],
                  ['ที่มา', SOURCE_LABEL[detail.source] ?? detail.source],
                  ['วันที่เอกสาร', detail.doc_date ? formatDateDMY(detail.doc_date) : '-'],
                  ['กำหนดส่ง', detail.due_date ? formatDateDMY(detail.due_date) : '-'],
                  ['อัปเดตล่าสุด', detail.updated_at ? formatDateTimeDMY(detail.updated_at) : detail.imported_at ? formatDateTimeDMY(detail.imported_at) : '-'],
                  ['ลิงก์จองใช้ได้ถึง', detail.booking_token_expires_at ? formatDateTimeDMY(detail.booking_token_expires_at) : 'ยังไม่ออกลิงก์'],
                ] as Array<[string, string]>).map(([label, value]) => (
                  <Box key={label}>
                    <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
                    <Typography variant="body2" fontWeight={600} sx={{ wordBreak: 'break-word' }}>{value}</Typography>
                  </Box>
                ))}
              </Box>
              {detail.remark ? (
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">หมายเหตุ</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{detail.remark}</Typography>
                </Box>
              ) : null}

              <Typography variant="subtitle2" fontWeight={700}>รายการสินค้า ({detail.items.length}){detail.total_qty != null ? ` · รวม ${detail.total_qty.toLocaleString('th-TH')}` : ''}</Typography>
              {detail.items.length === 0 ? <Typography variant="body2" color="text.secondary">ไม่มีรายการสินค้า</Typography> : (
                <TableContainer sx={{ maxHeight: 260, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                  <Table size="small" stickyHeader>
                    <TableHead><TableRow><TableCell>#</TableCell><TableCell>รหัส</TableCell><TableCell>ชื่อสินค้า</TableCell><TableCell align="right">จำนวน</TableCell><TableCell>หน่วย</TableCell></TableRow></TableHead>
                    <TableBody>
                      {detail.items.map((it, i) => (
                        <TableRow key={`${it.sku ?? ''}-${i}`}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell>{it.sku || '-'}</TableCell>
                          <TableCell>{it.name}</TableCell>
                          <TableCell align="right">{Number(it.qty).toLocaleString('th-TH')}</TableCell>
                          <TableCell>{it.uom || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              <Typography variant="subtitle2" fontWeight={700}>คิว ({detail.bookings.length})</Typography>
              {detail.bookings.length === 0 ? <Typography variant="body2" color="text.secondary">ยังไม่มีคิวจากเอกสารนี้</Typography> : (
                <TableContainer sx={{ maxHeight: 220, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                  <Table size="small" stickyHeader>
                    <TableHead><TableRow><TableCell>คิว</TableCell><TableCell>วัน / เวลา</TableCell><TableCell>ท่า</TableCell><TableCell>ทะเบียน</TableCell><TableCell>DO</TableCell><TableCell>สถานะ</TableCell></TableRow></TableHead>
                    <TableBody>
                      {detail.bookings.map((b) => (
                        <TableRow key={b.id} hover>
                          <TableCell><Button size="small" href={`/portal/bookings?doc=${detail.id}`}>{b.queue_number ?? '-'}</Button></TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateDMY(b.booking_date)} {hhmm(b.start_time)}{b.end_time ? `–${hhmm(b.end_time)}` : ''}</TableCell>
                          <TableCell>{b.resource_name ?? '-'}{b.services?.service_name ? <Typography variant="caption" color="text.secondary" display="block">{b.services.service_name}</Typography> : null}</TableCell>
                          <TableCell>{b.plate_number_actual ?? b.plate_number ?? '-'}</TableCell>
                          <TableCell>{b.do_number ?? '-'}</TableCell>
                          <TableCell><Chip size="small" variant="outlined" label={(BOOKING_STATUS_LABEL as Record<string, string>)[b.status] ?? b.status} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 0.5 }}>
          <Button color="inherit" onClick={() => setViewDoc(null)}>ปิด</Button>
          {viewDoc && isAdmin && (viewDoc.status === 'open' || viewDoc.status === 'booked') ? (
            <>
              <Button startIcon={<QrCode2RoundedIcon />} onClick={() => { const d = viewDoc; setViewDoc(null); void openLink(d); }}>{viewDoc.has_link ? 'ดูลิงก์จอง' : 'ส่งลิงก์จอง'}</Button>
              <Button variant="contained" startIcon={<EditRoundedIcon />} disabled={!detail} onClick={() => void openEdit(viewDoc)}>แก้ไข</Button>
            </>
          ) : null}
        </DialogActions>
      </Dialog>

      {/* CSV import */}
      <Dialog open={importOpen} onClose={importing ? undefined : () => setImportOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>นำเข้า {docType.toUpperCase()} จาก CSV</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">
              1 บรรทัด = 1 รายการสินค้า, บรรทัดที่เลขที่เอกสารเดียวกันรวมเป็นเอกสารเดียว. คอลัมน์ที่ต้องมี: <b>doc_no</b>, <b>partner_name</b> (รองรับหัวคอลัมน์ไทย เช่น เลขที่เอกสาร, ชื่อลูกค้า). ไม่บังคับ: <b>branch</b> (รหัสหรือชื่อสาขา), <b>payment_status</b> (SO: paid / unpaid / credit หรือ ชำระแล้ว / ยังไม่ชำระ / เครดิต — เว้นว่าง = ไม่เปลี่ยนค่าเดิม), partner_code, phone, due_date, sku, item_name, qty, uom, remark. บันทึกไฟล์เป็น CSV UTF-8
            </Alert>
            <TextField select size="small" label="สาขาสำหรับบรรทัดที่ไม่มีคอลัมน์สาขา" value={importBranch} onChange={(e) => setImportBranch(e.target.value)} sx={{ maxWidth: 360 }} slotProps={{ select: { displayEmpty: true } }}>
              <MenuItem value="">ค่าเริ่มต้นของคลัง</MenuItem>
              {branches.map((b) => <MenuItem key={b.id} value={b.id}>{b.branch_name}</MenuItem>)}
            </TextField>
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
                      <TableHead><TableRow><TableCell>เลขที่</TableCell><TableCell>{meta.partner}</TableCell><TableCell>สาขา</TableCell><TableCell>กำหนดส่ง</TableCell><TableCell align="right">รายการ</TableCell></TableRow></TableHead>
                      <TableBody>
                        {summary.preview.map((p) => <TableRow key={p.doc_no}><TableCell>{p.doc_no}</TableCell><TableCell>{p.partner}</TableCell><TableCell>{p.branch ?? (branches.find((b) => b.id === importBranch)?.branch_name ?? 'ค่าเริ่มต้น')}</TableCell><TableCell>{p.due_date ? formatDateDMY(p.due_date) : '-'}</TableCell><TableCell align="right">{p.items}</TableCell></TableRow>)}
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
