'use client';

import { ReactNode } from 'react';
import { CircularProgress, IconButton, Tooltip } from '@mui/material';
import type { IconButtonProps, TooltipProps } from '@mui/material';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { useConfirm, type ConfirmRequest } from '@/components/ui/confirm-dialog';

type Props = {
  icon: ReactNode;
  labelKey?: string;
  fallbackLabel: string;
  color?: IconButtonProps['color'];
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  size?: IconButtonProps['size'];
  /** Ask through the shared ConfirmDialog before running `onClick`. */
  confirm?: ConfirmRequest;
  /** @deprecated Use `confirm`. Kept so older call sites keep working. */
  confirmBeforeClick?: boolean;
  /** @deprecated Use `confirm.title`. */
  confirmTitle?: string;
  /** @deprecated Use `confirm.description`. */
  confirmMessage?: string;
  tooltipPlacement?: TooltipProps['placement'];
};

/**
 * Map the legacy `confirmBeforeClick` / `confirmTitle` / `confirmMessage`
 * props onto a ConfirmRequest so callers that have not migrated still get the
 * styled dialog instead of `window.confirm`.
 */
export function legacyConfirmRequest(input: {
  confirm?: ConfirmRequest;
  confirmBeforeClick?: boolean;
  confirmTitle?: string;
  confirmMessage?: string;
  label: string;
}): ConfirmRequest | null {
  if (input.confirm) return input.confirm;
  if (!input.confirmBeforeClick) return null;
  return {
    tone: 'warning',
    title: input.confirmTitle ?? input.label,
    description: input.confirmMessage,
    confirmLabel: input.label,
  };
}

export function ActionIconButton({
  icon,
  labelKey,
  fallbackLabel,
  color = 'default',
  disabled,
  loading,
  onClick,
  size = 'small',
  confirm: confirmRequest,
  confirmBeforeClick = false,
  confirmTitle,
  confirmMessage,
  tooltipPlacement = 'top',
}: Props) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const label = labelKey ? t(labelKey, fallbackLabel) : fallbackLabel;

  async function handleClick() {
    if (!onClick || disabled || loading) return;
    const request = legacyConfirmRequest({ confirm: confirmRequest, confirmBeforeClick, confirmTitle, confirmMessage, label });
    if (request && !(await confirm(request))) return;
    onClick();
  }

  return (
    <Tooltip title={label} placement={tooltipPlacement}>
      <span>
        <IconButton aria-label={label} color={color} disabled={disabled || loading} onClick={() => void handleClick()} size={size}>
          {loading ? <CircularProgress size={18} /> : icon}
        </IconButton>
      </span>
    </Tooltip>
  );
}
