'use client';

import { Box } from '@mui/material';

export function TabletFrame({
  title = 'Tablet Preview',
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
        maxWidth: 980,
        mx: 'auto',
        p: 1.2,
        borderRadius: '24px',
        bgcolor: '#0f172a',
        boxShadow: '0 22px 48px rgba(15,23,42,0.22)',
      }}
    >
      <Box sx={{ borderRadius: '18px', overflow: 'hidden', bgcolor: '#fff', minHeight: 520 }}>{children}</Box>
    </Box>
  );
}

