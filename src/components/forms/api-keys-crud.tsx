'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, Collapse, Dialog, DialogActions, DialogContent, DialogTitle, IconButton,
  Skeleton, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { CopyField } from '@/components/ui/copy-field';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { formatDateTimeDMY } from '@/lib/utils/date-format';

type KeyRow = {
  id: string; name: string; key_prefix: string; scopes: string[]; last_used_at: string | null; last_used_ip: string | null;
  active: boolean; created_at: string; revoked_at: string | null;
};

type LogRow = {
  id: string; doc_type: 'so' | 'po'; request_id: string | null; received_at: string; duration_ms: number | null;
  status: 'ok' | 'partial' | 'failed' | 'rejected'; count_received: number; count_created: number; count_updated: number; count_failed: number;
  error_summary: string | null; failures: Array<{ index: number; doc_no: string | null; code: string; message: string }> | null;
  dry_run: boolean; source_ip: string | null; key_name: string | null; key_prefix: string | null;
};

const LOG_STATUS: Record<LogRow['status'], { label: string; color: 'success' | 'warning' | 'error' | 'default' }> = {
  ok: { label: 'สำเร็จ', color: 'success' },
  partial: { label: 'สำเร็จบางส่วน', color: 'warning' },
  failed: { label: 'ไม่สำเร็จ', color: 'error' },
  rejected: { label: 'ปฏิเสธคำขอ', color: 'error' },
};

function Section({ title, hint, action, children }: { title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card><CardContent>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
          {hint ? <Typography variant="body2" color="text.secondary">{hint}</Typography> : null}
        </Box>
        {action}
      </Stack>
      <Box sx={{ mt: 2 }}>{children}</Box>
    </CardContent></Card>
  );
}

async function readJson<T>(res: Response, fallback: string): Promise<T> {
  const j = (await res.json().catch(() => ({}))) as { data?: T; error?: string };
  if (!res.ok || j.data === undefined) throw new Error(j.error ?? fallback);
  return j.data;
}

/** ERP integration: API keys for the push endpoints + the log of what the ERP sent. Admin only. */
export function ApiKeysCrud() {
  const { push } = useToast();
  const confirm = useConfirm();
  const [keys, setKeys] = useState<KeyRow[] | null>(null);
  const [keysError, setKeysError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogRow[] | null>(null);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [issued, setIssued] = useState<{ name: string; raw_key: string } | null>(null);
  const [openLog, setOpenLog] = useState<string | null>(null);

  const baseUrl = useMemo(() => (typeof window === 'undefined' ? '' : window.location.origin), []);

  const loadKeys = useCallback(async () => {
    setKeysError(null);
    try {
      setKeys(await readJson<KeyRow[]>(await fetch('/api/api-keys', { cache: 'no-store' }), 'โหลด API key ไม่สำเร็จ'));
    } catch (e) {
      setKeysError(e instanceof Error ? e.message : 'โหลด API key ไม่สำเร็จ');
      setKeys((prev) => prev ?? []);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLogsError(null);
    try {
      setLogs(await readJson<LogRow[]>(await fetch('/api/integration-logs?limit=50', { cache: 'no-store' }), 'โหลดประวัติไม่สำเร็จ'));
    } catch (e) {
      setLogsError(e instanceof Error ? e.message : 'โหลดประวัติไม่สำเร็จ');
      setLogs((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => { void loadKeys(); void loadLogs(); }, [loadKeys, loadLogs]);

  async function createKey() {
    if (newName.trim().length < 2) { push('ตั้งชื่อ key อย่างน้อย 2 ตัวอักษร', 'error'); return; }
    setCreating(true);
    try {
      const data = await readJson<KeyRow & { raw_key: string }>(
        await fetch('/api/api-keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName.trim() }) }),
        'สร้าง key ไม่สำเร็จ',
      );
      setCreateOpen(false);
      setNewName('');
      setIssued({ name: data.name, raw_key: data.raw_key });
      await loadKeys();
    } catch (e) {
      push(e instanceof Error ? e.message : 'สร้าง key ไม่สำเร็จ', 'error');
    } finally {
      setCreating(false);
    }
  }

  async function revoke(row: KeyRow) {
    const ok = await confirm({
      tone: 'error',
      title: `เพิกถอน key "${row.name}"?`,
      description: 'ระบบ ERP ที่ใช้ key นี้จะส่งข้อมูลไม่ได้ทันที และย้อนกลับไม่ได้ — ต้องสร้าง key ใหม่แล้วนำไปตั้งค่าใน ERP',
      confirmLabel: 'เพิกถอน',
    });
    if (!ok) return;
    try {
      await readJson(await fetch(`/api/api-keys/${row.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: false }) }), 'เพิกถอนไม่สำเร็จ');
      push('เพิกถอน key แล้ว');
      await loadKeys();
    } catch (e) {
      push(e instanceof Error ? e.message : 'เพิกถอนไม่สำเร็จ', 'error');
    }
  }

  return (
    <Box>
      <PageHeader
        title="เชื่อมต่อ ERP"
        description="รับใบสั่งขาย (SO) และใบสั่งซื้อ (PO) จาก Dynamics AX โดยอัตโนมัติผ่าน API — ฝั่ง ERP ต้องส่งข้อมูลมาพร้อม API key ที่สร้างจากหน้านี้"
        action={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setCreateOpen(true)}>สร้าง API key</Button>}
      />

      <Stack spacing={2.5}>
        <Section title="ปลายทางสำหรับ ERP" hint="ส่งเป็น JSON ผ่าน HTTPS ใส่ header X-API-Key ทุกครั้ง รายละเอียด payload อยู่ในเอกสาร docs/integration/ERP-API-v1.md">
          <Stack spacing={1.5}>
            <CopyField label="ทดสอบการเชื่อมต่อ (GET)" value={`${baseUrl}/api/integration/v1/health`} monospace />
            <CopyField label="ใบสั่งขาย SO (POST)" value={`${baseUrl}/api/integration/v1/sales-orders`} monospace />
            <CopyField label="ใบสั่งซื้อ PO (POST)" value={`${baseUrl}/api/integration/v1/purchase-orders`} monospace />
            <Typography variant="caption" color="text.secondary">
              เพิ่ม <code>?dry_run=1</code> ท้าย URL เพื่อตรวจข้อมูลโดยไม่บันทึก · ส่งได้สูงสุด 100 เอกสาร / 1 MB ต่อครั้ง · ผลลัพธ์รายเอกสารอยู่ใน <code>results[]</code>
            </Typography>
          </Stack>
        </Section>

        <Section title="API keys" hint="แสดงเฉพาะส่วนต้นของ key — ค่าเต็มแสดงครั้งเดียวตอนสร้าง">
          {keysError ? <Alert severity="error" sx={{ mb: 1.5 }} action={<Button size="small" onClick={() => void loadKeys()}>ลองใหม่</Button>}>{keysError}</Alert> : null}
          {keys === null ? (
            <Stack spacing={1}><Skeleton height={36} /><Skeleton height={36} /></Stack>
          ) : keys.length === 0 ? (
            <EmptyState title="ยังไม่มี API key" description="สร้าง key แล้วส่งให้ทีม IT ของ Fameline ตั้งค่าใน Dynamics AX" actionLabel="สร้าง API key" onAction={() => setCreateOpen(true)} icon="🔑" />
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ชื่อ</TableCell>
                    <TableCell>Key</TableCell>
                    <TableCell>สิทธิ์</TableCell>
                    <TableCell>ใช้ล่าสุด</TableCell>
                    <TableCell>สถานะ</TableCell>
                    <TableCell align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {keys.map((k) => (
                    <TableRow key={k.id} hover sx={{ opacity: k.active ? 1 : 0.6 }}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{k.name}</Typography>
                        <Typography variant="caption" color="text.secondary">สร้าง {formatDateTimeDMY(k.created_at)}</Typography>
                      </TableCell>
                      <TableCell><code>{k.key_prefix}…</code></TableCell>
                      <TableCell><Stack direction="row" spacing={0.5} flexWrap="wrap">{(k.scopes ?? []).map((s) => <Chip key={s} size="small" label={s} />)}</Stack></TableCell>
                      <TableCell>
                        {k.last_used_at ? (
                          <>
                            <Typography variant="body2">{formatDateTimeDMY(k.last_used_at)}</Typography>
                            {k.last_used_ip ? <Typography variant="caption" color="text.secondary">{k.last_used_ip}</Typography> : null}
                          </>
                        ) : <Typography variant="body2" color="text.secondary">ยังไม่เคยใช้</Typography>}
                      </TableCell>
                      <TableCell>
                        {k.active
                          ? <Chip size="small" color="success" label="ใช้งาน" />
                          : <Tooltip title={k.revoked_at ? `เพิกถอน ${formatDateTimeDMY(k.revoked_at)}` : ''}><Chip size="small" label="เพิกถอนแล้ว" /></Tooltip>}
                      </TableCell>
                      <TableCell align="right">
                        {k.active ? (
                          <Tooltip title="เพิกถอน key">
                            <IconButton size="small" color="error" onClick={() => void revoke(k)}><BlockRoundedIcon fontSize="small" /></IconButton>
                          </Tooltip>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </Section>

        <Section
          title="ประวัติการรับข้อมูลจาก ERP"
          hint="50 คำขอล่าสุด — คลิกแถวเพื่อดูเอกสารที่ไม่สำเร็จ (เก็บ 90 วัน)"
          action={<Button size="small" startIcon={<RefreshRoundedIcon />} onClick={() => void loadLogs()}>รีเฟรช</Button>}
        >
          {logsError ? <Alert severity="error" sx={{ mb: 1.5 }} action={<Button size="small" onClick={() => void loadLogs()}>ลองใหม่</Button>}>{logsError}</Alert> : null}
          {logs === null ? (
            <Stack spacing={1}><Skeleton height={36} /><Skeleton height={36} /><Skeleton height={36} /></Stack>
          ) : logs.length === 0 ? (
            <EmptyState title="ยังไม่มีข้อมูลเข้าจาก ERP" description="เมื่อ Dynamics AX ส่ง SO/PO เข้ามา แต่ละคำขอจะปรากฏที่นี่พร้อมผลรายเอกสาร" icon="🔄" />
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell />
                    <TableCell>เวลา</TableCell>
                    <TableCell>ประเภท</TableCell>
                    <TableCell>สถานะ</TableCell>
                    <TableCell align="right">รับ</TableCell>
                    <TableCell align="right">ใหม่</TableCell>
                    <TableCell align="right">อัปเดต</TableCell>
                    <TableCell align="right">ไม่สำเร็จ</TableCell>
                    <TableCell>Key</TableCell>
                    <TableCell>Request id</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.map((l) => {
                    const st = LOG_STATUS[l.status];
                    const expandable = Boolean(l.error_summary) || Boolean(l.failures && l.failures.length > 0);
                    const open = openLog === l.id;
                    return (
                      <LogRows key={l.id} row={l} status={st} expandable={expandable} open={open} onToggle={() => setOpenLog(open ? null : l.id)} />
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
          )}
        </Section>
      </Stack>

      <Dialog open={createOpen} onClose={() => (creating ? null : setCreateOpen(false))} fullWidth maxWidth="xs">
        <DialogTitle>สร้าง API key</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus fullWidth margin="dense" label="ชื่อ (เช่น AX Production)" value={newName}
            onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void createKey(); }}
            helperText="สิทธิ์: documents:write (ส่ง SO/PO)"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} disabled={creating}>ยกเลิก</Button>
          <Button variant="contained" onClick={() => void createKey()} disabled={creating}>{creating ? 'กำลังสร้าง…' : 'สร้าง'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(issued)} onClose={() => setIssued(null)} fullWidth maxWidth="sm">
        <DialogTitle>API key &ldquo;{issued?.name}&rdquo;</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <Alert severity="warning">คัดลอกเก็บไว้ตอนนี้ — ระบบจะไม่แสดงค่านี้อีก หากทำหาย ให้เพิกถอนแล้วสร้างใหม่</Alert>
            {issued ? <CopyField label="API key" value={issued.raw_key} monospace /> : null}
            <Typography variant="body2" color="text.secondary">ส่งให้ทีม IT ทางช่องทางที่ปลอดภัย และตั้งค่าเป็น header <code>X-API-Key</code> ในงาน batch ของ Dynamics AX</Typography>
          </Stack>
        </DialogContent>
        <DialogActions><Button variant="contained" onClick={() => setIssued(null)}>ปิด</Button></DialogActions>
      </Dialog>
    </Box>
  );
}

function LogRows({ row, status, expandable, open, onToggle }: {
  row: LogRow; status: { label: string; color: 'success' | 'warning' | 'error' | 'default' }; expandable: boolean; open: boolean; onToggle: () => void;
}) {
  return (
    <>
      <TableRow hover sx={{ cursor: expandable ? 'pointer' : 'default' }} onClick={expandable ? onToggle : undefined}>
        <TableCell padding="checkbox">
          {expandable ? <IconButton size="small" sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><ExpandMoreRoundedIcon fontSize="small" /></IconButton> : null}
        </TableCell>
        <TableCell>
          <Typography variant="body2">{formatDateTimeDMY(row.received_at)}</Typography>
          <Typography variant="caption" color="text.secondary">{row.duration_ms != null ? `${row.duration_ms} ms` : ''}{row.dry_run ? ' · dry run' : ''}</Typography>
        </TableCell>
        <TableCell>{row.doc_type.toUpperCase()}</TableCell>
        <TableCell><Chip size="small" color={status.color} label={status.label} /></TableCell>
        <TableCell align="right">{row.count_received}</TableCell>
        <TableCell align="right">{row.count_created}</TableCell>
        <TableCell align="right">{row.count_updated}</TableCell>
        <TableCell align="right" sx={{ color: row.count_failed > 0 ? 'error.main' : undefined, fontWeight: row.count_failed > 0 ? 700 : undefined }}>{row.count_failed}</TableCell>
        <TableCell>
          <Typography variant="body2">{row.key_name ?? '-'}</Typography>
          {row.source_ip ? <Typography variant="caption" color="text.secondary">{row.source_ip}</Typography> : null}
        </TableCell>
        <TableCell><code style={{ fontSize: 12 }}>{row.request_id ?? '-'}</code></TableCell>
      </TableRow>
      {expandable ? (
        <TableRow>
          <TableCell colSpan={10} sx={{ p: 0, borderBottom: open ? undefined : 'none' }}>
            <Collapse in={open} unmountOnExit>
              <Box sx={{ px: 2, py: 1.5, bgcolor: 'action.hover' }}>
                {row.error_summary ? <Typography variant="body2" sx={{ mb: 1 }}>{row.error_summary}</Typography> : null}
                {row.failures && row.failures.length > 0 ? (
                  <Table size="small">
                    <TableHead><TableRow><TableCell>#</TableCell><TableCell>เลขที่เอกสาร</TableCell><TableCell>รหัส</TableCell><TableCell>รายละเอียด</TableCell></TableRow></TableHead>
                    <TableBody>
                      {row.failures.map((f) => (
                        <TableRow key={`${row.id}-${f.index}`}>
                          <TableCell>{f.index + 1}</TableCell>
                          <TableCell>{f.doc_no ?? '-'}</TableCell>
                          <TableCell><code>{f.code}</code></TableCell>
                          <TableCell>{f.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : null}
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}
