'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, Chip, Stack, Typography } from '@mui/material';
import { canvasToBlob, ensureFontsLoaded, loadSvgImage, resolveFontStack, RICH_MENU_IMAGE_MAX_BYTES } from '@/lib/line/rich-menu/canvas';
import { LAYOUTS } from '@/lib/line/rich-menu/layouts';
import { renderRichMenu } from '@/lib/line/rich-menu/render';
import type { RichMenuConfig } from '@/lib/line/rich-menu/schema';

type Props = { config: RichMenuConfig; shopName: string };

/** Preview scale: 2500 → 1000 px canvas, displayed at CSS width of the phone. */
const PREVIEW_SCALE = 0.4;

/** LINE chat mock with the rich menu rendered live on a canvas. */
export function PhonePreview({ config, shopName }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [bytes, setBytes] = useState<number | null>(null);
  const layout = LAYOUTS[config.layout];

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const fontStack = resolveFontStack();
        await ensureFontsLoaded(fontStack);
        if (cancelled) return;
        canvas.width = layout.width * PREVIEW_SCALE;
        canvas.height = layout.height * PREVIEW_SCALE;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        await renderRichMenu(ctx, config, { scale: PREVIEW_SCALE, fontStack, loadImage: loadSvgImage, shopName });
        if (cancelled) return;
        // Measure the real export size so the 1 MB LINE cap is visible before saving.
        const full = document.createElement('canvas');
        full.width = layout.width;
        full.height = layout.height;
        const fullCtx = full.getContext('2d');
        if (!fullCtx) return;
        await renderRichMenu(fullCtx, config, { scale: 1, fontStack, loadImage: loadSvgImage, shopName });
        const blob = await canvasToBlob(full, 'image/png');
        if (!cancelled) setBytes(blob?.size ?? null);
      })();
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [config, shopName, layout]);

  const kb = bytes === null ? null : Math.round(bytes / 1024);
  const overCap = bytes !== null && bytes > RICH_MENU_IMAGE_MAX_BYTES;
  const initial = (shopName || 'ร').replace(/^ร้าน/, '').trim().charAt(0) || 'ร';

  return (
    <Stack spacing={1.5} alignItems="center">
      <Box sx={{ width: '100%', maxWidth: 360, bgcolor: '#0f1a15', borderRadius: '34px', p: 1.5, boxShadow: 3 }}>
        <Box sx={{ bgcolor: '#8cabd9', borderRadius: '24px', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 520 }}>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ bgcolor: 'rgba(255,255,255,.92)', color: '#10201a', px: 2, pt: 1.75, pb: 1.25 }}>
            <Box sx={{ width: 30, height: 30, borderRadius: '50%', bgcolor: config.palette.primary, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700 }}>
              {initial}
            </Box>
            <Typography variant="body2" fontWeight={600}>{shopName || 'ร้านของคุณ'}</Typography>
          </Stack>
          <Box sx={{ flex: 1, p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <Box sx={{ bgcolor: '#fff', color: '#10201a', borderRadius: '16px', px: 1.5, py: 1.25, fontSize: 12.5, maxWidth: '82%', boxShadow: '0 1px 1px rgba(0,0,0,.08)' }}>
              สวัสดีค่ะ จองคิวหรือเช็คคิวได้จากเมนูด้านล่างเลยนะคะ
            </Box>
            <Box sx={{ bgcolor: '#8de08f', color: '#10201a', borderRadius: '16px', px: 1.5, py: 1.25, fontSize: 12.5, maxWidth: '82%', alignSelf: 'flex-end', boxShadow: '0 1px 1px rgba(0,0,0,.08)' }}>
              ขอบคุณครับ
            </Box>
          </Box>
          <Box sx={{ bgcolor: '#fff' }}>
            <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: 'auto' }} />
          </Box>
          <Box sx={{ bgcolor: '#fff', color: '#10201a', fontSize: 13, fontWeight: 600, textAlign: 'center', py: 1.25, borderTop: '1px solid #e5e5e5' }}>
            ☰ {config.chatBarText || 'เมนู'}
          </Box>
        </Box>
      </Box>
      <Stack direction="row" spacing={0.75} flexWrap="wrap" justifyContent="center">
        <Chip size="small" variant="outlined" label={`${layout.width} × ${layout.height}`} sx={{ fontFamily: 'monospace' }} />
        <Chip
          size="small"
          variant="outlined"
          color={overCap ? 'warning' : 'default'}
          label={kb === null ? 'กำลังวัดขนาด…' : `PNG ~${kb} KB${overCap ? ' · เกิน 1 MB → จะบันทึกเป็น JPEG' : ''}`}
          sx={{ fontFamily: 'monospace' }}
        />
        <Chip size="small" variant="outlined" label={`${layout.cells.length} ช่อง`} />
      </Stack>
    </Stack>
  );
}
