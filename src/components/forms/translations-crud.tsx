'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { TablePaginationControls } from '@/components/ui/table-pagination-controls';
import { formatDateTimeDMY } from '@/lib/utils/date-format';

type Language = { code: string; name: string; native_name?: string | null };
type Namespace = { id: string; code: string; name: string };
type TranslationRow = {
  id: string;
  namespace_id: string;
  language_code: string;
  translation_key: string;
  translation_value: string;
  description: string | null;
  active: boolean;
  updated_at: string;
  translation_namespaces?: { code?: string; name?: string } | null;
};

type FormState = {
  id: string | null;
  namespace_id: string;
  language_code: string;
  translation_key: string;
  translation_value: string;
  description: string;
  active: boolean;
};

const initialForm: FormState = {
  id: null,
  namespace_id: '',
  language_code: 'th',
  translation_key: '',
  translation_value: '',
  description: '',
  active: true,
};

export function TranslationsCrud() {
  const { push } = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState<TranslationRow[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<FormState>(initialForm);

  const [q, setQ] = useState('');
  const [language, setLanguage] = useState('');
  const [namespaceCode, setNamespaceCode] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [total, setTotal] = useState(0);

  const editing = Boolean(form.id);
  const namespaceMap = useMemo(
    () => new Map(namespaces.map((n) => [n.id, n.code])),
    [namespaces],
  );

  async function loadRefs() {
    const [langRes, nsRes] = await Promise.all([
      fetch('/api/i18n/languages', { cache: 'no-store' }),
      fetch('/api/i18n/namespaces', { cache: 'no-store' }),
    ]);
    const [langJson, nsJson] = await Promise.all([langRes.json(), nsRes.json()]);
    if (!langRes.ok) return push(langJson.error ?? 'โหลดภาษาไม่สำเร็จ', 'error');
    if (!nsRes.ok) return push(nsJson.error ?? 'โหลด namespace ไม่สำเร็จ', 'error');
    setLanguages(langJson.data ?? []);
    setNamespaces(nsJson.data ?? []);
  }

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (language) params.set('language', language);
    if (namespaceCode) params.set('namespace', namespaceCode);
    if (active) params.set('active', active);
    params.set('page', String(page));
    params.set('page_size', String(rowsPerPage));

    const res = await fetch(`/api/i18n/manage?${params.toString()}`, { cache: 'no-store' });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) return push(json.error ?? 'โหลดคำแปลไม่สำเร็จ', 'error');
    setRows(json.data ?? []);
    setTotal(json.pagination?.total ?? 0);
  }

  useEffect(() => {
    void loadRefs();
  }, []);

  useEffect(() => {
    void load();
  }, [page, rowsPerPage]);

  function openAdd() {
    setForm((prev) => ({
      ...initialForm,
      namespace_id: namespaces[0]?.id ?? '',
      language_code: languages[0]?.code ?? 'th',
      active: true,
      description: prev.description,
    }));
    setDrawerOpen(true);
  }

  function openEdit(row: TranslationRow) {
    setForm({
      id: row.id,
      namespace_id: row.namespace_id,
      language_code: row.language_code,
      translation_key: row.translation_key,
      translation_value: row.translation_value,
      description: row.description ?? '',
      active: row.active,
    });
    setDrawerOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.namespace_id || !form.language_code || !form.translation_key.trim() || !form.translation_value.trim()) {
      push('กรอกข้อมูลให้ครบ', 'error');
      return;
    }

    setSaving(true);
    const res = await fetch('/api/i18n/manage', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: form.id ?? undefined,
        namespace_id: form.namespace_id,
        language_code: form.language_code,
        translation_key: form.translation_key.trim(),
        translation_value: form.translation_value,
        description: form.description.trim() || null,
        active: form.active,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) return push(json.error ?? 'บันทึกไม่สำเร็จ', 'error');

    push(editing ? 'อัปเดตคำแปลแล้ว' : 'เพิ่มคำแปลแล้ว');
    setDrawerOpen(false);
    setForm(initialForm);
    void load();
  }

  async function onDelete(row: TranslationRow) {
    const ok = await confirm({
      tone: 'warning',
      title: 'ปิดใช้งานคำแปลนี้?',
      description: 'หน้าจอจะกลับไปแสดงข้อความสำรอง (fallback) แทนคำแปลนี้ เปิดใช้ใหม่ได้ภายหลัง',
      context: {
        primary: row.translation_key,
        secondary: [row.translation_namespaces?.code, row.language_code.toUpperCase()].filter(Boolean).join(' · '),
        avatar: row.language_code.toUpperCase().slice(0, 2),
        avatarSquare: true,
      },
      confirmLabel: 'ปิดใช้งาน',
    });
    if (!ok) return;
    const res = await fetch(`/api/i18n/manage?id=${row.id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'ลบไม่สำเร็จ', 'error');
    push('ปิดใช้งานคำแปลแล้ว');
    void load();
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="grid gap-2 md:grid-cols-5">
          <input className="input md:col-span-2" placeholder="ค้นหา key/value" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input" value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="">ทุกภาษา</option>
            {languages.map((l) => <option key={l.code} value={l.code}>{l.code.toUpperCase()} - {l.native_name || l.name}</option>)}
          </select>
          <select className="input" value={namespaceCode} onChange={(e) => setNamespaceCode(e.target.value)}>
            <option value="">ทุก namespace</option>
            {namespaces.map((n) => <option key={n.id} value={n.code}>{n.code}</option>)}
          </select>
          <select className="input" value={active} onChange={(e) => setActive(e.target.value)}>
            <option value="">ทุกสถานะ</option>
            <option value="true">active</option>
            <option value="false">inactive</option>
          </select>
        </div>
        <div className="mt-3 flex gap-2">
          <button className="btn-outline" onClick={() => { setPage(1); void load(); }} disabled={loading}>{loading ? 'กำลังโหลด...' : 'ค้นหา'}</button>
          <button className="btn-primary" onClick={openAdd}>Add Translation</button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left">Namespace</th>
              <th className="px-3 py-2 text-left">Language</th>
              <th className="px-3 py-2 text-left">Key</th>
              <th className="px-3 py-2 text-left">Value</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Updated</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td className="px-3 py-4 text-slate-500" colSpan={7}>ไม่พบข้อมูลคำแปล</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 align-top">
                <td className="px-3 py-2">{r.translation_namespaces?.code || namespaceMap.get(r.namespace_id) || '-'}</td>
                <td className="px-3 py-2">{r.language_code.toUpperCase()}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.translation_key}</td>
                <td className="px-3 py-2">{r.translation_value}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-1 text-xs ${r.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    {r.active ? 'active' : 'inactive'}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">{formatDateTimeDMY(r.updated_at)}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button className="btn-outline" onClick={() => openEdit(r)}>Edit</button>
                    <button className="btn-outline" onClick={() => void onDelete(r)}>Deactivate</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <TablePaginationControls
          page={page}
          rowsPerPage={rowsPerPage}
          total={total}
          onPageChange={setPage}
          onRowsPerPageChange={(v) => { setRowsPerPage(v); setPage(1); }}
        />
      </div>

      {drawerOpen ? (
        <>
          <button className="fixed inset-0 z-40 bg-slate-900/30" onClick={() => setDrawerOpen(false)} aria-label="Close drawer" />
          <aside className="fixed right-0 top-0 z-50 h-dvh w-full overflow-y-auto bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:w-[60%]">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <h4 className="text-lg font-semibold">{editing ? 'แก้ไขคำแปล' : 'เพิ่มคำแปล'}</h4>
              <button className="btn-outline" onClick={() => setDrawerOpen(false)}>Close</button>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm block">
                  <span className="mb-1 block text-slate-600">Namespace</span>
                  <select className="input" value={form.namespace_id} onChange={(e) => setForm((p) => ({ ...p, namespace_id: e.target.value }))} required>
                    <option value="">เลือก namespace</option>
                    {namespaces.map((n) => <option key={n.id} value={n.id}>{n.code}</option>)}
                  </select>
                </label>
                <label className="text-sm block">
                  <span className="mb-1 block text-slate-600">Language</span>
                  <select className="input" value={form.language_code} onChange={(e) => setForm((p) => ({ ...p, language_code: e.target.value }))} required>
                    {languages.map((l) => <option key={l.code} value={l.code}>{l.code.toUpperCase()} - {l.native_name || l.name}</option>)}
                  </select>
                </label>
              </div>
              <label className="text-sm block">
                <span className="mb-1 block text-slate-600">Translation Key</span>
                <input className="input font-mono" value={form.translation_key} onChange={(e) => setForm((p) => ({ ...p, translation_key: e.target.value }))} required />
              </label>
              <label className="text-sm block">
                <span className="mb-1 block text-slate-600">Translation Value</span>
                <textarea className="input min-h-28" value={form.translation_value} onChange={(e) => setForm((p) => ({ ...p, translation_value: e.target.value }))} required />
              </label>
              <label className="text-sm block">
                <span className="mb-1 block text-slate-600">Description</span>
                <input className="input" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} />
                active
              </label>

              <div className="flex gap-2 pt-2">
                <button className="btn-primary" disabled={saving}>{saving ? 'กำลังบันทึก...' : (editing ? 'บันทึกการแก้ไข' : 'เพิ่มคำแปล')}</button>
                <button type="button" className="btn-outline" onClick={() => setDrawerOpen(false)}>ยกเลิก</button>
              </div>
            </form>
          </aside>
        </>
      ) : null}
    </div>
  );
}

