/**
 * Shared vocabulary of the in-app feedback feature (portal floating button).
 * Kept dependency-free so both the client dialog and the API route / e-mail
 * builder can import it.
 */

export const FEEDBACK_KINDS = ['bug', 'suggestion'] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FEEDBACK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type FeedbackPriority = (typeof FEEDBACK_PRIORITIES)[number];

export const FEEDBACK_KIND_LABEL: Record<FeedbackKind, { th: string; en: string }> = {
  bug: { th: 'แจ้งปัญหา (Bug)', en: 'Bug report' },
  suggestion: { th: 'แนะนำการปรับปรุง', en: 'Suggestion' },
};

export const FEEDBACK_PRIORITY_LABEL: Record<FeedbackPriority, { th: string; en: string }> = {
  low: { th: 'ต่ำ', en: 'Low' },
  medium: { th: 'ปานกลาง', en: 'Medium' },
  high: { th: 'สูง', en: 'High' },
  urgent: { th: 'ด่วน', en: 'Urgent' },
};

/** MUI palette color per priority (chips / radios). */
export const FEEDBACK_PRIORITY_COLOR: Record<FeedbackPriority, 'default' | 'info' | 'warning' | 'error'> = {
  low: 'default',
  medium: 'info',
  high: 'warning',
  urgent: 'error',
};

/** Storage bucket holding screenshots (private; service role only). */
export const FEEDBACK_SCREENSHOT_BUCKET = 'feedback-screenshots';

/** Upper bound of the screenshot data URL the API accepts (bytes of the decoded image). */
export const FEEDBACK_SCREENSHOT_MAX_BYTES = 2.5 * 1024 * 1024;

export const FEEDBACK_DESCRIPTION_MIN = 5;
export const FEEDBACK_DESCRIPTION_MAX = 2000;
export const FEEDBACK_NAME_MAX = 120;
export const FEEDBACK_PHONE_MAX = 30;
/** Maximum extra recipients one report may copy. */
export const FEEDBACK_CC_MAX = 5;

export function isFeedbackKind(v: unknown): v is FeedbackKind {
  return typeof v === 'string' && (FEEDBACK_KINDS as readonly string[]).includes(v);
}

export function isFeedbackPriority(v: unknown): v is FeedbackPriority {
  return typeof v === 'string' && (FEEDBACK_PRIORITIES as readonly string[]).includes(v);
}
