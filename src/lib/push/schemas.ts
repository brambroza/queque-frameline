import { z } from 'zod';

/** `PushSubscription.toJSON()` as the browser hands it over, plus a trimmed UA for support. */
export const pushSubscribeSchema = z.object({
  endpoint: z.string().url().max(2000).refine((u) => u.startsWith('https://'), 'endpoint must be https'),
  keys: z.object({
    p256dh: z.string().min(20).max(300),
    auth: z.string().min(10).max(100),
  }),
  user_agent: z.string().max(300).optional(),
});

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url().max(2000),
});

export type PushSubscribeInput = z.infer<typeof pushSubscribeSchema>;
