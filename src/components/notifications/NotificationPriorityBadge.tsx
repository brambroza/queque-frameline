'use client';

import { Chip } from '@mui/material';
import type { NotificationPriority } from '@/types/notification';

export function NotificationPriorityBadge({ priority }: { priority: NotificationPriority }) {
  const map = {
    low: { color: 'default' as const, label: 'Low' },
    medium: { color: 'info' as const, label: 'Medium' },
    high: { color: 'warning' as const, label: 'High' },
    critical: { color: 'error' as const, label: 'Critical' },
  };
  const cfg = map[priority] ?? map.medium;
  return <Chip size="small" color={cfg.color} label={cfg.label} />;
}
