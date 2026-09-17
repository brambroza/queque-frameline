import crypto from 'crypto';

export function verifyLineSignature(channelSecret: string, body: string, signature: string): boolean {
  const hash = crypto.createHmac('sha256', channelSecret).update(body).digest('base64');
  return hash === signature;
}
