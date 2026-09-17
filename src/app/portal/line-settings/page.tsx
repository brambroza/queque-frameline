'use client';

import { FormEvent, useEffect, useState } from 'react';
import { PageShell } from '@/components/ui/page-shell';
import { useToast } from '@/components/ui/toast';
import { track } from '@/lib/analytics/track';
import { REMINDER_MINUTES_DEFAULT, REMINDER_PRESETS, reminderLeadLabel } from '@/lib/line/booking-reminder';

type ConnectionCheck = { key: string; ok: boolean; message: string };

/** ฐาน URL ของแอป ใช้แสดงลิงก์ที่ต้องนำไปวางใน LINE Developer Console */
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://queuebooking.com';

export default function LineSettingsPage() {
  const { push } = useToast();
  const [form, setForm] = useState({
    line_channel_access_token: '',
    line_channel_secret: '',
    liff_id: '',
    liff_id_login_shop: '',
    auto_reply_enabled: true,
    booking_echo_enabled: true,
    reminder_enabled: false,
    reminder_minutes: REMINDER_MINUTES_DEFAULT as number,
    shop_key: '',
  });
  const [checks, setChecks] = useState<ConnectionCheck[] | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/line-settings');
      const json = await res.json();
      if (!res.ok) return push(json.error ?? 'โหลดไม่สำเร็จ', 'error');
      setForm({
        line_channel_access_token: json.data.line_channel_access_token ?? '',
        line_channel_secret: json.data.line_channel_secret ?? '',
        liff_id: json.data.liff_id ?? '',
        liff_id_login_shop: json.data.liff_id_login_shop ?? '',
        auto_reply_enabled: Boolean(json.data.auto_reply_enabled),
        booking_echo_enabled: json.data.booking_echo_enabled !== false,
        reminder_enabled: json.data.reminder_enabled === true,
        reminder_minutes: Number(json.data.reminder_minutes) || REMINDER_MINUTES_DEFAULT,
        shop_key: json.data.shop_key ?? '',
      });
    })();
  }, [push]);

  /** A stored value outside the preset list (set by SQL) is kept as an extra option so saving never silently changes it. */
  const reminderOptions: number[] = (REMINDER_PRESETS as readonly number[]).includes(form.reminder_minutes)
    ? [...REMINDER_PRESETS]
    : [...REMINDER_PRESETS, form.reminder_minutes];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const { reminder_minutes, ...rest } = form;
    // Send the lead time only when it is a preset; the API rejects anything else.
    const payload = (REMINDER_PRESETS as readonly number[]).includes(reminder_minutes) ? { ...rest, reminder_minutes } : rest;
    const res = await fetch('/api/line-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'บันทึกไม่สำเร็จ', 'error');
    push('บันทึกตั้งค่า LINE แล้ว');
    void testConnection();
  }

  /** ยิงตรวจ credential จริงกับ LINE API แทนการเดาว่ากรอกถูกหรือยัง */
  async function testConnection() {
    setTesting(true);
    try {
      const res = await fetch('/api/line-settings/test', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        push(json.error ?? 'ทดสอบการเชื่อมต่อไม่สำเร็จ', 'error');
        return;
      }
      setChecks(json.data.checks as ConnectionCheck[]);
      if (json.data.ok) {
        track('line_connected');
        push('เชื่อมต่อ LINE ครบถ้วนแล้ว');
      }
    } finally {
      setTesting(false);
    }
  }

  return (
    <PageShell title="LINE Settings" description="ตั้งค่า LINE OA ต่อร้าน">
      <section className="max-w-2xl rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">ลิงก์สำหรับตั้งค่าใน LINE Developer</h2>
        <div className="mt-3 space-y-2 text-sm text-slate-600">
          <p>Webhook URL</p>
          <code className="block rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
            {APP_URL}/api/line/webhook/{form.shop_key || '{shopKey}'}
          </code>
          <p>LIFF Booking URL</p>
          <code className="block rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
            {APP_URL}/liff/{form.shop_key || '{shopKey}'}
          </code>
          <p>LIFF Member URL</p>
          <code className="block rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
            {APP_URL}/liff/{form.shop_key || '{shopKey}'}/member
          </code>
        </div>
      </section>

      <form onSubmit={onSubmit} className="mt-4 max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-semibold text-slate-800">ข้อมูลเชื่อมต่อ LINE OA</h3>
          <p className="mt-1 text-xs text-slate-500">กรอกค่า Channel และ LIFF ID ให้ตรงกับร้านนี้</p>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">LINE Channel Access Token</label>
          <input className="input" placeholder="ใส่ Channel Access Token (Long-lived)" value={form.line_channel_access_token} onChange={(e) => setForm((s) => ({ ...s, line_channel_access_token: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">LINE Channel Secret</label>
          <input className="input" placeholder="ใส่ Channel Secret" value={form.line_channel_secret} onChange={(e) => setForm((s) => ({ ...s, line_channel_secret: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">LIFF Booking ID (`liff_id`)</label>
          <input className="input" placeholder="เช่น 200xxxxxxx-ABCDEFG" value={form.liff_id} onChange={(e) => setForm((s) => ({ ...s, liff_id: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">LIFF Member/Login ID (`liff_id_login_shop`)</label>
          <input className="input" placeholder="เช่น 200xxxxxxx-HIJKLMN" value={form.liff_id_login_shop} onChange={(e) => setForm((s) => ({ ...s, liff_id_login_shop: e.target.value }))} />
        </div>
        <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <input type="checkbox" checked={form.auto_reply_enabled} onChange={(e) => setForm((s) => ({ ...s, auto_reply_enabled: e.target.checked }))} />
          เปิด Auto Reply
        </label>
        <label className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-1"
            checked={form.booking_echo_enabled}
            onChange={(e) => setForm((s) => ({ ...s, booking_echo_enabled: e.target.checked }))}
          />
          <span>
            แจ้งเตือนร้านใน LINE OA Chat เมื่อมีคิวใหม่
            <span className="mt-0.5 block text-xs text-slate-500">
              หลังลูกค้าจองสำเร็จ ระบบจะส่งข้อความ &quot;ยืนยันคิว...&quot; เข้าห้องแชทแทนลูกค้า
              เพื่อให้ chat.line.biz เด้งแจ้งเตือน — ข้อความจะแสดงในแชทเหมือนลูกค้าพิมพ์เอง
              ต้องเปิด scope <code>chat_message.write</code> ใน LIFF app ด้วย
            </span>
          </span>
        </label>
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.reminder_enabled}
              onChange={(e) => setForm((s) => ({ ...s, reminder_enabled: e.target.checked }))}
            />
            <span>
              แจ้งเตือนลูกค้าล่วงหน้าก่อนถึงคิว
              <span className="mt-0.5 block text-xs text-slate-500">
                ส่งข้อความ LINE ไปหาลูกค้าก่อนเวลานัดตามที่ตั้งไว้ ส่งครั้งเดียวต่อคิว
                เฉพาะคิวที่จองผ่าน LINE และยังไม่ถูกยกเลิก คิวที่จองล่วงหน้าน้อยกว่าเวลาเตือนจะไม่ส่งซ้ำ
              </span>
            </span>
          </label>
          {form.reminder_enabled && (
            <div className="mt-3 flex flex-wrap items-center gap-2 pl-6">
              <label htmlFor="reminder_minutes" className="text-xs font-medium text-slate-600">
                เตือนก่อนถึงคิว
              </label>
              <select
                id="reminder_minutes"
                className="input max-w-[12rem]"
                value={form.reminder_minutes}
                onChange={(e) => setForm((s) => ({ ...s, reminder_minutes: Number(e.target.value) }))}
              >
                {reminderOptions.map((m) => (
                  <option key={m} value={m}>
                    {reminderLeadLabel(m)}
                    {(REMINDER_PRESETS as readonly number[]).includes(m) ? '' : ' (กำหนดเอง)'}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <button className="btn-primary">บันทึก</button>
          <button type="button" className="btn-outline" onClick={() => void testConnection()} disabled={testing}>
            {testing ? 'กำลังทดสอบ...' : 'ทดสอบการเชื่อมต่อ'}
          </button>
        </div>

        {checks && (
          <ul className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            {checks.map((c) => (
              <li key={c.key} className={c.ok ? 'text-emerald-700' : 'text-rose-700'}>
                {c.ok ? '✓' : '✕'} {c.message}
              </li>
            ))}
          </ul>
        )}
      </form>
    </PageShell>
  );
}
