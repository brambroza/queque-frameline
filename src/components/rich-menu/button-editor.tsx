'use client';

import { Box, Chip, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { ICON_KEYS, ICONS, iconDataUrl, type IconKey } from '@/lib/line/rich-menu/icons';
import { LAYOUTS } from '@/lib/line/rich-menu/layouts';
import { RICH_MENU_LABEL_MAX, type RichMenuAction, type RichMenuConfig } from '@/lib/line/rich-menu/schema';
import type { RichMenuCaps } from './rich-menu-types';

type ActionType = RichMenuAction['type'];

const ACTION_LABELS: Record<ActionType, string> = {
  liff_booking: 'เปิด LIFF จองคิว',
  liff_member: 'เปิด LIFF สมาชิก / เช็คคิว',
  url: 'เปิดลิงก์',
  message: 'ส่งข้อความหาร้าน',
};

/** Switch an action to another type, keeping sensible defaults. */
function actionOfType(type: ActionType, previous: RichMenuAction, label: string): RichMenuAction {
  switch (type) {
    case 'liff_booking':
      return { type };
    case 'liff_member':
      return { type };
    case 'url':
      return { type, url: previous.type === 'url' ? previous.url : 'https://' };
    case 'message':
      return { type, text: previous.type === 'message' ? previous.text : label };
    default:
      return previous;
  }
}

type Props = {
  config: RichMenuConfig;
  caps: RichMenuCaps;
  onChange: (index: number, patch: Partial<RichMenuConfig['buttons'][number]>) => void;
};

/** One row per layout cell: icon, label, and what happens on tap. */
export function ButtonEditor({ config, caps, onChange }: Props) {
  const cells = LAYOUTS[config.layout].cells;
  return (
    <Stack spacing={1}>
      {config.buttons.map((button, index) => {
        const hero = Boolean(cells[index]?.hero);
        const missingLiff =
          (button.action.type === 'liff_booking' && !caps.has_liff_booking) ||
          // Member buttons fall back to the booking LIFF (account tab) when no member LIFF is set.
          (button.action.type === 'liff_member' && !caps.has_liff_member && !caps.has_liff_booking);
        return (
          <Box
            key={index}
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '36px 180px 1fr 1fr' },
              gap: 1,
              alignItems: 'center',
              p: 1,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
              {index + 1}{hero ? '★' : ''}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" width={24} height={24} src={iconDataUrl(button.iconKey, config.palette.primary, '#ffffff', 24)} />
              <TextField
                select
                size="small"
                fullWidth
                label="ไอคอน"
                value={button.iconKey}
                onChange={(e) => onChange(index, { iconKey: e.target.value as IconKey })}
              >
                {ICON_KEYS.map((key) => (
                  <MenuItem key={key} value={key}>{ICONS[key].name}</MenuItem>
                ))}
              </TextField>
            </Stack>
            <TextField
              size="small"
              label={`ข้อความ (≤${RICH_MENU_LABEL_MAX})`}
              value={button.label}
              inputProps={{ maxLength: RICH_MENU_LABEL_MAX }}
              onChange={(e) => onChange(index, { label: e.target.value })}
            />
            <Stack spacing={0.75}>
              <TextField
                select
                size="small"
                label="เมื่อกด"
                value={button.action.type}
                onChange={(e) => onChange(index, { action: actionOfType(e.target.value as ActionType, button.action, button.label) })}
              >
                {(Object.keys(ACTION_LABELS) as ActionType[]).map((type) => (
                  <MenuItem key={type} value={type}>{ACTION_LABELS[type]}</MenuItem>
                ))}
              </TextField>
              {button.action.type === 'url' ? (
                <TextField
                  size="small"
                  label="ลิงก์ (https://)"
                  value={button.action.url}
                  onChange={(e) => onChange(index, { action: { type: 'url', url: e.target.value } })}
                />
              ) : null}
              {button.action.type === 'message' ? (
                <TextField
                  size="small"
                  label="ข้อความที่ลูกค้าส่ง"
                  value={button.action.text}
                  inputProps={{ maxLength: 300 }}
                  onChange={(e) => onChange(index, { action: { type: 'message', text: e.target.value } })}
                />
              ) : null}
              {missingLiff ? <Chip size="small" color="warning" variant="outlined" label="ยังไม่ตั้ง LIFF ID — ตั้งค่าที่ LINE Settings" /> : null}
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
}
