'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, FormControlLabel, Skeleton, Stack, Switch, TextField, Typography } from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { PageHeader } from '@/components/shared/page-header';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';

type View = {
  has_token: boolean; has_secret: boolean; token_from_env: boolean; login_channel_id: string | null; liff_id: string | null; oa_basic_id: string | null;
  staff_group_id: string | null; staff_group_name: string | null; notify_customer: boolean; notify_driver: boolean; notify_staff_group: boolean;
  webhook_verified_at: string | null; webhook_url: string; liff_endpoint_url: string; sample_liff_url: string | null;
};
type Check = { key: string; label: string; ok: boolean; detail: string };

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card><CardContent>
      <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
      {hint ? <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{hint}</Typography> : <Box sx={{ mb: 2 }} />}
      <Stack spacing={2}>{children}</Stack>
    </CardContent></Card>
  );
}

function CopyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const { push } = useToast();
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
      <TextField fullWidth size="small" label={label} value={value} helperText={hint} slotProps={{ input: { readOnly: true } }} />
      <Button size="small" startIcon={<ContentCopyRoundedIcon />} sx={{ flexShrink: 0, alignSelf: { xs: 'flex-start', sm: 'center' } }}
        onClick={() => { void navigator.clipboard.writeText(value).then(() => push('คัดลอกแล้ว')).catch(() => push('คัดลอกไม่สำเร็จ', 'error')); }}>คัดลอก</Button>
    </Stack>
  );
}

/** LINE OA wiring: credentials, LIFF, switches, connection test and the group registration state. */
export function LineSettingsForm() {
  const { push } = useToast();
  const confirm = useConfirm();
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ channel_access_token: '', channel_secret: '', login_channel_id: '', liff_id: '', oa_basic_id: '' });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [checks, setChecks] = useState<Check[] | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/line-settings', { cache: 'no-store' });
      const j = (await res.json()) as { data?: View; error?: string };
      if (!res.ok || !j.data) throw new Error(j.error ?? 'โหลดการตั้งค่าไม่สำเร็จ');
      setView(j.data);
      setForm((f) => ({ ...f, login_channel_id: j.data!.login_channel_id ?? '', liff_id: j.data!.liff_id ?? '', oa_basic_id: j.data!.oa_basic_id ?? '' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดการตั้งค่าไม่สำเร็จ');
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function patch(body: Record<string, unknown>, okMessage: string) {
    setSaving(true);
    try {
      const res = await fetch('/api/line-settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = (await res.json().catch(() => ({}))) as { data?: View; error?: string };
      if (!res.ok || !j.data) { push(j.error ?? 'บันทึกไม่สำเร็จ', 'error'); return false; }
      setView(j.data);
      push(okMessage);
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function saveCredentials() {
    const body: Record<string, unknown> = { login_channel_id: form.login_channel_id, liff_id: form.liff_id, oa_basic_id: form.oa_basic_id };
    if (form.channel_access_token.trim()) body.channel_access_token = form.channel_access_token.trim();
    if (form.channel_secret.trim()) body.channel_secret = form.channel_secret.trim();
    if (await patch(body, 'บันทึกการตั้งค่า LINE แล้ว')) { setForm((f) => ({ ...f, channel_access_token: '', channel_secret: '' })); setChecks(null); }
  }

  async function test() {
    setTesting(true);
    try {
      const res = await fetch('/api/line-settings/test', { method: 'POST' });
      const j = (await res.json().catch(() => ({}))) as { data?: { checks: Check[] }; error?: string };
      if (!res.ok || !j.data) { push(j.error ?? 'ทดสอบไม่สำเร็จ', 'error'); return; }
      setChecks(j.data.checks);
      await load();
    } finally {
      setTesting(false);
    }
  }

  async function clearGroup() {
    const ok = await confirm({ tone: 'warning', title: 'ยกเลิกกลุ่มแจ้งเตือน?', description: 'ทีมคลังจะไม่ได้รับข้อความจนกว่าจะพิมพ์ "ลงทะเบียนกลุ่ม" ในกลุ่มอีกครั้ง', context: { primary: view?.staff_group_name ?? view?.staff_group_id ?? '' }, confirmLabel: 'ยกเลิกกลุ่ม' });
    if (ok) await patch({ clear_staff_group: true }, 'ยกเลิกกลุ่มแล้ว');
  }

  return (
    <Stack spacing={2}>
      <PageHeader title="เชื่อมต่อ LINE" description="ส่งลิงก์จองและแจ้งสถานะให้ลูกค้า Supplier และคนขับทาง LINE OA และแจ้งทีมคลังเข้ากลุ่ม LINE"
        action={<Button variant="outlined" onClick={() => void test()} disabled={testing || !view}>{testing ? 'กำลังทดสอบ…' : 'ทดสอบการเชื่อมต่อ'}</Button>} />
      {error ? <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void load()}>ลองใหม่</Button>}>{error}</Alert> : null}
      {!view && !error ? <Skeleton variant="rounded" height={360} /> : null}
      {checks ? (
        <Card><CardContent>
          <Stack spacing={1}>
            {checks.map((c) => (
              <Stack key={c.key} direction="row" spacing={1} alignItems="flex-start">
                {c.ok ? <CheckCircleRoundedIcon color="success" fontSize="small" /> : <ErrorOutlineRoundedIcon color="warning" fontSize="small" />}
                <Typography variant="body2"><b>{c.label}:</b> {c.detail}</Typography>
              </Stack>
            ))}
          </Stack>
        </CardContent></Card>
      ) : null}
      {view ? (
        <>
          <Section title="1. Messaging API (จาก LINE Developers Console)" hint="OA Manager → Settings → Messaging API เปิดใช้งาน แล้วไปที่ developers.line.biz → channel นี้ → แท็บ Messaging API">
            <TextField size="small" type="password" label="Channel access token (long-lived)" value={form.channel_access_token} onChange={(e) => setForm((f) => ({ ...f, channel_access_token: e.target.value }))}
              placeholder={view.has_token ? '•••••••• (มีค่าอยู่แล้ว — กรอกเมื่อต้องการเปลี่ยน)' : 'วาง token'} helperText={view.token_from_env ? 'ใช้ค่าจาก env ของ server' : undefined} />
            <TextField size="small" type="password" label="Channel secret" value={form.channel_secret} onChange={(e) => setForm((f) => ({ ...f, channel_secret: e.target.value }))}
              placeholder={view.has_secret ? '•••••••• (มีค่าอยู่แล้ว)' : 'วาง secret'} />
            <TextField size="small" label="Basic ID ของ OA (เช่น @fameline)" value={form.oa_basic_id} onChange={(e) => setForm((f) => ({ ...f, oa_basic_id: e.target.value }))} helperText="ใช้ทำปุ่ม “เพิ่มเพื่อน” ให้ลูกค้า" sx={{ maxWidth: 360 }} />
            <CopyField label="Webhook URL (ใส่ในแท็บ Messaging API แล้วกด Verify + เปิด Use webhook)" value={view.webhook_url} hint={view.webhook_verified_at ? `LINE เรียกเข้ามาล่าสุด ${new Date(view.webhook_verified_at).toLocaleString('th-TH')}` : 'ยังไม่เคยรับ event จาก LINE'} />
            <Alert severity="info">ปิด “ข้อความตอบกลับอัตโนมัติ” และ “ข้อความทักทาย” ใน OA Manager ไม่งั้นลูกค้าจะได้ข้อความซ้อนกับของระบบ · เปิด “Allow bot to join group chats” ถ้าจะใช้กลุ่มทีมคลัง</Alert>
          </Section>

          <Section title="2. LIFF (ให้ลูกค้าเปิดลิงก์จองใน LINE แล้วผูกบัญชีอัตโนมัติ)" hint="สร้าง LINE Login channel ใน Provider เดียวกัน → แท็บ LIFF → Add">
            <CopyField label="Endpoint URL ของ LIFF app" value={view.liff_endpoint_url} hint="Scope: profile, openid, chat_message.write · Size: Full · Bot link feature: Aggressive (ขอเพิ่มเพื่อน OA ตอนเปิดครั้งแรก)" />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField fullWidth size="small" label="LIFF ID" value={form.liff_id} onChange={(e) => setForm((f) => ({ ...f, liff_id: e.target.value }))} placeholder="1234567890-abcdefgh" helperText="วาง LIFF ID หรือ LIFF URL ก็ได้" />
              <TextField fullWidth size="small" label="Channel ID ของ LINE Login channel" value={form.login_channel_id} onChange={(e) => setForm((f) => ({ ...f, login_channel_id: e.target.value }))} placeholder="1660000000" helperText="ตัวเลข ใช้ตรวจสอบตัวตนตอนผูก LINE" />
            </Stack>
            {view.sample_liff_url ? <Typography variant="caption" color="text.secondary">ลิงก์จองแบบ LINE จะเป็น {view.sample_liff_url}</Typography> : null}
            <Button variant="contained" onClick={() => void saveCredentials()} disabled={saving} sx={{ alignSelf: 'flex-start' }}>{saving ? 'กำลังบันทึก…' : 'บันทึกการตั้งค่า'}</Button>
          </Section>

          <Section title="3. กลุ่ม LINE ของทีมคลัง" hint="เชิญ OA เข้ากลุ่ม แล้วให้ใครก็ได้ในกลุ่มพิมพ์ “ลงทะเบียนกลุ่ม” — ระบบจะส่งคิวใหม่ รถมาถึง ทะเบียนไม่ตรง การยกเลิก และไม่มา เข้ากลุ่มนั้น">
            {view.staff_group_id ? (
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Chip color="success" icon={<CheckCircleRoundedIcon />} label={`ลงทะเบียนแล้ว: ${view.staff_group_name ?? view.staff_group_id}`} />
                <Button size="small" color="inherit" onClick={() => void clearGroup()} disabled={saving}>ยกเลิกกลุ่ม</Button>
              </Stack>
            ) : <Chip variant="outlined" color="warning" icon={<ErrorOutlineRoundedIcon />} label="ยังไม่ลงทะเบียนกลุ่ม" />}
          </Section>

          <Section title="4. เปิด/ปิดการแจ้งเตือน">
            <FormControlLabel control={<Switch checked={view.notify_customer} disabled={saving} onChange={(e) => void patch({ notify_customer: e.target.checked }, 'บันทึกแล้ว')} />} label="แจ้งลูกค้า / Supplier (รับคำขอ, ยืนยัน + DO, เรียกคิว, เลื่อน, ยกเลิก, ไม่มา)" />
            <FormControlLabel control={<Switch checked={view.notify_driver} disabled={saving} onChange={(e) => void patch({ notify_driver: e.target.checked }, 'บันทึกแล้ว')} />} label="แจ้งคนขับ (ใบงาน, ถึงคิวแล้ว)" />
            <FormControlLabel control={<Switch checked={view.notify_staff_group} disabled={saving} onChange={(e) => void patch({ notify_staff_group: e.target.checked }, 'บันทึกแล้ว')} />} label="แจ้งกลุ่มทีมคลัง" />
            <Typography variant="caption" color="text.secondary">แผนฟรีของ LINE OA ส่งได้ 200 ข้อความ/เดือน (นับทั้งลูกค้า คนขับ และกลุ่ม) หากเกินต้องอัปเกรดแพ็กเกจใน OA Manager</Typography>
          </Section>
        </>
      ) : null}
    </Stack>
  );
}
