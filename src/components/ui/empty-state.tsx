'use client';

import Link from 'next/link';

type Props = {
  title: string;
  /** One line explaining why this matters, not just that the list is empty. */
  description?: string;
  actionLabel?: string;
  /** Use for in-page actions such as opening a drawer. */
  onAction?: () => void;
  /** Use instead of onAction when the next step lives on another page. */
  actionHref?: string;
  icon?: string;
};

/**
 * Replaces the bare "ยังไม่มีข้อมูล" that every empty list used to show. An
 * empty screen with no next action is where new shops stalled.
 */
export function EmptyState({ title, description, actionLabel, onAction, actionHref, icon = '📋' }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <span className="text-3xl" aria-hidden="true">
        {icon}
      </span>
      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
        {title}
      </p>
      {description ? (
        <p className="max-w-sm text-xs" style={{ color: 'var(--muted)' }}>
          {description}
        </p>
      ) : null}
      {actionLabel && actionHref ? (
        <Link href={actionHref} className="btn-primary mt-2">
          {actionLabel}
        </Link>
      ) : actionLabel && onAction ? (
        <button type="button" className="btn-primary mt-2" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
