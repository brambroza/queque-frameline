'use client';

import {
  Avatar,
  Box,
  ButtonBase,
  Card,
  CardContent,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { alpha, useTheme, type Theme } from '@mui/material/styles';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { lineGreen, shadowLight } from '@/theme/tokens';

/** Width of the LIFF column — a phone screen, centred when opened on desktop. */
const LIFF_MAX_WIDTH = 480;

/** Soft brand fill for selected/highlighted surfaces (matches the portal's `selected` token). */
export const brandSoft = (t: Theme) => alpha(t.palette.primary.main, 0.12);

/** Gradient used for the shop avatar and the customer's initial avatar. */
export function brandGradient(primaryLight: string, primaryDark: string) {
  return `linear-gradient(135deg, ${primaryLight}, ${primaryDark})`;
}

/**
 * Page frame for every LIFF screen: shop header on a white bar, then the
 * screen content stacked in a single phone-width column.
 */
export function LiffShell({
  shopName,
  branchName,
  title,
  children,
}: {
  shopName?: string | null;
  branchName?: string | null;
  title: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const name = shopName?.trim() || 'ร้านค้า';
  const subtitle = [name, branchName?.trim()].filter(Boolean).join(' · ');
  return (
    <Box component="main" sx={{ minHeight: '100dvh', bgcolor: 'background.default', pb: 4 }}>
      <Box
        component="header"
        sx={{
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          spacing={1.5}
          sx={{ maxWidth: LIFF_MAX_WIDTH, mx: 'auto', px: 2, py: 1.5 }}
        >
          <Avatar
            variant="rounded"
            sx={{
              width: 40,
              height: 40,
              borderRadius: '12px',
              fontWeight: 800,
              fontSize: 15,
              color: theme.palette.primary.contrastText,
              background: brandGradient(theme.palette.primary.light, theme.palette.primary.dark),
            }}
          >
            {name.slice(0, 1).toUpperCase()}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, display: 'block' }} noWrap>
              {subtitle}
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.2 }} noWrap>
              {title}
            </Typography>
          </Box>
          <Box
            sx={{
              flexShrink: 0,
              px: 1,
              py: 0.25,
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
              color: lineGreen,
              bgcolor: alpha(lineGreen, 0.1),
            }}
          >
            LINE
          </Box>
        </Stack>
      </Box>
      <Stack spacing={1.75} sx={{ maxWidth: LIFF_MAX_WIDTH, mx: 'auto', px: 2, pt: 2 }}>
        {children}
      </Stack>
    </Box>
  );
}

/** Two-step progress: 1 pick a service, 2 pick a time. */
export function LiffStepper({ step }: { step: 1 | 2 }) {
  const steps: Array<{ n: 1 | 2; label: string }> = [
    { n: 1, label: 'เลือกบริการ' },
    { n: 2, label: 'เลือกวันเวลา' },
  ];
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75 }}>
      {steps.map((s) => {
        const active = s.n === step;
        const done = s.n < step;
        return (
          <Stack
            key={s.n}
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{
              px: 1.25,
              py: 1,
              borderRadius: '12px',
              border: 1,
              borderColor: active ? 'primary.main' : 'divider',
              bgcolor: active ? brandSoft : 'background.paper',
              color: active ? 'primary.dark' : 'text.secondary',
              fontSize: 12.5,
              fontWeight: 600,
            }}
          >
            <Box
              sx={{
                width: 22,
                height: 22,
                borderRadius: 999,
                display: 'grid',
                placeItems: 'center',
                fontSize: 11,
                fontWeight: 700,
                flexShrink: 0,
                bgcolor: active || done ? 'primary.main' : 'grey.100',
                color: active || done ? 'primary.contrastText' : 'text.secondary',
              }}
            >
              {done ? <CheckRoundedIcon sx={{ fontSize: 14 }} /> : s.n}
            </Box>
            {s.label}
          </Stack>
        );
      })}
    </Box>
  );
}

/** A titled card section; `action` sits at the right of the title. */
export function LiffSection({
  title,
  action,
  muted,
  children,
}: {
  title?: string;
  action?: React.ReactNode;
  /** Quieter card for read-only summaries. */
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card sx={muted ? { bgcolor: 'grey.50', boxShadow: 'none' } : undefined}>
      <CardContent sx={{ p: 1.75, '&:last-child': { pb: 1.75 } }}>
        <Stack spacing={1.25}>
          {title || action ? (
            <Stack direction="row" alignItems="baseline" justifyContent="space-between" spacing={1}>
              {title ? (
                <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                  {title}
                </Typography>
              ) : (
                <span />
              )}
              {action}
            </Stack>
          ) : null}
          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}

/** Small caption label above a group of options or fields. */
export function LiffLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
      {children}
      {hint ? (
        <Box component="span" sx={{ fontWeight: 400 }}>
          {' '}
          {hint}
        </Box>
      ) : null}
    </Typography>
  );
}

/**
 * A selectable row card — services, staff, payment methods. Selected state is
 * a brand border + soft fill with a check mark, so the label stays readable.
 */
export function OptionCard({
  icon,
  title,
  subtitle,
  trailing,
  selected,
  disabled,
  onClick,
}: {
  /** Emoji or short text shown in the leading tile. */
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Right-aligned text such as a price. */
  trailing?: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <ButtonBase
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      sx={{
        width: '100%',
        justifyContent: 'flex-start',
        textAlign: 'left',
        gap: 1.25,
        px: 1.5,
        py: 1.375,
        borderRadius: '16px',
        border: 1,
        borderColor: selected ? 'primary.main' : 'divider',
        boxShadow: selected ? (t) => `inset 0 0 0 1px ${t.palette.primary.main}` : 'none',
        bgcolor: selected ? brandSoft : 'background.paper',
        transition: 'border-color .15s, background-color .15s',
        '&:hover': { bgcolor: selected ? brandSoft : 'action.hover' },
        '&.Mui-disabled': { opacity: 0.5 },
      }}
    >
      <Box
        sx={{
          width: 38,
          height: 38,
          borderRadius: '10px',
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          fontSize: 19,
          bgcolor: selected ? 'background.paper' : 'grey.100',
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 14 }}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {subtitle}
          </Typography>
        ) : null}
      </Box>
      {trailing ? (
        <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
          {trailing}
        </Typography>
      ) : null}
      <Box
        sx={{
          width: 20,
          height: 20,
          borderRadius: 999,
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          border: 1.5,
          borderColor: selected ? 'primary.main' : 'grey.300',
          bgcolor: selected ? 'primary.main' : 'background.paper',
          color: 'primary.contrastText',
        }}
      >
        {selected ? <CheckRoundedIcon sx={{ fontSize: 13 }} /> : null}
      </Box>
    </ButtonBase>
  );
}

/** One time slot in the 3-column grid. */
export function SlotButton({
  label,
  selected,
  disabled,
  remaining,
  booked,
  capacity,
  disabledReason,
  onClick,
}: {
  label: string;
  selected: boolean;
  /** Full or past slot: stays in the grid, greyed out, not clickable. */
  disabled?: boolean;
  /** Shown as "เหลือ N" when the slot is nearly full. */
  remaining?: number;
  /** Booked / capacity, shown as "เต็ม 3/3" on a full slot. */
  booked?: number;
  capacity?: number;
  /** Why it is disabled; `past` is a dashed outline with no caption, `full` a solid fill with the count. */
  disabledReason?: 'full' | 'past';
  onClick: () => void;
}) {
  const showRemaining = !disabled && typeof remaining === 'number' && remaining > 0 && remaining <= 2;
  const past = disabled && disabledReason === 'past';
  const fullLabel =
    typeof booked === 'number' && typeof capacity === 'number' && capacity > 0 ? `เต็ม ${booked}/${capacity}` : 'เต็ม';
  return (
    <ButtonBase
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      aria-disabled={disabled || undefined}
      title={disabled ? (past ? 'เลยเวลาแล้ว' : 'คิวเต็ม') : undefined}
      sx={{
        minHeight: 40,
        borderRadius: '12px',
        border: 1,
        // A past slot is an empty dashed outline — the shape says "gone", no caption needed.
        borderStyle: past ? 'dashed' : 'solid',
        flexDirection: 'column',
        fontWeight: past ? 400 : 600,
        fontSize: 14,
        fontVariantNumeric: 'tabular-nums',
        borderColor: selected ? 'primary.main' : past ? 'divider' : disabled ? 'transparent' : 'divider',
        bgcolor: selected ? 'primary.main' : past ? 'transparent' : disabled ? 'grey.100' : 'background.paper',
        color: selected ? 'primary.contrastText' : disabled ? 'text.disabled' : 'text.primary',
        boxShadow: selected ? shadowLight.brand : 'none',
        '&:hover': { bgcolor: selected ? 'primary.dark' : 'action.hover' },
        '&.Mui-disabled': { color: 'text.disabled', cursor: 'not-allowed', pointerEvents: 'auto' },
      }}
    >
      {label}
      {disabled && !past ? (
        <Box component="span" sx={{ fontSize: 10, fontWeight: 500, lineHeight: 1, mt: 0.25 }}>
          {fullLabel}
        </Box>
      ) : showRemaining ? (
        <Box component="span" sx={{ fontSize: 10, fontWeight: 500, lineHeight: 1, mt: 0.25, opacity: 0.8 }}>
          เหลือ {remaining}
        </Box>
      ) : null}
    </ButtonBase>
  );
}

/** Label / value pairs, e.g. the booking summary. */
export function KeyValueList({
  rows,
  dense,
}: {
  rows: Array<{ label: string; value: React.ReactNode }>;
  dense?: boolean;
}) {
  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        display: 'grid',
        gridTemplateColumns: '64px 1fr',
        columnGap: 1.5,
        rowGap: 0.5,
        fontSize: dense ? 13 : 13.5,
      }}
    >
      {rows.map((r) => (
        <Box key={r.label} sx={{ display: 'contents' }}>
          <Box component="dt" sx={{ color: 'text.secondary' }}>
            {r.label}
          </Box>
          <Box component="dd" sx={{ m: 0, fontWeight: 500, minWidth: 0, overflowWrap: 'anywhere' }}>
            {r.value}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

/** Centered empty state with a soft icon tile. */
export function LiffEmpty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <Stack alignItems="center" spacing={0.75} sx={{ py: 2, color: 'text.secondary', textAlign: 'center' }}>
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: '12px',
          display: 'grid',
          placeItems: 'center',
          bgcolor: 'grey.100',
          color: 'text.disabled',
        }}
      >
        {icon}
      </Box>
      <Typography variant="body2" color="text.secondary">
        {text}
      </Typography>
    </Stack>
  );
}

/** Placeholder rows while a list loads. */
export function LiffSkeleton({ rows = 2, button }: { rows?: number; button?: boolean }) {
  return (
    <Stack spacing={1.25}>
      {Array.from({ length: rows }).map((_, i) => (
        <Stack key={i} direction="row" spacing={1.25} alignItems="center">
          <Skeleton variant="rounded" width={38} height={38} sx={{ borderRadius: '10px' }} />
          <Box sx={{ flex: 1 }}>
            <Skeleton width="55%" height={16} />
            <Skeleton width="80%" height={12} />
          </Box>
        </Stack>
      ))}
      {button ? <Skeleton variant="rounded" height={42} sx={{ borderRadius: '12px' }} /> : null}
    </Stack>
  );
}
