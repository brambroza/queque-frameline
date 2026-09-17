/**
 * Read the pixel size of a PNG or JPEG from its bytes without decoding it.
 * Used server-side to validate uploaded rich menu images.
 */

export type ImageSize = { width: number; height: number; mime: 'image/png' | 'image/jpeg' };

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * @param bytes - Raw file contents.
 * @returns Size + mime, or null when the bytes are not a recognisable PNG/JPEG.
 */
export function readImageSize(bytes: Uint8Array): ImageSize | null {
  return readPng(bytes) ?? readJpeg(bytes);
}

function readPng(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 24) return null;
  for (let i = 0; i < PNG_SIGNATURE.length; i += 1) if (bytes[i] !== PNG_SIGNATURE[i]) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // IHDR chunk always first: length(4) type(4) width(4) height(4)
  if (String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]) !== 'IHDR') return null;
  return { width: view.getUint32(16), height: view.getUint32(20), mime: 'image/png' };
}

function readJpeg(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    // Standalone markers without a length field
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = view.getUint16(offset + 2);
    const isSof = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf);
    if (isSof) {
      return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7), mime: 'image/jpeg' };
    }
    if (marker === 0xda) return null; // start of scan before any SOF
    offset += 2 + length;
  }
  return null;
}
