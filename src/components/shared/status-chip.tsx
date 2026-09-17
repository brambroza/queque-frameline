'use client';

import { Chip } from '@mui/material';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { getStatusMeta } from '@/lib/booking/status-meta';

/**
 * Booking status chip. Colour comes from the shared `STATUS_META` map so it matches
 * the dashboard donut and every other status colour in the portal.
 */
export function StatusChip({ status }: { status: string }) {
  const { t } = useTranslation('status');
  return <Chip size="small" label={t(status, status)} color={getStatusMeta(status).palette} variant="filled" />;
}
