import { describe, expect, it } from 'vitest';
import { buildStaffWelcomeEmail, getStaffDefaultPassword, mustChangePassword } from './welcome-email';

describe('getStaffDefaultPassword', () => {
  it('is off when unset, blank or too short', () => {
    expect(getStaffDefaultPassword({})).toBeNull();
    expect(getStaffDefaultPassword({ STAFF_DEFAULT_PASSWORD: '' })).toBeNull();
    expect(getStaffDefaultPassword({ STAFF_DEFAULT_PASSWORD: 'short7!' })).toBeNull();
  });

  it('returns the value, trimmed (a stray space from the env UI must not join the password)', () => {
    expect(getStaffDefaultPassword({ STAFF_DEFAULT_PASSWORD: 'Start#2026' })).toBe('Start#2026');
    expect(getStaffDefaultPassword({ STAFF_DEFAULT_PASSWORD: ' Start#2026 \n' })).toBe('Start#2026');
    expect(getStaffDefaultPassword({ STAFF_DEFAULT_PASSWORD: '  short  ' })).toBeNull();
  });
});

describe('mustChangePassword', () => {
  it('is true only for the explicit flag', () => {
    expect(mustChangePassword({ must_change_password: true })).toBe(true);
    expect(mustChangePassword({ must_change_password: false })).toBe(false);
    expect(mustChangePassword({ must_change_password: 'true' })).toBe(false);
    expect(mustChangePassword({})).toBe(false);
    expect(mustChangePassword(null)).toBe(false);
  });
});

describe('buildStaffWelcomeEmail', () => {
  const input = { displayName: 'สมชาย ใจดี', email: 'somchai@fameline.com', password: 'Start#2026', loginUrl: 'https://queue.example.com/login' };

  it('puts e-mail, password and login link in both bodies', () => {
    const mail = buildStaffWelcomeEmail(input);
    for (const body of [mail.text, mail.html]) {
      expect(body).toContain('somchai@fameline.com');
      expect(body).toContain('Start#2026');
      expect(body).toContain('https://queue.example.com/login');
      expect(body).toContain('เรียน คุณสมชาย ใจดี');
    }
    expect(mail.subject).toContain('Fameline Queue');
  });

  it('escapes HTML in user-supplied values', () => {
    const mail = buildStaffWelcomeEmail({ ...input, displayName: '<b>x</b>', password: 'a<b>&"c\'d' });
    expect(mail.html).not.toContain('<b>x</b>');
    expect(mail.html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(mail.html).toContain('a&lt;b&gt;&amp;&quot;c&#39;d');
  });

  it('falls back to a generic greeting without a name', () => {
    expect(buildStaffWelcomeEmail({ ...input, displayName: '  ' }).text).toContain('เรียน ผู้ใช้งานใหม่');
  });
});
