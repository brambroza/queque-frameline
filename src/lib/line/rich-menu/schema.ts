import { z } from 'zod';
import { BUSINESS_TYPES } from './business-types';
import { ICON_KEYS } from './icons';
import { LAYOUT_KEYS, LAYOUTS } from './layouts';

/** LINE caps: action label ≤ 20 chars, chat bar text ≤ 14 chars. */
export const RICH_MENU_LABEL_MAX = 20;
export const RICH_MENU_CHAT_BAR_MAX = 14;
export const RICH_MENU_BUTTONS_MIN = 2;
export const RICH_MENU_BUTTONS_MAX = 6;

export const STYLE_KEYS = ['clean', 'bold', 'card'] as const;
export type StyleKey = (typeof STYLE_KEYS)[number];

const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'สีต้องเป็น hex 6 หลัก เช่น #12a862');

export const RichMenuActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('liff_booking') }),
  z.object({ type: z.literal('liff_member') }),
  z.object({ type: z.literal('url'), url: z.string().trim().url().startsWith('https://', 'ลิงก์ต้องขึ้นต้นด้วย https://') }),
  z.object({ type: z.literal('message'), text: z.string().trim().min(1).max(300) }),
]);
export type RichMenuAction = z.infer<typeof RichMenuActionSchema>;

export const RichMenuButtonSchema = z.object({
  iconKey: z.enum(ICON_KEYS),
  label: z.string().trim().min(1, 'ต้องมีข้อความ').max(RICH_MENU_LABEL_MAX, `ข้อความยาวได้ไม่เกิน ${RICH_MENU_LABEL_MAX} ตัว`),
  action: RichMenuActionSchema,
});
export type RichMenuButton = z.infer<typeof RichMenuButtonSchema>;

export const RichMenuPaletteSchema = z.object({
  primary: HexColor,
});
export type RichMenuPalette = z.infer<typeof RichMenuPaletteSchema>;

/**
 * Persisted rich menu configuration (`shops.rich_menu_config`). Everything the
 * renderer and the LINE request builder need, nothing tenant-specific.
 */
export const RichMenuConfigSchema = z
  .object({
    version: z.literal(1),
    businessType: z.enum(BUSINESS_TYPES).nullable(),
    layout: z.enum(LAYOUT_KEYS),
    style: z.enum(STYLE_KEYS),
    palette: RichMenuPaletteSchema,
    chatBarText: z.string().trim().min(1).max(RICH_MENU_CHAT_BAR_MAX, `ข้อความแถบเมนูยาวได้ไม่เกิน ${RICH_MENU_CHAT_BAR_MAX} ตัว`),
    heroSubtitle: z.string().trim().max(40).optional(),
    buttons: z.array(RichMenuButtonSchema).min(RICH_MENU_BUTTONS_MIN).max(RICH_MENU_BUTTONS_MAX),
  })
  .superRefine((cfg, ctx) => {
    const cells = LAYOUTS[cfg.layout].cells.length;
    if (cfg.buttons.length !== cells) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['buttons'],
        message: `เลย์เอาต์นี้ต้องมี ${cells} ปุ่ม (มี ${cfg.buttons.length})`,
      });
    }
  });
export type RichMenuConfig = z.infer<typeof RichMenuConfigSchema>;
