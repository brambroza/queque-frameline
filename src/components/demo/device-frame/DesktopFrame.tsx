'use client';

import { Box, Stack } from '@mui/material';

export function DesktopFrame({
  title = 'Desktop Preview',
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      aria-label={title}
      sx={{
        width: '100%',
        maxWidth: 1200,
        mx: 'auto',
        borderRadius: 3,
        overflow: 'hidden',
        boxShadow: '0 24px 56px rgba(15,23,42,0.2)',
        border: '1px solid #dbe3eb',
        bgcolor: '#fff',
      }}
    >
      <Stack direction="row" spacing={1} sx={{ px: 1.5, py: 1, bgcolor: '#f3f5f8', borderBottom: '1px solid #dbe3eb' }}>
        <Box sx={{ width: 10, height: 10, borderRadius: 999, bgcolor: '#f87171' }} />
        <Box sx={{ width: 10, height: 10, borderRadius: 999, bgcolor: '#fbbf24' }} />
        <Box sx={{ width: 10, height: 10, borderRadius: 999, bgcolor: '#4ade80' }} />
      </Stack>
      <Box sx={{ minHeight: 540 }}>{children}</Box>
    </Box>
  );
}

