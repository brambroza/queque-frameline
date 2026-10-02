'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Slide, Stack } from '@mui/material';

import { capToasts, durationFor, type ToastType } from '@/lib/ui/toast-timing';

export type { ToastType } from '@/lib/ui/toast-timing';
export { durationFor, MAX_TOASTS } from '@/lib/ui/toast-timing';

type Toast = { id: number; message: string; type: ToastType; open: boolean };

type ToastContextValue = {
  push: (message: string, type?: ToastType) => void;
};

/** Time the Slide-out plays before the toast leaves the DOM. */
const EXIT_MS = 200;

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setToasts((prev) => prev.map((x) => (x.id === id ? { ...x, open: false } : x)));
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), EXIT_MS);
  }, []);

  const schedule = useCallback(
    (id: number, type: ToastType) => {
      const t = timers.current.get(id);
      if (t) clearTimeout(t);
      timers.current.set(id, setTimeout(() => dismiss(id), durationFor(type)));
    },
    [dismiss],
  );

  const pause = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
  }, []);

  const push = useCallback(
    (message: string, type: ToastType = 'success') => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((prev) => {
        return capToasts([...prev, { id, message, type, open: true }]);
      });
      schedule(id, type);
    },
    [schedule],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/*
        Top-right snackbar stack. Sits above every MUI layer (appBar 1100,
        drawer 1200, modal 1300, snackbar 1400, tooltip 1500) so a toast fired
        from a drawer or dialog is never hidden behind it. The container ignores
        pointer events so it never blocks the app bar underneath; each toast
        opts back in so its close button and hover-to-pause work.
        `data-feedback-ignore` keeps toasts out of the feedback screenshot.
      */}
      <Box
        role="status"
        aria-live="polite"
        data-feedback-ignore=""
        sx={{
          position: 'fixed',
          zIndex: 1600,
          top: 'calc(env(safe-area-inset-top, 0px) + 16px)',
          right: 16,
          left: { xs: 16, sm: 'auto' },
          pointerEvents: 'none',
        }}
      >
        <Stack spacing={1} alignItems="flex-end">
          {toasts.map((t) => (
            <Slide key={t.id} in={t.open} direction="left" timeout={{ enter: 250, exit: EXIT_MS }} mountOnEnter unmountOnExit appear>
              <Alert
                severity={t.type}
                variant="filled"
                elevation={6}
                onClose={() => dismiss(t.id)}
                onMouseEnter={() => pause(t.id)}
                onMouseLeave={() => schedule(t.id, t.type)}
                sx={{
                  pointerEvents: 'auto',
                  width: { xs: '100%', sm: 'auto' },
                  minWidth: { sm: 280 },
                  maxWidth: { sm: 420 },
                  alignItems: 'center',
                  fontSize: 14,
                  fontWeight: 500,
                  boxShadow: '0 8px 24px rgba(15,23,42,0.18)',
                }}
              >
                {t.message}
              </Alert>
            </Slide>
          ))}
        </Stack>
      </Box>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
