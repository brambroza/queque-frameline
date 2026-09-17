'use client';

import { useState } from 'react';
import Link from 'next/link';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { createClient } from '@/lib/supabase/client';

type Step = 'email' | 'otp' | 'password' | 'done';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function sendOtp() {
    setLoading(true);
    setError('');
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) { setError(error.message); return; }
      setStep('otp');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setLoading(true);
    setError('');
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'recovery' });
      if (error) { setError(error.message); return; }
      setStep('password');
    } finally {
      setLoading(false);
    }
  }

  async function updatePassword() {
    setLoading(true);
    setError('');
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) { setError(error.message); return; }
      setStep('done');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center p-4">
      <section className="card w-full max-w-md p-6">
        <h1 className="text-2xl font-bold">ลืมรหัสผ่าน</h1>

        {step === 'email' && (
          <>
            <p className="mt-1 text-sm text-slate-600">
              กรอก Email ของคุณ ระบบจะส่งรหัส OTP ให้ทางอีเมล
            </p>
            <div className="mt-4 space-y-3">
              <input
                className="input"
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                disabled={loading || !email}
                onClick={sendOtp}
                className="btn-primary w-full"
              >
                {loading ? 'กำลังส่ง...' : 'ส่งรหัส OTP'}
              </button>
            </div>
          </>
        )}

        {step === 'otp' && (
          <>
            <p className="mt-1 text-sm text-slate-600">
              กรอกรหัส 6 หลักที่ส่งไปยัง{' '}
              <span className="font-medium text-slate-800">{email}</span>
            </p>
            <div className="mt-4 space-y-3">
              <input
                className="input text-center tracking-[0.4em] text-xl font-mono"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                autoComplete="one-time-code"
                autoFocus
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                disabled={loading || otp.length !== 6}
                onClick={verifyOtp}
                className="btn-primary w-full"
              >
                {loading ? 'กำลังตรวจสอบ...' : 'ยืนยัน OTP'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('email'); setOtp(''); setError(''); }}
                className="w-full text-sm text-brand-700 hover:underline"
              >
                ส่งรหัสใหม่
              </button>
            </div>
          </>
        )}

        {step === 'password' && (
          <>
            <p className="mt-1 text-sm text-slate-600">ตั้งรหัสผ่านใหม่</p>
            <div className="mt-4 space-y-3">
              <div className="relative">
                <input
                  className="input w-full pr-10"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                  aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                >
                  {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                </button>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                disabled={loading || password.length < 8}
                onClick={updatePassword}
                className="btn-primary w-full"
              >
                {loading ? 'กำลังบันทึก...' : 'เปลี่ยนรหัสผ่าน'}
              </button>
            </div>
          </>
        )}

        {step === 'done' && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-green-600 font-medium">เปลี่ยนรหัสผ่านสำเร็จ</p>
            <Link href="/login" className="btn-primary w-full block text-center">
              เข้าสู่ระบบ
            </Link>
          </div>
        )}

        {step !== 'done' && (
          <p className="mt-4 text-sm">
            <Link href="/login" className="text-brand-700 hover:underline">
              กลับหน้าเข้าสู่ระบบ
            </Link>
          </p>
        )}
      </section>
    </main>
  );
}
