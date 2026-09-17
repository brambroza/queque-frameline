/**
 * Detect an image's real type from its leading bytes.
 *
 * A client-declared `file.type` and the filename extension are both attacker
 * controlled — a renamed PDF or HTML file would otherwise land in storage and be
 * served back to a staff member's browser.
 */
export type SniffedImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

export function sniffImageMime(bytes: Uint8Array): SniffedImageMime | null {
  if (bytes.length < 12) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((b, i) => bytes[i] === b)) return 'image/png';

  // WebP: 'RIFF' .... 'WEBP'
  const riff = [0x52, 0x49, 0x46, 0x46];
  const webp = [0x57, 0x45, 0x42, 0x50];
  if (riff.every((b, i) => bytes[i] === b) && webp.every((b, i) => bytes[8 + i] === b)) return 'image/webp';

  return null;
}
