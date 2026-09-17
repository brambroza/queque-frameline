'use client';

import { Chip, Stack } from '@mui/material';

const REPLIES = [
  { key: 'today', label: 'วันนี้' },
  { key: 'tomorrow', label: 'พรุ่งนี้' },
  { key: 'morning', label: 'เช้า' },
  { key: 'afternoon', label: 'บ่าย' },
  { key: 'contact', label: 'ติดต่อร้าน' },
] as const;

export function QuickReplyBar({
  disabled,
  onClick,
}: {
  disabled?: boolean;
  onClick: (key: (typeof REPLIES)[number]['key']) => void;
}) {
  return (
    <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5 }}>
      {REPLIES.map((item) => (
        <Chip
          key={item.key}
          label={item.label}
          clickable
          disabled={disabled}
          onClick={() => onClick(item.key)}
          sx={{
            borderRadius: 999,
            bgcolor: '#1c2127',
            color: '#d4dde8',
            border: '1px solid #2e343b',
            '&:hover': { bgcolor: '#242b33' },
          }}
        />
      ))}
    </Stack>
  );
}
