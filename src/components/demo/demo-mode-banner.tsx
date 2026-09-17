'use client';

import Link from 'next/link';
import { Alert, AlertTitle, Button, Stack } from '@mui/material';

export function DemoModeBanner({ show = false }: { show?: boolean }) {
  if (!show) return null;

  return (
    <Alert
      severity="warning"
      sx={{
        mb: 2,
        border: '1px solid',
        borderColor: '#f0d7a1',
        bgcolor: '#fff8e8',
      }}
      action={
        <Stack direction="row" spacing={1} sx={{ mr: 1 }}>
          <Button component={Link} href="/portal/line-settings" size="small" variant="contained" color="warning">
            เชื่อม LINE OA
          </Button>
          <Button component={Link} href="/portal/demo-sandbox" size="small" variant="outlined" color="warning">
            Demo Sandbox
          </Button>
        </Stack>
      }
    >
      <AlertTitle sx={{ mb: 0.4 }}>โหมดทดลองใช้งาน</AlertTitle>
      คุณกำลังใช้งานโหมดตัวอย่าง ข้อมูลนี้ใช้สำหรับทดลองเท่านั้น
    </Alert>
  );
}

