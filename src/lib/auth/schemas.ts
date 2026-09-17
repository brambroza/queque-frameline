import { z } from 'zod';

export const registerSchema = z.object({
  company_name: z.string().min(2),
  shop_name: z.string().min(2),
  owner_name: z.string().min(2),
  phone: z.string().min(8),
  email: z.string().email(),
  password: z.string().min(8),
  plan_name: z.string().trim().optional().default(''),
  /** Drives which service templates seed the new shop; also qualifies the lead. */
  business_category: z.string().trim().max(60).optional().default(''),
  /** First-touch campaign parameters captured on the landing page. */
  utm: z.record(z.string()).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
