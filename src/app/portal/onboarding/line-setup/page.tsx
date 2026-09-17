'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import AutoAwesomeMosaicRoundedIcon from '@mui/icons-material/AutoAwesomeMosaicRounded';
import { useToast } from '@/components/ui/toast';
import { RichMenuIconStudio } from '@/components/onboarding/rich-menu-icon-studio';

type LineSettings = {
  shop_key: string;
  liff_id: string;
  liff_id_login_shop: string;
  line_channel_access_token: string;
  line_channel_secret: string;
};

function normalizeLiffId(input?: string) {
  if (!input) return '';
  const raw = input.trim();
  const match = raw.match(/liff\.line\.me\/([^/?#]+)/);
  return match?.[1] ?? raw;
}

export default function LineSetupOnboardingPage() {
  const { push } = useToast();
  const [data, setData] = useState<LineSettings>({
    shop_key: '',
    liff_id: '',
    liff_id_login_shop: '',
    line_channel_access_token: '',
    line_channel_secret: '',
  });

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/line-settings', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) return push(json.error ?? 'โหลดข้อมูลไม่สำเร็จ', 'error');
      setData({
        shop_key: json.data?.shop_key ?? '',
        liff_id: json.data?.liff_id ?? '',
        liff_id_login_shop: json.data?.liff_id_login_shop ?? '',
        line_channel_access_token: json.data?.line_channel_access_token ?? '',
        line_channel_secret: json.data?.line_channel_secret ?? '',
      });
    })();
  }, [push]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://queuebooking.com';
  const webhookUrl = `${appUrl}/api/line/webhook/${data.shop_key || '{shopKey}'}`;
  const liffBookingEndpoint = `${appUrl}/liff/${data.shop_key || '{shopKey}'}`;
  const liffMemberEndpoint = `${appUrl}/liff/${data.shop_key || '{shopKey}'}/member`;
  const bookingLiffId = normalizeLiffId(data.liff_id);
  const memberLiffId = normalizeLiffId(data.liff_id_login_shop);
  const bookingLiffUrl = bookingLiffId ? `https://liff.line.me/${bookingLiffId}` : '';
  const memberLiffUrl = memberLiffId ? `https://liff.line.me/${memberLiffId}` : '';

  const checklist = useMemo(
    () => [
      { label: 'Webhook URL', ok: Boolean(data.line_channel_secret && data.shop_key) },
      { label: 'LIFF Booking', ok: Boolean(bookingLiffId) },
      { label: 'LIFF Member/Login', ok: Boolean(memberLiffId) },
      { label: 'Channel Access Token', ok: Boolean(data.line_channel_access_token) },
    ],
    [data, bookingLiffId, memberLiffId],
  );

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      push(`คัดลอก ${label} แล้ว`);
    } catch {
      push(`คัดลอก ${label} ไม่สำเร็จ`, 'error');
    }
  }

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5" fontWeight={800}>LINE Setup Onboarding</Typography>
        <Typography variant="body2" color="text.secondary">
          ตั้งค่า Messaging API, LIFF Booking, LIFF Member และตรวจสอบความพร้อมก่อน Go Live
        </Typography>
      </Box>

      <Alert severity="info">
        หลังตั้งค่าเสร็จ ให้ทดสอบที่เมนู <b>Mock/Demo</b> และจองคิวผ่าน LIFF ก่อนใช้งานจริง
      </Alert>

      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700}>Setup Checklist</Typography>
          <Stack direction="row" flexWrap="wrap" gap={1} mt={1}>
            {checklist.map((x) => (
              <Chip key={x.label} color={x.ok ? 'success' : 'default'} label={`${x.label} • ${x.ok ? 'OK' : 'Pending'}`} />
            ))}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700}>Step 1: Messaging API (Webhook)</Typography>
          <Typography variant="body2" color="text.secondary" mb={1.5}>
            เปิดใช้งาน Webhook และวาง URL นี้ใน LINE Developers Console
          </Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
            <Box sx={{ flex: 1, p: 1.2, borderRadius: 1, bgcolor: 'grey.100', fontFamily: 'monospace', fontSize: 13 }}>
              {webhookUrl}
            </Box>
            <Button variant="outlined" startIcon={<ContentCopyRoundedIcon />} onClick={() => void copy(webhookUrl, 'Webhook URL')}>
              Copy
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700}>Step 2: LIFF Booking Endpoint</Typography>
          <Typography variant="body2" color="text.secondary" mb={1.5}>
            LIFF App สำหรับจองคิวของลูกค้า
          </Typography>
          <Stack spacing={1}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
              <Box sx={{ flex: 1, p: 1.2, borderRadius: 1, bgcolor: 'grey.100', fontFamily: 'monospace', fontSize: 13 }}>
                Endpoint: {liffBookingEndpoint}
              </Box>
              <Button variant="outlined" startIcon={<ContentCopyRoundedIcon />} onClick={() => void copy(liffBookingEndpoint, 'LIFF Booking Endpoint')}>
                Copy
              </Button>
            </Stack>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
              <Box sx={{ flex: 1, p: 1.2, borderRadius: 1, bgcolor: 'grey.100', fontFamily: 'monospace', fontSize: 13 }}>
                LIFF URL: {bookingLiffUrl || 'ยังไม่ได้ตั้งค่า liff_id'}
              </Box>
              {bookingLiffUrl ? (
                <Button component={Link} href={bookingLiffUrl} target="_blank" variant="outlined" startIcon={<OpenInNewRoundedIcon />}>
                  Open
                </Button>
              ) : null}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700}>Step 3: LIFF Member/Login Endpoint</Typography>
          <Typography variant="body2" color="text.secondary" mb={1.5}>
            LIFF App สำหรับสมาชิก/ประวัติการจอง
          </Typography>
          <Stack spacing={1}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
              <Box sx={{ flex: 1, p: 1.2, borderRadius: 1, bgcolor: 'grey.100', fontFamily: 'monospace', fontSize: 13 }}>
                Endpoint: {liffMemberEndpoint}
              </Box>
              <Button variant="outlined" startIcon={<ContentCopyRoundedIcon />} onClick={() => void copy(liffMemberEndpoint, 'LIFF Member Endpoint')}>
                Copy
              </Button>
            </Stack>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
              <Box sx={{ flex: 1, p: 1.2, borderRadius: 1, bgcolor: 'grey.100', fontFamily: 'monospace', fontSize: 13 }}>
                LIFF URL: {memberLiffUrl || 'ยังไม่ได้ตั้งค่า liff_id_login_shop'}
              </Box>
              {memberLiffUrl ? (
                <Button component={Link} href={memberLiffUrl} target="_blank" variant="outlined" startIcon={<OpenInNewRoundedIcon />}>
                  Open
                </Button>
              ) : null}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ md: 'center' }}>
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>Step 4: สร้างภาพ Rich Menu อัตโนมัติตามธุรกิจ</Typography>
              <Typography variant="body2" color="text.secondary">
                เลือกประเภทธุรกิจ ระบบจัดเลย์เอาต์ ไอคอน ข้อความ และสีให้ พร้อมดาวน์โหลดหรือเผยแพร่เข้า LINE OA ได้ทันที
              </Typography>
            </Box>
            <Button component={Link} href="/portal/rich-menu" variant="contained" startIcon={<AutoAwesomeMosaicRoundedIcon />} sx={{ whiteSpace: 'nowrap' }}>
              เปิดตัวสร้าง Rich Menu
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <RichMenuIconStudio />

      <Divider />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Button component={Link} href="/portal/line-settings" variant="contained">ไปหน้า LINE Settings</Button>
        <Button component={Link} href="/portal/rich-menu" variant="outlined">สร้าง Rich Menu</Button>
        <Button component={Link} href="/portal/rich-menu-guide" variant="outlined">ไปหน้า Rich Menu Guide</Button>
      </Stack>
    </Stack>
  );
}

