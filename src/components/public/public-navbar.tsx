'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AppBar, Box, Button, Container, Drawer, IconButton, Stack, Toolbar, Typography } from '@mui/material';
import { LanguageSwitch } from '@/components/layout/language-switch';
import { ColorModeToggle } from '@/components/theme/color-mode-toggle';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

const navs = [
  { label: 'หน้าแรก', href: '/' },
  { label: 'โหมดทดลอง', href: '/sandbox-demo' },
  { label: 'ฟีเจอร์', href: '/#features' },
  { label: 'ตัวอย่างการใช้งาน', href: '/use-cases' },
  { label: 'บทความ', href: '/blog' },
  { label: 'ราคา', href: '/#pricing' },
  { label: 'ติดต่อเรา', href: '/contact' },
];

export function PublicNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  function closeMobileMenu() {
    setMobileOpen(false);
  }

  return (
    <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(20,26,36,0.82)' : 'rgba(255,255,255,0.85)'), backdropFilter: 'blur(10px)' }}>
      <Container maxWidth="xl">
        <Toolbar disableGutters sx={{ minHeight: 72, justifyContent: 'space-between', gap: 2 }}>


          <Typography
            component={Link}
            href="/"
            color="text.primary"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              textDecoration: 'none',
            }}
          >
            <Box
              sx={{
                width: 32,
                height: 32,
                bgcolor: '#12a862',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <CalendarMonthIcon sx={{ color: '#fff', fontSize: 20 }} />
            </Box>

            <Typography
              component="span"
              sx={{
                fontSize: { xs: 14, sm: 16 },
                fontWeight: 700,
                color: 'text.primary',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: { xs: 150, sm: 'none' },
              }}
            >
              QueueBooking LINE
            </Typography>
          </Typography>

          <Stack direction="row" spacing={0.5} sx={{ display: { xs: 'none', md: 'flex' } }}>
            {navs.map((n) => {
              const isDemo = n.href === '/sandbox-demo';
              return (
                <Button
                  key={n.href}
                  component={Link}
                  href={n.href}
                  color="inherit"
                  sx={
                    isDemo
                      ? {
                          bgcolor: '#EAF7EF',
                          color: '#1B5E20',
                          border: '1px solid #12a862',
                          borderRadius: 999,
                          fontWeight: 700,
                          px: 1.6,
                          animation: 'demoBlink 1.4s ease-in-out infinite',
                          '@keyframes demoBlink': {
                            '0%, 100%': { boxShadow: '0 0 0 0 rgba(115, 192, 136, 0.45)' },
                            '50%': { boxShadow: '0 0 0 8px rgba(115, 192, 136, 0)' },
                          },
                          '&:hover': {
                            bgcolor: '#DDF2E5',
                            borderColor: '#5EAD77',
                          },
                        }
                      : undefined
                  }
                >
                  {n.label}
                </Button>
              );
            })}
          </Stack>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <IconButton
              aria-label="open mobile menu"
              onClick={() => setMobileOpen(true)}
              sx={{
                display: { xs: 'inline-flex', md: 'none' },
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
              }}
            >
              <MenuRoundedIcon />
            </IconButton>
            <ColorModeToggle size="small" />
            <LanguageSwitch />
            <Button component={Link} href="/login" color="inherit" sx={{ display: { xs: 'none', md: 'inline-flex' } }}>เข้าสู่ระบบ</Button>
            <Button component={Link} href="/register" variant="contained" sx={{ display: { xs: 'none', md: 'inline-flex' } }}>เริ่มใช้งานฟรี</Button>
          </Box>
        </Toolbar>
      </Container>

      <Drawer
        anchor="right"
        open={mobileOpen}
        onClose={closeMobileMenu}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: 290, p: 2 },
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Typography fontWeight={800}>เมนู</Typography>
          <IconButton aria-label="close mobile menu" onClick={closeMobileMenu}>
            <CloseRoundedIcon />
          </IconButton>
        </Stack>

        <Stack spacing={0.8}>
          {navs.map((n) => {
            const isDemo = n.href === '/sandbox-demo';
            return (
              <Button
                key={n.href}
                component={Link}
                href={n.href}
                onClick={closeMobileMenu}
                fullWidth
                sx={{
                  justifyContent: 'flex-start',
                  py: 1,
                  borderRadius: 2,
                  color: isDemo ? '#1B5E20' : 'text.primary',
                  bgcolor: isDemo ? '#EAF7EF' : 'background.paper',
                  border: '1px solid',
                  borderColor: isDemo ? '#12a862' : 'divider',
                  fontWeight: isDemo ? 700 : 500,
                }}
              >
                {n.label}
              </Button>
            );
          })}
        </Stack>

        <Stack spacing={1} sx={{ mt: 2 }}>
          <Button component={Link} href="/login" onClick={closeMobileMenu} variant="outlined" fullWidth>
            เข้าสู่ระบบ
          </Button>
          <Button component={Link} href="/register" onClick={closeMobileMenu} variant="contained" fullWidth>
            เริ่มใช้งานฟรี
          </Button>
        </Stack>
      </Drawer>
    </AppBar>
  );
}
