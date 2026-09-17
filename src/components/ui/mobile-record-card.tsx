'use client';

import type { ReactNode } from 'react';
import { Box, Button, Chip, Typography } from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

export type MobileRecordStat = {
  icon: ReactNode;
  value: string;
  label: string;
};

type Props = {
  title: string;
  /** Muted line under the title (e.g. code, branch). */
  subtitle?: string;
  /** Node rendered left of the title block (e.g. a queue-number badge). */
  leading?: ReactNode;
  /** Active / inactive pill shown top-right. */
  status?: { active: boolean; activeLabel?: string; inactiveLabel?: string };
  /** Custom top-right node (e.g. a status chip); takes precedence over `status`. */
  badge?: ReactNode;
  /** Custom footer; replaces the default edit / delete buttons. */
  footer?: ReactNode;
  /** Chips or short badges rendered under the title block. */
  tags?: ReactNode;
  /** Optional free-form line under the tags (e.g. linked services). */
  note?: ReactNode;
  /** Up to 3–4 icon + value + label tiles. */
  stats?: MobileRecordStat[];
  onEdit?: () => void;
  onDelete?: () => void;
  editLabel?: string;
  deleteLabel?: string;
};

/**
 * Phone-only record card shared by the portal CRUD pages (services, resources, …):
 * title + status pill, tags, a row of stat tiles and a two-button 44px footer.
 * Inactive records are dimmed. Desktop tables are unaffected — render this only
 * through `MobileCardList` / `ResponsiveTable`'s `renderCard`.
 */
export function MobileRecordCard({
  title,
  subtitle,
  leading,
  status,
  badge,
  footer,
  tags,
  note,
  stats = [],
  onEdit,
  onDelete,
  editLabel = 'แก้ไข',
  deleteLabel = 'ลบ',
}: Props) {
  const dimmed = status ? !status.active : false;
  return (
    <Box
      sx={{
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        overflow: 'hidden',
        opacity: dimmed ? 0.72 : 1,
      }}
    >
      <Box sx={{ p: 2, pb: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
          {leading ? <Box sx={{ flexShrink: 0 }}>{leading}</Box> : null}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.3, overflowWrap: 'anywhere' }}>
              {title}
            </Typography>
            {subtitle ? (
              <Typography variant="caption" color="text.secondary" component="div" sx={{ overflowWrap: 'anywhere' }}>
                {subtitle}
              </Typography>
            ) : null}
          </Box>
          {badge ? (
            <Box sx={{ flexShrink: 0 }}>{badge}</Box>
          ) : status ? (
            <Chip
              size="small"
              label={status.active ? status.activeLabel ?? 'เปิดใช้งาน' : status.inactiveLabel ?? 'ปิดอยู่'}
              color={status.active ? 'success' : 'default'}
              variant={status.active ? 'filled' : 'outlined'}
              sx={{ flexShrink: 0, fontWeight: 600 }}
            />
          ) : null}
        </Box>
        {tags ? <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>{tags}</Box> : null}
        {note ? (
          <Typography variant="caption" color="text.secondary" component="div" sx={{ overflowWrap: 'anywhere' }}>
            {note}
          </Typography>
        ) : null}
        {stats.length > 0 ? (
          <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
            {stats.map((s) => (
              <Box
                key={s.label}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.25,
                  py: 1,
                  px: 0.5,
                  borderRadius: 2,
                  bgcolor: 'action.hover',
                  color: 'text.secondary',
                  '& .MuiSvgIcon-root': { fontSize: 18 },
                }}
              >
                {s.icon}
                <Typography variant="body2" fontWeight={700} color="text.primary" noWrap sx={{ maxWidth: '100%' }}>
                  {s.value}
                </Typography>
                <Typography variant="caption" sx={{ lineHeight: 1.2 }}>
                  {s.label}
                </Typography>
              </Box>
            ))}
          </Box>
        ) : null}
      </Box>
      {footer ? (
        <Box sx={{ display: 'flex', borderTop: '1px solid', borderColor: 'divider' }}>{footer}</Box>
      ) : onEdit || onDelete ? (
        <Box sx={{ display: 'flex', borderTop: '1px solid', borderColor: 'divider' }}>
          {onEdit ? (
            <Button fullWidth startIcon={<EditOutlinedIcon />} onClick={onEdit} sx={{ minHeight: 44, borderRadius: 0, fontWeight: 600 }}>
              {editLabel}
            </Button>
          ) : null}
          {onEdit && onDelete ? <Box sx={{ width: '1px', bgcolor: 'divider' }} /> : null}
          {onDelete ? (
            <Button fullWidth color="error" startIcon={<DeleteOutlineIcon />} onClick={onDelete} sx={{ minHeight: 44, borderRadius: 0, fontWeight: 600 }}>
              {deleteLabel}
            </Button>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}
