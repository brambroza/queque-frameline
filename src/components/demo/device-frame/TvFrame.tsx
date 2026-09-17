'use client';

import { Box } from '@mui/material';

export function TvFrame({
  title = 'TV Preview',
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
        maxWidth: 1320,
        aspectRatio: '16 / 9',
        mx: 'auto',
        p: 1.1,
        borderRadius: 3,
        bgcolor: '#0b1020',
        boxShadow: '0 28px 64px rgba(2,6,23,0.45)',
      }}
    >
      <Box sx={{ width: '100%', height: '100%', borderRadius: 2, overflow: 'hidden', bgcolor: '#0f172a' }}>{children}</Box>
    </Box>
  );
}

