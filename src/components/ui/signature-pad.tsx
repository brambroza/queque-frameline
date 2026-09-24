'use client';

import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';

export type SignaturePadHandle = {
  /** PNG data URL of the drawing, or null when nothing was drawn. */
  toDataUrl: () => string | null;
  clear: () => void;
};

/**
 * Finger / stylus signature box drawn on a canvas. Renders at device pixel
 * ratio so the exported PNG stays crisp on the DO; pointer events cover
 * mouse, touch and pen. Emits `onChange(hasInk)` so the parent can enable
 * its buttons without polling the canvas.
 */
export const SignaturePad = forwardRef<SignaturePadHandle, { height?: number; disabled?: boolean; onChange?: (hasInk: boolean) => void; label?: string }>(
  function SignaturePad({ height = 160, disabled = false, onChange, label }, ref) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const drawing = useRef(false);
    const last = useRef<{ x: number; y: number } | null>(null);
    const [hasInk, setHasInk] = useState(false);

    // Size the bitmap to the box × DPR once mounted / resized; drawing survives a resize by redrawing from a snapshot.
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return undefined;
      const fit = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        const rect = canvas.getBoundingClientRect();
        const snapshot = hasInk ? canvas.toDataURL('image/png') : null;
        canvas.width = Math.max(1, Math.round(rect.width * dpr));
        canvas.height = Math.max(1, Math.round(rect.height * dpr));
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = '#0f172a';
        if (snapshot) {
          const img = new Image();
          img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
          img.src = snapshot;
        }
      };
      fit();
      const ro = new ResizeObserver(fit);
      ro.observe(canvas);
      return () => ro.disconnect();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (disabled) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      drawing.current = true;
      last.current = point(e);
    };

    const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawing.current || !last.current) return;
      e.preventDefault();
      const ctx = e.currentTarget.getContext('2d');
      if (!ctx) return;
      const p = point(e);
      ctx.beginPath();
      ctx.moveTo(last.current.x, last.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last.current = p;
      if (!hasInk) { setHasInk(true); onChange?.(true); }
    };

    const end = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawing.current) return;
      // A tap with no movement still leaves a dot.
      if (last.current && !hasInk) {
        const ctx = e.currentTarget.getContext('2d');
        if (ctx) { ctx.beginPath(); ctx.arc(last.current.x, last.current.y, 1.2, 0, Math.PI * 2); ctx.fillStyle = '#0f172a'; ctx.fill(); }
        setHasInk(true);
        onChange?.(true);
      }
      drawing.current = false;
      last.current = null;
    };

    const clear = useCallback(() => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasInk(false);
      onChange?.(false);
    }, [onChange]);

    useImperativeHandle(ref, () => ({
      toDataUrl: () => (hasInk && canvasRef.current ? canvasRef.current.toDataURL('image/png') : null),
      clear,
    }), [hasInk, clear]);

    return (
      <Stack spacing={0.5}>
        <Box
          sx={{
            position: 'relative', height, borderRadius: 1.5, border: 1, borderColor: hasInk ? 'primary.main' : 'divider', bgcolor: '#fff',
            overflow: 'hidden', touchAction: 'none', opacity: disabled ? 0.6 : 1,
          }}
        >
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={label ?? 'พื้นที่ลงชื่อ'}
            style={{ display: 'block', width: '100%', height: '100%', cursor: disabled ? 'default' : 'crosshair' }}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            onPointerLeave={end}
          />
          {!hasInk ? (
            <Typography variant="caption" color="text.disabled" sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
              ลงชื่อด้วยนิ้วหรือปากกาในกรอบนี้
            </Typography>
          ) : null}
          <Box sx={{ position: 'absolute', left: 16, right: 16, bottom: 28, borderTop: '1px dashed', borderColor: 'divider', pointerEvents: 'none' }} />
        </Box>
        <Button size="small" color="inherit" onClick={clear} disabled={!hasInk || disabled} sx={{ alignSelf: 'flex-end' }}>ล้างลายเซ็น</Button>
      </Stack>
    );
  },
);
