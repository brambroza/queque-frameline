'use client';

import { IconButton, Tooltip } from '@mui/material';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import { useColorMode } from '@/components/theme/mui-provider';

/** ปุ่มสลับ light/dark สำหรับ topbar (portal) หรือ navbar (public) */
export function ColorModeToggle({ size = 'medium' }: { size?: 'small' | 'medium' }) {
  const { mode, toggleMode } = useColorMode();
  const isDark = mode === 'dark';

  return (
    <Tooltip title={isDark ? 'โหมดสว่าง' : 'โหมดมืด'}>
      <IconButton onClick={toggleMode} size={size} aria-label="Toggle color mode" color="inherit">
        {isDark ? <LightModeRoundedIcon fontSize="small" /> : <DarkModeRoundedIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
}
