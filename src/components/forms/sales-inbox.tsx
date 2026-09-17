'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';

type LeadStatus = 'new' | 'contacted' | 'won' | 'lost';

type ContactLead = {
  id: string;
  name: string;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  business_type: string | null;
  message: string | null;
  status: LeadStatus;
  created_at: string;
};

type UpgradeRequest = {
  id: string;
  requested_plan_code: string;
  current_plan_code: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  note: string | null;
  source: string;
  status: LeadStatus;
  created_at: string;
  shops?: { name?: string | null; shop_key?: string | null } | null;
};

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'ใหม่',
  contacted: 'ติดต่อแล้ว',
  won: 'ปิดการขาย',
  lost: 'ไม่สำเร็จ',
};

const STATUSES: LeadStatus[] = ['new', 'contacted', 'won', 'lost'];

function formatDate(value: string) {
  return new Date(value).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * Sales inbox for the two inbound signals the funnel produces: website contact
 * enquiries and in-product upgrade requests. Both previously landed in tables
 * nothing in the app read.
 */
export function SalesInbox() {
  const { push } = useToast();
  const [tab, setTab] = useState<'upgrades' | 'leads'>('upgrades');
  const [upgrades, setUpgrades] = useState<UpgradeRequest[]>([]);
  const [leads, setLeads] = useState<ContactLead[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [upRes, leadRes] = await Promise.all([
        fetch('/api/upgrade-requests', { cache: 'no-store' }),
        fetch('/api/contact-leads', { cache: 'no-store' }),
      ]);
      const [upJson, leadJson] = await Promise.all([upRes.json(), leadRes.json()]);
      if (upRes.ok) setUpgrades((upJson.data ?? []) as UpgradeRequest[]);
      else push(upJson.error ?? 'โหลดคำขออัปเกรดไม่สำเร็จ', 'error');
      if (leadRes.ok) setLeads((leadJson.data ?? []) as ContactLead[]);
      else push(leadJson.error ?? 'โหลด lead ไม่สำเร็จ', 'error');
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateStatus(kind: 'upgrades' | 'leads', id: string, status: LeadStatus) {
    const url = kind === 'upgrades' ? '/api/upgrade-requests' : '/api/contact-leads';
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'อัปเดตสถานะไม่สำเร็จ', 'error');
    push('อัปเดตสถานะแล้ว');
    void load();
  }

  const newUpgrades = upgrades.filter((u) => u.status === 'new').length;
  const newLeads = leads.filter((l) => l.status === 'new').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          className={tab === 'upgrades' ? 'btn-primary' : 'btn-outline'}
          onClick={() => setTab('upgrades')}
        >
          คำขออัปเกรด {newUpgrades > 0 ? `(${newUpgrades} ใหม่)` : ''}
        </button>
        <button className={tab === 'leads' ? 'btn-primary' : 'btn-outline'} onClick={() => setTab('leads')}>
          Lead จากเว็บไซต์ {newLeads > 0 ? `(${newLeads} ใหม่)` : ''}
        </button>
      </div>

      <div className="card overflow-x-auto p-4">
        {loading ? (
          <p className="text-sm text-slate-500">กำลังโหลด...</p>
        ) : tab === 'upgrades' ? (
          upgrades.length === 0 ? (
            <p className="text-sm text-slate-500">ยังไม่มีคำขออัปเกรด</p>
          ) : (
            <table className="w-full min-w-[840px] text-sm">
              <thead>
                <tr>
                  <th className="px-2 py-2 text-left">วันที่</th>
                  <th className="px-2 py-2 text-left">ร้าน</th>
                  <th className="px-2 py-2 text-left">ขอแพ็กเกจ</th>
                  <th className="px-2 py-2 text-left">ปัจจุบัน</th>
                  <th className="px-2 py-2 text-left">ติดต่อ</th>
                  <th className="px-2 py-2 text-left">ที่มา</th>
                  <th className="px-2 py-2 text-left">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {upgrades.map((u) => (
                  <tr key={u.id} className="border-t border-slate-100 align-top">
                    <td className="px-2 py-2 whitespace-nowrap">{formatDate(u.created_at)}</td>
                    <td className="px-2 py-2">
                      {u.shops?.name ?? '-'}
                      {u.shops?.shop_key ? <span className="block text-xs text-slate-500">{u.shops.shop_key}</span> : null}
                    </td>
                    <td className="px-2 py-2 font-semibold">{u.requested_plan_code}</td>
                    <td className="px-2 py-2">{u.current_plan_code ?? '-'}</td>
                    <td className="px-2 py-2">
                      {u.contact_name ?? '-'}
                      <span className="block text-xs text-slate-500">{u.phone ?? ''} {u.email ?? ''}</span>
                      {u.note ? <span className="block text-xs text-slate-500">“{u.note}”</span> : null}
                    </td>
                    <td className="px-2 py-2">{u.source}</td>
                    <td className="px-2 py-2">
                      <select
                        className="input"
                        value={u.status}
                        onChange={(e) => void updateStatus('upgrades', u.id, e.target.value as LeadStatus)}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : leads.length === 0 ? (
          <p className="text-sm text-slate-500">ยังไม่มี lead จากเว็บไซต์</p>
        ) : (
          <table className="w-full min-w-[840px] text-sm">
            <thead>
              <tr>
                <th className="px-2 py-2 text-left">วันที่</th>
                <th className="px-2 py-2 text-left">ชื่อ</th>
                <th className="px-2 py-2 text-left">บริษัท</th>
                <th className="px-2 py-2 text-left">ประเภทธุรกิจ</th>
                <th className="px-2 py-2 text-left">ติดต่อ</th>
                <th className="px-2 py-2 text-left">ข้อความ</th>
                <th className="px-2 py-2 text-left">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-t border-slate-100 align-top">
                  <td className="px-2 py-2 whitespace-nowrap">{formatDate(l.created_at)}</td>
                  <td className="px-2 py-2">{l.name}</td>
                  <td className="px-2 py-2">{l.company_name ?? '-'}</td>
                  <td className="px-2 py-2">{l.business_type ?? '-'}</td>
                  <td className="px-2 py-2">
                    {l.phone ?? '-'}
                    <span className="block text-xs text-slate-500">{l.email ?? ''}</span>
                  </td>
                  <td className="max-w-sm px-2 py-2 text-xs text-slate-600">{l.message ?? '-'}</td>
                  <td className="px-2 py-2">
                    <select
                      className="input"
                      value={l.status}
                      onChange={(e) => void updateStatus('leads', l.id, e.target.value as LeadStatus)}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
