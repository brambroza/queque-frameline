'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import DownloadingRoundedIcon from '@mui/icons-material/DownloadingRounded';
import AutoAwesomeMosaicRoundedIcon from '@mui/icons-material/AutoAwesomeMosaicRounded';
import Link from 'next/link';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import { lineGreen, neutral } from '@/theme/tokens';
import { useToast } from '@/components/ui/toast';
import { downloadCanvas, loadSvgImage, resolveFontStack } from '@/lib/line/rich-menu/canvas';
import { COLOR_PRESETS, mixWithWhite } from '@/lib/line/rich-menu/colors';
import { buildIconSvg, type IconKey } from '@/lib/line/rich-menu/icons';

/** รูปแบบพื้นหลังของไอคอนที่ดาวน์โหลดได้ */
export type IconVariant = 'plain' | 'white' | 'tint' | 'solid';

type TileColors = { glyph: string; knockout: string; bg: string | null; label: string };

const SIZE_OPTIONS = [300, 512, 1024];

const VARIANT_OPTIONS: { value: IconVariant; label: string }[] = [
  { value: 'plain', label: 'พื้นหลังโปร่งใส' },
  { value: 'white', label: 'พื้นหลังขาว' },
  { value: 'tint', label: 'พื้นหลังสีอ่อน' },
  { value: 'solid', label: 'พื้นหลังสีเข้ม' },
];

type IconDef = { key: IconKey; defaultLabel: string };

/** The 8 classic studio icons + default Thai labels (glyphs live in src/lib/line/rich-menu/icons.ts). */
const STUDIO_ICONS: IconDef[] = [
  { key: 'booking', defaultLabel: 'จองคิว' },
  { key: 'member', defaultLabel: 'ข้อมูลสมาชิก' },
  { key: 'queue', defaultLabel: 'เช็คคิวของฉัน' },
  { key: 'contact', defaultLabel: 'ติดต่อร้าน' },
  { key: 'services', defaultLabel: 'บริการของเรา' },
  { key: 'location', defaultLabel: 'ที่ตั้งร้าน' },
  { key: 'hours', defaultLabel: 'เวลาทำการ' },
  { key: 'promo', defaultLabel: 'โปรโมชั่น' },
];

/** เลือกสี glyph / knockout / พื้นหลัง ตาม variant */
function resolveColors(color: string, variant: IconVariant): TileColors {
  if (variant === 'solid') {
    return { glyph: '#ffffff', knockout: color, bg: color, label: '#ffffff' };
  }
  if (variant === 'tint') {
    const tint = mixWithWhite(color, 0.12);
    return { glyph: color, knockout: tint, bg: tint, label: neutral[900] };
  }
  if (variant === 'white') {
    return { glyph: color, knockout: '#ffffff', bg: '#ffffff', label: neutral[900] };
  }
  return { glyph: color, knockout: '#ffffff', bg: null, label: neutral[900] };
}

type TileOptions = {
  color: string;
  variant: IconVariant;
  showLabel: boolean;
  radiusRatio: number;
};

/** วาดไอคอน 1 ชิ้นลง canvas ตามขนาดที่กำหนด */
async function drawTile(
  canvas: HTMLCanvasElement,
  def: IconDef,
  label: string,
  size: number,
  options: TileOptions,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const colors = resolveColors(options.color, options.variant);
  canvas.width = size;
  canvas.height = size;
  ctx.clearRect(0, 0, size, size);

  if (colors.bg) {
    const radius = size * options.radiusRatio;
    ctx.fillStyle = colors.bg;
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(0, 0, size, size, radius);
      ctx.fill();
    } else {
      ctx.fillRect(0, 0, size, size);
    }
  }

  const glyphSize = options.showLabel ? size * 0.5 : size * 0.62;
  const glyphX = (size - glyphSize) / 2;
  const glyphY = options.showLabel ? size * 0.14 : (size - glyphSize) / 2;
  const img = await loadSvgImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildIconSvg(def.key, colors.glyph, colors.knockout, Math.round(glyphSize)))}`);
  ctx.drawImage(img, glyphX, glyphY, glyphSize, glyphSize);

  if (options.showLabel && label.trim()) {
    const fontSize = size * (label.trim().length > 10 ? 0.1 : 0.125);
    ctx.fillStyle = colors.label;
    ctx.font = `700 ${fontSize}px ${resolveFontStack()}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label.trim(), size / 2, size * 0.82, size * 0.9);
  }
}

type PreviewTileProps = {
  def: IconDef;
  label: string;
  options: TileOptions;
  onLabelChange: (value: string) => void;
  onDownload: () => void;
};

/** การ์ดพรีวิว 1 ไอคอน + ปุ่มดาวน์โหลด + แก้ข้อความ */
function PreviewTile({ def, label, options, onLabelChange, onDownload }: PreviewTileProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    void (async () => {
      if (typeof document !== 'undefined' && document.fonts?.ready) await document.fonts.ready;
      if (cancelled || !canvasRef.current) return;
      await drawTile(canvasRef.current, def, label, 320, options);
    })();
    return () => {
      cancelled = true;
    };
  }, [def, label, options]);

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Stack spacing={1.2} alignItems="stretch">
          <Box
            sx={{
              borderRadius: 2,
              p: 1,
              display: 'flex',
              justifyContent: 'center',
              background:
                options.variant === 'plain'
                  ? 'repeating-conic-gradient(#f1f3f6 0% 25%, #ffffff 0% 50%) 50% / 16px 16px'
                  : 'transparent',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <canvas ref={canvasRef} style={{ width: 148, height: 148 }} />
          </Box>
          <TextField
            size="small"
            label="ข้อความใต้ไอคอน"
            value={label}
            onChange={(e) => onLabelChange(e.target.value)}
          />
          <Button size="small" variant="outlined" startIcon={<DownloadRoundedIcon />} onClick={onDownload}>
            ดาวน์โหลด PNG
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

/**
 * Rich Menu Icon Studio
 * ให้เจ้าของร้านเลือกสี ปรับข้อความ แล้วดาวน์โหลดไอคอน PNG
 * รวมถึง export ภาพ Rich Menu เต็มขนาดสำหรับอัปโหลดเข้า LINE OA Manager
 */
export function RichMenuIconStudio() {
  const { push } = useToast();
  const [color, setColor] = useState<string>(lineGreen);
  const [variant, setVariant] = useState<IconVariant>('white');
  const [size, setSize] = useState<number>(512);
  const [showLabel, setShowLabel] = useState<boolean>(true);
  const [labels, setLabels] = useState<Record<string, string>>(
    () => Object.fromEntries(STUDIO_ICONS.map((icon) => [icon.key, icon.defaultLabel])),
  );
  const [busy, setBusy] = useState(false);

  const options = useMemo<TileOptions>(
    () => ({ color, variant, showLabel, radiusRatio: 0.16 }),
    [color, variant, showLabel],
  );

  const downloadIcon = useCallback(
    async (def: IconDef) => {
      const canvas = document.createElement('canvas');
      await drawTile(canvas, def, labels[def.key] ?? def.defaultLabel, size, options);
      await downloadCanvas(canvas, `richmenu-${def.key}-${size}.png`);
    },
    [labels, options, size],
  );

  const downloadAll = useCallback(async () => {
    setBusy(true);
    try {
      for (const def of STUDIO_ICONS) {
        // eslint-disable-next-line no-await-in-loop
        await downloadIcon(def);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      push('ดาวน์โหลดไอคอนทั้งหมดแล้ว');
    } catch {
      push('ดาวน์โหลดไม่สำเร็จ', 'error');
    } finally {
      setBusy(false);
    }
  }, [downloadIcon, push]);

  const resetLabels = useCallback(() => {
    setLabels(Object.fromEntries(STUDIO_ICONS.map((icon) => [icon.key, icon.defaultLabel])));
  }, []);

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>Step 5: ไอคอน Rich Menu รายชิ้น (เลือกสี + ดาวน์โหลด)</Typography>
            <Typography variant="body2" color="text.secondary">
              เลือกสีให้ตรงกับแบรนด์ร้าน แก้ข้อความใต้ไอคอนได้ แล้วดาวน์โหลดเป็น PNG ไปใช้ใน LINE OA Manager
            </Typography>
          </Box>

          <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
            {COLOR_PRESETS.map((preset) => (
              <Tooltip key={preset.value} title={preset.label}>
                <Box
                  role="button"
                  aria-label={preset.label}
                  onClick={() => setColor(preset.value)}
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    bgcolor: preset.value,
                    cursor: 'pointer',
                    outline: color.toLowerCase() === preset.value.toLowerCase() ? '3px solid' : '1px solid',
                    outlineColor: color.toLowerCase() === preset.value.toLowerCase() ? 'text.primary' : 'divider',
                    outlineOffset: 2,
                  }}
                />
              </Tooltip>
            ))}
            <Chip label={color.toUpperCase()} size="small" variant="outlined" />
          </Stack>

          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                fullWidth
                size="small"
                type="color"
                label="สีที่กำหนดเอง"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                fullWidth
                select
                size="small"
                label="รูปแบบพื้นหลัง"
                value={variant}
                onChange={(e) => setVariant(e.target.value as IconVariant)}
              >
                {VARIANT_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                fullWidth
                select
                size="small"
                label="ขนาดไฟล์ (px)"
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
              >
                {SIZE_OPTIONS.map((opt) => (
                  <MenuItem key={opt} value={opt}>{`${opt} × ${opt}`}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Stack direction="row" spacing={1} alignItems="center" height="100%">
                <FormControlLabel
                  control={<Checkbox checked={showLabel} onChange={(e) => setShowLabel(e.target.checked)} />}
                  label="ใส่ข้อความใต้ไอคอน"
                />
                <Tooltip title="คืนค่าข้อความเริ่มต้น">
                  <Button size="small" onClick={resetLabels} startIcon={<RestartAltRoundedIcon />}>รีเซ็ต</Button>
                </Tooltip>
              </Stack>
            </Grid>
          </Grid>

          <Grid container spacing={1.5}>
            {STUDIO_ICONS.map((def) => (
              <Grid key={def.key} size={{ xs: 6, sm: 4, md: 3 }}>
                <PreviewTile
                  def={def}
                  label={labels[def.key] ?? def.defaultLabel}
                  options={options}
                  onLabelChange={(value) => setLabels((prev) => ({ ...prev, [def.key]: value }))}
                  onDownload={() => void downloadIcon(def)}
                />
              </Grid>
            ))}
          </Grid>

          <Divider />

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
            <Button
              variant="contained"
              disabled={busy}
              startIcon={<DownloadingRoundedIcon />}
              onClick={() => void downloadAll()}
            >
              ดาวน์โหลดไอคอนทั้งหมด ({STUDIO_ICONS.length} ไฟล์)
            </Button>
            <Button component={Link} href="/portal/rich-menu" variant="outlined" startIcon={<AutoAwesomeMosaicRoundedIcon />}>
              สร้างภาพ Rich Menu เต็มขนาดตามธุรกิจ
            </Button>
          </Stack>

          <Typography variant="caption" color="text.secondary">
            ต้องการภาพ Rich Menu เต็มขนาด (2500 × 1686 / 2500 × 843) ที่จัดเลย์เอาต์ตามธุรกิจให้อัตโนมัติ ใช้เมนู &quot;สร้าง Rich Menu&quot;
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
