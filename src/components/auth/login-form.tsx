'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/toast';
import { identifyUser } from '@/lib/analytics/track';

export function LoginForm() {
  const { push } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = createClient();
      const formData = new FormData(e.currentTarget);
      const email = String(formData.get('email') ?? '');
      const password = String(formData.get('password') ?? '');

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        push(error.message, 'error');
        return;
      }

      // Ties every later event to this account; without it the funnel is anonymous.
      if (data.user) identifyUser(data.user.id);
      push('เข้าสู่ระบบสำเร็จ');
      router.push('/portal/dashboard');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch';
      if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
        push('เชื่อมต่อ Supabase ไม่ได้ (Network). ตรวจ URL/ANON key ใน .env และลองปิด VPN/AdBlock', 'error');
      } else {
        push(message, 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input className="input" type="email" name="email" placeholder="Email" required />
      <div className="relative">
        <input
          className="input w-full pr-10"
          type={showPassword ? 'text' : 'password'}
          name="password"
          placeholder="Password"
          required
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
      <div className="text-right -mt-1">
        <Link href="/forgot-password" className="text-sm text-brand-700 hover:underline">
          ลืมรหัสผ่าน?
        </Link>
      </div>
      <button disabled={loading} className="btn-primary w-full" type="submit">
        {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
      </button>
    </form>
  );
}
