import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/login-form';
import { LanguageSwitch } from '@/components/layout/language-switch';

export const metadata: Metadata = {
  title: 'เข้าสู่ระบบ',
  robots: { index: false, follow: false },
};

const LINK_ERRORS: Record<string, string> = {
  invalid_link: 'ลิงก์ไม่ถูกต้อง กรุณาเปิดจากอีเมลคำเชิญอีกครั้ง',
  link_expired: 'ลิงก์หมดอายุหรือถูกใช้ไปแล้ว ขอให้ผู้ดูแลระบบส่งคำเชิญใหม่',
};

/** Portal sign-in. No self-registration: accounts are created by an admin and invited by email. */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const message = error ? LINK_ERRORS[error] : null;
  return (
    <main className="min-h-screen grid place-items-center p-4 relative">
      <div className="absolute right-4 top-4">
        <LanguageSwitch />
      </div>
      <section className="card w-full max-w-md p-6">
        <h1 className="text-2xl font-bold">เข้าสู่ระบบ</h1>
        <p className="mt-1 text-sm text-slate-600">ระบบคิวรับ-ส่งสินค้า Fameline — สำหรับผู้ดูแลและพนักงาน</p>
        {message ? <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800" role="alert">{message}</p> : null}
        <div className="mt-4">
          <LoginForm />
        </div>
        <p className="mt-4 text-sm text-slate-600">ยังไม่มีบัญชี? ขอให้ผู้ดูแลระบบส่งคำเชิญทางอีเมล</p>
      </section>
    </main>
  );
}
