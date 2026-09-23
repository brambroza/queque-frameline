import { describe, expect, it } from 'vitest';
import { base64ByteLength, feedbackReportSchema, parseScreenshotDataUrl } from './schemas';
import { FEEDBACK_SCREENSHOT_MAX_BYTES } from './constants';

const tinyJpeg = `data:image/jpeg;base64,${Buffer.from('jpegbytes').toString('base64')}`;

const valid = {
  kind: 'bug',
  priority: 'high',
  reporter_name: 'สมชาย',
  description: 'ปุ่มอนุมัติกดไม่ได้',
  page_path: '/portal/bookings',
  page_label: 'คิวรับ-ส่งสินค้า',
  screenshot: tinyJpeg,
  user_agent: 'Mozilla/5.0',
  viewport: '1440x900',
};

describe('base64ByteLength', () => {
  it('matches the decoded size for every padding case', () => {
    for (const s of ['a', 'ab', 'abc', 'abcd', 'abcde', 'jpegbytes']) {
      const b64 = Buffer.from(s).toString('base64');
      expect(base64ByteLength(b64)).toBe(Buffer.byteLength(s));
    }
  });
});

describe('parseScreenshotDataUrl', () => {
  it('decodes jpeg and png data URLs', () => {
    const jpg = parseScreenshotDataUrl(tinyJpeg);
    expect(jpg?.mime).toBe('image/jpeg');
    expect(jpg?.ext).toBe('jpg');
    expect(jpg?.buffer.toString()).toBe('jpegbytes');
    const png = parseScreenshotDataUrl(`data:image/png;base64,${Buffer.from('x').toString('base64')}`);
    expect(png?.ext).toBe('png');
  });

  it('rejects other mime types, malformed strings and empty values', () => {
    expect(parseScreenshotDataUrl('data:image/gif;base64,R0lGOD')).toBeNull();
    expect(parseScreenshotDataUrl('data:text/html;base64,PGI+')).toBeNull();
    expect(parseScreenshotDataUrl('not a data url')).toBeNull();
    expect(parseScreenshotDataUrl('')).toBeNull();
    expect(parseScreenshotDataUrl(null)).toBeNull();
  });

  it('rejects images above the size cap without decoding them', () => {
    const tooBig = 'A'.repeat(Math.ceil((FEEDBACK_SCREENSHOT_MAX_BYTES + 1024) / 3) * 4);
    expect(parseScreenshotDataUrl(`data:image/jpeg;base64,${tooBig}`)).toBeNull();
  });
});

describe('feedbackReportSchema', () => {
  it('accepts a full report and one without a screenshot', () => {
    expect(feedbackReportSchema.safeParse(valid).success).toBe(true);
    expect(feedbackReportSchema.safeParse({ ...valid, screenshot: null, page_label: undefined }).success).toBe(true);
  });

  it('trims and bounds the free-text fields', () => {
    const r = feedbackReportSchema.safeParse({ ...valid, reporter_name: '  สมชาย  ', description: '  hello world  ' });
    expect(r.success && r.data.reporter_name).toBe('สมชาย');
    expect(r.success && r.data.description).toBe('hello world');
    expect(feedbackReportSchema.safeParse({ ...valid, description: 'สั้น' }).success).toBe(false);
    expect(feedbackReportSchema.safeParse({ ...valid, reporter_name: '' }).success).toBe(false);
  });

  it('only accepts portal paths', () => {
    expect(feedbackReportSchema.safeParse({ ...valid, page_path: '/portal' }).success).toBe(true);
    expect(feedbackReportSchema.safeParse({ ...valid, page_path: '/portal/bookings?tab=x' }).success).toBe(true);
    expect(feedbackReportSchema.safeParse({ ...valid, page_path: '/book/abc' }).success).toBe(false);
    expect(feedbackReportSchema.safeParse({ ...valid, page_path: 'https://evil.example/portal' }).success).toBe(false);
  });

  it('rejects unknown kind / priority and bad screenshots', () => {
    expect(feedbackReportSchema.safeParse({ ...valid, kind: 'question' }).success).toBe(false);
    expect(feedbackReportSchema.safeParse({ ...valid, priority: 'p0' }).success).toBe(false);
    expect(feedbackReportSchema.safeParse({ ...valid, screenshot: 'data:image/gif;base64,R0lGOD' }).success).toBe(false);
  });
});
