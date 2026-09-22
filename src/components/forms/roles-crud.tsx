'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControlLabel,
  MenuItem, Skeleton, Stack, Switch, TextField, Typography,
} from '@mui/material';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useI18n } from '@/components/i18n/i18n-provider';
import { ADMIN_LOCKED_MENUS, MENU_GROUPS, MENU_ITEMS, menuKeysForLevel, menuKeysOfRole, type MenuKey } from '@/lib/auth/menu-registry';
import type { AppRole } from '@/types/db';

type RoleRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  access_level: AppRole;
  menu_keys: string[] | null;
  is_system: boolean;
  user_count: number;
};

type FormState = {
  id: string | null;
  code: string;
  name: string;
  description: string;
  access_level: AppRole;
  /** true = every menu the level allows (stored as null) */
  all_menus: boolean;
  menu_keys: MenuKey[];
};

const LEVEL_LABEL: Record<AppRole, string> = { admin: 'ผู้ดูแลระบบ', staff: 'พนักงาน' };
const LEVEL_HINT: Record<AppRole, string> = {
  admin: 'ทำได้ทุกอย่างรวมถึงตั้งค่า อนุมัติ และจัดการพนักงาน',
  staff: 'งานหน้าคลัง: ดู/สร้างคิว เช็คอิน เรียกคิว บันทึกการชำระ — เมนูตั้งค่าเปิดดูได้แต่แก้ไม่ได้',
};

const emptyForm: FormState = { id: null, code: '', name: '', description: '', access_level: 'staff', all_menus: false, menu_keys: [] };

function toForm(r: RoleRow): FormState {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description ?? '',
    access_level: r.access_level,
    all_menus: r.menu_keys == null,
    menu_keys: menuKeysOfRole(r),
  };
}

/** Admin-managed roles: level (API tier) + which portal menus each role sees. */
export function RolesCrud({ isAdmin }: { isAdmin: boolean }) {
  const { push } = useToast();
  const confirm = useConfirm();
  const { t } = useI18n();
  const [rows, setRows] = useState<RoleRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/roles', { cache: 'no-store' });
      const j = (await res.json()) as { data?: RoleRow[]; error?: string };
      if (!res.ok || !j.data) throw new Error(j.error ?? 'โหลดสิทธิ์ไม่สำเร็จ');
      setRows(j.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดสิทธิ์ไม่สำเร็จ');
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function save() {
    if (!form || saving) return;
    if (!form.name.trim()) { push('กรุณาตั้งชื่อสิทธิ์', 'error'); return; }
    if (!form.id && !/^[a-z][a-z0-9_]{1,31}$/.test(form.code)) { push('รหัสใช้ a-z 0-9 _ ขึ้นต้นด้วยตัวอักษร ยาว 2–32', 'error'); return; }
    setSaving(true);
    try {
      const body = {
        ...(form.id ? { id: form.id } : { code: form.code }),
        name: form.name.trim(),
        description: form.description.trim() || null,
        access_level: form.access_level,
        menu_keys: form.all_menus ? null : form.menu_keys,
      };
      const res = await fetch('/api/roles', { method: form.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { push(j.error ?? 'บันทึกไม่สำเร็จ', 'error'); return; }
      push(form.id ? 'บันทึกสิทธิ์แล้ว' : 'เพิ่มสิทธิ์แล้ว');
      setForm(null);
      void load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(r: RoleRow) {
    const ok = await confirm({
      tone: 'error',
      title: 'ลบสิทธิ์นี้?',
      description: 'ลบได้เฉพาะสิทธิ์ที่ไม่มีพนักงานใช้อยู่',
      context: { primary: r.name, secondary: r.code },
      confirmLabel: 'ลบสิทธิ์',
    });
    if (!ok) return;
    const res = await fetch(`/api/roles?id=${r.id}`, { method: 'DELETE' });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) { push(j.error ?? 'ลบไม่สำเร็จ', 'error'); return; }
    push('ลบสิทธิ์แล้ว');
    void load();
  }

  const allowedForLevel = form ? menuKeysForLevel(form.access_level) : [];
  const locked = form?.access_level === 'admin' ? ADMIN_LOCKED_MENUS : [];

  function toggleMenu(key: MenuKey) {
    setForm((p) => {
      if (!p) return p;
      const has = p.menu_keys.includes(key);
      return { ...p, menu_keys: has ? p.menu_keys.filter((k) => k !== key) : [...p.menu_keys, key] };
    });
  }

  function setLevel(level: AppRole) {
    setForm((p) => (p ? { ...p, access_level: level, menu_keys: p.menu_keys.filter((k) => menuKeysForLevel(level).includes(k)) } : p));
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>สิทธิ์และเมนู</Typography>
          <Typography variant="body2" color="text.secondary">
            แต่ละสิทธิ์กำหนดระดับ (ผู้ดูแลระบบ / พนักงาน) และเมนูที่เห็น — พนักงาน 1 คนมี 1 สิทธิ์ เมนูที่ไม่ได้ติ๊กจะไม่แสดงและเปิดตรงไม่ได้
          </Typography>
        </Box>
        {isAdmin ? <Button variant="contained" onClick={() => setForm(emptyForm)}>เพิ่มสิทธิ์</Button> : null}
      </Stack>
      {error ? <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void load()}>ลองใหม่</Button>}>{error}</Alert> : null}
      {!rows && !error ? <Skeleton variant="rounded" height={200} /> : null}
      {rows?.length === 0 ? <Alert severity="info">ยังไม่มีสิทธิ์ — รัน migration seed ก่อน</Alert> : null}

      {rows?.map((r) => {
        const menus = menuKeysOfRole(r);
        return (
          <Card key={r.id} variant="outlined">
            <CardContent>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography fontWeight={800}>{r.name}</Typography>
                    <Chip size="small" label={r.code} variant="outlined" />
                    <Chip size="small" color={r.access_level === 'admin' ? 'primary' : 'default'} label={LEVEL_LABEL[r.access_level]} />
                    {r.is_system ? <Chip size="small" variant="outlined" label="พื้นฐาน" /> : null}
                    <Chip size="small" variant="outlined" label={`${r.user_count} คน`} />
                  </Stack>
                  {r.description ? <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{r.description}</Typography> : null}
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                    เมนู ({menus.length}/{MENU_ITEMS.length}): {r.menu_keys == null ? 'ทุกเมนูของระดับนี้ — ' : ''}
                    {menus.map((k) => { const m = MENU_ITEMS.find((x) => x.key === k)!; return t(m.labelKey, m.fallback); }).join(' · ') || 'ไม่มี'}
                  </Typography>
                </Box>
                {isAdmin ? (
                  <Stack direction="row" spacing={1} sx={{ flexShrink: 0, alignSelf: { xs: 'stretch', sm: 'flex-start' } }}>
                    <Button size="small" variant="outlined" onClick={() => setForm(toForm(r))}>แก้ไข</Button>
                    {!r.is_system ? <Button size="small" color="error" variant="outlined" disabled={r.user_count > 0} onClick={() => void remove(r)}>ลบ</Button> : null}
                  </Stack>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={Boolean(form)} onClose={saving ? undefined : () => setForm(null)} fullWidth maxWidth="sm">
        {form ? (
          <>
            <DialogTitle>{form.id ? 'แก้ไขสิทธิ์' : 'เพิ่มสิทธิ์'}</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ pt: 0.5 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <TextField size="small" label="รหัส (a-z, 0-9, _)" value={form.code} disabled={Boolean(form.id)} fullWidth
                    onChange={(e) => setForm((p) => (p ? { ...p, code: e.target.value.toLowerCase() } : p))} helperText={form.id ? 'เปลี่ยนรหัสไม่ได้' : 'เช่น gate, finance'} />
                  <TextField size="small" label="ชื่อสิทธิ์" value={form.name} fullWidth onChange={(e) => setForm((p) => (p ? { ...p, name: e.target.value } : p))} />
                </Stack>
                <TextField size="small" label="คำอธิบาย" value={form.description} onChange={(e) => setForm((p) => (p ? { ...p, description: e.target.value } : p))} />
                <TextField select size="small" label="ระดับสิทธิ์" value={form.access_level} helperText={LEVEL_HINT[form.access_level]}
                  disabled={rows?.find((r) => r.id === form.id)?.is_system ?? false} onChange={(e) => setLevel(e.target.value as AppRole)}>
                  <MenuItem value="staff">{LEVEL_LABEL.staff}</MenuItem>
                  <MenuItem value="admin">{LEVEL_LABEL.admin}</MenuItem>
                </TextField>

                <Divider />
                <FormControlLabel control={<Switch checked={form.all_menus} onChange={(e) => setForm((p) => (p ? { ...p, all_menus: e.target.checked } : p))} />}
                  label="เห็นทุกเมนูที่ระดับนี้อนุญาต" />
                {!form.all_menus ? MENU_GROUPS.map((g) => (
                  <Box key={g.key}>
                    <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t(g.titleKey, g.fallback)}</Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                      {MENU_ITEMS.filter((m) => m.group === g.key).map((m) => {
                        const allowed = allowedForLevel.includes(m.key);
                        const isLocked = locked.includes(m.key);
                        return (
                          <FormControlLabel key={m.key} disabled={!allowed || isLocked}
                            control={<Checkbox size="small" checked={isLocked || form.menu_keys.includes(m.key)} onChange={() => toggleMenu(m.key)} />}
                            label={<Typography variant="body2">{t(m.labelKey, m.fallback)}{!allowed ? ' (เฉพาะผู้ดูแลระบบ)' : isLocked ? ' (บังคับ)' : ''}</Typography>} />
                        );
                      })}
                    </Box>
                  </Box>
                )) : null}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setForm(null)} disabled={saving}>ปิด</Button>
              <Button variant="contained" onClick={() => void save()} disabled={saving}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</Button>
            </DialogActions>
          </>
        ) : null}
      </Dialog>
    </Stack>
  );
}
