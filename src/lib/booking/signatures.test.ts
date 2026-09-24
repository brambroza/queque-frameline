import { describe, expect, it } from 'vitest';
import {
  SIGNATURE_MAX_BYTES, base64ByteLength, decodeSignatureDataUrl, isSignatureDataUrl, isSignatureParty, signatureColumns, signatureLogText,
  signatureObjectPath, signedParties,
} from './signatures';

const tinyPng = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64')}`;

describe('signature data URLs', () => {
  it('accepts a small PNG data URL and decodes its bytes', () => {
    expect(isSignatureDataUrl(tinyPng)).toBe(true);
    expect(Array.from(decodeSignatureDataUrl(tinyPng)?.subarray(0, 4) ?? [])).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it('rejects other formats, garbage and non-strings', () => {
    expect(isSignatureDataUrl('data:image/jpeg;base64,AAAA')).toBe(false);
    expect(isSignatureDataUrl('not a data url')).toBe(false);
    expect(isSignatureDataUrl(null)).toBe(false);
    expect(decodeSignatureDataUrl('data:image/png;base64,***')).toBeNull();
  });

  it('rejects a payload over the size cap', () => {
    const big = `data:image/png;base64,${'A'.repeat(Math.ceil(((SIGNATURE_MAX_BYTES + 100) * 4) / 3 / 4) * 4)}`;
    expect(base64ByteLength(big.slice('data:image/png;base64,'.length))).toBeGreaterThan(SIGNATURE_MAX_BYTES);
    expect(isSignatureDataUrl(big)).toBe(false);
  });

  it('computes decoded length with padding', () => {
    expect(base64ByteLength('AAAA')).toBe(3);
    expect(base64ByteLength('AAA=')).toBe(2);
    expect(base64ByteLength('AA==')).toBe(1);
  });
});

describe('row mapping', () => {
  it('builds one object per shop / booking / party', () => {
    expect(signatureObjectPath('shop', 'bk', 'staff')).toBe('shop/bk/staff.png');
    expect(signatureObjectPath('shop', 'bk', 'customer')).toBe('shop/bk/customer.png');
  });

  it('maps parties to columns', () => {
    expect(signatureColumns('staff')).toEqual({ path: 'sign_staff_path', name: 'sign_staff_name' });
    expect(signatureColumns('customer')).toEqual({ path: 'sign_customer_path', name: 'sign_customer_name' });
  });

  it('lists signed parties from a row', () => {
    expect(signedParties({ sign_staff_path: 'a', sign_customer_path: null })).toEqual(['staff']);
    expect(signedParties({ sign_staff_path: null, sign_customer_path: 'b' })).toEqual(['customer']);
    expect(signedParties({})).toEqual([]);
  });

  it('narrows parties', () => {
    expect(isSignatureParty('staff')).toBe(true);
    expect(isSignatureParty('driver')).toBe(false);
  });

  it('writes the audit fragment only when someone signed', () => {
    expect(signatureLogText({})).toBe('');
    expect(signatureLogText({ staff: { name: 'สมชาย' } })).toBe('ลงชื่อ: เจ้าหน้าที่คลัง สมชาย');
    expect(signatureLogText({ staff: { name: 'สมชาย' }, customer: { name: 'วิชัย' } })).toBe('ลงชื่อ: เจ้าหน้าที่คลัง สมชาย · ลูกค้า / คนขับ วิชัย');
  });
});
