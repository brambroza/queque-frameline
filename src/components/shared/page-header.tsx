'use client';

import { Box, Stack, Typography } from '@mui/material';

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  /** ปุ่ม/องค์ประกอบด้านขวา เช่น ปุ่ม "เพิ่มใหม่" */
  action?: React.ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1.5}
      alignItems={{ xs: 'stretch', sm: 'center' }} // xs: stretch so a page can make its action button full-width
      justifyContent="space-between"
      sx={{ mb: 2.5 }}
    >
      <Stack data-tour="page-heading" spacing={0.5} sx={{ minWidth: 0 }}>
        <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '-0.01em' }}>
          {title}
        </Typography>
        {description ? (
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        ) : null}
      </Stack>
      {action ? <Box sx={{ flexShrink: 0 }}>{action}</Box> : null}
    </Stack>
  );
}
