

import type { Metadata } from 'next';
import Link from 'next/link';
import { RegisterForm } from '@/components/auth/register-form';
import { LanguageSwitch } from '@/components/layout/language-switch';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'สมัครใช้งาน',
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return (
    <main className="min-h-screen grid place-items-center p-4 relative">
      <div className="absolute right-4 top-4">
        <LanguageSwitch />
      </div>
      <section className="card w-full max-w-md p-6">
        <h1 className="text-2xl font-bold">สมัครใช้งานร้านค้า</h1>
        <p className="mt-1 text-sm text-slate-600">สร้างบริษัท ร้าน และ shop_key อัตโนมัติ</p>
        <div className="mt-4">
          <Suspense fallback={<div>กำลังโหลด...</div>}>
            <RegisterForm />
          </Suspense>

        </div>
        <p className="mt-4 text-sm">มีบัญชีแล้ว? <Link className="text-brand-700" href="/login">เข้าสู่ระบบ</Link></p>
      </section>
    </main>
  );
}
