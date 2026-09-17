'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Avatar,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  FormControlLabel,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { useToast } from '@/components/ui/toast';

/**
 * Visual tone of a confirmation. Drives the icon, the accent color and which
 * button receives focus:
 * - `error`   destructive, cannot be undone → cancel button is focused
 * - `warning` affects customers or discards unsaved work
 * - `primary` publishing / sending something out (brand color)
 * - `info`    settings changes that do not touch data
 */
export type ConfirmTone = 'error' | 'warning' | 'primary' | 'info';

/** The "what am I about to act on" row shown under the description. */
export type ConfirmContext = {
  /** Short avatar content (initials, queue number). Defaults to the first characters of `primary`. */
  avatar?: ReactNode;
  /** Square avatar (queue number / code) instead of a circle. */
  avatarSquare?: boolean;
  primary: string;
  secondary?: string;
};

export type ConfirmOptions = {
  tone?: ConfirmTone;
  /** Short question, e.g. "ลบลูกค้านี้?" */
  title: string;
  /** What will happen as a consequence, not a restatement of the question. */
  description?: string;
  context?: ConfirmContext;
  /** Extra caution line rendered in the warning color. */
  caution?: string;
  /** When set, the confirm button stays disabled until this checkbox is ticked. */
  acknowledge?: string;
  /** Verb + object, e.g. "ลบลูกค้า". Never "ตกลง" / "OK". */
  confirmLabel: string;
  /** Defaults to the translated "ยกเลิก". Override when the action itself is "cancel". */
  cancelLabel?: string;
  /** Override the tone icon. */
  icon?: ReactNode;
  /**
   * Work to run while the dialog shows its loading state. If it throws, the
   * error is shown as a toast and the dialog stays open so the user can retry.
   */
  onConfirm?: () => Promise<unknown> | unknown;
};

/** Options accepted by declarative wrappers (ActionIconButton) — the work is the button's own onClick. */
export type ConfirmRequest = Omit<ConfirmOptions, 'onConfirm'>;

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

const TONE_ICON: Record<ConfirmTone, ReactNode> = {
  error: <DeleteOutlineRoundedIcon />,
  warning: <WarningAmberRoundedIcon />,
  primary: <SendRoundedIcon />,
  info: <InfoOutlinedIcon />,
};

type Pending = { options: ConfirmOptions; resolve: (ok: boolean) => void };

/**
 * Mount once (next to ToastProvider, inside MuiAppProvider) and call
 * `useConfirm()` anywhere below to replace `window.confirm`.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [open, setOpen] = useState(false);
  const resolvedRef = useRef(false);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      resolvedRef.current = false;
      setPending({ options, resolve });
      setOpen(true);
    });
  }, []);

  const settle = useCallback(
    (ok: boolean) => {
      if (!pending || resolvedRef.current) return;
      resolvedRef.current = true;
      pending.resolve(ok);
      setOpen(false);
    },
    [pending],
  );

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {pending ? (
        <ConfirmDialog
          open={open}
          options={pending.options}
          onSettle={settle}
          onExited={() => setPending(null)}
        />
      ) : null}
    </ConfirmContext.Provider>
  );
}

/**
 * Promise-based confirmation. Resolves `true` when the user confirmed (and
 * `onConfirm`, if given, finished without throwing), `false` otherwise.
 *
 * @example
 * const ok = await confirm({ tone: 'error', title: 'ลบลูกค้านี้?', confirmLabel: 'ลบลูกค้า' });
 * if (!ok) return;
 */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}

type DialogProps = {
  open: boolean;
  options: ConfirmOptions;
  onSettle: (ok: boolean) => void;
  onExited: () => void;
};

/**
 * The dialog itself. Normally driven by `ConfirmProvider`; exported for
 * screens that need a controlled instance (e.g. storybook-like demos).
 */
export function ConfirmDialog({ open, options, onSettle, onExited }: DialogProps) {
  const { t } = useTranslation();
  const { push } = useToast();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [loading, setLoading] = useState(false);
  const [acked, setAcked] = useState(false);

  const tone: ConfirmTone = options.tone ?? 'warning';
  const accent = theme.palette[tone].main;
  const cancelLabel = options.cancelLabel ?? t('common.cancel', 'ยกเลิก');
  const needsAck = Boolean(options.acknowledge);
  const confirmDisabled = loading || (needsAck && !acked);

  async function handleConfirm() {
    if (confirmDisabled) return;
    if (!options.onConfirm) {
      onSettle(true);
      return;
    }
    setLoading(true);
    try {
      await options.onConfirm();
      onSettle(true);
    } catch (e) {
      push(e instanceof Error ? e.message : t('common.action_failed', 'ดำเนินการไม่สำเร็จ'), 'error');
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (loading) return;
    onSettle(false);
  }

  const ctx = options.context;
  const avatarText = ctx ? (ctx.avatar ?? ctx.primary.trim().slice(0, 2)) : null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      disableEscapeKeyDown={loading}
      slotProps={{ transition: { onExited } }}
      aria-labelledby="confirm-dialog-title"
      aria-describedby={options.description ? 'confirm-dialog-description' : undefined}
      sx={mobile ? { '& .MuiDialog-container': { alignItems: 'flex-end' } } : undefined}
      PaperProps={{
        sx: {
          width: 400,
          maxWidth: '100%',
          m: mobile ? 0 : 2,
          p: mobile ? '20px 20px 24px' : 3,
          borderRadius: mobile ? '20px 20px 0 0' : 2.5,
          boxShadow: theme.shadows[24],
        },
      }}
    >
      <Stack spacing={2}>
        {mobile ? <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: 'divider', mx: 'auto', mt: -1 }} /> : null}

        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Box
            aria-hidden
            sx={{
              width: 48,
              height: 48,
              flex: 'none',
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              color: accent,
              bgcolor: alpha(accent, theme.palette.mode === 'dark' ? 0.18 : 0.12),
            }}
          >
            {options.icon ?? TONE_ICON[tone]}
          </Box>
          <Box sx={{ minWidth: 0, pt: 0.25 }}>
            <Typography id="confirm-dialog-title" variant="h6" sx={{ fontSize: 18, fontWeight: 500, lineHeight: 1.3 }}>
              {options.title}
            </Typography>
            {options.description ? (
              <Typography id="confirm-dialog-description" variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {options.description}
              </Typography>
            ) : null}
          </Box>
        </Stack>

        {ctx ? (
          <Stack
            direction="row"
            spacing={1.25}
            alignItems="center"
            sx={{ bgcolor: 'action.hover', borderRadius: 1.5, px: 1.5, py: 1.25, minWidth: 0 }}
          >
            <Avatar
              variant={ctx.avatarSquare ? 'rounded' : 'circular'}
              sx={{
                width: 32,
                height: 32,
                fontSize: 12,
                fontWeight: 500,
                bgcolor: ctx.avatarSquare ? 'text.primary' : 'primary.main',
                color: ctx.avatarSquare ? 'background.paper' : 'primary.contrastText',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {avatarText}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={500} noWrap>{ctx.primary}</Typography>
              {ctx.secondary ? (
                <Typography variant="caption" color="text.secondary" noWrap component="div">{ctx.secondary}</Typography>
              ) : null}
            </Box>
          </Stack>
        ) : null}

        {options.caution ? (
          <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ color: 'warning.main' }}>
            <WarningAmberRoundedIcon sx={{ fontSize: 16, mt: '3px' }} />
            <Typography variant="body2" sx={{ color: 'inherit' }}>{options.caution}</Typography>
          </Stack>
        ) : null}

        {needsAck ? (
          <FormControlLabel
            sx={{ alignItems: 'flex-start', ml: -1, mr: 0 }}
            control={<Checkbox checked={acked} onChange={(e) => setAcked(e.target.checked)} disabled={loading} sx={{ pt: 0.25 }} />}
            label={<Typography variant="body2" color="text.secondary">{options.acknowledge}</Typography>}
          />
        ) : null}

        <Stack direction={mobile ? 'column-reverse' : 'row'} spacing={1} justifyContent="flex-end" sx={{ pt: 0.5 }}>
          <Button
            color="inherit"
            onClick={handleClose}
            disabled={loading}
            autoFocus={tone === 'error'}
            fullWidth={mobile}
            sx={{ color: 'text.secondary', height: mobile ? 44 : 40 }}
          >
            {cancelLabel}
          </Button>
          <Button
            variant="contained"
            color={tone}
            onClick={() => void handleConfirm()}
            disabled={confirmDisabled}
            autoFocus={tone !== 'error'}
            fullWidth={mobile}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
            sx={{ height: mobile ? 44 : 40, boxShadow: 'none' }}
          >
            {options.confirmLabel}
          </Button>
        </Stack>
      </Stack>
    </Dialog>
  );
}
