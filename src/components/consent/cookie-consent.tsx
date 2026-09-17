'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Link as MLink,
  Paper,
  Slide,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import CookieRoundedIcon from '@mui/icons-material/CookieRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import {
  ACCEPT_ALL,
  REJECT_ALL,
  getConsent,
  saveConsent,
} from '@/lib/consent/cookie-consent';

const PRIVACY_HREF = '/privacy';

/** path ที่ไม่ต้องแสดง banner (embedded / signage) */
const HIDDEN_PREFIXES = ['/liff', '/display'];

type Prefs = { analytics: boolean; marketing: boolean };

const categories: Array<{
  key: keyof Prefs | 'necessary';
  title: string;
  desc: string;
  locked?: boolean;
}> = [
  {
    key: 'necessary',
    title: 'คุกกี้ที่จำเป็น',
    desc: 'จำเป็นต่อการทำงานพื้นฐานของระบบ เช่น การเข้าสู่ระบบและความปลอดภัย ไม่สามารถปิดได้',
    locked: true,
  },
  {
    key: 'analytics',
    title: 'คุกกี้เพื่อการวิเคราะห์',
    desc: 'ช่วยให้เราเข้าใจการใช้งานเว็บไซต์ เพื่อปรับปรุงประสบการณ์ให้ดียิ่งขึ้น',
  },
  {
    key: 'marketing',
    title: 'คุกกี้เพื่อการตลาด',
    desc: 'ใช้เพื่อนำเสนอเนื้อหาและโฆษณาให้ตรงกับความสนใจของคุณ',
  },
];

export function CookieConsent() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>({ analytics: false, marketing: false });

  useEffect(() => {
    // แสดงเฉพาะเมื่อยังไม่เคยเลือก consent
    if (!getConsent()) setOpen(true);
  }, []);

  const hidden = HIDDEN_PREFIXES.some((p) => pathname.startsWith(p));
  if (hidden) return null;

  function acceptAll() {
    saveConsent(ACCEPT_ALL);
    setOpen(false);
    setSettingsOpen(false);
  }

  function rejectAll() {
    saveConsent(REJECT_ALL);
    setOpen(false);
    setSettingsOpen(false);
  }

  function savePrefs() {
    saveConsent({ necessary: true, ...prefs });
    setOpen(false);
    setSettingsOpen(false);
  }

  function openSettings() {
    const current = getConsent();
    setPrefs({
      analytics: current?.analytics ?? false,
      marketing: current?.marketing ?? false,
    });
    setSettingsOpen(true);
  }

  if (!open && !settingsOpen) return null;

  return (
    <>
      <Slide direction="up" in={open && !settingsOpen} mountOnEnter unmountOnExit>
        <Box
          sx={{
            position: 'fixed',
            zIndex: (theme) => theme.zIndex.snackbar + 1,
            left: { xs: 12, sm: 16 },
            right: { xs: 12, sm: 16 },
            bottom: { xs: 12, sm: 16 },
            display: 'flex',
            justifyContent: { xs: 'stretch', md: 'flex-start' },
          }}
        >
          <Paper
            elevation={0}
            sx={{
              width: '100%',
              maxWidth: 460,
              p: { xs: 2.25, sm: 2.75 },
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: 'var(--shadow-pop)',
              bgcolor: (theme) =>
                theme.palette.mode === 'dark' ? 'rgba(20,26,36,0.92)' : 'rgba(255,255,255,0.96)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <Box
                sx={{
                  flexShrink: 0,
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: (theme) => `${theme.palette.primary.main}22`,
                  color: 'primary.main',
                }}
              >
                <CookieRoundedIcon fontSize="small" />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography fontWeight={800} sx={{ fontSize: 15 }}>
                  เว็บไซต์นี้ใช้คุกกี้ 🍪
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.7 }}>
                  เราใช้คุกกี้เพื่อให้ระบบทำงานได้อย่างสมบูรณ์และวิเคราะห์การใช้งาน เพื่อพัฒนาประสบการณ์ให้ดียิ่งขึ้น
                  อ่านเพิ่มเติมได้ที่{' '}
                  <MLink component={Link} href={PRIVACY_HREF} underline="hover" sx={{ fontWeight: 600 }}>
                    นโยบายความเป็นส่วนตัว
                  </MLink>
                </Typography>
              </Box>
            </Stack>

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              sx={{ mt: 2.25 }}
              alignItems="center"
            >
              <Button
                onClick={openSettings}
                variant="text"
                color="inherit"
                startIcon={<TuneRoundedIcon />}
                sx={{ width: { xs: '100%', sm: 'auto' }, color: 'text.secondary' }}
              >
                ตั้งค่า
              </Button>
              <Box sx={{ flex: 1, display: { xs: 'none', sm: 'block' } }} />
              <Button
                onClick={rejectAll}
                variant="outlined"
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                ปฏิเสธ
              </Button>
              <Button
                onClick={acceptAll}
                variant="contained"
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                ยอมรับทั้งหมด
              </Button>
            </Stack>
          </Paper>
        </Box>
      </Slide>

      <Dialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ pr: 6, fontWeight: 800 }}>
          ตั้งค่าคุกกี้
          <IconButton
            onClick={() => setSettingsOpen(false)}
            sx={{ position: 'absolute', right: 12, top: 12 }}
            aria-label="ปิด"
          >
            <CloseRoundedIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={0.5} divider={<Divider flexItem />}>
            {categories.map((c) => {
              const checked = c.locked ? true : prefs[c.key as keyof Prefs];
              return (
                <Stack
                  key={c.key}
                  direction="row"
                  spacing={1.5}
                  alignItems="flex-start"
                  justifyContent="space-between"
                  sx={{ py: 1.5 }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={700} sx={{ fontSize: 14.5 }}>
                      {c.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.3, lineHeight: 1.6 }}>
                      {c.desc}
                    </Typography>
                  </Box>
                  <Switch
                    checked={checked}
                    disabled={c.locked}
                    onChange={(e) =>
                      setPrefs((p) => ({ ...p, [c.key]: e.target.checked }))
                    }
                    edge="end"
                  />
                </Stack>
              );
            })}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={rejectAll} variant="text" color="inherit" sx={{ color: 'text.secondary' }}>
            ปฏิเสธทั้งหมด
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button onClick={savePrefs} variant="outlined">
            บันทึกการตั้งค่า
          </Button>
          <Button onClick={acceptAll} variant="contained">
            ยอมรับทั้งหมด
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
