'use client';

import { useMemo } from 'react';
import { Box, ThemeProvider } from '@mui/material';
import { createAppTheme } from '@/theme/mui-theme';

/**
 * Pins every LIFF screen to the light theme.
 *
 * The root `MuiAppProvider` follows the customer's saved portal preference or
 * their OS setting, but the LIFF booking flow is designed light-only and is
 * opened by customers who never chose a mode. The wrapper also paints its own
 * background and `color-scheme` because the root `CssBaseline` (and native
 * controls such as the date picker) would otherwise still render dark.
 */
export function LiffThemeScope({ children }: { children: React.ReactNode }) {
  const theme = useMemo(() => createAppTheme('light'), []);
  return (
    <ThemeProvider theme={theme}>
      <Box
        sx={{
          minHeight: '100dvh',
          bgcolor: 'background.default',
          color: 'text.primary',
          colorScheme: 'light',
        }}
      >
        {children}
      </Box>
    </ThemeProvider>
  );
}
