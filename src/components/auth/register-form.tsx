'use client';

import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { getStoredUtm, track } from '@/lib/analytics/track';

/** Values must match service_templates.business_category so seeding finds templates. */
const BUSINESS_CATEGORIES = [
  { value: 'ร้านตัดผม', label: 'ร้านตัดผม / ร้านเสริมสวย' },
  { value: 'ร้านทำเล็บ', label: 'ร้านทำเล็บ' },
  { value: 'คลินิก', label: 'คลินิก / สถานพยาบาล' },
  { value: 'ร้านอาหาร', label: 'ร้านอาหาร' },
  { value: 'buffet', label: 'บุฟเฟ่ต์' },
  { value: 'fitness', label: 'ฟิตเนส / คลาสออกกำลังกาย' },
  { value: 'meeting_room', label: 'ห้องประชุม / พื้นที่เช่า' },
  { value: 'ร้านซ่อมรถ', label: 'ศูนย์บริการรถยนต์' },
  { value: 'ร้านซ่อมมือถือ', label: 'ร้านซ่อมมือถือ / ไอที' },
  { value: 'ทีมช่างติดตั้ง', label: 'ทีมช่าง / งานติดตั้งนอกสถานที่' },
  { value: 'งานราชการ', label: 'หน่วยงานราชการ' },
  { value: 'Consult', label: 'ที่ปรึกษา / นัดหมายส่วนตัว' },
];

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { push } = useToast();
  const [loading, setLoading] = useState(false);
  const selectedPlan = searchParams.get('plan') ?? '';

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const payload = { ...Object.fromEntries(formData.entries()), utm: getStoredUtm() };
    track('signup_started', { plan: selectedPlan || 'starter' });

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      push(json.error ?? 'สมัครใช้งานไม่สำเร็จ', 'error');
      return;
    }

    track('signup_completed', { plan: selectedPlan || 'starter', seeded: Boolean(json.data?.seeded) });
    push(json.message ?? 'สมัครสำเร็จ กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ');
    const email = String(formData.get('email') ?? '');
    sessionStorage.setItem('verify_email', email);
    router.push('/verify-email');
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input className="input" name="company_name" placeholder="ชื่อบริษัท" required />
      <input className="input" name="shop_name" placeholder="ชื่อร้าน" required />
      <input className="input" name="owner_name" placeholder="ชื่อเจ้าของ" required />
      <input className="input" name="phone" placeholder="เบอร์โทร" required />
      <input className="input" type="email" name="email" placeholder="Email" required />
      <input className="input" type="password" name="password" placeholder="Password" required />
      <select className="input" name="business_category" defaultValue="">
        <option value="">ประเภทธุรกิจ (ไม่บังคับ — ช่วยตั้งค่าบริการเริ่มต้นให้)</option>
        {BUSINESS_CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <input type="hidden" name="plan_name" value={selectedPlan} />
      <button disabled={loading} className="btn-primary w-full" type="submit">{loading ? 'กำลังสมัคร...' : 'สมัครใช้งาน'}</button>
    </form>
  );
}
