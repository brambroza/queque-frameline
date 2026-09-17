'use client';

import { Chip } from '@mui/material';
import type { NotificationCategory } from '@/types/notification';

export function NotificationCategoryChip({ category }: { category: NotificationCategory }) {
  return <Chip size="small" variant="outlined" label={category} sx={{ textTransform: 'capitalize' }} />;
}
