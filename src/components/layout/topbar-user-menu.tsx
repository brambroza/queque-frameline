'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Drawer } from '@mui/material';
import { useToast } from '@/components/ui/toast';
import { ColorModeToggle } from '@/components/theme/color-mode-toggle';
import { LanguageSwitch } from '@/components/layout/language-switch';

type Props = {
  initialName?: string | null;
  email?: string | null;
  appVersion: string;
};

function initials(name?: string | null, email?: string | null) {
  const raw = (name || email || 'U').trim();
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return raw.slice(0, 2).toUpperCase();
}

/**
 * Avatar button in the topbar that opens the profile drawer (name / phone /
 * app version / logout). On phones the drawer also hosts the color-mode and
 * language toggles, which the topbar hides below the `sm` breakpoint.
 */
export function TopbarUserMenu({ initialName, email, appVersion }: Props) {
  const router = useRouter();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(initialName ?? '');
  const [phone, setPhone] = useState('');

  const avatarText = useMemo(() => initials(name, email), [name, email]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const res = await fetch('/api/me-profile', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) return;
      setName(json.data?.full_name ?? initialName ?? '');
      setPhone(json.data?.phone ?? '');
    })();
  }, [open, initialName]);

  async function saveProfile() {
    if (!name.trim()) return push('กรุณาระบุชื่อ', 'error');
    setSaving(true);
    const res = await fetch('/api/me-profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: name.trim(), phone: phone.trim() || null }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) return push(json.error ?? 'บันทึกโปรไฟล์ไม่สำเร็จ', 'error');
    push('บันทึกโปรไฟล์แล้ว');
    router.refresh();
  }

  async function logout() {
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    if (!res.ok) return push('Logout ไม่สำเร็จ', 'error');
    router.replace('/login');
  }

  return (
    <>
      <button
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-emerald-200 bg-surface text-xs font-semibold text-content"
        onClick={() => setOpen(true)}
        aria-label="User menu"
      >
        {avatarText}
      </button>
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 448 },
            maxWidth: '100%',
            p: 2.5,
            pb: 'calc(20px + env(safe-area-inset-bottom))',
          },
        }}
      >
        <div className="mb-4 flex items-center justify-between border-b pb-3">
          <h4 className="text-lg font-semibold">My Profile</h4>
          <button className="btn-outline" onClick={() => setOpen(false)}>Close</button>
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border bg-surface-soft p-3">
            <p className="text-xs text-muted">Signed in as</p>
            <p className="text-sm font-medium">{email ?? '-'}</p>
          </div>
          {/* Phone-only: toggles that the topbar hides below `sm`. */}
          <Box
            sx={{
              display: { xs: 'flex', sm: 'none' },
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              p: 1.5,
            }}
          >
            <span className="text-sm text-muted">การแสดงผล / ภาษา</span>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ColorModeToggle />
              <LanguageSwitch />
            </Box>
          </Box>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">ชื่อ</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">เบอร์โทร</span>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
          </label>
          <div className="rounded-xl border bg-surface p-3 text-sm">
            <p className="text-muted">App Version</p>
            <p className="font-medium">{appVersion}</p>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <button className="btn-primary" onClick={() => void saveProfile()} disabled={saving}>
              {saving ? 'กำลังบันทึก...' : 'บันทึกโปรไฟล์'}
            </button>
            <button className="btn-outline" onClick={() => void logout()}>Logout</button>
          </div>
        </div>
      </Drawer>
    </>
  );
}
