# Runbook — ลบคิว (bookings) และเอกสาร SO/PO

สคริปต์: `scripts/dev/delete-bookings.mjs` (เรียกผ่าน `npm run delete:bookings -- …` ได้)

ใช้สำหรับล้างข้อมูลทดสอบบน dev / staging หรือล้างประวัติเก่า เป็น **hard delete** (ไม่ใช่ `is_deleted`) กู้คืนไม่ได้
สคริปต์เป็น **dry-run โดยค่าเริ่มต้น** — ไม่มี `--yes` จะพิมพ์แผนแล้วจบ ไม่แตะข้อมูล

> ⚠️ `.env` ชี้ไปที่ Supabase โปรเจกต์ไหน สคริปต์จะลบที่นั่น ถ้า `.env` ชี้ production = ลบของจริง
> ตรวจบรรทัด `Supabase: https://…` ที่สคริปต์พิมพ์ก่อนใส่ `--yes` ทุกครั้ง

---

## 1. เตรียม

- ต้องมีใน `.env` / `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SITE_SHOP_KEY` (ค่าเดียวกับที่ `seed:test` ใช้)
- รันจาก root ของ `Queue-fameline/`
- ก่อนลบบน Supabase จริง ให้ backup ก่อน (Dashboard → Database → Backups หรือ `pg_dump`)

## 2. วิธีใช้

```bash
node scripts/dev/delete-bookings.mjs <ตัวกรอง…> [ตัวเลือก]
```

ต้องมีตัวกรองอย่างน้อย 1 ตัว ใส่หลายตัวได้ (เป็น AND) ถ้าจะลบทั้งหมดต้องพิมพ์ `--all` เอง

### ตัวกรอง

| ตัวกรอง | ความหมาย |
|---|---|
| `--all` | ทุกคิวของ site |
| `--id=<uuid>[,<uuid>…]` | ระบุ id คิว |
| `--queue=<เลขคิว>[,…]` | ระบุเลขคิว เช่น `R-001,S-003` |
| `--date=YYYY-MM-DD` | วันที่นัดเท่ากับ |
| `--from=YYYY-MM-DD` / `--to=YYYY-MM-DD` | ช่วงวันที่นัด (รวมปลายทั้งสองข้าง) |
| `--before=YYYY-MM-DD` | วันที่นัดก่อนวันนี้ (ไม่รวม) — ใช้ล้างประวัติเก่า |
| `--status=<s>[,…]` | `pending`, `confirmed`, `waiting`, `serving`, `late`, `completed`, `cancelled`, `no_show` |
| `--code=<รหัสคู่ค้า>` | คิวของคู่ค้ารหัสนี้ เช่น `C002` |
| `--doc-prefix=<prefix>` | คิวที่ผูกกับเอกสารที่ `doc_no` ขึ้นต้นด้วย เช่น `SO-TEST-` |
| `--source=<s>[,…]` | ที่มาของคิว: `customer_link`, `admin`, `api`, `walk_in` |

### ตัวเลือก

| ตัวเลือก | ความหมาย |
|---|---|
| `--yes` | **ลบจริง** (ไม่ใส่ = dry-run) |
| `--with-docs` | ลบเอกสาร SO/PO ที่ผูกกับคิวที่ลบด้วย — เฉพาะเอกสารที่ไม่เหลือคิวอื่น |
| `--keep-doc-status` | ไม่ต้องรีเซ็ตเอกสารจาก `booked` กลับเป็น `open` |
| `--keep-files` | ไม่ลบไฟล์ลายเซ็นปิดงานใน bucket `booking-signatures` |
| `--purge-logs` | ลบแถว `activity_logs` ที่ชี้คิวเหล่านี้ด้วย (ค่าเริ่มต้นเก็บไว้เป็น audit trail) |
| `--shop=<shop_key>` | เปลี่ยน site (ค่าเริ่มต้น `SITE_SHOP_KEY`) |
| `--json` | พิมพ์ท้ายผลเป็น `__DELETE_JSON__{…}` สำหรับสคริปต์อื่น |

## 3. ตัวอย่างที่ใช้บ่อย

```bash
# ล้างชุดทดสอบจาก seed:test ทั้งคิวและเอกสาร — ดูแผนก่อน
node scripts/dev/delete-bookings.mjs --doc-prefix=SO-TEST- --with-docs
# แล้วค่อยลบจริง
node scripts/dev/delete-bookings.mjs --doc-prefix=SO-TEST- --with-docs --yes

# ลบคิวของลูกค้า C002 ทั้งหมด (เอกสารคงไว้ รีเซ็ตเป็น open)
node scripts/dev/delete-bookings.mjs --code=C002 --yes

# ลบคิวที่ยกเลิก / ไม่มา ของวันหนึ่ง
node scripts/dev/delete-bookings.mjs --date=2026-10-01 --status=cancelled,no_show --yes

# ล้างประวัติก่อนปีนี้ รวม audit log
node scripts/dev/delete-bookings.mjs --before=2026-01-01 --purge-logs --yes

# ล้าง site ทั้งหมดก่อน UAT (คิว + เอกสาร)
node scripts/dev/delete-bookings.mjs --all --with-docs --yes
```

## 4. สคริปต์ลบอะไรบ้าง

ลำดับการลบ (ตาราง child ส่วนใหญ่ **ไม่มี** `on delete cascade` จึงต้องลบเอง):

1. `booking_logs` ของคิว (timeline ใน drawer)
2. `activity_logs` ที่ `target_table = 'bookings'` — เฉพาะเมื่อใส่ `--purge-logs`
3. ไฟล์ลายเซ็นปิดงาน `sign_staff_path` / `sign_customer_path` ใน bucket `booking-signatures` — ลบไม่สำเร็จแค่เตือน ไม่หยุด
4. แถว `bookings` → cascade ไป `booking_resource_assignments`, `push_subscriptions` เอง
5. เอกสาร `external_documents` ที่ผูกอยู่:
   - `--with-docs` → ลบเอกสารที่ **ไม่เหลือคิวอื่น** (เอกสารที่ยังมีคิวอื่นอยู่จะไม่ถูกลบ)
   - ไม่ใส่ `--with-docs` → เอกสารที่สถานะ `booked` และไม่เหลือคิวอื่นจะถูกตั้งกลับเป็น `open` (ลูกค้าจองจากลิงก์เดิมได้อีก) เว้นแต่ใส่ `--keep-doc-status`
   - เอกสาร `completed` / `cancelled` ไม่ถูกเปลี่ยนสถานะ

### สิ่งที่ **ไม่** แตะ (ตั้งใจ)

| สิ่ง | เหตุผล |
|---|---|
| `do_counters` | เลข DO ออกแบบให้ไม่ซ้ำและไม่ย้อน เลข DO ของคิวที่ลบจะว่างเว้นไปเลย ไม่ถูกนำกลับมาใช้ |
| `notifications` | ชี้คิวด้วย `related_id` (ไม่ใช่ FK) เก็บไว้เป็นประวัติแจ้งเตือน |
| `line_events`, `integration_logs` | log ของ webhook / ERP ไม่ผูกคิว |
| `customers` (คู่ค้า) | ไม่ลบแม้ใช้ `--with-docs` |
| `activity_logs` | เก็บเป็น audit trail เว้นแต่ `--purge-logs` |

## 5. ข้อควรระวัง

- **คิวที่กำลังเดิน** (`checked_in`, `called`, `serving`) ลบได้ถ้าตรงตัวกรอง — บอร์ดคิวและจอ TV จะหายทันที ถ้าไม่ตั้งใจให้กรอง `--status` ให้แคบ
- ลิงก์คนขับ (`/driver/<token>`) ของคิวที่ลบจะตอบ 404
- สคริปต์ลบทีละตารางผ่าน PostgREST ไม่ใช่ transaction เดียว ถ้าล้มกลางทาง (เช่น เน็ตหลุด) ให้รันซ้ำด้วยตัวกรองเดิม — ทุกขั้นรันซ้ำได้
- `seed:test -- --reset` ก็ลบชุดทดสอบของ code/tag นั้นได้เหมือนกัน แต่สคริปต์นี้ครอบคลุมกว่า (ลบลายเซ็น, เลือกตามวัน/สถานะ/ลูกค้า, รีเซ็ตสถานะเอกสาร)
- รันบน production ต้องผ่าน approval ก่อนตาม policy (ห้าม deploy/ลบข้อมูล production โดยไม่ได้รับ approval)

## 6. ลบด้วย SQL ตรง (กรณีไม่มี Node)

ลำดับเดียวกัน รันใน Supabase SQL editor ใน transaction เดียว ตัวอย่างลบคิวของเอกสาร `SO-TEST-%`:

```sql
begin;

create temp table _del as
select b.id, b.document_id
from public.bookings b
join public.external_documents d on d.id = b.document_id
where d.doc_no like 'SO-TEST-%';

delete from public.booking_logs where booking_id in (select id from _del);
delete from public.bookings where id in (select id from _del);

-- เอกสารที่ไม่เหลือคิว: ลบ (หรือเปลี่ยนเป็น update … set status = 'open')
delete from public.external_documents d
where d.id in (select document_id from _del)
  and not exists (select 1 from public.bookings b where b.document_id = d.id);

select count(*) as deleted from _del;
-- ตรวจตัวเลขก่อน แล้วค่อย commit; ไม่ตรงให้ rollback;
commit;
```

ไฟล์ลายเซ็นใน storage ต้องลบแยกจาก Dashboard → Storage → `booking-signatures/<shop_id>/<booking_id>/`
