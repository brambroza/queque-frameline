'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, Button, Chip, Dialog, DialogContent, DialogTitle, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import FullscreenRoundedIcon from '@mui/icons-material/FullscreenRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import QrCode2RoundedIcon from '@mui/icons-material/QrCode2Rounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import type { SignageConfig, SignageData } from '@/lib/signage/types';
import { SignageBoard } from '@/components/signage/signage-board';

export type PreviewLabels = {
  preview_live: string;
  unsaved_hint: string;
  refresh: string;
  fullscreen: string;
  fullscreen_unsupported: string;
  open_tv: string;
  copy_link: string;
  link_copied: string;
  qr_title: string;
  qr_hint: string;
  demo_call_next: string;
  calling: string;
};

type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

export function PreviewPanel({
  data,
  config,
  dirty,
  tvUrl,
  labels,
  demoMode,
  calling,
  onRefresh,
  onCallNext,
  notify,
}: {
  data: SignageData | null;
  config: SignageConfig;
  dirty: boolean;
  tvUrl: string | null;
  labels: PreviewLabels;
  demoMode: boolean;
  calling: boolean;
  onRefresh: () => void;
  onCallNext: () => void;
  notify: (message: string, type?: 'success' | 'error') => void;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!qrOpen || !tvUrl) return;
    let cancelled = false;
    import('qrcode')
      .then((mod) => mod.toDataURL(tvUrl, { width: 512, margin: 1 }))
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [qrOpen, tvUrl]);

  async function enterFullscreen() {
    const el = frameRef.current as FullscreenElement | null;
    if (!el) return;
    try {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else notify(labels.fullscreen_unsupported, 'error');
    } catch {
      notify(labels.fullscreen_unsupported, 'error');
    }
  }

  async function copyLink() {
    if (!tvUrl) return;
    try {
      await navigator.clipboard.writeText(tvUrl);
      notify(labels.link_copied);
    } catch {
      notify(tvUrl);
    }
  }

  const isPortrait = config.layout === 'portrait';

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap spacing={1}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Chip size="small" color="success" variant="outlined" label={labels.preview_live} />
          {dirty ? <Chip size="small" color="warning" variant="outlined" label={labels.unsaved_hint} /> : null}
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap justifyContent="flex-end">
          <Tooltip title={labels.refresh}><IconButton size="small" onClick={onRefresh}><RefreshRoundedIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title={labels.fullscreen}><IconButton size="small" onClick={() => void enterFullscreen()}><FullscreenRoundedIcon fontSize="small" /></IconButton></Tooltip>
          {tvUrl ? (
            <>
              <Tooltip title={labels.copy_link}><IconButton size="small" onClick={() => void copyLink()}><ContentCopyRoundedIcon fontSize="small" /></IconButton></Tooltip>
              <Tooltip title={labels.qr_title}><IconButton size="small" onClick={() => setQrOpen(true)}><QrCode2RoundedIcon fontSize="small" /></IconButton></Tooltip>
              <Button size="small" variant="contained" endIcon={<OpenInNewRoundedIcon />} href={tvUrl} target="_blank" rel="noopener" sx={{ borderRadius: 1.5 }}>
                {labels.open_tv}
              </Button>
            </>
          ) : null}
          {demoMode ? (
            <Button size="small" variant="outlined" startIcon={<CampaignRoundedIcon />} disabled={calling} onClick={onCallNext} sx={{ borderRadius: 1.5 }}>
              {calling ? labels.calling : labels.demo_call_next}
            </Button>
          ) : null}
        </Stack>
      </Stack>

      <Box sx={{ display: 'flex', justifyContent: 'center', bgcolor: '#0b0f0b', borderRadius: 2, p: { xs: 1, md: 1.5 }, border: '1px solid', borderColor: 'divider' }}>
        <Box
          ref={frameRef}
          sx={{
            width: isPortrait ? 'auto' : '100%',
            height: isPortrait ? { xs: 520, md: 'min(70vh, 760px)' } : 'auto',
            aspectRatio: isPortrait ? '9 / 16' : '16 / 9',
            maxWidth: '100%',
            borderRadius: 1.5,
            overflow: 'hidden',
            boxShadow: '0 20px 50px rgba(0,0,0,0.45)',
            bgcolor: '#070d07',
            '&:fullscreen': { width: '100vw', height: '100vh', aspectRatio: 'auto', borderRadius: 0 },
          }}
        >
          {data ? (
            <SignageBoard data={data} config={config} mode="preview" />
          ) : (
            <Box sx={{ display: 'grid', placeItems: 'center', height: '100%', minHeight: 240, color: '#8ca98c' }}>
              <Typography variant="body2">…</Typography>
            </Box>
          )}
        </Box>
      </Box>

      <Dialog open={qrOpen} onClose={() => setQrOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{labels.qr_title}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} alignItems="center">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- client-generated data URL
              <img src={qrDataUrl} alt={labels.qr_title} style={{ width: 260, height: 260, borderRadius: 12, background: '#fff' }} />
            ) : null}
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>{labels.qr_hint}</Typography>
            {tvUrl ? (
              <Typography variant="caption" sx={{ wordBreak: 'break-all', textAlign: 'center', fontFamily: 'monospace' }}>{tvUrl}</Typography>
            ) : null}
            <Button variant="outlined" size="small" startIcon={<ContentCopyRoundedIcon />} onClick={() => void copyLink()} sx={{ borderRadius: 1.5 }}>
              {labels.copy_link}
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
