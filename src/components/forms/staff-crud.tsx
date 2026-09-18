'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { TablePaginationControls } from '@/components/ui/table-pagination-controls';
import { MobileCardList } from '@/components/ui/responsive-table';
import { MobileRecordCard } from '@/components/ui/mobile-record-card';
import { Chip } from '@mui/material';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import { useTranslation } from '@/lib/i18n/useTranslation';

type RefUser = { id: string; full_name: string | null; email: string | null; phone: string | null };
type RefBranch = { id: string; branch_name: string };
type StaffRow = { id: string; user_id: string; display_name: string; active: boolean; branches: Array<{ id: string; branch_name: string }> };

/** 'existing' picks an account already in the shop; 'invite' creates a new login. */
type StaffMode = 'existing' | 'invite';

type FormState = {
  id: string | null;
  mode: StaffMode;
  user_id: string;
  email: string;
  role: 'admin' | 'staff';
  display_name: string;
  active: boolean;
  branch_ids: string[];
};

const initialForm: FormState = {
  id: null,
  mode: 'invite',
  user_id: '',
  email: '',
  role: 'staff',
  display_name: '',
  active: true,
  branch_ids: [],
};

export function StaffCrud() {
  const { t } = useTranslation('staff');
  const { push } = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [users, setUsers] = useState<RefUser[]>([]);
  const [branches, setBranches] = useState<RefBranch[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const [form, setForm] = useState<FormState>(initialForm);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const editing = Boolean(form.id);

  async function load() {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    const res = await fetch(`/api/staff?${params.toString()}`, { cache: 'no-store' });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? t('load_failed', 'โหลดรายชื่อพนักงานไม่สำเร็จ'), 'error');
    setRows(json.data ?? []);
    setUsers(json.refs?.users ?? []);
    setBranches(json.refs?.branches ?? []);
  }

  useEffect(() => { void load(); }, []);

  const selectedUser = useMemo(() => users.find((u) => u.id === form.user_id), [users, form.user_id]);
  const pagedRows = rows.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  function openAdd() {
    setForm(initialForm);
    setDrawerOpen(true);
  }

  function openEdit(row: StaffRow) {
    setForm({
      ...initialForm,
      id: row.id,
      mode: 'existing',
      user_id: row.user_id,
      display_name: row.display_name,
      active: row.active,
      branch_ids: row.branches.map((b) => b.id),
    });
    setDrawerOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const invitingNew = !editing && form.mode === 'invite';

    if (!form.display_name.trim()) {
      push(t('err_display_name', 'กรุณากรอกชื่อแสดงผล'), 'error');
      return;
    }
    if (invitingNew ? !form.email.trim() : !form.user_id) {
      push(invitingNew ? t('err_email', 'กรุณากรอกอีเมลผู้ใช้ใหม่') : t('err_user', 'กรุณาเลือกผู้ใช้'), 'error');
      return;
    }

    setSaving(true);
    const res = await fetch('/api/staff', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: form.id,
        ...(invitingNew ? { email: form.email.trim(), role: form.role } : { user_id: form.user_id }),
        display_name: form.display_name,
        active: form.active,
        branch_ids: form.branch_ids,
      }),
    });
    const json = await res.json();
    setSaving(false);

    if (!res.ok) {
      push(json.error ?? t('save_failed', 'บันทึกไม่สำเร็จ'), 'error');
      return;
    }

    push(editing ? t('updated', 'อัปเดตพนักงานแล้ว') : t('added', 'เพิ่มพนักงานแล้ว'));
    setDrawerOpen(false);
    setForm(initialForm);
    void load();
  }

  async function onDelete(row: StaffRow) {
    const ok = await confirm({
      tone: 'error',
      title: t('delete_title', 'ลบพนักงานนี้?'),
      description: t('delete_desc', 'พนักงานจะเข้าระบบร้านไม่ได้ทันที คิวที่มอบหมายไว้ยังอยู่แต่ไม่มีผู้รับผิดชอบ'),
      context: {
        primary: row.display_name,
        secondary: row.branches.map((b) => b.branch_name).join(' · ') || undefined,
      },
      confirmLabel: t('delete_confirm', 'ลบพนักงาน'),
    });
    if (!ok) return;
    const res = await fetch(`/api/staff?id=${row.id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? t('delete_failed', 'ลบไม่สำเร็จ'), 'error');
    push(t('deleted', 'ลบพนักงานแล้ว'));
    void load();
  }

  function toggleBranch(branchId: string) {
    setForm((prev) => ({
      ...prev,
      branch_ids: prev.branch_ids.includes(branchId)
        ? prev.branch_ids.filter((x) => x !== branchId)
        : [...prev.branch_ids, branchId],
    }));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700">{t('list_title', 'รายการพนักงาน')}</h3>
        {/* Phones: search full width, then two equal 44px buttons. sm+: one row (unchanged). */}
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <input className="input w-full sm:w-56" placeholder={t('search_placeholder', 'ค้นหาชื่อพนักงาน')} value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn-outline min-h-[44px] flex-1 sm:min-h-0 sm:flex-none" onClick={() => void load()}>{t('search', 'ค้นหา')}</button>
          <button className="btn-primary min-h-[44px] flex-1 sm:min-h-0 sm:flex-none" onClick={openAdd}>{t('add', 'เพิ่มพนักงาน')}</button>
        </div>
      </div>

      <div className="card">
        {/* Phones: one card per staff member, same look as /portal/services. */}
        <MobileCardList
          rows={pagedRows}
          rowKey={(r) => r.id}
          columns={[]}
          renderCard={(r) => {
            const user = users.find((u) => u.id === r.user_id);
            return (
              <MobileRecordCard
                title={r.display_name}
                subtitle={user?.email ?? user?.full_name ?? r.user_id}
                status={{ active: r.active, activeLabel: t('active', 'ใช้งานอยู่'), inactiveLabel: t('inactive', 'ปิดใช้งาน') }}
                tags={
                  r.branches.length > 0
                    ? r.branches.map((b) => <Chip key={b.id} size="small" variant="outlined" icon={<StorefrontRoundedIcon />} label={b.branch_name} />)
                    : <Chip size="small" variant="outlined" label={t('no_branch', 'ยังไม่ระบุสาขา')} />
                }
                onEdit={() => openEdit(r)}
                onDelete={() => void onDelete(r)}
                editLabel={t('edit', 'แก้ไข')}
                deleteLabel={t('delete', 'ลบ')}
              />
            );
          }}
          emptyState={<p className="px-3 py-4 text-sm text-slate-500">{t('empty', 'ยังไม่มีพนักงาน')}</p>}
          sx={{ display: { xs: 'flex', sm: 'none' }, p: 1.5, bgcolor: 'action.hover' }}
        />
        <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left">{t('col_name', 'ชื่อ-สกุล')}</th>
              <th className="px-3 py-2 text-left">{t('col_user', 'รหัสเข้าใช้งาน')}</th>
              <th className="px-3 py-2 text-left">{t('col_branches', 'สาขา')}</th>
              <th className="px-3 py-2 text-left">{t('col_status', 'สถานะ')}</th>
              <th className="px-3 py-2 text-left">{t('col_actions', 'จัดการ')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td className="px-3 py-4 text-slate-500" colSpan={5}>{t('empty', 'ยังไม่มีพนักงาน')}</td></tr>
            ) : pagedRows.map((r) => {
              const user = users.find((u) => u.id === r.user_id);
              return (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{r.display_name}</td>
                  <td className="px-3 py-2">{user?.email ?? user?.full_name ?? r.user_id}</td>
                  <td className="px-3 py-2">{r.branches.map((b) => b.branch_name).join(', ') || '-'}</td>
                  <td className="px-3 py-2">{r.active ? t('active', 'ใช้งานอยู่') : t('inactive', 'ปิดใช้งาน')}</td>
                  <td className="px-3 py-2 flex gap-2">
                    <button className="btn-outline" onClick={() => openEdit(r)}>{t('edit', 'แก้ไข')}</button>
                    <button className="btn-outline" onClick={() => void onDelete(r)}>{t('delete', 'ลบ')}</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        {rows.length > 0 ? (
          <TablePaginationControls
            page={page}
            rowsPerPage={rowsPerPage}
            total={rows.length}
            onPageChange={setPage}
            onRowsPerPageChange={(v) => { setRowsPerPage(v); setPage(1); }}
          />
        ) : null}
      </div>

      {drawerOpen ? (
        <>
          <button className="fixed inset-0 z-[1200] bg-slate-900/30" onClick={() => setDrawerOpen(false)} aria-label={t('close', 'ปิด')} />
          <aside className="fixed right-0 top-0 z-[1201] h-dvh w-full overflow-y-auto bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:w-[60%]">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <h4 className="text-lg font-semibold">{editing ? t('edit_title', 'แก้ไขพนักงาน') : t('add_title', 'เพิ่มพนักงาน')}</h4>
              <button className="btn-outline" onClick={() => setDrawerOpen(false)}>{t('close', 'ปิด')}</button>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              {!editing ? (
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="staff-mode"
                      checked={form.mode === 'invite'}
                      onChange={() => setForm((prev) => ({ ...prev, mode: 'invite', user_id: '' }))}
                    />
                    {t('mode_invite', 'เชิญผู้ใช้ใหม่ทางอีเมล')}
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="staff-mode"
                      checked={form.mode === 'existing'}
                      onChange={() => setForm((prev) => ({ ...prev, mode: 'existing', email: '' }))}
                    />
                    {t('mode_existing', 'เลือกจากผู้ใช้ที่มีอยู่')}
                  </label>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                {!editing && form.mode === 'invite' ? (
                  <>
                    <label className="text-sm">
                      <span className="mb-1 block text-slate-600">{t('email', 'อีเมล')}</span>
                      <input
                        className="input"
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                        placeholder="staff@example.com"
                        required
                      />
                    </label>
                    <label className="text-sm">
                      <span className="mb-1 block text-slate-600">{t('role', 'สิทธิ์')}</span>
                      <select
                        className="input"
                        value={form.role}
                        onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value as FormState['role'] }))}
                      >
                        <option value="staff">{t('role_staff', 'พนักงาน')}</option>
                        <option value="admin">{t('role_admin', 'ผู้ดูแลระบบ')}</option>
                      </select>
                    </label>
                  </>
                ) : (
                  <label className="text-sm">
                    <span className="mb-1 block text-slate-600">{t('user_account', 'บัญชีผู้ใช้')}</span>
                    <select
                      className="input"
                      value={form.user_id}
                      onChange={(e) => {
                        const uid = e.target.value;
                        const u = users.find((x) => x.id === uid);
                        setForm((prev) => ({
                          ...prev,
                          user_id: uid,
                          display_name: prev.display_name || u?.full_name || u?.email || '',
                        }));
                      }}
                      required
                    >
                      <option value="">{t('pick_user', 'เลือกผู้ใช้')}</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.full_name || u.email || u.id}</option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="text-sm">
                  <span className="mb-1 block text-slate-600">{t('display_name', 'ชื่อแสดงผล')}</span>
                  <input
                    className="input"
                    value={form.display_name}
                    onChange={(e) => setForm((prev) => ({ ...prev, display_name: e.target.value }))}
                    required
                  />
                </label>
              </div>

              <div className="rounded-xl border border-slate-200 p-3">
                <p className="mb-2 text-sm font-medium">{t('assign_branches', 'สาขาที่รับผิดชอบ')}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {branches.map((b) => (
                    <label key={b.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={form.branch_ids.includes(b.id)} onChange={() => toggleBranch(b.id)} />
                      {b.branch_name}
                    </label>
                  ))}
                  {branches.length === 0 ? <p className="text-xs text-slate-500">{t('no_branches_yet', 'ยังไม่มีสาขา')}</p> : null}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))} />
                {t('active_checkbox', 'เปิดใช้งาน')}
              </label>

              {/* Phones: two equal 44px buttons; sm+: natural widths. */}
              <div className="flex gap-2 pt-2">
                <button className="btn-primary min-h-[44px] flex-1 sm:min-h-0 sm:flex-none" disabled={saving}>
                  {saving ? t('saving', 'กำลังบันทึก...') : (editing ? t('save_edit', 'บันทึกการแก้ไข') : t('add_title', 'เพิ่มพนักงาน'))}
                </button>
                <button type="button" className="btn-outline min-h-[44px] flex-1 sm:min-h-0 sm:flex-none" onClick={() => setDrawerOpen(false)}>{t('cancel', 'ยกเลิก')}</button>
              </div>

              {selectedUser ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  <p>{t('info_user', 'ผู้ใช้')}: {selectedUser.full_name || '-'}</p>
                  <p>{t('email', 'อีเมล')}: {selectedUser.email || '-'}</p>
                  <p>{t('info_phone', 'เบอร์โทร')}: {selectedUser.phone || '-'}</p>
                </div>
              ) : null}
            </form>
          </aside>
        </>
      ) : null}
    </div>
  );
}
