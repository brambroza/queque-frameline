type SignupPayload = {
  companyName: string;
  shopName: string;
  ownerName: string;
  phone: string;
  email: string;
  shopKey: string;
  createdAt: string;
};

function buildHtml(payload: SignupPayload) {
  return `
  <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
    <h2 style="margin:0 0 12px">New Shop Registration</h2>
    <table style="border-collapse:collapse">
      <tr><td style="padding:4px 10px 4px 0"><b>Company</b></td><td>${payload.companyName}</td></tr>
      <tr><td style="padding:4px 10px 4px 0"><b>Shop</b></td><td>${payload.shopName}</td></tr>
      <tr><td style="padding:4px 10px 4px 0"><b>Owner</b></td><td>${payload.ownerName}</td></tr>
      <tr><td style="padding:4px 10px 4px 0"><b>Phone</b></td><td>${payload.phone}</td></tr>
      <tr><td style="padding:4px 10px 4px 0"><b>Email</b></td><td>${payload.email}</td></tr>
      <tr><td style="padding:4px 10px 4px 0"><b>Shop Key</b></td><td>${payload.shopKey}</td></tr>
      <tr><td style="padding:4px 10px 4px 0"><b>Created At</b></td><td>${payload.createdAt}</td></tr>
    </table>
  </div>
  `;
}

async function sendViaGmailSmtp(payload: SignupPayload): Promise<boolean> {
  const host = process.env.SMTP_HOST ?? 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT ?? 465);
  const secure = String(process.env.SMTP_SECURE ?? 'true') === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM_EMAIL ?? user;
  const to = process.env.SIGNUP_NOTIFY_EMAIL ?? 'amnart.gl@gmail.com';

  if (!user || !pass || !from) return false;

  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.default.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to,
    subject: `New Signup: ${payload.shopName} (${payload.companyName})`,
    html: buildHtml(payload),
  });
  return true;
}

export async function notifySignupByEmail(payload: SignupPayload): Promise<void> {
  // Prefer SMTP (Gmail App Password) when configured.
  try {
    const sentBySmtp = await sendViaGmailSmtp(payload);
    if (sentBySmtp) return;
  } catch (err) {
    console.warn('[signup-notify] smtp failed, fallback to resend:', err);
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? 'QueueBooking <onboarding@resend.dev>';
  const to = process.env.SIGNUP_NOTIFY_EMAIL ?? 'amnart.gl@gmail.com';

  if (!apiKey) {
    console.warn('[signup-notify] RESEND_API_KEY is missing; skip sending email');
    return;
  }

  const subject = `New Signup: ${payload.shopName} (${payload.companyName})`;
  const html = buildHtml(payload);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.warn(`[signup-notify] resend failed ${res.status}: ${body}`);
    return;
  }
}
