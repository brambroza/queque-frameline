import { describe, expect, it } from 'vitest';
import { buildFeedbackEmail, escapeHtml, pageUrl, summarize } from './email';

const report = {
  id: '11111111-2222-3333-4444-555555555555',
  kind: 'bug' as const,
  priority: 'urgent' as const,
  reporter_name: 'สมชาย',
  description: 'กดอนุมัติแล้ว <script>alert(1)</script> ไม่ขึ้น DO\nบรรทัดสอง',
  page_path: '/portal/bookings?tab=pending',
  page_label: 'คิวรับ-ส่งสินค้า',
  user_agent: 'Mozilla/5.0',
  viewport: '1440x900',
  created_at: new Date('2026-09-24T02:30:00Z'),
};

describe('summarize / pageUrl / escapeHtml', () => {
  it('summarizes the first non-empty line and truncates with an ellipsis', () => {
    expect(summarize('\n\n  first line  \nsecond')).toBe('first line');
    expect(summarize('x'.repeat(80), 10)).toBe(`${'x'.repeat(9)}…`);
    expect(summarize('')).toBe('');
  });

  it('joins app url and path without double slashes', () => {
    expect(pageUrl('https://q.example.com/', '/portal/bookings')).toBe('https://q.example.com/portal/bookings');
    expect(pageUrl('https://q.example.com', 'portal')).toBe('https://q.example.com/portal');
  });

  it('escapes html', () => {
    expect(escapeHtml(`<a href="x">&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  });
});

describe('buildFeedbackEmail', () => {
  const ctx = { appUrl: 'https://q.example.com', reporterEmail: 'somchai@fameline.co.th', reporterRole: 'staff', siteName: 'Fameline', screenshotCid: 'shot', appVersion: 'v0.1.0' };

  it('builds a tagged subject from kind, priority, page label and description', () => {
    const { subject } = buildFeedbackEmail(report, ctx);
    expect(subject).toBe('[Fameline][BUG][ด่วน] คิวรับ-ส่งสินค้า — กดอนุมัติแล้ว <script>alert(1)</script> ไม่ขึ้น DO');
  });

  it('falls back to the path and default site name', () => {
    const { subject } = buildFeedbackEmail({ ...report, page_label: null, kind: 'suggestion', priority: 'low' }, { appUrl: ctx.appUrl });
    expect(subject.startsWith('[Fameline Queue][แนะนำ][ต่ำ] /portal/bookings?tab=pending — ')).toBe(true);
  });

  it('renders every context row in text and escapes the html body', () => {
    const { text, html } = buildFeedbackEmail(report, ctx);
    expect(text).toContain('ผู้แจ้ง: สมชาย');
    expect(text).toContain('อีเมลผู้ใช้: somchai@fameline.co.th');
    expect(text).toContain('URL: https://q.example.com/portal/bookings?tab=pending');
    expect(text).toContain('Report ID: 11111111-2222-3333-4444-555555555555');
    expect(text).toContain('(Asia/Bangkok)');
    expect(text).toContain('screenshot.jpg');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('src="cid:shot"');
  });

  it('says so when no screenshot is attached', () => {
    const { text, html } = buildFeedbackEmail(report, { ...ctx, screenshotCid: null });
    expect(text).toContain('ไม่มีภาพหน้าจอแนบ');
    expect(html).not.toContain('cid:');
  });
});
