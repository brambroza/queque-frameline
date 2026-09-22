'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, CardContent, FormControlLabel, MenuItem, Skeleton, Stack, Switch, TextField, Typography } from '@mui/material';
import { PageHeader } from '@/components/shared/page-header';
import { useToast } from '@/components/ui/toast';

type Settings = {
  grace_minutes: number; early_arrival_minutes: number; auto_call_mode: 'off' | 'dock_free' | 'time' | 'hybrid'; auto_call_lead_minutes: number;
  called_timeout_minutes: number; auto_no_show_after_grace: boolean; booking_token_ttl_days: number; driver_token_ttl_days: number;
  booking_lead_min_hours: number; booking_horizon_days: number; require_admin_confirm: boolean; driver_self_checkin: boolean; do_number_format: string;
  item_minutes_enabled: boolean; minutes_per_item: number;
  auto_call_last_run_at: string | null;
};

const MODE_HINT: Record<Settings['auto_call_mode'], string> = {
  off: 'พนักงานกดเรียกคิวเองทุกครั้ง',
  dock_free: 'เมื่อท่าว่าง ระบบเรียกรถที่เช็คอินแล้วของท่านั้นทันที (แนะนำ)',
  time: 'ถึงเวลานัดและท่าว่าง จึงเรียก — รถที่มาก่อนเวลาต้องรอ',
  hybrid: 'เรียกเมื่อท่าว่าง และตรวจซ้ำทุกนาทีตามเวลานัด',
};

function previewDo(format: string): string {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  return format.replace('{YYYYMM}', ym).replace('{YYYY}', String(now.getFullYear())).replace(/\{(N+)\}/, (_, n: string) => '1'.padStart(n.length, '0'));
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
        {hint ? <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{hint}</Typography> : null}
        <Stack spacing={2} sx={{ mt: hint ? 0 : 2 }}>{children}</Stack>
      </CardContent>
    </Card>
  );
}

/** Site-wide rules: grace time, auto-call, booking window, link lifetime, DO numbering. */
export function SiteSettingsForm({ isAdmin }: { isAdmin: boolean }) {
  const { push } = useToast();
  const [s, setS] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/site-settings', { cache: 'no-store' });
      const j = (await res.json()) as { data?: Settings; error?: string };
      if (!res.ok || !j.data) throw new Error(j.error ?? 'โหลดการตั้งค่าไม่สำเร็จ');
      setS(j.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดการตั้งค่าไม่สำเร็จ');
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function save() {
    if (!s || saving) return;
    setSaving(true);
    try {
      const { auto_call_last_run_at: _ignored, ...body } = s;
      void _ignored;
      const res = await fetch('/api/site-settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = (await res.json().catch(() => ({}))) as { data?: Settings; error?: string };
      if (!res.ok || !j.data) { push(j.error ?? 'บันทึกไม่สำเร็จ', 'error'); return; }
      setS(j.data);
      push('บันทึกการตั้งค่าแล้ว');
    } finally {
      setSaving(false);
    }
  }

  const num = (key: keyof Settings, label: string, helper: string, min: number, max: number) => (
    <TextField
      size="small" type="number" label={label} helperText={helper} disabled={!isAdmin}
      value={s ? String(s[key]) : ''}
      onChange={(e) => setS((p) => (p ? { ...p, [key]: e.target.value === '' ? 0 : Number(e.target.value) } : p))}
      slotProps={{ htmlInput: { min, max } }}
      sx={{ maxWidth: 320 }}
    />
  );
  const toggle = (key: keyof Settings, label: string) => (
    <FormControlLabel control={<Switch disabled={!isAdmin} checked={Boolean(s?.[key])} onChange={(e) => setS((p) => (p ? { ...p, [key]: e.target.checked } : p))} />} label={label} />
  );

  return (
    <Stack spacing={2}>
      <PageHeader title="ตั้งค่าระบบคิว" description="กติกาของคลัง: เผื่อเวลามาสาย เรียกคิวอัตโนมัติ เวลาตามรายการสินค้า ช่วงเวลาที่เปิดจอง ลิงก์ และเลข DO"
        action={isAdmin ? <Button variant="contained" onClick={() => void save()} disabled={!s || saving}>{saving ? 'กำลังบันทึก…' : 'บันทึกการตั้งค่า'}</Button> : undefined} />
      {error ? <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void load()}>ลองใหม่</Button>}>{error}</Alert> : null}
      {!isAdmin ? <Alert severity="info">เฉพาะผู้ดูแลระบบเท่านั้นที่แก้ไขได้</Alert> : null}
      {!s && !error ? <Skeleton variant="rounded" height={320} /> : null}
      {s ? (
        <>
          <Section title="เผื่อเวลา" hint="รถที่ยังไม่เช็คอินหลังเวลานัด + เวลาเผื่อ จะขึ้นสถานะ “เลยเวลานัด” (ยังเช็คอินได้)">
            {num('grace_minutes', 'เผื่อเวลามาสาย (นาที)', 'นับจากเวลานัด', 0, 720)}
            {num('early_arrival_minutes', 'มาก่อนเวลาได้ (นาที)', 'ใช้แสดงคำแนะนำให้คนขับ', 0, 1440)}
            {toggle('auto_no_show_after_grace', 'ปิดคิวเป็น “ไม่มา” อัตโนมัติ เมื่อเลยเวลาเผื่อ 2 เท่า')}
          </Section>

          <Section title="เรียกคิวอัตโนมัติ">
            <TextField select size="small" label="โหมด" disabled={!isAdmin} value={s.auto_call_mode} helperText={MODE_HINT[s.auto_call_mode]}
              onChange={(e) => setS((p) => (p ? { ...p, auto_call_mode: e.target.value as Settings['auto_call_mode'] } : p))} sx={{ maxWidth: 420 }}>
              <MenuItem value="off">ปิด</MenuItem>
              <MenuItem value="dock_free">เรียกเมื่อท่าว่าง</MenuItem>
              <MenuItem value="time">เรียกตามเวลานัด</MenuItem>
              <MenuItem value="hybrid">ทั้งสองแบบ</MenuItem>
            </TextField>
            {s.auto_call_mode === 'time' || s.auto_call_mode === 'hybrid' ? num('auto_call_lead_minutes', 'เรียกก่อนเวลานัด (นาที)', '0 = ตรงเวลานัด', 0, 180) : null}
            {num('called_timeout_minutes', 'รอรถเข้าท่าหลังเรียก (นาที)', 'เกินนี้ระบบปิดคิวเป็น “ไม่มา” และเรียกคันถัดไป', 1, 240)}
            <Typography variant="caption" color="text.secondary">
              ตรวจอัตโนมัติล่าสุด: {s.auto_call_last_run_at ? new Date(s.auto_call_last_run_at).toLocaleString('th-TH') : 'ยังไม่เคยทำงาน — ต้องตั้งค่า pg_cron + Vault (ดู README)'}
            </Typography>
          </Section>

          <Section title="เวลาตามรายการสินค้า" hint="ใช้เป็นค่าแนะนำตอนอนุมัติคิว — นับตามจำนวนรายการ ไม่นับจำนวนชิ้น ถ้าเอกสารไม่มีรายการจะใช้เวลาของประเภทรถ">
            {toggle('item_minutes_enabled', 'แนะนำเวลาที่ท่าจากจำนวนรายการสินค้าในเอกสาร')}
            {s.item_minutes_enabled ? num('minutes_per_item', 'นาทีต่อ 1 รายการ', `เช่น 3 รายการ × ${s.minutes_per_item || 10} = ${3 * (s.minutes_per_item || 10)} นาที`, 1, 240) : null}
          </Section>

          <Section title="การจองผ่านลิงก์" hint="มีผลกับลูกค้า / Supplier ที่จองเอง ไม่มีผลกับคิวที่เจ้าหน้าที่สร้าง">
            {toggle('require_admin_confirm', 'ต้องให้ผู้ดูแลยืนยันก่อน จึงออก DO')}
            {num('booking_lead_min_hours', 'ต้องจองล่วงหน้าอย่างน้อย (ชั่วโมง)', '0 = จองช่วงเวลาถัดไปได้เลย', 0, 168)}
            {num('booking_horizon_days', 'จองล่วงหน้าได้ไกลสุด (วัน)', '', 1, 365)}
            {num('booking_token_ttl_days', 'อายุลิงก์จอง (วัน)', 'นับจากวันที่ออกลิงก์', 1, 90)}
            {num('driver_token_ttl_days', 'อายุลิงก์คนขับ (วัน)', 'นับหลังวันนัด', 1, 90)}
            {toggle('driver_self_checkin', 'ให้คนขับกด “ฉันมาถึงแล้ว” เช็คอินเองจากลิงก์ — ตรวจ GPS ตามพิกัดและรัศมีที่ตั้งในหน้า สาขา / คลัง (ปิด = เจ้าหน้าที่หน้าประตูเป็นคนเช็คอิน)')}
          </Section>

          <Section title="เลข DO">
            <TextField size="small" label="รูปแบบ" disabled={!isAdmin} value={s.do_number_format} onChange={(e) => setS((p) => (p ? { ...p, do_number_format: e.target.value } : p))}
              helperText={`ใช้ {YYYYMM} {YYYY} และ {NNNN} (เลขรัน เริ่มใหม่ทุกเดือน) — ตัวอย่าง: ${previewDo(s.do_number_format)}`} sx={{ maxWidth: 420 }} />
          </Section>
        </>
      ) : null}
    </Stack>
  );
}
