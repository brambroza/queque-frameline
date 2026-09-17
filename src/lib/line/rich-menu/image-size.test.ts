import { describe, expect, it } from 'vitest';
import { readImageSize } from './image-size';

function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12); // IHDR
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

function jpegHeader(width: number, height: number): Uint8Array {
  // SOI, APP0 (length 16), SOF0 (length 17)
  const bytes = new Uint8Array(2 + 18 + 19);
  const view = new DataView(bytes.buffer);
  bytes.set([0xff, 0xd8], 0);
  bytes.set([0xff, 0xe0], 2);
  view.setUint16(4, 16);
  const sof = 2 + 18;
  bytes.set([0xff, 0xc0], sof);
  view.setUint16(sof + 2, 17);
  bytes[sof + 4] = 8;
  view.setUint16(sof + 5, height);
  view.setUint16(sof + 7, width);
  return bytes;
}

describe('readImageSize', () => {
  it('reads PNG IHDR', () => {
    expect(readImageSize(pngHeader(2500, 1686))).toEqual({ width: 2500, height: 1686, mime: 'image/png' });
  });

  it('reads JPEG SOF0 after an APP0 segment', () => {
    expect(readImageSize(jpegHeader(2500, 843))).toEqual({ width: 2500, height: 843, mime: 'image/jpeg' });
  });

  it('returns null for unknown bytes', () => {
    expect(readImageSize(new Uint8Array([1, 2, 3, 4]))).toBeNull();
    expect(readImageSize(new TextEncoder().encode('<svg></svg>'))).toBeNull();
  });
});
