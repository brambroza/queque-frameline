# Walk-in overflow — E2E on the local stack (2026-10-01)

Result: **19/19 passed** (`results.json`).

How it was run:

```bash
# local stack from a copy of supabase/ (bucket blocks patched, see CLAUDE.md Roadmap)
supabase start --workdir /tmp/fameline-ui -x studio,realtime,storage-api,imgproxy,edge-runtime,logflare,vector,supavisor,mailpit
node scripts/create-admin.mjs admin@ui.local '<password>' 'ทดสอบ UI' admin
NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… TOKEN_SECRET=x npx next dev -p 3100
QA_PASSWORD='<password>' APP_URL=http://localhost:3100 node scripts/dev/e2e-walk-in-overflow.mjs
```

Scenarios: 1 free slots · 2 working hours full → queue after the last booking · 3 after closing time · 4 regular "สร้างคิว" never sees overflow · 5 board.
The script moves today's closing time on the test DB (19:00 / 15:00) and restores it at the end.

| Shot | What it shows |
|---|---|
| `01-free-picker.png` | ช่องว่างในเวลาทำการ (16:00 กำลังเดิน) |
| `02-free-selected.png` | เลือก 16:00 แล้ว |
| `03-free-result.png` | สร้างคิว R-001 ท่าว่าง ระบบเรียกเข้าท่า 1 ทันที |
| `04-full-picker.png` | เวลาทำการเต็ม — เสนอ 19:00 / 19:30 ต่อท้าย |
| `05-full-selected.png` | เลือก 19:00 ปุ่มเปลี่ยนเป็น "ต่อท้ายคิว + เช็คอิน" |
| `06-full-result.png` | คิว R-013 ชิป "ต่อท้ายคิว" + DO + QR คนขับ |
| `07-after-hours-picker.png` | เฉพาะช่องต่อท้าย 19:00 (ท่าว่าง 1/2) / 19:30 / 20:00 |
| `08-after-hours-result.png` | คิว R-014 ท่า 3 ว่าง ระบบเรียกเข้าท่าทันที |
| `09-regular-create-days.png` | drawer สร้างคิว — วันที่ว่างข้ามวันนี้ ไม่มีช่องต่อท้าย |
| `10-board.png` | บอร์ดคิว — คิว FILL-n ที่ seed + walk-in 3 คัน |
