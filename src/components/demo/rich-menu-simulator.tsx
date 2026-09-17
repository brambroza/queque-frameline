'use client';

import { Box, Stack, Typography } from '@mui/material';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import SupportAgentRoundedIcon from '@mui/icons-material/SupportAgentRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import type { DemoMenuAction } from '@/components/demo/line-demo-types';

const DEFAULT_ITEMS: Array<{ key: DemoMenuAction; label: string; icon: React.ReactNode }> = [
  { key: 'booking', label: 'จองคิว', icon: <CalendarMonthRoundedIcon sx={{ fontSize: 28 }} /> },
  { key: 'member', label: 'ข้อมูลสมาชิก', icon: <BadgeRoundedIcon sx={{ fontSize: 28 }} /> },
/*   { key: 'check', label: 'เช็กคิว', icon: <ScheduleRoundedIcon sx={{ fontSize: 28 }} /> },
  { key: 'promo', label: 'โปรโมชั่น', icon: <CampaignRoundedIcon sx={{ fontSize: 28 }} /> },
  { key: 'contact', label: 'ติดต่อร้าน', icon: <SupportAgentRoundedIcon sx={{ fontSize: 28 }} /> },
  { key: 'open_liff', label: 'เปิด LIFF', icon: <OpenInNewRoundedIcon sx={{ fontSize: 28 }} /> }, */
];

export function RichMenuSimulator({
  active,
  onSelect,
  labels,
}: {
  active: DemoMenuAction;
  onSelect: (key: DemoMenuAction) => void;
  labels?: Partial<Record<DemoMenuAction, string>>;
}) {
  return (
    <Box sx={{ borderTop: '1px solid #dce2ea', bgcolor: '#fff', p: 1.2 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 1,
        }}
      >
        {DEFAULT_ITEMS.map((item) => {
          const isActive = active === item.key;
          return (
            <Stack
              key={item.key}
              onClick={() => onSelect(item.key)}
              alignItems="center"
              spacing={0.6}
              sx={{
                borderRadius: 1,
                py: 1,
                px: 0.8,
                cursor: 'pointer',
                userSelect: 'none',
                bgcolor: isActive ? '#e9f7ee' : '#f8fafb',
                color: isActive ? '#2d7a4a' : '#4a5665',
                border: '1px solid',
                borderColor: isActive ? '#a7d9b7' : '#e4e9ef',
                transition: 'all .15s ease',
              }}
            >
              {item.icon}
              <Typography sx={{ fontSize: 12, fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>{labels?.[item.key] ?? item.label}</Typography>
            </Stack>
          );
        })}
      </Box>
      <Typography sx={{ mt: 0.6, textAlign: 'center', fontSize: 12, color: '#5b6674' }}>เมนู</Typography>
    </Box>
  );
}
