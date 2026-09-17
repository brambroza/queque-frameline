'use client';

import { FormEvent, useState } from 'react';
import { z } from 'zod';
import { Alert, Box, Button, MenuItem, Stack, TextField } from '@mui/material';
import { useToast } from '@/components/ui/toast';
import { track } from '@/lib/analytics/track';

const schema = z.object({
  name: z.string().trim().min(2, 'กรุณากรอกชื่ออย่างน้อย 2 ตัวอักษร'),
  company_name: z.string().trim().optional(),
  phone: z.string().trim().min(8, 'กรุณากรอกเบอร์โทรให้ถูกต้อง'),
  email: z.string().trim().email('รูปแบบอีเมลไม่ถูกต้อง'),
  business_type: z.string().trim().min(2, 'กรุณาเลือกประเภทธุรกิจ'),
  message: z.string().trim().min(5, 'กรุณากรอกข้อความอย่างน้อย 5 ตัวอักษร'),
  website: z.string().optional(),
});

export function ContactForm() {
  const { push } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setError('');
    setSuccess('');
    const form = e.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get('name') ?? ''),
      company_name: String(formData.get('company_name') ?? ''),
      phone: String(formData.get('phone') ?? ''),
      email: String(formData.get('email') ?? ''),
      business_type: String(formData.get('business_type') ?? ''),
      message: String(formData.get('message') ?? ''),
      website: String(formData.get('website') ?? ''),
    };
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/contact-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const json = await res.json().catch(() => ({ error: 'ไม่สามารถอ่านผลลัพธ์จากเซิร์ฟเวอร์ได้' }));
      if (!res.ok) {
        setError(json.error ?? 'ส่งฟอร์มไม่สำเร็จ');
        return;
      }

      form.reset();
      setSuccess('ส่งข้อมูลเรียบร้อย ทีมงานจะติดต่อกลับเร็วที่สุด');
      track('contact_submitted', { business_type: parsed.data.business_type });
      push('ส่งข้อมูลเรียบร้อย ทีมงานจะติดต่อกลับเร็วที่สุด', 'success');
    } catch {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box component="form" onSubmit={onSubmit} sx={{ display: 'grid', gap: 1.5 }}>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {success ? <Alert severity="success">{success}</Alert> : null}
      <TextField
        name="website"
        label="Website"
        autoComplete="off"
        tabIndex={-1}
        sx={{ display: 'none' }}
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <TextField name="name" label="ชื่อ" fullWidth required />
        <TextField name="company_name" label="ชื่อบริษัท/ร้านค้า" fullWidth />
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <TextField name="phone" label="เบอร์โทร" fullWidth required />
        <TextField name="email" label="อีเมล" type="email" fullWidth required />
      </Stack>
      <TextField select name="business_type" label="ประเภทธุรกิจ" required defaultValue="">
        <MenuItem value="">เลือกประเภทธุรกิจ</MenuItem>
        <MenuItem value="ร้านตัดผม">ร้านตัดผม</MenuItem>
        <MenuItem value="คลินิก">คลินิก</MenuItem>
        <MenuItem value="ร้านอาหาร">ร้านอาหาร</MenuItem>
        <MenuItem value="ร้านบุฟเฟ่ต์">ร้านบุฟเฟ่ต์</MenuItem>
        <MenuItem value="ห้องประชุม">ห้องประชุม</MenuItem>
        <MenuItem value="ศูนย์บริการ">ศูนย์บริการ</MenuItem>
        <MenuItem value="อื่น ๆ">อื่น ๆ</MenuItem>
      </TextField>
      <TextField name="message" label="ข้อความ" multiline minRows={4} required />
      <Button type="submit" variant="contained" size="large" disabled={loading}>
        {loading ? 'กำลังส่ง...' : 'ส่งข้อมูลติดต่อ'}
      </Button>
    </Box>
  );
}
