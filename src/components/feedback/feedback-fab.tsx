'use client';

import { useCallback, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { CircularProgress, Fab, Tooltip } from '@mui/material';
import FeedbackRoundedIcon from '@mui/icons-material/FeedbackRounded';
import { useI18n } from '@/components/i18n/i18n-provider';
import { useBranchScope } from '@/components/layout/branch-scope-provider';
import { menuItemForPath } from '@/lib/auth/menu-registry';
import { captureScreenshot, FEEDBACK_IGNORE_ATTR } from './capture';
import { FeedbackDialog } from './feedback-dialog';

/**
 * Above MUI's drawer (1200) / modal (1300) and the Tailwind CRUD drawers (1201)
 * so the button stays clickable while a dialog or drawer is open — a bug seen
 * inside a dialog is exactly what people need to report. Kept below tooltip
 * (1500) and the toast stack (1600).
 */
const FAB_Z_INDEX = 1450;

/**
 * Floating "report a problem / suggest" button pinned bottom-left on every
 * portal page, reachable even while a dialog or drawer is open. Captures the
 * current screen first (with itself hidden), then opens the form.
 */
export function FeedbackFab({ fullName }: { fullName?: string | null }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const { branchId } = useBranchScope();
  const [capturing, setCapturing] = useState(false);
  const [open, setOpen] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  // Path + query frozen at the moment the user pressed the button (query read
  // from `window` to avoid a Suspense boundary for `useSearchParams`).
  const [pagePath, setPagePath] = useState(pathname);

  const pageLabel = useMemo(() => {
    const item = menuItemForPath(pathname);
    return item ? t(item.labelKey, item.fallback) : null;
  }, [pathname, t]);

  const start = useCallback(async () => {
    if (capturing || open) return;
    setPagePath(`${window.location.pathname}${window.location.search}`);
    setCapturing(true);
    try {
      const shot = await captureScreenshot();
      setScreenshot(shot);
    } finally {
      setCapturing(false);
      setOpen(true);
    }
  }, [capturing, open]);

  const tooltip = t('feedback.fab', 'แจ้งปัญหา / แนะนำการใช้งาน');

  return (
    <>
      <Tooltip title={tooltip} placement="right" arrow>
        <span
          {...{ [FEEDBACK_IGNORE_ATTR]: '' }}
          style={{
            position: 'fixed',
            left: 'calc(20px + env(safe-area-inset-left, 0px))',
            bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
            zIndex: FAB_Z_INDEX,
            // Hidden while rendering so the button never shows up in its own screenshot.
            visibility: capturing ? 'hidden' : 'visible',
          }}
        >
          <Fab
            color="primary"
            size="medium"
            aria-label={tooltip}
            onClick={() => void start()}
            disabled={capturing}
            sx={{ boxShadow: (theme) => `0 8px 20px ${theme.palette.primary.main}55` }}
          >
            {capturing ? <CircularProgress size={22} color="inherit" /> : <FeedbackRoundedIcon />}
          </Fab>
        </span>
      </Tooltip>
      <FeedbackDialog
        open={open}
        onClose={() => setOpen(false)}
        screenshot={screenshot}
        pagePath={pagePath}
        pageLabel={pageLabel}
        defaultName={fullName}
        branchId={branchId || null}
      />
    </>
  );
}
