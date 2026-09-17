'use client';

import { Chip } from '@mui/material';
import { useTranslation } from '@/lib/i18n/useTranslation';

const colorMap: Record<string, 'primary' | 'warning' | 'info' | 'secondary' | 'error' | 'default'> = {
  fixed_slot: 'primary',
  flexible_duration: 'warning',
  capacity_based: 'info',
  walk_in: 'secondary',
  request_approval: 'error',
};

const thaiModeLabel: Record<string, string> = {
  fixed_slot: 'จองตามเวลาที่แน่นอน',
  flexible_duration: 'เวลายืดหยุ่น',
  capacity_based: 'รับจำนวนต่อรอบ',
  walk_in: 'Walk-in',
  request_approval: 'ต้องยืนยันก่อน',
};

export function BookingModeChip({ mode }: { mode: string }) {
  const { t } = useTranslation('booking_mode');
  return <Chip size="small" label={t(mode, thaiModeLabel[mode] ?? mode)} color={colorMap[mode] ?? 'default'} variant="outlined" />;
}
