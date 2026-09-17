'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { PageShell } from '@/components/ui/page-shell';
import { useToast } from '@/components/ui/toast';
import { DeeplinkProviderCard, type DeeplinkProviderView } from '@/components/portal/deeplink-provider-card';

interface PaymentSettings {
  qr_payment_enabled: boolean;
  mobile_banking_enabled: boolean;
  omise_public_key: string;
  omise_secret_key: string;
  omise_secret_key_set: boolean;
  omise_secret_key_hint: string | null;
  transfer_payment_enabled: boolean;
  promptpay_id: string;
  promptpay_display_name: string;
  bank_name: string;
  bank_account_no: string;
  bank_account_name: string;
  transfer_payment_window_minutes: number;
}

const EMPTY: PaymentSettings = {
  qr_payment_enabled: false,
  mobile_banking_enabled: false,
  omise_public_key: '',
  omise_secret_key: '',
  omise_secret_key_set: false,
  omise_secret_key_hint: null,
  transfer_payment_enabled: false,
  promptpay_id: '',
  promptpay_display_name: '',
  bank_name: '',
  bank_account_no: '',
  bank_account_name: '',
  transfer_payment_window_minutes: 1440,
};

export default function PaymentSettingsPage() {
  const { push } = useToast();
  const [form, setForm] = useState<PaymentSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Bumped after every save so the preview <img> refetches instead of showing a
  // stale QR for the previous PromptPay id.
  const [previewNonce, setPreviewNonce] = useState(0);
  const [deeplinkProviders, setDeeplinkProviders] = useState<DeeplinkProviderView[]>([]);
  const [linkSecretConfigured, setLinkSecretConfigured] = useState(true);
  // Server-side flag: mobile banking's return page needs PAYMENT_LINK_SECRET.
  const [mobileBankingAvailable, setMobileBankingAvailable] = useState(true);

  const loadDeeplink = useCallback(async () => {
    const res = await fetch('/api/shop-payment-settings/deeplink');
    const json = await res.json();
    // A missing table (migration not applied yet) hides the section instead of breaking the page.
    if (!res.ok) { setDeeplinkProviders([]); return; }
    setDeeplinkProviders((json.data?.providers ?? []) as DeeplinkProviderView[]);
    setLinkSecretConfigured(Boolean(json.data?.link_secret_configured));
  }, []);

  useEffect(() => { void loadDeeplink(); }, [loadDeeplink]);

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/shop-payment-settings');
      const json = await res.json();
      if (!res.ok) { push(json.error ?? 'โหลดไม่สำเร็จ', 'error'); return; }
      setMobileBankingAvailable(Boolean(json.data.mobile_banking_available));
      setForm({
        qr_payment_enabled: Boolean(json.data.qr_payment_enabled),
        mobile_banking_enabled: Boolean(json.data.mobile_banking_enabled),
        omise_public_key: json.data.omise_public_key ?? '',
        omise_secret_key: '',
        omise_secret_key_set: Boolean(json.data.omise_secret_key_set),
        omise_secret_key_hint: json.data.omise_secret_key_hint ?? null,
        transfer_payment_enabled: Boolean(json.data.transfer_payment_enabled),
        promptpay_id: json.data.promptpay_id ?? '',
        promptpay_display_name: json.data.promptpay_display_name ?? '',
        bank_name: json.data.bank_name ?? '',
        bank_account_no: json.data.bank_account_no ?? '',
        bank_account_name: json.data.bank_account_name ?? '',
        transfer_payment_window_minutes: Number(json.data.transfer_payment_window_minutes ?? 1440),
      });
      setLoading(false);
    })();
  }, [push]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const body: Record<string, unknown> = {
      qr_payment_enabled: form.qr_payment_enabled,
      mobile_banking_enabled: form.mobile_banking_enabled,
      omise_public_key: form.omise_public_key,
      transfer_payment_enabled: form.transfer_payment_enabled,
      promptpay_id: form.promptpay_id,
      promptpay_display_name: form.promptpay_display_name,
      bank_name: form.bank_name,
      bank_account_no: form.bank_account_no,
      bank_account_name: form.bank_account_name,
      transfer_payment_window_minutes: form.transfer_payment_window_minutes,
    };
    if (form.omise_secret_key) body.omise_secret_key = form.omise_secret_key;
    const res = await fetch('/api/shop-payment-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) return push(json.error ?? 'บันทึกไม่สำเร็จ', 'error');
    push('บันทึกตั้งค่าการชำระเงินแล้ว');
    setPreviewNonce((n) => n + 1);
    if (form.omise_secret_key) {
      setForm((s) => ({ ...s, omise_secret_key: '', omise_secret_key_set: true, omise_secret_key_hint: `skey_...${form.omise_secret_key.slice(-4)}` }));
    }
  }

  const isTest =
    form.omise_public_key.startsWith('pkey_test_') ||
    (form.omise_secret_key_hint?.includes('skey_test_') ?? form.omise_public_key.startsWith('pkey_test_'));

  const deeplinkEnabled = deeplinkProviders.some((p) => p.enabled && p.available && p.credentials_set && p.biller_id.trim());
  const mobileBankingEnabled = form.mobile_banking_enabled && mobileBankingAvailable;
  const enabledCount = Number(form.qr_payment_enabled) + Number(mobileBankingEnabled) + Number(form.transfer_payment_enabled) + Number(deeplinkEnabled);
  const transferMisconfigured = form.transfer_payment_enabled && !form.promptpay_id.trim();
  const omiseMisconfigured = (form.qr_payment_enabled || form.mobile_banking_enabled) && !form.omise_secret_key_set && !form.omise_secret_key;

  if (loading) return <PageShell title="Payment Settings"><p className="text-sm text-slate-500">กำลังโหลด...</p></PageShell>;

  return (
    <PageShell title="Payment Settings" description="ตั้งค่าช่องทางรับชำระเงินจากลูกค้า">

      {/* Status banner */}
      <div className={`max-w-2xl rounded-xl px-4 py-3 text-sm font-medium ${enabledCount > 0 ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
        {enabledCount === 0 && 'ยังไม่เปิดช่องทางชำระเงิน — ลูกค้าจองโดยไม่ต้องชำระล่วงหน้า'}
        {enabledCount === 1 && '✓ เปิดรับชำระเงิน 1 ช่องทาง — ระบบจะส่งวิธีชำระให้ลูกค้าหลังจองสำเร็จ'}
        {enabledCount >= 2 && `✓ เปิดรับชำระเงิน ${enabledCount} ช่องทาง — ลูกค้าจะเลือกวิธีชำระเองตอนจอง`}
      </div>

      {transferMisconfigured && (
        <div className="max-w-2xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          ⚠️ เปิดรับโอนเงินไว้ แต่ยังไม่ได้กรอก PromptPay ID — ลูกค้าจะไม่เห็น QR
        </div>
      )}

      {omiseMisconfigured && (
        <div className="max-w-2xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          ⚠️ เปิดรับชำระผ่าน Omise ไว้ แต่ยังไม่ได้กรอก Secret Key — ลูกค้าจะไม่เห็นช่องทางนี้
        </div>
      )}

      {form.mobile_banking_enabled && !mobileBankingAvailable && (
        <div className="max-w-2xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          ⚠️ จ่ายผ่านแอปธนาคารยังไม่แสดงให้ลูกค้า — ระบบยังไม่ได้ตั้งค่า <code>PAYMENT_LINK_SECRET</code> (ติดต่อผู้ดูแลระบบ)
        </div>
      )}

      {isTest && (
        <div className="max-w-2xl rounded-xl px-4 py-3 text-sm bg-amber-50 text-amber-700 border border-amber-200">
          🧪 <strong>Test Mode</strong> — ใช้ Omise test keys กำลังทดสอบระบบ ไม่มีการตัดเงินจริง
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-2 max-w-2xl space-y-5">

        {/* ─── Card 1: bank transfer + slip ─────────────────────────────── */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
          <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4 border border-slate-200">
            <input
              id="transfer-toggle"
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-blue-600"
              checked={form.transfer_payment_enabled}
              onChange={(e) => setForm((s) => ({ ...s, transfer_payment_enabled: e.target.checked }))}
            />
            <label htmlFor="transfer-toggle" className="cursor-pointer">
              <span className="text-sm font-semibold text-slate-800">โอนเงิน + แนบสลิป (ตรวจสอบเอง)</span>
              <p className="mt-0.5 text-xs text-slate-500">
                ระบบสร้าง QR PromptPay ของร้านเอง ไม่มีค่าธรรมเนียม ไม่ต้องสมัคร payment gateway<br />
                ลูกค้าโอนแล้วอัปโหลดสลิป → คุณตรวจสอบและกดอนุมัติที่หน้า &quot;ตรวจสอบการชำระเงิน&quot;
              </p>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">PromptPay ID *</label>
              <input
                className="input"
                placeholder="0812345678 หรือ เลขผู้เสียภาษี 13 หลัก"
                value={form.promptpay_id}
                onChange={(e) => setForm((s) => ({ ...s, promptpay_id: e.target.value }))}
              />
              <p className="text-xs text-slate-400">ลูกค้าเห็นแค่ 4 ตัวท้าย — เลขเต็มถูกฝังอยู่ใน QR เท่านั้น</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">ชื่อผู้รับเงิน (แสดงกับลูกค้า)</label>
              <input
                className="input"
                placeholder="เช่น ร้านตัดผมพี่ตูน"
                value={form.promptpay_display_name}
                onChange={(e) => setForm((s) => ({ ...s, promptpay_display_name: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">ธนาคาร (ไม่บังคับ)</label>
              <input
                className="input"
                placeholder="เช่น กสิกรไทย"
                value={form.bank_name}
                onChange={(e) => setForm((s) => ({ ...s, bank_name: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">เลขบัญชี (ไม่บังคับ)</label>
              <input
                className="input"
                placeholder="xxx-x-xxxxx-x"
                value={form.bank_account_no}
                onChange={(e) => setForm((s) => ({ ...s, bank_account_no: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">ชื่อบัญชี (ไม่บังคับ)</label>
              <input
                className="input"
                value={form.bank_account_name}
                onChange={(e) => setForm((s) => ({ ...s, bank_account_name: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">ให้เวลาชำระ (นาที)</label>
              <input
                className="input"
                type="number"
                min={15}
                max={20160}
                value={form.transfer_payment_window_minutes}
                onChange={(e) => setForm((s) => ({ ...s, transfer_payment_window_minutes: Number(e.target.value) || 1440 }))}
              />
              <p className="text-xs text-slate-400">ค่าเริ่มต้น 1440 นาที (24 ชั่วโมง)</p>
            </div>
          </div>

          {form.promptpay_id.trim() && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium text-slate-600">ตัวอย่าง QR (บันทึกก่อนเพื่อดูของใหม่)</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/payments/promptpay-qr?preview=1&amount=100&v=${previewNonce}`}
                alt="ตัวอย่าง PromptPay QR ยอด 100 บาท"
                className="mt-2 h-44 w-44 rounded-lg border border-slate-200 bg-white"
              />
              <p className="mt-2 text-xs text-slate-500">ลองสแกนด้วยแอปธนาคารเพื่อตรวจว่าชื่อผู้รับถูกต้อง (ยอดตัวอย่าง 100 บาท)</p>
            </div>
          )}
        </section>

        {/* ─── Card 2: Omise ────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
          <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4 border border-slate-200">
            <input
              id="qr-toggle"
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-blue-600"
              checked={form.qr_payment_enabled}
              onChange={(e) => setForm((s) => ({ ...s, qr_payment_enabled: e.target.checked }))}
            />
            <label htmlFor="qr-toggle" className="cursor-pointer">
              <span className="text-sm font-semibold text-slate-800">QR Payment อัตโนมัติ (Omise PromptPay)</span>
              <p className="mt-0.5 text-xs text-slate-500">
                ต้องสมัคร Omise และมีค่าธรรมเนียมต่อรายการ แต่ระบบยืนยันการชำระให้อัตโนมัติ<br />
                ไม่ต้องตรวจสลิปเอง — ลูกค้าจ่ายแล้วได้ใบเสร็จผ่าน LINE ทันที
              </p>
            </label>
          </div>

          <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4 border border-slate-200">
            <input
              id="mobile-banking-toggle"
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-blue-600"
              checked={form.mobile_banking_enabled}
              onChange={(e) => setForm((s) => ({ ...s, mobile_banking_enabled: e.target.checked }))}
            />
            <label htmlFor="mobile-banking-toggle" className="cursor-pointer">
              <span className="text-sm font-semibold text-slate-800">จ่ายผ่านแอปธนาคาร (Omise Mobile Banking)</span>
              <p className="mt-0.5 text-xs text-slate-500">
                ลูกค้ากดปุ่มธนาคารใน LINE → เด้งเข้าแอปธนาคารพร้อมยอดที่ล็อกไว้ → ใส่ PIN → Omise ยืนยันอัตโนมัติ<br />
                ใช้ Omise Keys ชุดเดียวกับ QR · รองรับ K PLUS, SCB EASY, KMA, Bualuang mBanking, Krungthai NEXT (ยอด 20 – 150,000 บาท)<br />
                <strong>แต่ละธนาคารต้องขอเปิดใช้กับ Omise ก่อน</strong> — ธนาคารที่ยังไม่เปิด ลูกค้าจะกดแล้วขึ้นให้เลือกธนาคารอื่น
              </p>
            </label>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold text-slate-800">Omise API Keys</h3>
            <p className="mt-1 text-xs text-slate-500">
              ใช้ <strong>Test Keys</strong> สำหรับทดสอบ (<code>pkey_test_...</code> / <code>skey_test_...</code>)<br />
              เปลี่ยนเป็น <strong>Live Keys</strong> เมื่อพร้อม go-live (<code>pkey_...</code> / <code>skey_...</code>)
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Public Key</label>
            <input
              className="input"
              placeholder="pkey_test_xxxxxxxx หรือ pkey_xxxxxxxx"
              value={form.omise_public_key}
              onChange={(e) => setForm((s) => ({ ...s, omise_public_key: e.target.value }))}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">
              Secret Key{form.omise_secret_key_set && <span className="ml-2 text-green-600 font-normal">✓ ตั้งค่าแล้ว {form.omise_secret_key_hint ? `(${form.omise_secret_key_hint})` : ''}</span>}
            </label>
            <input
              className="input"
              type="password"
              placeholder={form.omise_secret_key_set ? 'กรอกใหม่เพื่อเปลี่ยน Secret Key' : 'skey_test_xxxxxxxx หรือ skey_xxxxxxxx'}
              value={form.omise_secret_key}
              onChange={(e) => setForm((s) => ({ ...s, omise_secret_key: e.target.value }))}
              autoComplete="new-password"
            />
            <p className="text-xs text-slate-400">Secret Key แสดงเฉพาะ 4 ตัวท้าย และไม่ถูกส่งกลับมาที่หน้าจอนี้อีก</p>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold text-slate-800">Omise Webhook</h3>
            <p className="mt-1 text-xs text-slate-500">ตั้งค่า Webhook URL นี้ใน Omise Dashboard เพื่อรับแจ้งเตือนเมื่อลูกค้าชำระเงินสำเร็จ</p>
            <code className="mt-2 block rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700 break-all">
              {(process.env.NEXT_PUBLIC_APP_URL || 'https://yourdomain.com').replace(/\/+$/, '')}/api/payments/webhook
            </code>
            <p className="mt-1 text-xs text-slate-400">
              ถ้าตั้งค่า <code>OMISE_WEBHOOK_SECRET</code> ไว้ ต้องต่อท้าย URL ด้วย <code>?key=&lt;secret&gt;</code>
            </p>
          </div>
        </section>

        <div className="pt-1">
          <button className="btn-primary" disabled={saving}>
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      </form>

      {/* ─── Card 3+: bank deeplink (one card per bank, saved separately) ── */}
      {deeplinkProviders.length > 0 && (
        <div className="mt-8 max-w-2xl space-y-5">
          <div>
            <h2 className="text-base font-semibold text-slate-800">จ่ายผ่านแอปธนาคาร (Deeplink)</h2>
            <p className="mt-1 text-xs text-slate-500">
              ลูกค้าเลือกธนาคารตอนจอง → เด้งเข้าแอปธนาคารพร้อมยอดที่ล็อกไว้ → ใส่ PIN → ระบบยืนยันอัตโนมัติ
              เงินเข้าบัญชีร้านโดยตรง ต้องสมัครกับธนาคารก่อน (ดูขั้นตอนในแต่ละการ์ด)
            </p>
          </div>
          {deeplinkProviders.map((p) => (
            <DeeplinkProviderCard key={p.provider} view={p} linkSecretConfigured={linkSecretConfigured} onSaved={() => void loadDeeplink()} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
