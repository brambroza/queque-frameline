'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

type Toast = { id: number; message: string; type: 'success' | 'error' };

type ToastContextValue = {
  push: (message: string, type?: 'success' | 'error') => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/*
        Above every MUI layer (appBar 1100, drawer 1200, modal 1300, snackbar
        1400, tooltip 1500) so a toast fired from a drawer or dialog, or while
        the sticky app bar is on screen, is never hidden behind them. The
        container ignores pointer events so it never blocks the app bar buttons
        underneath; each toast opts back in.
      */}
      <div
        role="status"
        aria-live="polite"
        data-feedback-ignore=""
        className="pointer-events-none fixed right-4 space-y-2"
        style={{ zIndex: 1600, top: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-lg px-4 py-2 text-sm text-white shadow-lg ${t.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
