'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { readPaywallDetail, useUpgrade } from '@/components/subscription/upgrade-provider';
import { TablePaginationControls } from '@/components/ui/table-pagination-controls';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import { Chip } from '@mui/material';
import { ActionIconGroup } from '@/components/ui/action-icon-group';
import { MobileCardList } from '@/components/ui/responsive-table';
import { MobileRecordCard } from '@/components/ui/mobile-record-card';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { RESOURCE_TYPES, resourceTypeIcon, resourceTypeLabel, type ResourceType } from '@/lib/booking/resource-types';

type Branch = { id: string; branch_name: string };
type Service = { id: string; service_name: string; active?: boolean };
type Resource = {
  id: string;
  branch_id: string | null;
  resource_type: ResourceType;
  resource_code: string | null;
  resource_name: string;
  capacity: number;
  unit_price: number;
  floor: string | null;
  zone: string | null;
  description: string | null;
  active: boolean;
  /** Services this resource serves; empty / null = every service. */
  service_ids?: string[] | null;
  branches?: { branch_name?: string } | null;
};

/**
 * Optional "ให้บริการเฉพาะ" picker. Nothing ticked = the resource serves every
 * service, which is how every existing resource behaves.
 */
function ServiceLinkPicker({ services, selected, onToggle }: { services: Service[]; selected: string[]; onToggle: (id: string) => void }) {
  if (services.length === 0) return null;
  return (
    <div className="space-y-1 sm:col-span-2">
      <label className="text-xs font-medium text-slate-600">ให้บริการเฉพาะ (ไม่บังคับ)</label>
      <p className="text-xs text-slate-500">ไม่เลือก = ใช้ได้กับทุกบริการ • เลือกแล้วจะแสดงให้ลูกค้าเลือกเฉพาะตอนจองบริการนั้น</p>
      <div className="flex flex-wrap gap-2 pt-1">
        {services.map((s) => {
          const checked = selected.includes(s.id);
          return (
            <label
              key={s.id}
              className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${checked ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600'}`}
            >
              <input className="mr-1 align-middle" type="checkbox" checked={checked} onChange={() => onToggle(s.id)} />
              {s.service_name}
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function ResourcesCrud() {
  const { push } = useToast();
  const confirm = useConfirm();
  const { openPaywall } = useUpgrade();
  const [rows, setRows] = useState<Resource[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [linkedServiceIds, setLinkedServiceIds] = useState<string[]>([]);
  const [bulkServiceIds, setBulkServiceIds] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filterType, setFilterType] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterZone, setFilterZone] = useState('');
  const [filterActive, setFilterActive] = useState('');
  const [q, setQ] = useState('');

  function closeSingleDrawer() {
    setDrawerOpen(false);
    setEditing(null);
  }

  function openCreateDrawer() {
    setEditing(null);
    setLinkedServiceIds([]);
    setDrawerOpen(true);
  }

  function openEditDrawer(row: Resource) {
    setEditing(row);
    setLinkedServiceIds(row.service_ids ?? []);
    setDrawerOpen(true);
  }

  function toggleIn(list: string[], id: string) {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  const serviceNameById = useMemo(() => new Map(services.map((s) => [s.id, s.service_name])), [services]);

  /** Column text: linked service names, or "ทุกบริการ" when unlinked. */
  function linkedServicesLabel(r: Resource) {
    const ids = r.service_ids ?? [];
    if (ids.length === 0) return 'ทุกบริการ';
    return ids.map((id) => serviceNameById.get(id) ?? '?').join(', ');
  }

  async function load() {
    const params = new URLSearchParams();
    if (filterType) params.set('resource_type', filterType);
    if (filterBranch) params.set('branch_id', filterBranch);
    if (filterZone) params.set('zone', filterZone);
    if (filterActive) params.set('active', filterActive);
    if (q.trim()) params.set('q', q.trim());

    const [rRes, bRes, sRes] = await Promise.all([
      fetch(`/api/resources?${params.toString()}`, { cache: 'no-store' }),
      fetch('/api/branches?page_size=100', { cache: 'no-store' }),
      fetch('/api/services?page_size=100', { cache: 'no-store' }),
    ]);
    const [rJson, bJson, sJson] = await Promise.all([rRes.json(), bRes.json(), sRes.json()]);
    if (!rRes.ok) return push(rJson.error ?? 'โหลด resources ไม่สำเร็จ', 'error');
    if (!bRes.ok) return push(bJson.error ?? 'โหลด branches ไม่สำเร็จ', 'error');
    setRows(rJson.data ?? []);
    setBranches(bJson.data ?? []);
    // Service list only feeds the optional link picker; the page still works without it.
    setServices(sRes.ok ? (sJson.data ?? []) : []);
    setPage(1);
  }

  useEffect(() => { void load(); }, []);

  const pagedRows = useMemo(() => rows.slice((page - 1) * rowsPerPage, page * rowsPerPage), [rows, page, rowsPerPage]);

  async function submitSingle(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const payload = {
      id: editing?.id,
      branch_id: String(fd.get('branch_id') || '') || null,
      resource_type: String(fd.get('resource_type') || ''),
      resource_code: String(fd.get('resource_code') || '') || null,
      resource_name: String(fd.get('resource_name') || ''),
      capacity: Number(fd.get('capacity') || 1),
      unit_price: Number(fd.get('unit_price') || 0),
      floor: String(fd.get('floor') || '') || null,
      zone: String(fd.get('zone') || '') || null,
      description: String(fd.get('description') || '') || null,
      active: fd.get('active') === 'on',
      service_ids: linkedServiceIds,
    };

    const isEdit = Boolean(editing);
    const res = await fetch('/api/resources', {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    const paywall = readPaywallDetail(res, json);
    if (paywall) return openPaywall(paywall);
    if (!res.ok) return push(json.error ?? 'บันทึก resource ไม่สำเร็จ', 'error');
    push(isEdit ? 'อัปเดตทรัพยากรแล้ว' : 'เพิ่มทรัพยากรสำเร็จ');
    closeSingleDrawer();
    form.reset();
    await load();
  }

  async function submitBulk(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const mode = String(fd.get('mode') || 'range');
    const codeListRaw = String(fd.get('code_list') || '');
    const payload = {
      mode,
      resource_type: String(fd.get('resource_type') || ''),
      branch_id: String(fd.get('branch_id') || '') || null,
      prefix: String(fd.get('prefix') || '') || null,
      start_number: Number(fd.get('start_number') || 1),
      end_number: Number(fd.get('end_number') || 1),
      pad_length: Number(fd.get('pad_length') || 2),
      code_list: mode === 'list' ? codeListRaw.split(',').map((x) => x.trim()).filter(Boolean) : undefined,
      name_prefix: String(fd.get('name_prefix') || '') || null,
      capacity: Number(fd.get('capacity') || 1),
      unit_price: Number(fd.get('unit_price') || 0),
      floor: String(fd.get('floor') || '') || null,
      zone: String(fd.get('zone') || '') || null,
      active: fd.get('active') === 'on',
      service_ids: bulkServiceIds,
    };
    const res = await fetch('/api/resources/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'สร้าง resource แบบกลุ่มไม่สำเร็จ', 'error');
    push(`สร้างทรัพยากรแล้ว ${json.data?.created ?? 0} รายการ`);
    setBulkOpen(false);
    setBulkServiceIds([]);
    form.reset();
    await load();
  }

  async function removeRow(id: string) {
    const res = await fetch(`/api/resources?id=${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'ลบไม่สำเร็จ', 'error');
    push('ลบทรัพยากรแล้ว');
    await load();
  }

  /** Same confirm dialog the table's ActionIconGroup shows, for the phone card button. */
  async function confirmRemove(r: Resource) {
    const ok = await confirm({
      tone: 'error',
      title: 'ลบทรัพยากรนี้?',
      description: 'คิวที่ผูกกับทรัพยากรนี้ยังอยู่ แต่จะเลือกใช้ทรัพยากรนี้ไม่ได้อีก',
      context: { primary: r.resource_name, secondary: resourceTypeLabel(r.resource_type) },
      confirmLabel: 'ลบทรัพยากร',
    });
    if (ok) await removeRow(r.id);
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        {/* Phones: search full width, 2 filters per row, full-width search button. md+: one row of 6 (unchanged). */}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
          <input className="input col-span-2 md:col-span-1" placeholder="ค้นหา code/name" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">ทุกประเภท</option>
            {RESOURCE_TYPES.map((t) => <option key={t} value={t}>{resourceTypeLabel(t)}</option>)}
          </select>
          <select className="input" value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}>
            <option value="">ทุกสาขา</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
          </select>
          <input className="input" placeholder="Zone" value={filterZone} onChange={(e) => setFilterZone(e.target.value)} />
          <select className="input" value={filterActive} onChange={(e) => setFilterActive(e.target.value)}>
            <option value="">ทุกสถานะ</option>
            <option value="true">active</option>
            <option value="false">inactive</option>
          </select>
          <button className="btn-outline col-span-2 min-h-[44px] md:col-span-1 md:min-h-0" onClick={() => void load()}>ค้นหา</button>
        </div>
      </div>

      {/* Phones: title row then two equal 44px buttons. sm+: title left, buttons right (unchanged). */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">ทรัพยากรร้าน</h3>
          <p className="text-xs text-slate-500 sm:hidden">{rows.length} รายการ</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button className="btn-outline min-h-[44px] sm:min-h-0" onClick={() => setBulkOpen(true)}>เพิ่มด่วน</button>
          <button className="btn-primary min-h-[44px] sm:min-h-0" onClick={openCreateDrawer}>เพิ่ม</button>
        </div>
      </div>

      <div className="card p-4">
        {rows.length === 0 ? <p className="text-sm text-slate-500">ยังไม่มีทรัพยากร</p> : (
          <>
          {/* Phones: one card per resource, same look as /portal/services. */}
          <MobileCardList
            rows={pagedRows}
            rowKey={(r) => r.id}
            columns={[]}
            renderCard={(r) => (
              <MobileRecordCard
                title={r.resource_name}
                subtitle={[r.resource_code, r.branches?.branch_name].filter(Boolean).join(' · ') || undefined}
                status={{ active: r.active }}
                tags={
                  <>
                    <Chip size="small" variant="outlined" color="primary" label={`${resourceTypeIcon(r.resource_type)} ${resourceTypeLabel(r.resource_type)}`} />
                    {r.zone ? <Chip size="small" variant="outlined" icon={<PlaceRoundedIcon />} label={r.zone} /> : null}
                  </>
                }
                note={
                  <>
                    ให้บริการ:{' '}
                    {(r.service_ids?.length ?? 0) === 0 ? 'ทุกบริการ' : linkedServicesLabel(r)}
                  </>
                }
                stats={[
                  { icon: <GroupsRoundedIcon />, value: String(r.capacity), label: 'ความจุ' },
                  { icon: <PaymentsRoundedIcon />, value: `฿${Number(r.unit_price ?? 0).toLocaleString('th-TH')}`, label: 'ราคา' },
                  { icon: <PlaceRoundedIcon />, value: r.floor ? `ชั้น ${r.floor}` : '-', label: 'ชั้น' },
                ]}
                onEdit={() => openEditDrawer(r)}
                onDelete={() => void confirmRemove(r)}
              />
            )}
            sx={{ display: { xs: 'flex', sm: 'none' }, mx: -2, mt: -2, p: 1.5, bgcolor: 'action.hover' }}
          />
          <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr>
                <th className="px-2 py-2 text-left">Code</th>
                <th className="px-2 py-2 text-left">Name</th>
                <th className="px-2 py-2 text-left">Type</th>
                <th className="px-2 py-2 text-left">Branch</th>
                <th className="px-2 py-2 text-left">Capacity</th>
                <th className="px-2 py-2 text-left">Price</th>
                <th className="px-2 py-2 text-left">Zone</th>
                <th className="px-2 py-2 text-left">บริการ</th>
                <th className="px-2 py-2 text-left">Status</th>
                <th className="px-2 py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-2 py-2">{r.resource_code ?? '-'}</td>
                  <td className="px-2 py-2">{r.resource_name}</td>
                  <td className="px-2 py-2">{resourceTypeLabel(r.resource_type)}</td>
                  <td className="px-2 py-2">{r.branches?.branch_name ?? '-'}</td>
                  <td className="px-2 py-2">{r.capacity}</td>
                  <td className="px-2 py-2">{Number(r.unit_price ?? 0).toLocaleString('th-TH')}</td>
                  <td className="px-2 py-2">{r.zone ?? '-'}</td>
                  <td className="px-2 py-2 max-w-[220px] truncate" title={linkedServicesLabel(r)}>
                    {(r.service_ids?.length ?? 0) === 0 ? <span className="text-slate-400">ทุกบริการ</span> : linkedServicesLabel(r)}
                  </td>
                  <td className="px-2 py-2">{r.active ? 'active' : 'inactive'}</td>
                  <td className="px-2 py-2">
                    <ActionIconGroup
                      actions={[
                        {
                          key: 'edit',
                          icon: <EditIcon fontSize="small" />,
                          labelKey: 'common.edit',
                          fallbackLabel: 'Edit',
                          onClick: () => openEditDrawer(r),
                        },
                        {
                          key: 'delete',
                          icon: <DeleteOutlineIcon fontSize="small" />,
                          labelKey: 'common.delete',
                          fallbackLabel: 'Delete',
                          color: 'error',
                          onClick: () => void removeRow(r.id),
                          confirm: {
                            tone: 'error',
                            title: 'ลบทรัพยากรนี้?',
                            description: 'คิวที่ผูกกับทรัพยากรนี้ยังอยู่ แต่จะเลือกใช้ทรัพยากรนี้ไม่ได้อีก',
                            context: { primary: r.resource_name, secondary: resourceTypeLabel(r.resource_type) },
                            confirmLabel: 'ลบทรัพยากร',
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
        )}
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
          <button className="fixed inset-0 z-40 bg-slate-900/30" onClick={closeSingleDrawer} aria-label="Close drawer" />
          <aside className="fixed right-0 top-0 z-50 h-dvh w-full overflow-y-auto bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:w-[60%]">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <h4 className="text-lg font-semibold">{editing ? 'แก้ไขทรัพยากร' : 'เพิ่มทรัพยากร'}</h4>
              <button className="btn-outline" onClick={closeSingleDrawer}>Close</button>
            </div>
            <form key={editing?.id ?? 'new'} onSubmit={submitSingle} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">ประเภททรัพยากร</label>
                <select className="input" name="resource_type" defaultValue={editing?.resource_type || 'table'} required>
                  {RESOURCE_TYPES.map((t) => <option key={t} value={t}>{resourceTypeLabel(t)}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">สาขา</label>
                <select className="input" name="branch_id" defaultValue={editing?.branch_id || ''}>
                  <option value="">ทุกสาขา/ไม่ระบุ</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Resource Code</label>
                <input className="input" name="resource_code" placeholder="เช่น T01, ROOM-A" defaultValue={editing?.resource_code ?? ''} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">ชื่อทรัพยากร</label>
                <input className="input" name="resource_name" placeholder="เช่น โต๊ะ 1, ห้องประชุม A" defaultValue={editing?.resource_name ?? ''} required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">ความจุ (Capacity)</label>
                <input className="input" name="capacity" type="number" min={1} defaultValue={editing?.capacity ?? 1} required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">ราคาต่อหน่วย</label>
                <input className="input" name="unit_price" type="number" min={0} step="0.01" defaultValue={editing?.unit_price ?? 0} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">ชั้น (Floor)</label>
                <input className="input" name="floor" placeholder="เช่น 1, 2, 3" defaultValue={editing?.floor ?? ''} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">โซน (Zone)</label>
                <input className="input" name="zone" placeholder="เช่น Indoor, Outdoor, VIP" defaultValue={editing?.zone ?? ''} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-medium text-slate-600">รายละเอียดเพิ่มเติม</label>
                <input className="input" name="description" placeholder="รายละเอียดทรัพยากร (ถ้ามี)" defaultValue={editing?.description ?? ''} />
              </div>
              <ServiceLinkPicker
                services={services}
                selected={linkedServiceIds}
                onToggle={(id) => setLinkedServiceIds((prev) => toggleIn(prev, id))}
              />
              <label className="sm:col-span-2 text-sm text-slate-600">
                <input className="mr-2" type="checkbox" name="active" defaultChecked={editing?.active ?? true} />
                Active
              </label>
              <div className="sm:col-span-2 flex gap-2 pt-1">
                <button className="btn-primary">{editing ? 'บันทึกการแก้ไข' : 'เพิ่มทรัพยากร'}</button>
                <button type="button" className="btn-outline" onClick={closeSingleDrawer}>ยกเลิก</button>
              </div>
            </form>
          </aside>
        </>
      ) : null}

      {bulkOpen ? (
        <>
          <button className="fixed inset-0 z-40 bg-slate-900/30" onClick={() => setBulkOpen(false)} aria-label="Close drawer" />
          <aside className="fixed right-0 top-0 z-50 h-dvh w-full overflow-y-auto bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:w-[60%]">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <h4 className="text-lg font-semibold">Quick Create Resource</h4>
              <button className="btn-outline" onClick={() => setBulkOpen(false)}>Close</button>
            </div>
            <form onSubmit={submitBulk} className="grid gap-3 sm:grid-cols-2">
              <select className="input" name="resource_type" defaultValue="table" required>
                {RESOURCE_TYPES.map((t) => <option key={t} value={t}>{resourceTypeLabel(t)}</option>)}
              </select>
              <select className="input" name="branch_id" defaultValue="">
                <option value="">ทุกสาขา/ไม่ระบุ</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
              </select>
              <select className="input" name="mode" defaultValue="range">
                <option value="range">Range (T01-T20)</option>
                <option value="list">List (ROOM-A,ROOM-B)</option>
              </select>
              <input className="input" name="prefix" placeholder="prefix เช่น T" defaultValue="T" />
              <input className="input" name="start_number" type="number" min={1} defaultValue={1} />
              <input className="input" name="end_number" type="number" min={1} defaultValue={20} />
              <input className="input" name="pad_length" type="number" min={0} max={6} defaultValue={2} />
              <input className="input" name="code_list" placeholder="ROOM-A, ROOM-B, ROOM-C" />
              <input className="input" name="name_prefix" placeholder="name prefix เช่น โต๊ะ" defaultValue="โต๊ะ" />
              <input className="input" name="capacity" type="number" min={1} defaultValue={4} />
              <input className="input" name="unit_price" type="number" min={0} step="0.01" placeholder="ราคาต่อหน่วย" defaultValue={0} />
              <input className="input" name="floor" placeholder="floor" />
              <input className="input" name="zone" placeholder="zone เช่น Indoor" />
              <ServiceLinkPicker
                services={services}
                selected={bulkServiceIds}
                onToggle={(id) => setBulkServiceIds((prev) => toggleIn(prev, id))}
              />
              <label className="sm:col-span-2 text-sm text-slate-600">
                <input className="mr-2" type="checkbox" name="active" defaultChecked />
                Active
              </label>
              <div className="sm:col-span-2 flex gap-2 pt-1">
                <button className="btn-primary">สร้างรายการ</button>
                <button type="button" className="btn-outline" onClick={() => setBulkOpen(false)}>ยกเลิก</button>
              </div>
            </form>
          </aside>
        </>
      ) : null}
    </div>
  );
}
