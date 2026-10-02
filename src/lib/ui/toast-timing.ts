export type ToastType = 'success' | 'error' | 'info' | 'warning';

/** Most toasts kept on screen at once; older ones are dropped first. */
export const MAX_TOASTS = 4;

/**
 * How long a toast stays before it hides itself. Errors stay longest because
 * the message usually explains what to fix; a green "saved" needs a glance.
 */
export function durationFor(type: ToastType): number {
  switch (type) {
    case 'error':
      return 6000;
    case 'warning':
      return 5000;
    default:
      return 3000;
  }
}

/** Keep at most `max` toasts, dropping the oldest first. */
export function capToasts<T>(list: T[], max: number = MAX_TOASTS): T[] {
  return list.length > max ? list.slice(list.length - max) : list;
}
