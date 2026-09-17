'use client';

import { Button } from '@mui/material';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { CONSENT_KEY } from '@/lib/consent/cookie-consent';

/** ปุ่มจัดการความยินยอมคุกกี้ — ล้างค่าเดิมแล้วรีโหลดเพื่อให้ banner แสดงใหม่ */
export function ManageConsentButton() {
  function reopen() {
    try {
      window.localStorage.removeItem(CONSENT_KEY);
    } catch {
      /* ignore */
    }
    window.location.reload();
  }

  return (
    <Button onClick={reopen} variant="outlined" startIcon={<TuneRoundedIcon />}>
      จัดการความยินยอมคุกกี้
    </Button>
  );
}
