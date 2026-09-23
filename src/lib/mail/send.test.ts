import { describe, expect, it } from 'vitest';
import { getSmtpConfig } from './send';

describe('getSmtpConfig', () => {
  it('is disabled unless host, user and pass are all present', () => {
    expect(getSmtpConfig({})).toBeNull();
    expect(getSmtpConfig({ SMTP_HOST: 'smtp.gmail.com' })).toBeNull();
    expect(getSmtpConfig({ SMTP_HOST: 'smtp.gmail.com', SMTP_USER: 'a@gmail.com' })).toBeNull();
    expect(getSmtpConfig({ SMTP_HOST: ' ', SMTP_USER: 'a@gmail.com', SMTP_PASS: 'x' })).toBeNull();
  });

  it('applies gmail-style defaults and falls back the from address to the user', () => {
    const cfg = getSmtpConfig({ SMTP_HOST: 'smtp.gmail.com', SMTP_USER: 'a@gmail.com', SMTP_PASS: 'app-pass' });
    expect(cfg).toEqual({ host: 'smtp.gmail.com', port: 587, secure: false, user: 'a@gmail.com', pass: 'app-pass', from: 'a@gmail.com' });
  });

  it('parses port / secure and honours an explicit from address', () => {
    const cfg = getSmtpConfig({ SMTP_HOST: 'h', SMTP_USER: 'u', SMTP_PASS: 'p', SMTP_PORT: '465', SMTP_SECURE: 'TRUE', SMTP_FROM_EMAIL: 'noreply@x.com' });
    expect(cfg?.port).toBe(465);
    expect(cfg?.secure).toBe(true);
    expect(cfg?.from).toBe('noreply@x.com');
    expect(getSmtpConfig({ SMTP_HOST: 'h', SMTP_USER: 'u', SMTP_PASS: 'p', SMTP_PORT: 'abc' })?.port).toBe(587);
  });
});
