/**
 * Close-of-job sign-off: the warehouse officer and the customer / driver sign
 * on the tablet when the queue is closed. Pure helpers shared by the Zod
 * schema, the PATCH handler and the UI; the bytes live in the private bucket
 * `booking-signatures`, the row only keeps paths and names.
 */

export const SIGNATURE_BUCKET = 'booking-signatures';
/** Decoded PNG size cap per signature (bucket limit is 256 KB). */
export const SIGNATURE_MAX_BYTES = 200 * 1024;
export const SIGNATURE_NAME_MAX = 120;

export type SignatureParty = 'staff' | 'customer';
export const SIGNATURE_PARTIES: readonly SignatureParty[] = ['staff', 'customer'];

export const SIGNATURE_PARTY_LABEL: Record<SignatureParty, string> = { staff: 'เจ้าหน้าที่คลัง', customer: 'ลูกค้า / คนขับ' };

/** One party's sign-off as sent by the tablet: typed name + PNG data URL. */
export type SignatureInput = { name: string; image: string };

const PNG_DATA_URL_RE = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/;

/** Decoded byte length of a base64 payload without materialising it. */
export function base64ByteLength(b64: string): number {
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

/** Narrow a value to a signature party. */
export function isSignatureParty(v: unknown): v is SignatureParty {
  return v === 'staff' || v === 'customer';
}

/** True when the string is a PNG data URL whose decoded size fits the cap. */
export function isSignatureDataUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = PNG_DATA_URL_RE.exec(value);
  return Boolean(m) && base64ByteLength(m![1]) <= SIGNATURE_MAX_BYTES;
}

/** Bytes of a validated signature data URL (null when it does not validate). */
export function decodeSignatureDataUrl(value: string): Buffer | null {
  const m = PNG_DATA_URL_RE.exec(value);
  if (!m || base64ByteLength(m[1]) > SIGNATURE_MAX_BYTES) return null;
  return Buffer.from(m[1], 'base64');
}

/** Object path inside the bucket: one folder per shop and booking, one file per party. */
export function signatureObjectPath(shopId: string, bookingId: string, party: SignatureParty): string {
  return `${shopId}/${bookingId}/${party}.png`;
}

/** Row columns for a party's signature. */
export function signatureColumns(party: SignatureParty): { path: 'sign_staff_path' | 'sign_customer_path'; name: 'sign_staff_name' | 'sign_customer_name' } {
  return party === 'staff'
    ? { path: 'sign_staff_path', name: 'sign_staff_name' }
    : { path: 'sign_customer_path', name: 'sign_customer_name' };
}

/** Audit-log fragment: "ลงชื่อ: เจ้าหน้าที่คลัง สมชาย · ลูกค้า / คนขับ วิชัย" or '' when nobody signed. */
export function signatureLogText(signed: Partial<Record<SignatureParty, { name: string }>>): string {
  const parts = SIGNATURE_PARTIES.filter((p) => signed[p]).map((p) => `${SIGNATURE_PARTY_LABEL[p]} ${signed[p]!.name}`);
  return parts.length ? `ลงชื่อ: ${parts.join(' · ')}` : '';
}

/** Which parties of a booking row have a stored signature. */
export function signedParties(row: { sign_staff_path?: string | null; sign_customer_path?: string | null }): SignatureParty[] {
  return SIGNATURE_PARTIES.filter((p) => Boolean(p === 'staff' ? row.sign_staff_path : row.sign_customer_path));
}
