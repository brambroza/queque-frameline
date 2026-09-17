export async function GET() {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://queuebooking.com';
  const body = [
    '# QueueBooking LINE',
    '',
    '> ระบบจองคิวผ่าน LINE OA สำหรับทุกธุรกิจ',
    '',
    `Website: ${base}`,
    '',
    '## Core Pages',
    `- Landing: ${base}/`,
    `- Pricing: ${base}/pricing`,
    `- Contact: ${base}/contact`,
    `- Use Cases: ${base}/use-cases`,
    `- Blog: ${base}/blog`,
    '',
    '## Product Summary',
    '- รองรับจองคิวผ่าน LINE OA และ LIFF',
    '- มีระบบหลังบ้านสำหรับจัดการคิว สาขา บริการ พนักงาน และรายงาน',
    '- รองรับหลายร้านหลายสาขา (Multi-tenant)',
    '',
    '## Target Industries',
    '- ร้านตัดผม, คลินิก, ร้านอาหาร, ศูนย์บริการ, ทีมช่างติดตั้ง',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
