'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { EmptyState } from '@/components/ui/empty-state';
import { readPaywallDetail, useUpgrade } from '@/components/subscription/upgrade-provider';
import { TablePaginationControls } from '@/components/ui/table-pagination-controls';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import TagRoundedIcon from '@mui/icons-material/TagRounded';
import { ActionIconGroup } from '@/components/ui/action-icon-group';
import { MobileCardList } from '@/components/ui/responsive-table';
import { MobileRecordCard } from '@/components/ui/mobile-record-card';
import { useConfirm } from '@/components/ui/confirm-dialog';

type Column = { key: string; label: string; type?: 'text' | 'number' | 'time' | 'date' | 'checkbox' };

export function SimpleCrud({
  endpoint,
  title,
  columns,
  defaults,
}: {
  endpoint: string;
  title: string;
  columns: Column[];
  defaults: Record<string, string | number | boolean>;
}) {
  const { push } = useToast();
  const confirm = useConfirm();
  const { openPaywall } = useUpgrade();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formSeed, setFormSeed] = useState<Record<string, string | number | boolean>>(defaults);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(endpoint, { cache: 'no-store' });
    const json = await res.json();
    setRows(json.data ?? []);
    setPage(1);
    setLoading(false);
  }, [endpoint]);

  useEffect(() => { void load(); }, [load]);

  function openCreate() {
    setEditingId(null);
    setFormSeed(defaults);
    setDrawerOpen(true);
  }

  function openEdit(row: Record<string, unknown>) {
    const next: Record<string, string | number | boolean> = { ...defaults };
    columns.forEach((c) => {
      const v = row[c.key];
      if (c.type === 'checkbox') next[c.key] = Boolean(v);
      else next[c.key] = String(v ?? defaults[c.key] ?? '');
    });
    setEditingId(String(row.id));
    setFormSeed(next);
    setDrawerOpen(true);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const payload = { ...defaults } as Record<string, unknown>;

    columns.forEach((c) => {
      if (c.type === 'checkbox') payload[c.key] = formData.get(c.key) === 'on';
      else payload[c.key] = formData.get(c.key);
    });
    if (editingId) payload.id = editingId;

    setSaving(true);
    const res = await fetch(endpoint, {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setSaving(false);

    const paywall = readPaywallDetail(res, json);
    if (paywall) {
      openPaywall(paywall);
      return;
    }

    if (!res.ok) {
      push(json.error ?? 'บันทึกไม่สำเร็จ', 'error');
      return;
    }

    push('บันทึกสำเร็จ');
    form.reset();
    setEditingId(null);
    setFormSeed(defaults);
    setDrawerOpen(false);
    void load();
  }

  async function onDelete(id: string) {
    const res = await fetch(`${endpoint}?id=${id}`, { method: 'DELETE' });
    if (!res.ok) {
      push('ลบไม่สำเร็จ', 'error');
      return;
    }
    push('ลบสำเร็จ');
    void load();
  }

  const pagedRows = rows.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  /** Same confirm dialog the table's ActionIconGroup shows, for the phone card button. */
  async function confirmDelete(row: Record<string, unknown>) {
    const ok = await confirm({
      tone: 'error',
      title: `ลบ${title}นี้?`,
      description: 'รายการจะถูกซ่อนจากระบบทันที ข้อมูลที่เกี่ยวข้องยังอยู่ในรายงาน',
      context: { primary: String(row[columns[0]?.key] ?? row.id) },
      confirmLabel: `ลบ${title}`,
    });
    if (ok) await onDelete(String(row.id));
  }

  /** Cell text for the phone card: times trimmed to HH:MM, checkboxes as ใช่/ไม่. */
  function cellText(c: Column, row: Record<string, unknown>) {
    if (c.type === 'checkbox') return row[c.key] ? 'ใช่' : 'ไม่';
    if (c.type === 'time') return String(row[c.key] ?? '-').slice(0, 5);
    return String(row[c.key] ?? '-');
  }

  return (
    <div className="space-y-4">
      {/* Phones: title row then a full-width 44px button. sm+: title left, button right (unchanged). */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">รายการ{title}</h3>
          <p className="text-xs text-slate-500 sm:hidden">{rows.length} รายการ</p>
        </div>
        <button className="btn-primary min-h-[44px] sm:min-h-0" onClick={openCreate}>เพิ่ม{title}</button>
      </div>

      <div className="card overflow-hidden">
        {loading ? <p className="p-4 text-sm">กำลังโหลด...</p> : null}
        {!loading && rows.length === 0 ? (
          <EmptyState
            title={`ยังไม่มี${title}`}
            description={`เพิ่ม${title}แรกเพื่อให้ลูกค้าเลือกได้ตอนจองคิว`}
            actionLabel={`เพิ่ม${title}`}
            onAction={openCreate}
            icon="🏪"
          />
        ) : null}
        {!loading && rows.length > 0 ? (
          <>
          {/*
            Phones: one card per row, same look as /portal/services. Column roles are
            derived from the generic config: first column = title, `active` checkbox =
            status pill, time/number columns = stat tiles (max 3), the rest = note lines.
          */}
          <MobileCardList<Record<string, unknown>>
            rows={pagedRows}
            rowKey={(row) => String(row.id)}
            columns={[]}
            renderCard={(row) => {
              const [first, ...rest] = columns;
              const statusCol = rest.find((c) => c.type === 'checkbox' && c.key === 'active');
              const statCols = rest.filter((c) => c.type === 'time' || c.type === 'number').slice(0, 3);
              const noteCols = rest.filter((c) => c !== statusCol && !statCols.includes(c));
              return (
                <MobileRecordCard
                  title={String(row[first?.key ?? 'id'] ?? '-')}
                  status={statusCol ? { active: Boolean(row[statusCol.key]) } : undefined}
                  note={
                    noteCols.length > 0
                      ? noteCols.map((c) => (
                          <span key={c.key} className="block">
                            {c.label}: {cellText(c, row)}
                          </span>
                        ))
                      : undefined
                  }
                  stats={statCols.map((c) => ({
                    icon: c.type === 'time' ? <AccessTimeRoundedIcon /> : <TagRoundedIcon />,
                    value: cellText(c, row),
                    label: c.label,
                  }))}
                  onEdit={() => openEdit(row)}
                  onDelete={() => void confirmDelete(row)}
                />
              );
            }}
            sx={{ display: { xs: 'flex', sm: 'none' }, p: 1.5, bgcolor: 'action.hover' }}
          />
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {columns.map((c) => <th key={c.key} className="px-3 py-2 text-left">{c.label}</th>)}
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row) => (
                  <tr key={String(row.id)} className="border-t border-slate-100">
                    {columns.map((c) => <td key={c.key} className="px-3 py-2">{String(row[c.key] ?? '-')}</td>)}
                    <td className="px-3 py-2">
                      <ActionIconGroup
                        actions={[
                          {
                            key: 'edit',
                            icon: <EditOutlinedIcon fontSize="small" />,
                            labelKey: 'common.edit',
                            fallbackLabel: 'Edit',
                            color: 'primary',
                            onClick: () => openEdit(row),
                          },
                          {
                            key: 'delete',
                            icon: <DeleteOutlineIcon fontSize="small" />,
                            labelKey: 'common.delete',
                            fallbackLabel: 'Delete',
                            color: 'error',
                            onClick: () => void onDelete(String(row.id)),
                            confirm: {
                              tone: 'error',
                              title: `ลบ${title}นี้?`,
                              description: 'รายการจะถูกซ่อนจากระบบทันที ข้อมูลที่เกี่ยวข้องยังอยู่ในรายงาน',
                              context: { primary: String(row[columns[0]?.key] ?? row.id) },
                              confirmLabel: `ลบ${title}`,
                            },
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        ) : null}
        {!loading && rows.length > 0 ? (
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
          <button className="fixed inset-0 z-40 bg-slate-900/30" onClick={() => setDrawerOpen(false)} aria-label="Close drawer" />
          <aside className="fixed right-0 top-0 z-50 h-dvh w-full overflow-y-auto bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:w-[60%]">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <h4 className="text-lg font-semibold">{editingId ? `แก้ไข${title}` : `เพิ่ม${title}`}</h4>
              <button className="btn-outline" onClick={() => setDrawerOpen(false)}>Close</button>
            </div>

            <form key={editingId ?? 'new'} onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
              {columns.map((c) => (
                <label key={c.key} className="text-sm">
                  <span className="mb-1 block text-slate-600">{c.label}</span>
                  {c.type === 'checkbox' ? (
                    <input type="checkbox" name={c.key} defaultChecked={Boolean(formSeed[c.key])} />
                  ) : (
                    <input className="input" name={c.key} type={c.type ?? 'text'} defaultValue={String(formSeed[c.key] ?? '')} required />
                  )}
                </label>
              ))}
              <div className="sm:col-span-2 flex gap-2 pt-2">
                <button className="btn-primary" disabled={saving}>{saving ? 'กำลังบันทึก...' : editingId ? `บันทึก${title}` : `เพิ่ม${title}`}</button>
                <button type="button" className="btn-outline" onClick={() => setDrawerOpen(false)}>ยกเลิก</button>
              </div>
            </form>
          </aside>
        </>
      ) : null}
    </div>
  );
}
