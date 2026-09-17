'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { formatDateTimeDMY } from '@/lib/utils/date-format';

type CalendarStatus = {
  platform_configured: boolean;
  sync_schema_ready: boolean;
  shop_id: string;
  can_manage: boolean;
  connected: boolean;
  calendar_id: string | null;
  last_synced_at: string | null;
  last_error: string | null;
  updated_at: string | null;
};

type SyncSummary = {
  total: number;
  synced: number;
  skipped: number;
  failed: number;
  limited: boolean;
};

const OAUTH_MESSAGES: Record<string, { message: string; type: 'success' | 'error' }> = {
  connected: { message: 'เชื่อมต่อ Google Calendar แล้ว', type: 'success' },
  denied: { message: 'ยกเลิกการอนุญาต Google Calendar', type: 'error' },
  invalid_state: { message: 'คำขอเชื่อมต่อหมดอายุ กรุณาลองใหม่', type: 'error' },
  missing_refresh_token: { message: 'Google ไม่ได้ส่งสิทธิ์ซิงก์ระยะยาว กรุณาเชื่อมต่อใหม่', type: 'error' },
  not_configured: { message: 'ระบบ QueueBooking ยังไม่ได้ตั้งค่า Google OAuth', type: 'error' },
  error: { message: 'เชื่อมต่อ Google Calendar ไม่สำเร็จ กรุณาลองใหม่', type: 'error' },
};

export function GoogleCalendarSettings() {
  const { push } = useToast();
  const confirm = useConfirm();
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch('/api/google-calendar', { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? 'โหลดสถานะ Google Calendar ไม่สำเร็จ');
      const nextStatus = json.data as CalendarStatus;
      setStatus(nextStatus);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'โหลดสถานะ Google Calendar ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const oauthResult = url.searchParams.get('google_calendar');
    if (oauthResult && OAUTH_MESSAGES[oauthResult]) {
      const feedback = OAUTH_MESSAGES[oauthResult];
      push(feedback.message, feedback.type);
      url.searchParams.delete('google_calendar');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
    void loadStatus();
  }, [loadStatus, push]);

  async function syncExisting() {
    setSyncing(true);
    const response = await fetch('/api/google-calendar/sync', { method: 'POST' });
    const json = await response.json();
    setSyncing(false);
    if (!response.ok) {
      push(json.error ?? 'ซิงก์ Google Calendar ไม่สำเร็จ', 'error');
      return;
    }
    const result = json.data as SyncSummary;
    const suffix = result.limited ? ' (สูงสุด 100 รายการต่อครั้ง)' : '';
    push(`ซิงก์สำเร็จ ${result.synced}/${result.total} รายการ${suffix}`, result.failed > 0 ? 'error' : 'success');
    void loadStatus();
  }

  async function disconnect() {
    const ok = await confirm({
      tone: 'info',
      title: 'ยกเลิกการเชื่อมต่อ Google Calendar?',
      description: 'คิวใหม่จะไม่ซิงก์ไปปฏิทินอีก Event ที่ซิงก์ไปแล้วยังอยู่ในปฏิทินตามเดิม',
      context: status?.calendar_id ? { primary: status.calendar_id, avatar: 'G' } : undefined,
      confirmLabel: 'ตัดการเชื่อมต่อ',
    });
    if (!ok) return;
    setDisconnecting(true);
    const response = await fetch('/api/google-calendar', { method: 'DELETE' });
    const json = await response.json();
    setDisconnecting(false);
    if (!response.ok) {
      push(json.error ?? 'ยกเลิกการเชื่อมต่อไม่สำเร็จ', 'error');
      return;
    }
    push('ยกเลิกการเชื่อมต่อ Google Calendar แล้ว');
    void loadStatus();
  }

  return (
    <section id="google-calendar" className="card scroll-mt-6 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-xl font-bold shadow-sm">
            <span className="text-blue-600">G</span>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-800">Google Calendar</h3>
              {status?.connected ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">เชื่อมต่อแล้ว</span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              ส่งการจองใหม่ การเลื่อนเวลา และการยกเลิก ไปยังปฏิทินหลักของร้านโดยอัตโนมัติ
            </p>
          </div>
        </div>

        {loading ? (
          <span className="text-sm text-slate-500">กำลังโหลด...</span>
        ) : status?.connected ? (
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => void syncExisting()} disabled={!status.can_manage || syncing}>
              {syncing ? 'กำลังซิงก์...' : 'ซิงก์รายการที่มีอยู่'}
            </button>
            <button className="btn-outline" onClick={() => void disconnect()} disabled={!status.can_manage || disconnecting}>
              {disconnecting ? 'กำลังยกเลิก...' : 'ยกเลิกการเชื่อมต่อ'}
            </button>
          </div>
        ) : status ? (
          <button
            className="btn-primary"
            onClick={() => window.location.assign('/api/google-calendar/connect')}
            disabled={!status.can_manage || !status.platform_configured || !status.sync_schema_ready}
          >
            เชื่อมต่อ Google Calendar
          </button>
        ) : null}
      </div>

      {loadError ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <span>โหลดการตั้งค่า Google Calendar ไม่สำเร็จ: {loadError}</span>
          <button type="button" className="btn-outline" onClick={() => void loadStatus()}>ลองใหม่</button>
        </div>
      ) : null}

      {status && !status.platform_configured ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-100 px-3 py-2 text-xs leading-5 text-amber-900">
          ผู้ดูแลระบบต้องตั้งค่า OAuth App ของ QueueBooking ก่อน ผู้ใช้แต่ละร้านจึงจะกด Allow ได้
        </p>
      ) : null}

      {status && !status.sync_schema_ready ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-100 px-3 py-2 text-xs leading-5 text-amber-900">
          ฐานข้อมูลยังไม่มีตาราง Google Calendar sync — ต้อง apply migration
          {' '}<code className="font-mono">202608050001_google_calendar_sync.sql</code>{' '}
          ก่อนเชื่อมต่อ Google
        </p>
      ) : null}

      {status?.connected ? (
        <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm sm:grid-cols-2">
          <div>
            <span className="block text-xs text-slate-500">ปฏิทินปลายทาง</span>
            <span className="mt-1 block font-medium text-slate-700">ปฏิทินหลัก (Primary Calendar)</span>
          </div>
          <div>
            <span className="block text-xs text-slate-500">ซิงก์ล่าสุด</span>
            <span className="mt-1 block font-medium text-slate-700">{formatDateTimeDMY(status.last_synced_at)}</span>
          </div>
          <div className="sm:col-span-2">
            <span className="block text-xs text-slate-500">เชื่อมต่อสำหรับ Shop ID</span>
            <span className="mt-1 block break-all font-medium text-slate-700">{status.shop_id}</span>
          </div>
        </div>
      ) : null}

      {status?.last_error ? (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          ซิงก์ล่าสุดมีปัญหา: {status.last_error}
        </div>
      ) : null}

      {status && !status.can_manage ? (
        <p className="mt-3 text-xs text-slate-500">เฉพาะเจ้าของร้านหรือผู้จัดการสาขาเท่านั้นที่จัดการการเชื่อมต่อได้</p>
      ) : null}
    </section>
  );
}
