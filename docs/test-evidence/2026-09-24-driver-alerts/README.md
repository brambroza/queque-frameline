# ผลทดสอบจริง — แจ้งเตือนคนขับ (เรียกคิว / คิวช้า / กรุณารอสักครู่)

- วันที่: 2026-09-24 10:00–10:13 (ICT)
- ระบบ: dev server `localhost:3000` (branch งาน Web Push + wait notice) + Supabase จริงของ Fameline
- วิธี: `QA_PASSWORD=… CRON_SECRET=… node scripts/dev/e2e-driver-alerts.mjs` — Playwright กดจริงบน portal (user `qa-driver-test@example.com`, role admin) และเปิดหน้าคนขับจริง (มือถือ 390×844) ยิง cron จริงผ่าน `GET /api/cron/auto-call`
- ข้อมูล: seed ชุด `SO-TEST-C002-E2E-*` (ลูกค้า C002) — R-006 รถกระบะ 4 ล้อ (คนขับที่ทดสอบ), R-007 รถ 6 ล้อ (ครองท่า 1)

| # | ภาพ | เหตุการณ์ | ผล |
|---|---|---|---|
| 01 | `01-driver-R-006-confirmed.png` | คนขับเปิดลิงก์ คิวยืนยันแล้ว | ✅ เห็น DO + ปุ่ม "เปิดแจ้งเตือน" |
| 02 | `02-driver-R-006-alerts-enabled.png` | กดเปิดแจ้งเตือน | ✅ เสียง+สั่น (server push 503 เพราะยังไม่ตั้ง `VAPID_*` → แสดง "เปิดหน้านี้ค้างไว้" ตามจริง) |
| 03 | `03-driver-R-006-late.png` | cron: เลย grace (นัด 08:00) → `late` | ✅ แถบส้ม "เลยเวลานัด 08:00 น. — ยังเข้าได้ ต้องเช็คอินภายใน 30 นาที" · LINE ลูกค้า + กลุ่มส่งแล้ว (คนขับ not_linked) |
| 04 | `04-portal-board-R-006-late.png` | บอร์ดคิว | ✅ chip "เลยเวลานัด" |
| 05 | `05-portal-board-R-007-on-dock-R-006-waiting.png` | staff: R-007 มาถึง → เรียกเข้าท่า 1; R-006 มาถึง | ✅ R-006 อยู่คอลัมน์ "มาถึงแล้ว · รอเรียก" |
| 06 | `06-driver-R-006-checked-in.png` | หน้าคนขับ | ✅ "มาถึงแล้ว · รอเรียก" |
| 07 | `07-driver-R-006-please-wait.png` | cron: `waited: ["R-006"]` | ✅ แถบเหลือง "คิวล่าช้ากว่ากำหนด — ท่า 1 ยังไม่ว่าง กรุณารอในลานจอดสักครู่" · `wait_notified_at` stamp · log `wait_notice` · LINE คนขับพยายามส่ง (not_linked) |
| 08 | `08-portal-board-R-006-auto-called.png` | staff: R-007 เริ่ม → ปิดงาน; ท่ายังถูก R-002 (called) ครอง → cron 10:13 timeout R-002 → auto-call R-006 | ✅ chip "เรียกอัตโนมัติ" |
| 09 | `09-driver-R-006-called.png` | หน้าคนขับ | ✅ แถบฟ้า "ถึงคิวของคุณแล้ว เชิญเข้าท่า 1" |

## booking_logs R-006 (จาก DB)

```
10:02 status_change: confirmed → late (grace_passed)
10:02 line_push: driver (late) ไม่ส่ง: not_linked · partner (late) ส่งแล้ว · staff_group (late) ส่งแล้ว
10:03 status_change: late → checked_in
10:03 wait_notice: เลยเวลานัดแล้วท่ายังไม่ว่าง — แจ้งคนขับให้รอ
10:03 line_push: driver (waiting) ไม่ส่ง: not_linked
10:13 status_change: Auto-called R-006
10:13 line_push: driver (called) not_linked · partner (called) ส่งแล้ว · staff_group (auto_called) ส่งแล้ว
```

## สิ่งที่ยังไม่ได้พิสูจน์ในรอบนี้

- Web Push ตอนปิดแท็บ — ต้องตั้ง `VAPID_PUBLIC_KEY/PRIVATE_KEY` แล้วเปิดบน Android Chrome จริง (headless ไม่มี push service)
- LINE ถึงคนขับ — คนขับทดสอบยังไม่ผูก LINE (`not_linked`); ลูกค้า/กลุ่มทีมคลังส่งจริงแล้ว
- ผลข้างเคียงของ cron ที่ยิงระหว่างทดสอบ: R-001 และ R-002 ของชุดทดสอบเดิม (ถูก staff เรียกไว้ตั้งแต่ 08:51 / auto-call 09:57) หมดเวลา `called_timeout_minutes` → `no_show` ตามกติกา
