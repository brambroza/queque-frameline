import { describe, expect, it } from 'vitest';
import { estimateDataUrlBytes, fitWidth } from './capture';

describe('estimateDataUrlBytes', () => {
  it('reads the decoded size from the base64 part of a data URL', () => {
    const b64 = Buffer.from('hello world').toString('base64');
    expect(estimateDataUrlBytes(`data:image/jpeg;base64,${b64}`)).toBe(11);
    expect(estimateDataUrlBytes(b64)).toBe(11);
  });
});

describe('fitWidth', () => {
  it('keeps images that already fit', () => {
    expect(fitWidth(1200, 800, 1600)).toEqual({ width: 1200, height: 800 });
  });

  it('scales wide images down while keeping the aspect ratio', () => {
    expect(fitWidth(3200, 1800, 1600)).toEqual({ width: 1600, height: 900 });
    expect(fitWidth(1601, 1, 1600).height).toBe(1);
  });
});
