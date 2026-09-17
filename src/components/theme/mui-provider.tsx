'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { createAppTheme } from '@/theme/mui-theme';
import type { ColorMode } from '@/theme/tokens';

export const COLOR_MODE_KEY = 'qb-color-mode';

type ColorModeContextValue = {
  mode: ColorMode;
  toggleMode: () => void;
  setMode: (m: ColorMode) => void;
};

const ColorModeContext = createContext<ColorModeContextValue>({
  mode: 'light',
  toggleMode: () => {},
  setMode: () => {},
});

/** hook สำหรับอ่าน/สลับโหมดสีจากที่ไหนก็ได้ */
export function useColorMode() {
  return useContext(ColorModeContext);
}

function applyHtmlMode(mode: ColorMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', mode === 'dark');
  root.style.colorScheme = mode;
  root.dataset.theme = mode;
}

export function MuiAppProvider({ children }: { children: React.ReactNode }) {
  // ค่าเริ่มต้นตรงกับ inline script ใน layout (กัน hydration mismatch / FOUC)
  const [mode, setModeState] = useState<ColorMode>('light');

  useEffect(() => {
    const stored = (typeof window !== 'undefined'
      ? (window.localStorage.getItem(COLOR_MODE_KEY) as ColorMode | null)
      : null);
    const initial: ColorMode =
      stored ??
      (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light');
    setModeState(initial);
    applyHtmlMode(initial);
  }, []);

  const setMode = useCallback((m: ColorMode) => {
    setModeState(m);
    applyHtmlMode(m);
    try {
      window.localStorage.setItem(COLOR_MODE_KEY, m);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((prev) => {
      const next: ColorMode = prev === 'dark' ? 'light' : 'dark';
      applyHtmlMode(next);
      try {
        window.localStorage.setItem(COLOR_MODE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const theme = useMemo(() => createAppTheme(mode), [mode]);
  const ctx = useMemo<ColorModeContextValue>(() => ({ mode, toggleMode, setMode }), [mode, toggleMode, setMode]);

  return (
    <ColorModeContext.Provider value={ctx}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
