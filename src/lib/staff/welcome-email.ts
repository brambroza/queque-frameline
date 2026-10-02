/**
 * New-staff onboarding with a site-wide starting password.
 *
 * When `STAFF_DEFAULT_PASSWORD` is set, POST /api/staff creates the login with that
 * password (no Supabase invite link) and mails the member their sign-in details.
 * The account carries `user_metadata.must_change_password = true`; the login form
 * then offers /set-password?first=1 until the member picks their own password
 * (they may postpone). Unset = the old invite-by-email flow.
 *
 * Pure: no I/O. The password comes from env and is only ever rendered into the
 * e-mail body — never logged or returned by the API.
 */
import { escapeHtml } from '@/lib/feedback/email';

export { MUST_CHANGE_PASSWORD_KEY, mustChangePassword } from './password-flag';

/** Supabase Auth's minimum; shorter values are treated as "not configured". */
const MIN_PASSWORD_LENGTH = 8;

/**
 * The starting password for new staff, or null when the feature is off
 * (unset, blank, or shorter than the Auth minimum).
 */
export function getStaffDefaultPassword(env: Record<string, string | undefined> = process.env): string | null {
  const value = env.STAFF_DEFAULT_PASSWORD ?? '';
  return value.length >= MIN_PASSWORD_LENGTH ? value : null;
}

export type StaffWelcomeInput = {
  displayName: string;
  email: string;
  password: string;
  /** Absolute URL of the portal sign-in page. */
  loginUrl: string;
};

export type BuiltEmail = { subject: string; text: string; html: string };

const SUBJECT = 'ข้อมูลเข้าใช้งาน Fameline Queue — ระบบจองคิวรับ-ส่งสินค้าหน้าคลัง';

/** Subject, plain-text and HTML body of the welcome e-mail (Fameline brand, same look as the invite template). */
export function buildStaffWelcomeEmail(input: StaffWelcomeInput): BuiltEmail {
  const name = input.displayName.trim();
  const greeting = name ? `เรียน คุณ${name}` : 'เรียน ผู้ใช้งานใหม่';

  const text = [
    greeting,
    '',
    'บริษัท เฟมไลน์ โปรดักส์ จำกัด ขอเรียนเชิญท่านเข้าใช้งาน Fameline Queue ระบบจองคิวรับ-ส่งสินค้าหน้าคลัง',
    '',
    `อีเมลสำหรับเข้าสู่ระบบ: ${input.email}`,
    `รหัสผ่านเริ่มต้น: ${input.password}`,
    `เข้าสู่ระบบ: ${input.loginUrl}`,
    '',
    'เมื่อเข้าสู่ระบบครั้งแรก ระบบจะให้ท่านตั้งรหัสผ่านใหม่ (เลือกเปลี่ยนภายหลังได้)',
    'เพื่อความปลอดภัย กรุณาเปลี่ยนรหัสผ่านโดยเร็ว และห้ามเปิดเผยรหัสผ่านกับผู้อื่น',
    '',
    'ขอแสดงความนับถือ',
    'ฝ่ายบริหารระบบ Fameline Queue',
    'บริษัท เฟมไลน์ โปรดักส์ จำกัด',
    '',
    '© บริษัท เฟมไลน์ โปรดักส์ จำกัด · จัดทำโดย บริษัท โกอะลอง จำกัด',
  ].join('\n');

  const e = {
    greeting: escapeHtml(greeting),
    email: escapeHtml(input.email),
    password: escapeHtml(input.password),
    loginUrl: escapeHtml(input.loginUrl),
  };

  const step = (n: number, body: string, last = false) => `
                <tr>
                  <td valign="top" width="30" style="padding:0 0 ${last ? 0 : 10}px 0;">
                    <div style="width:22px; height:22px; line-height:22px; text-align:center; background-color:#002c1f; color:#adc32b; border-radius:999px; font-size:12px; font-weight:700; font-family:Arial,sans-serif;">${n}</div>
                  </td>
                  <td valign="top" style="padding:1px 0 ${last ? 0 : 10}px 0; font-size:14px; line-height:22px; color:#334155;">${body}</td>
                </tr>`;

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <title>ข้อมูลเข้าใช้งาน Fameline Queue</title>
  <style>
    body { margin: 0; padding: 0; }
    @media only screen and (max-width: 620px) {
      .container { width: 100% !important; }
      .px { padding-left: 24px !important; padding-right: 24px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#eef3f0; font-family:'Leelawadee UI','Sarabun','Tahoma','Segoe UI',Arial,sans-serif;">
  <div style="display:none; max-height:0; overflow:hidden; font-size:1px; line-height:1px; color:#eef3f0; opacity:0;">ข้อมูลเข้าสู่ระบบ Fameline Queue ของท่าน — อีเมลและรหัสผ่านเริ่มต้น</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef3f0;">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">
          <tr>
            <td class="px" style="background-color:#002c1f; border-radius:16px 16px 0 0; padding:28px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle" width="48" style="width:48px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                      <td align="center" valign="middle" width="44" height="44" style="width:44px; height:44px; background-color:#adc32b; border-radius:12px; font-size:22px; font-weight:700; color:#002c1f; font-family:Arial,sans-serif;">F</td>
                    </tr></table>
                  </td>
                  <td valign="middle" style="padding-left:14px;">
                    <div style="font-size:20px; line-height:24px; font-weight:700; letter-spacing:3px; color:#ffffff; font-family:Arial,sans-serif;">FAMELINE</div>
                    <div style="font-size:13px; line-height:18px; color:#aedbc0;">Queue · ระบบจองคิวรับ-ส่งสินค้าหน้าคลัง</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td height="4" style="height:4px; line-height:4px; font-size:4px; background-color:#adc32b;">&nbsp;</td></tr>
          <tr>
            <td class="px" style="background-color:#ffffff; padding:40px 40px 8px 40px;">
              <div style="display:inline-block; padding:4px 12px; background-color:#d4eddf; color:#0a5937; font-size:12px; font-weight:600; border-radius:999px;">ข้อมูลเข้าใช้งานระบบ</div>
              <h1 style="margin:16px 0 8px 0; font-size:24px; line-height:34px; font-weight:700; color:#002c1f;">${e.greeting}</h1>
              <p style="margin:0 0 24px 0; font-size:15px; line-height:26px; color:#334155;">
                บริษัท เฟมไลน์ โปรดักส์ จำกัด ขอเรียนเชิญท่านเข้าใช้งาน <strong style="color:#002c1f;">Fameline Queue</strong>
                ระบบจองคิวรับ-ส่งสินค้าหน้าคลัง สำหรับจัดการคิวรถ ใบสั่งขาย (SO) ใบสั่งซื้อ (PO) และงานหน้าท่า
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f8f6; border:1px solid #dbe7e0; border-radius:12px; margin:0 0 28px 0;">
                <tr>
                  <td style="padding:18px 20px 8px 20px;">
                    <div style="font-size:12px; line-height:18px; color:#64748b; letter-spacing:1px;">อีเมลสำหรับเข้าสู่ระบบ</div>
                    <div style="font-size:16px; line-height:24px; font-weight:600; color:#002c1f; word-break:break-all;">${e.email}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 20px 18px 20px;">
                    <div style="font-size:12px; line-height:18px; color:#64748b; letter-spacing:1px;">รหัสผ่านเริ่มต้น</div>
                    <div style="font-size:18px; line-height:26px; font-weight:700; color:#002c1f; font-family:'Courier New',Consolas,monospace; letter-spacing:1px;">${e.password}</div>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0;">
                <tr>
                  <td align="center" style="background-color:#0b8d51; border-radius:10px;">
                    <a href="${e.loginUrl}" target="_blank" style="display:inline-block; padding:14px 36px; font-size:16px; line-height:20px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:10px;">เข้าสู่ระบบ</a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 10px 0; font-size:14px; line-height:22px; font-weight:700; color:#002c1f;">ขั้นตอนการเริ่มใช้งาน</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">${step(1, 'กดปุ่ม “เข้าสู่ระบบ” แล้วกรอกอีเมลและรหัสผ่านเริ่มต้นข้างต้น')}${step(2, 'ระบบจะให้ตั้งรหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร — เลือก “เปลี่ยนทีหลัง” ได้')}${step(3, 'ครั้งถัดไปเข้าสู่ระบบด้วยรหัสผ่านที่ตั้งเอง', true)}
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
                <tr>
                  <td style="border-left:4px solid #d97706; background-color:#fffbeb; padding:14px 16px; font-size:13px; line-height:22px; color:#78350f; border-radius:0 8px 8px 0;">
                    <strong>เพื่อความปลอดภัย</strong> รหัสผ่านเริ่มต้นนี้ใช้ร่วมกันกับผู้ใช้ใหม่ทุกคน กรุณาเปลี่ยนเป็นรหัสผ่านของท่านเองโดยเร็ว และห้ามส่งต่ออีเมลนี้ให้ผู้อื่น
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 6px 0; font-size:12px; line-height:20px; color:#64748b;">หากกดปุ่มไม่ได้ ให้คัดลอกลิงก์นี้ไปเปิดในเบราว์เซอร์:</p>
              <p style="margin:0 0 32px 0; font-size:12px; line-height:20px; word-break:break-all;"><a href="${e.loginUrl}" target="_blank" style="color:#0b8d51; text-decoration:underline;">${e.loginUrl}</a></p>
            </td>
          </tr>
          <tr>
            <td class="px" style="background-color:#ffffff; padding:0 40px 36px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #e2e8f0;">
                <tr>
                  <td style="padding-top:20px; font-size:14px; line-height:22px; color:#334155;">
                    ขอแสดงความนับถือ<br />
                    <strong style="color:#002c1f;">ฝ่ายบริหารระบบ Fameline Queue</strong><br />
                    บริษัท เฟมไลน์ โปรดักส์ จำกัด
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="px" style="background-color:#00170f; border-radius:0 0 16px 16px; padding:22px 40px; font-size:12px; line-height:20px; color:#aedbc0;">
              Fameline Queue — ระบบจองคิวรับ-ส่งสินค้าหน้าคลัง<br />
              <span style="color:#7fa892;">© บริษัท เฟมไลน์ โปรดักส์ จำกัด · จัดทำโดย บริษัท โกอะลอง จำกัด</span><br />
              <span style="font-size:11px; color:#5f8573;">อีเมลนี้ส่งโดยอัตโนมัติจากระบบ กรุณาอย่าตอบกลับ</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject: SUBJECT, text, html };
}
