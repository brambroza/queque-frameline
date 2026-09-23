'use client';

import { Button, Stack, TextField } from '@mui/material';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import { useToast } from '@/components/ui/toast';

/** Read-only value with a copy button (URLs, ids, one-time secrets). */
export function CopyField({ label, value, hint, monospace = false }: { label: string; value: string; hint?: string; monospace?: boolean }) {
  const { push } = useToast();
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
      <TextField
        fullWidth
        size="small"
        label={label}
        value={value}
        helperText={hint}
        slotProps={{ input: { readOnly: true, sx: monospace ? { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13 } : undefined } }}
      />
      <Button
        size="small"
        startIcon={<ContentCopyRoundedIcon />}
        sx={{ flexShrink: 0, alignSelf: { xs: 'flex-start', sm: 'center' } }}
        onClick={() => { void navigator.clipboard.writeText(value).then(() => push('คัดลอกแล้ว')).catch(() => push('คัดลอกไม่สำเร็จ', 'error')); }}
      >
        คัดลอก
      </Button>
    </Stack>
  );
}
