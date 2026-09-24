/**
 * Customer rich menu: layout, button actions and the LINE request body.
 * Pure module shared by the portal (draws the image from `RICH_MENU_TILES`),
 * the publish route (`richMenuRequest`, `pngDimensions`) and the webhook
 * (`parsePostback`). No I/O here.
 */

/** LINE "compact" rich menu size: one row. */
export const RICH_MENU_SIZE = { width: 2500, height: 843 } as const;

/** LINE rejects rich menu images above 1 MB. */
export const RICH_MENU_IMAGE_MAX_BYTES = 1_048_576;

/** What a button asks the webhook to do. */
export type RichMenuAction = 'my_queues' | 'my_docs' | 'contact';

export type RichMenuTile = {
  action: RichMenuAction;
  /** Big label on the image and the text LINE shows as the user's message. */
  label: string;
  /** Small line under the label on the image. */
  sub: string;
  /** Tile background. */
  color: string;
  /** Simple glyph the canvas renderer knows how to draw. */
  icon: 'queue' | 'doc' | 'phone';
};

/** Left to right. Three equal tiles across the compact menu. */
export const RICH_MENU_TILES: readonly RichMenuTile[] = [
  { action: 'my_queues', label: 'คิวของฉัน', sub: 'ดูคิวที่จองไว้และสถานะ', color: '#1F7A5A', icon: 'queue' },
  { action: 'my_docs', label: 'สถานะ SO', sub: 'เอกสารที่เปิดอยู่และการชำระเงิน', color: '#2F4A7D', icon: 'doc' },
  { action: 'contact', label: 'ติดต่อคลัง', sub: 'เบอร์โทรและที่อยู่', color: '#5C6B63', icon: 'phone' },
];

/** Postback data of a tile: `action=<name>`; parsed back by the webhook. */
export function postbackData(action: RichMenuAction): string {
  return `action=${action}`;
}

/** `postbackData` inverse. Unknown / malformed data = null (ignored by the webhook). */
export function parsePostback(data: string | null | undefined): RichMenuAction | null {
  const m = /^action=([a-z_]+)$/.exec((data ?? '').trim());
  if (!m) return null;
  const action = m[1];
  return RICH_MENU_TILES.some((t) => t.action === action) ? (action as RichMenuAction) : null;
}

/**
 * Plain text a user might type instead of pressing a button. Matched after
 * trimming and removing spaces; keep the list short so normal chatter is
 * still answered with the help text.
 */
export function actionForText(text: string): RichMenuAction | null {
  const t = text.replace(/\s+/g, '').toLowerCase();
  if (!t) return null;
  if (['คิว', 'คิวของฉัน', 'เช็คคิว', 'ดูคิว', 'สถานะคิว', 'queue', 'myqueue'].includes(t)) return 'my_queues';
  if (['so', 'สถานะso', 'เอกสาร', 'สถานะเอกสาร', 'po', 'สถานะ', 'status'].includes(t)) return 'my_docs';
  if (['ติดต่อ', 'ติดต่อคลัง', 'เบอร์', 'โทร', 'contact'].includes(t)) return 'contact';
  return null;
}

/** Pixel bounds of each tile on the image, in tile order. */
export function tileBounds(): Array<{ x: number; y: number; width: number; height: number }> {
  const n = RICH_MENU_TILES.length;
  const w = Math.floor(RICH_MENU_SIZE.width / n);
  return RICH_MENU_TILES.map((_, i) => ({
    x: i * w,
    y: 0,
    // The last tile absorbs the rounding remainder so the areas cover the full width.
    width: i === n - 1 ? RICH_MENU_SIZE.width - i * w : w,
    height: RICH_MENU_SIZE.height,
  }));
}

export type LineRichMenuRequest = {
  size: { width: number; height: number };
  selected: boolean;
  name: string;
  chatBarText: string;
  areas: Array<{ bounds: { x: number; y: number; width: number; height: number }; action: { type: 'postback'; data: string; displayText: string } }>;
};

/**
 * Body for `POST /v2/bot/richmenu`. `selected` = menu opens by default;
 * `displayText` echoes the button label into the chat so the user sees what
 * they pressed.
 */
export function richMenuRequest(opts: { version?: number } = {}): LineRichMenuRequest {
  const bounds = tileBounds();
  return {
    size: { ...RICH_MENU_SIZE },
    selected: true,
    name: `fameline-customer-v${opts.version ?? 1}`,
    chatBarText: 'เมนู',
    areas: RICH_MENU_TILES.map((t, i) => ({ bounds: bounds[i], action: { type: 'postback', data: postbackData(t.action), displayText: t.label } })),
  };
}

/** PNG signature + IHDR width/height. Null when the bytes are not a PNG. */
export function pngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || sig.some((b, i) => bytes[i] !== b)) return null;
  // Bytes 12..15 must spell "IHDR"; width and height follow as big-endian u32.
  if (bytes[12] !== 0x49 || bytes[13] !== 0x48 || bytes[14] !== 0x44 || bytes[15] !== 0x52) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/** Why an uploaded image cannot be published, or null when it fits LINE's rules. */
export function richMenuImageProblem(bytes: Uint8Array): string | null {
  if (bytes.byteLength > RICH_MENU_IMAGE_MAX_BYTES) return `ไฟล์ภาพใหญ่เกิน 1 MB (${(bytes.byteLength / 1024).toFixed(0)} KB)`;
  const dim = pngDimensions(bytes);
  if (!dim) return 'ภาพต้องเป็น PNG';
  if (dim.width !== RICH_MENU_SIZE.width || dim.height !== RICH_MENU_SIZE.height) return `ขนาดภาพต้องเป็น ${RICH_MENU_SIZE.width}×${RICH_MENU_SIZE.height} (ได้ ${dim.width}×${dim.height})`;
  return null;
}
