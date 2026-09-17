/**
 * Draws a placeholder transfer slip in the browser and returns it as a PNG.
 *
 * Generated rather than shipped as a static asset so the demo slip always
 * carries the shop's own wording, and so nothing that looks like a real bank
 * receipt lives in the repo. It is watermarked DEMO on purpose.
 */
export async function drawDemoSlipPng(options: {
  shopName: string;
  amountLabel: string;
  timestampLabel: string;
}): Promise<Blob> {
  const width = 600;
  const height = 900;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('เบราว์เซอร์นี้ไม่รองรับการสร้างรูปสลิปตัวอย่าง');

  // Same face as the page (Kanit via next/font) so the slip matches the app.
  // Wait for the webfont so the first slip is not drawn in the OS fallback.
  try { await document.fonts.ready; } catch { /* older browsers: draw with whatever is loaded */ }
  const family = window.getComputedStyle(document.body).fontFamily || 'sans-serif';
  const font = (spec: string) => `${spec} ${family}`;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#12a862';
  ctx.fillRect(0, 0, width, 140);
  ctx.fillStyle = '#ffffff';
  ctx.font = font('bold 34px');
  ctx.fillText('โอนเงินสำเร็จ', 40, 70);
  ctx.font = font('20px');
  ctx.fillText('สลิปตัวอย่างสำหรับทดลองระบบ', 40, 108);

  const lines: Array<[string, string]> = [
    ['จาก', 'ลูกค้าเดโม่'],
    ['ไปยัง', options.shopName],
    ['จำนวนเงิน', `${options.amountLabel} บาท`],
    ['วันเวลา', options.timestampLabel],
    ['รหัสอ้างอิง', 'DEMO-0000000000'],
  ];

  let y = 220;
  lines.forEach(([label, value]) => {
    ctx.fillStyle = '#7f8b98';
    ctx.font = font('20px');
    ctx.fillText(label, 40, y);
    ctx.fillStyle = '#152131';
    ctx.font = font('bold 26px');
    ctx.fillText(value, 40, y + 34);
    ctx.strokeStyle = '#e4e8ee';
    ctx.beginPath();
    ctx.moveTo(40, y + 58);
    ctx.lineTo(width - 40, y + 58);
    ctx.stroke();
    y += 110;
  });

  ctx.save();
  ctx.translate(width / 2, height - 180);
  ctx.rotate(-Math.PI / 12);
  ctx.fillStyle = 'rgba(18,168,98,0.16)';
  ctx.font = font('bold 96px');
  ctx.textAlign = 'center';
  ctx.fillText('DEMO', 0, 0);
  ctx.restore();

  ctx.fillStyle = '#9aa6b2';
  ctx.font = font('18px');
  ctx.textAlign = 'center';
  ctx.fillText('ไม่ใช่หลักฐานการโอนเงินจริง', width / 2, height - 60);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('สร้างรูปสลิปตัวอย่างไม่สำเร็จ'));
    }, 'image/png');
  });
}
