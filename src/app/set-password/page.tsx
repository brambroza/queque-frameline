'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/toast';
import { MUST_CHANGE_PASSWORD_KEY } from '@/lib/staff/password-flag';

/**
 * Invited staff land here from the email link (via /auth/callback) and choose
 * their password. Also serves the "#access_token" implicit-flow links, which
 * the browser client picks up on load.
 *
 * `?first=1`: signed in with the shared starting password (login form) — same form,
 * plus "change later". The offer comes back on every login until they change it.
 * `?change=1`: "เปลี่ยนรหัสผ่าน" from the profile drawer — same form, plus cancel.
 */

type Mode = 'invite' | 'first' | 'change';
export default function SetPasswordPage() {
  const router = useRouter();
  const { push } = useToast();
  const [mode, setMode] = useState<Mode>('invite');
  const firstLogin = mode === 'first';
  const [ready, setReady] = useState<'checking' | 'ok' | 'no_session'>('checking');
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setMode(params.get('first') === '1' ? 'first' : params.get('change') === '1' ? 'change' : 'invite');
    const supabase = createClient();
    let done = false;
    const finish = (ok: boolean, mail?: string | null) => { if (done) return; done = true; setEmail(mail ?? null); setReady(ok ? 'ok' : 'no_session'); };
    // The implicit-flow hash is processed asynchronously; give it a moment before deciding.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => { if (session) finish(true, session.user.email); });
    supabase.auth.getSession().then(({ data }) => { if (data.session) finish(true, data.session.user.email); });
    const t = setTimeout(() => finish(false), 2500);
    return () => { clearTimeout(t); sub.subscription.unsubscribe(); };
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'); return; }
    if (password !== confirm) { setError('รหัสผ่านทั้งสองช่องไม่ตรงกัน'); return; }
    setLoading(true);
    setError('');
    try {
      // Clearing the flag in the same call: no more "change your password" offer after this.
      const { error: err } = await createClient().auth.updateUser({ password, data: { [MUST_CHANGE_PASSWORD_KEY]: false } });
      if (err) { setError(err.message); return; }
      push(mode === 'invite' ? 'ตั้งรหัสผ่านแล้ว — เข้าสู่ระบบสำเร็จ' : 'เปลี่ยนรหัสผ่านแล้ว');
      router.replace('/portal/dashboard');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center p-4">
      <section className="card w-full max-w-md p-6">
        <h1 className="text-2xl font-bold">{mode === 'first' ? 'ตั้งรหัสผ่านของคุณ' : mode === 'change' ? 'เปลี่ยนรหัสผ่าน' : 'ตั้งรหัสผ่าน'}</h1>
        {ready === 'checking' ? <p className="mt-2 text-sm text-slate-600">กำลังตรวจสอบลิงก์…</p> : null}
        {ready === 'no_session' ? (
          <div className="mt-2 space-y-3 text-sm text-slate-600">
            <p>ลิงก์นี้หมดอายุหรือถูกใช้ไปแล้ว ขอให้ผู้ดูแลระบบส่งคำเชิญใหม่ หรือถ้าเคยตั้งรหัสผ่านแล้ว ให้เข้าสู่ระบบตามปกติ</p>
            <a className="btn-primary inline-block" href="/login">ไปหน้าเข้าสู่ระบบ</a>
          </div>
        ) : null}
        {ready === 'ok' ? (
          <form className="mt-4 space-y-3" onSubmit={save}>
            {firstLogin ? (
              <p className="text-sm text-slate-600">บัญชี <b>{email}</b> ยังใช้รหัสผ่านเริ่มต้นที่ผู้ใช้ใหม่ทุกคนใช้ร่วมกัน — แนะนำให้ตั้งรหัสผ่านของคุณเองก่อนเริ่มใช้งาน</p>
            ) : mode === 'change' ? (
              <p className="text-sm text-slate-600">บัญชี <b>{email}</b> — ตั้งรหัสผ่านใหม่ ใช้แทนรหัสเดิมตั้งแต่การเข้าสู่ระบบครั้งถัดไป</p>
            ) : (
              <p className="text-sm text-slate-600">บัญชี <b>{email}</b> — ตั้งรหัสผ่านสำหรับเข้าใช้ระบบคิว</p>
            )}
            <div className="relative">
              <input id="new-password" className="input pr-10" type={show ? 'text' : 'password'} placeholder="รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" autoFocus />
              <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500" onClick={() => setShow((s) => !s)} aria-label={show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}>
                {show ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
              </button>
            </div>
            <input id="confirm-password" className="input" type={show ? 'text' : 'password'} placeholder="ยืนยันรหัสผ่าน" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button disabled={loading} className="btn-primary w-full" type="submit">{loading ? 'กำลังบันทึก…' : mode === 'change' ? 'บันทึกรหัสผ่านใหม่' : 'บันทึกและเข้าสู่ระบบ'}</button>
            {mode === 'change' ? (
              <button type="button" disabled={loading} className="btn-outline w-full" onClick={() => router.back()}>
                ยกเลิก
              </button>
            ) : null}
            {firstLogin ? (
              <button type="button" disabled={loading} className="btn-outline w-full" onClick={() => router.replace('/portal/dashboard')}>
                เปลี่ยนทีหลัง
              </button>
            ) : null}
          </form>
        ) : null}
      </section>
    </main>
  );
}
