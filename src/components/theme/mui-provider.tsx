'use client';

import { createContext, useContext, useMemo } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { createAppTheme } from '@/theme/mui-theme';
import type { ColorMode } from '@/theme/tokens';

type ColorModeContextValue = { mode: ColorMode; toggleMode: () => void; setMode: (m: ColorMode) => void };

/**
 * The site runs in light mode only (decision 2026-09-18): the yard tablets and
 * the office share one look, and the printed DO matches the screen. The
 * context stays so components that read `mode` keep working.
 */
const ColorModeContext = createContext<ColorModeContextValue>({ mode: 'light', toggleMode: () => {}, setMode: () => {} });

export function useColorMode() {
  return useContext(ColorModeContext);
}

export function MuiAppProvider({ children }: { children: React.ReactNode }) {
  const theme = useMemo(() => createAppTheme('light'), []);
  const ctx = useMemo<ColorModeContextValue>(() => ({ mode: 'light', toggleMode: () => {}, setMode: () => {} }), []);
  return (
    <ColorModeContext.Provider value={ctx}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
