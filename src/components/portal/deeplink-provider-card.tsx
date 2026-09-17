'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';

export interface DeeplinkProviderView {
  provider: string;
  display_name: string;
  available: boolean;
  enabled: boolean;
  environment: 'sandbox' | 'production';
  biller_id: string;
  merchant_name: string;
  session_minutes: number;
  credentials_set: boolean;
  credentials_hint: string | null;
  webhook_url: string | null;
}

interface CredentialField {
  key: string;
  label: string;
  placeholder: string;
}

/** Which secrets each bank needs. Labels mirror the bank portals so owners can copy across. */
const CREDENTIAL_FIELDS: Record<string, CredentialField[]> = {
  scb: [
    { key: 'applicationKey', label: 'Application Key', placeholder: 'จาก SCB Developer Portal' },
    { key: 'applicationSecret', label: 'Application Secret', placeholder: 'จาก SCB Developer Portal' },
  ],
  kbank: [
    { key: 'consumerId', label: 'Consumer ID', placeholder: 'จาก KBank Open API portal' },
    { key: 'consumerSecret', label: 'Consumer Secret', placeholder: 'จาก KBank Open API portal' },
    { key: 'partnerId', label: 'Partner ID', placeholder: 'ได้จากธนาคารตอนสมัคร merchant' },
    { key: 'partnerSecret', label: 'Partner Secret', placeholder: 'ได้จากธนาคารตอนสมัคร merchant' },
  ],
};

const BILLER_LABEL: Record<string, string> = {
  scb: 'Biller ID (15 หลัก)',
  kbank: 'Merchant ID',
};

const ONBOARDING: Record<string, string[]> = {
  scb: [
    'มีบัญชีธุรกิจ SCB และสมัครเป็น SCB Biller (Bill Payment) เพื่อรับ Biller ID',
    'สมัคร SCB Developer Portal → สร้าง Application → เปิดใช้ Deeplink Payment (Bill Payment)',
    'นำ Webhook URL ด้านล่างไปตั้งเป็น Payment Confirmation URL ใน Application นั้น',
    'ทดสอบด้วย sandbox ก่อน แล้วสลับเป็น production หลัง SCB อนุมัติ',
  ],
  kbank: [
    'มีบัญชีธุรกิจ KBank และสมัครบริการ Pay with K PLUS ผ่านสาขาหรือ RM เพื่อรับ Merchant ID / Partner ID / Partner Secret',
    'สมัคร KBank Open API portal → สร้าง Application → รับ Consumer ID / Consumer Secret',
    'นำ Webhook URL ด้านล่างไปตั้งเป็น Payment Notification URL',
    'Production ต้องยื่นขอ client certificate (mTLS) กับธนาคารก่อน',
  ],
};

/**
 * Settings card for one bank. Saves independently of the main payment form so a
 * half-filled bank section cannot block saving PromptPay details, and secrets
 * are cleared from the inputs as soon as they are stored.
 */
export function DeeplinkProviderCard({
  view,
  linkSecretConfigured,
  onSaved,
}: {
  view: DeeplinkProviderView;
  linkSecretConfigured: boolean;
  onSaved: () => void;
}) {
  const { push } = useToast();
  const [form, setForm] = useState(view);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => setForm(view), [view]);

  const fields = CREDENTIAL_FIELDS[view.provider] ?? [];
  const misconfigured = form.enabled && (!form.biller_id.trim() || !form.credentials_set);

  async function save() {
    setSaving(true);
    const body: Record<string, unknown> = {
      provider: view.provider,
      enabled: form.enabled,
      environment: form.environment,
      biller_id: form.biller_id,
      merchant_name: form.merchant_name,
      session_minutes: form.session_minutes,
    };
    const filled = Object.fromEntries(Object.entries(credentials).filter(([, v]) => v.trim()));
    if (Object.keys(filled).length) body.credentials = filled;

    const res = await fetch('/api/shop-payment-settings/deeplink', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) return push(json.error ?? 'บันทึกไม่สำเร็จ', 'error');
    setCredentials({});
    push(`บันทึกการตั้งค่า ${view.display_name} แล้ว`);
    onSaved();
  }

  async function testConnection() {
    setTesting(true);
    const res = await fetch('/api/shop-payment-settings/deeplink/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: view.provider }),
    });
    const json = await res.json();
    setTesting(false);
    if (!res.ok) return push(json.error ?? 'เชื่อมต่อไม่สำเร็จ', 'error');
    push(`เชื่อมต่อ ${view.display_name} สำเร็จ (${json.data?.environment ?? 'sandbox'})`);
  }

  async function copyWebhook() {
    if (!form.webhook_url) return;
    try {
      await navigator.clipboard.writeText(form.webhook_url);
      push('คัดลอก Webhook URL แล้ว');
    } catch {
      push('คัดลอกไม่สำเร็จ กรุณาคัดลอกด้วยตนเอง', 'error');
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
      <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4 border border-slate-200">
        <input
          id={`deeplink-toggle-${view.provider}`}
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-blue-600"
          checked={form.enabled}
          disabled={!view.available}
          onChange={(e) => setForm((s) => ({ ...s, enabled: e.target.checked }))}
        />
        <label htmlFor={`deeplink-toggle-${view.provider}`} className="cursor-pointer">
          <span className="text-sm font-semibold text-slate-800">จ่ายผ่านแอป {view.display_name}</span>
          <p className="mt-0.5 text-xs text-slate-500">
            ลูกค้ากดปุ่มแล้วเด้งเข้าแอปธนาคาร ยอดเงินและผู้รับถูกล็อกไว้ ใส่ PIN จบ<br />
            เงินเข้าบัญชีร้านโดยตรง ระบบยืนยันการชำระอัตโนมัติ ไม่ต้องตรวจสลิป
          </p>
        </label>
      </div>

      {!view.available && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          ช่องทางนี้ยังไม่เปิดให้ใช้ในระบบ (รอตรวจสอบกับธนาคาร) — บันทึกข้อมูลไว้ล่วงหน้าได้ แต่ยังเปิดใช้งานไม่ได้
        </div>
      )}
      {!linkSecretConfigured && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          ระบบยังไม่ได้ตั้งค่า PAYMENT_LINK_SECRET — ต้องตั้งค่าก่อนจึงเปิดช่องทางนี้ได้ (แจ้งผู้ดูแลระบบ)
        </div>
      )}
      {misconfigured && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          ⚠️ เปิดใช้งานไว้ แต่ยังกรอก {BILLER_LABEL[view.provider]} หรือ credentials ไม่ครบ — ลูกค้าจะไม่เห็นปุ่มนี้
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">{BILLER_LABEL[view.provider]} *</label>
          <input
            className="input"
            value={form.biller_id}
            onChange={(e) => setForm((s) => ({ ...s, biller_id: e.target.value }))}
            placeholder={view.provider === 'scb' ? '0xxxxxxxxxxxxxx' : 'จากธนาคาร'}
          />
          <p className="text-xs text-slate-400">บัญชีปลายทางที่เงินเข้า — ลูกค้าแก้ไขไม่ได้</p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">ชื่อร้านที่แสดงในแอปธนาคาร</label>
          <input
            className="input"
            value={form.merchant_name}
            onChange={(e) => setForm((s) => ({ ...s, merchant_name: e.target.value }))}
            placeholder="เว้นว่าง = ใช้ชื่อร้าน"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">Environment</label>
          <select
            className="input"
            value={form.environment}
            onChange={(e) => setForm((s) => ({ ...s, environment: e.target.value as 'sandbox' | 'production' }))}
          >
            <option value="sandbox">Sandbox (ทดสอบ ไม่ตัดเงินจริง)</option>
            <option value="production">Production (ใช้งานจริง)</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">เวลาที่ลิงก์ใช้ได้ (นาที)</label>
          <input
            className="input"
            type="number"
            min={5}
            max={60}
            value={form.session_minutes}
            onChange={(e) => setForm((s) => ({ ...s, session_minutes: Number(e.target.value) || 15 }))}
          />
          <p className="text-xs text-slate-400">ค่าเริ่มต้น 15 นาที หมดเวลาแล้วลูกค้าออกลิงก์ใหม่ได้</p>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <h3 className="text-sm font-semibold text-slate-800">
          API Credentials
          {form.credentials_set && (
            <span className="ml-2 text-green-600 font-normal">✓ ตั้งค่าแล้ว {form.credentials_hint ? `(…${form.credentials_hint})` : ''}</span>
          )}
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          เก็บแบบเข้ารหัสและไม่ถูกส่งกลับมาที่หน้าจอนี้อีก กรอกใหม่ครบทุกช่องเมื่อต้องการเปลี่ยน
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1">
              <label className="text-xs font-medium text-slate-600">{f.label}</label>
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                placeholder={form.credentials_set ? 'กรอกใหม่เพื่อเปลี่ยน' : f.placeholder}
                value={credentials[f.key] ?? ''}
                onChange={(e) => setCredentials((c) => ({ ...c, [f.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </div>

      {form.webhook_url && (
        <div className="border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold text-slate-800">Webhook URL (แจ้งผลชำระเงินจากธนาคาร)</h3>
          <p className="mt-1 text-xs text-slate-500">นำ URL นี้ไปตั้งใน portal ของธนาคาร URL มี secret เฉพาะร้าน อย่าแชร์ต่อ</p>
          <code className="mt-2 block rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700 break-all">{form.webhook_url}</code>
          <button type="button" className="btn-outline mt-2 !py-1 !text-xs" onClick={() => void copyWebhook()}>คัดลอก</button>
        </div>
      )}

      <details className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        <summary className="cursor-pointer font-medium text-slate-700">ขั้นตอนสมัครกับธนาคาร</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          {(ONBOARDING[view.provider] ?? []).map((step) => <li key={step}>{step}</li>)}
        </ol>
      </details>

      <div className="flex flex-wrap gap-2 pt-1">
        <button type="button" className="btn-primary" disabled={saving} onClick={() => void save()}>
          {saving ? 'กำลังบันทึก...' : `บันทึก ${view.display_name}`}
        </button>
        <button type="button" className="btn-outline" disabled={testing || !form.credentials_set} onClick={() => void testConnection()}>
          {testing ? 'กำลังทดสอบ...' : 'ทดสอบการเชื่อมต่อ'}
        </button>
      </div>
    </section>
  );
}
