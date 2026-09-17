'use client';

import { Box, Typography } from '@mui/material';

export function MobileFrame({
  title = 'Mobile Preview',
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
        maxWidth: 390,
        mx: 'auto',
        borderRadius: '36px',
        p: 1,
        bgcolor: '#0f172a',
        boxShadow: '0 28px 60px rgba(15,23,42,0.28)',
      }}
    >
      <Box sx={{ height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}>
        <Typography variant="caption">9:41</Typography>
      </Box>
      <Box
        sx={{
          width: 120,
          height: 20,
          borderRadius: 999,
          bgcolor: '#111827',
          mx: 'auto',
          mt: -2.5,
          mb: 0.8,
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      />
      <Box sx={{ borderRadius: '28px', overflow: 'hidden', bgcolor: '#fff', minHeight: 700 }}>
        {children}
      </Box>
    </Box>
  );
}

