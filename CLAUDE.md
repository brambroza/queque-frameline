# CLAUDE.md — Fameline Dock Queue (Queue-fameline)

## Project Overview

ระบบจองคิวรับ-ส่งสินค้าหน้าคลังของ **Fameline** — site เดียว, database แยกของตัวเอง
- **Outbound** ลูกค้ามารับสินค้าตาม Sales Order (SO)
- **Inbound** supplier มาส่งสินค้าตาม Purchase Order (PO)
- ลูกค้า/supplier จองเองผ่านลิงก์/QR ที่ admin ส่งให้ต่อเอกสาร หรือ admin สร้างคิวให้
- Admin ยืนยันคิว → ระบบออก DO (delivery order) · staff หน้างานเช็คอิน/เรียก/ปิดงาน · เรียกคิวอัตโนมัติเมื่อท่าว่าง

Forked from GoAlong **Queue** (LINE queue booking SaaS) @ `035e174` on 2026-09-17. ไม่มี LINE, ไม่มี payment, ไม่ multi-tenant

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 App Router + TypeScript |
| UI | MUI v7 (portal, **light theme เท่านั้น**) · Tailwind CSS (public booking / driver pages) |
| Auth | Supabase Auth (portal users only; customers/drivers ใช้ token link) |
| Database | Supabase PostgreSQL + RLS (project แยกเฉพาะ site นี้) |
| Deployment | Vercel (region sin1) |
| Scheduler | Supabase pg_cron + pg_net → `/api/cron/*` (Bearer `CRON_SECRET`) |
| LINE (optional) | Messaging API push + LIFF bind ผ่านลิงก์เดิม, กลุ่มทีมคลัง — ดู section LINE |
| Email (optional) | Nodemailer SMTP |

---

## Critical Files — อ่านก่อนทำงานทุกครั้ง

| ไฟล์ | หน้าที่ |
|---|---|
| `src/lib/auth/context.ts` | `requireAuthContext({ roles: [...] })` — RBAC ทุก API route |
| `src/lib/supabase/server.ts` / `admin.ts` | Session client (RLS) / service-role client |
| `src/types/db.ts` | `AppRole`, `BookingStatus`, `ApiResponse` |
| `src/lib/booking/status-flow.ts` | กฎเปลี่ยนสถานะคิว (ใช้ร่วมกันทั้ง public และ portal) |
| `src/lib/booking/schemas.ts` | Zod schemas ของ bookings / services / resources / working hours |
| `src/components/bookings/booking-types.ts` | สถานะ, คอลัมน์, ปุ่ม `NEXT_STATUSES` ของ portal |
| `middleware.ts` | Redirect `/portal/*` ถ้าไม่ได้ login |
| `supabase/migrations/` | Migration chain ทั้งหมด (ดู "Database") |
| `scripts/apply-migrations.sh` | apply chain ตามลำดับต่อ `DATABASE_URL` |
| `scripts/create-admin.mjs` | สร้าง/รีเซ็ต user + ผูกกับ site + role |

---

## Roles

```
admin  — ตั้งค่า, จัดการเอกสาร SO/PO, จัดการพนักงาน, API keys + ทุกอย่างที่ staff ทำได้
staff  — คลัง/หน้างาน: บันทึกการชำระเงิน SO, อนุมัติคิว + ออก DO, จัดตารางคิว (เลื่อนวัน/เวลา/ท่า + ปรับเวลาที่ท่า — เปิดให้ staff 2026-09-22), ยกเลิก (ต้องมีเหตุผล), เช็คอิน, เรียกคิว, เริ่ม/ปิดงาน, แก้ทะเบียน
driver — ไม่มี login: เข้าผ่านลิงก์ token ดู DO ของตัวเอง
```

**Role ที่ admin สร้างเอง + เมนูต่อ role (2026-09-22, `202609220001_roles_menu_access`)**
- `roles.access_level` (admin|staff) = ระดับสิทธิ์ API ที่ทุก route ตรวจ; `roles.menu_keys text[]` = เมนูที่เห็น (null = ทุกเมนูของระดับนั้น); `is_system` = admin/staff ลบ/เปลี่ยนระดับไม่ได้
- `requireAuthContext().roles` คืน **ระดับ** (ไม่ใช่ code) — role ที่สร้างเอง เช่น `gate` ระดับ staff จะผ่าน guard `['admin','staff']` เหมือน staff; code ดิบอยู่ที่ `roleCodes`
- Registry เมนู + กติกา pure: `src/lib/auth/menu-registry.ts` (`MENU_ITEMS`, `resolveMenuAccess`, `adminOnly` = reports/staff/line_settings/translations ที่ API เป็น admin เท่านั้น; role ระดับ admin ถูกบังคับให้มีเมนู `staff` เสมอ กันล็อกตัวเอง) — เพิ่มหน้าใหม่ = เพิ่ม entry ที่นี่ + icon ใน `portal-nav.tsx` + `requirePageAccess('<key>')` ใน page.tsx
- กันเข้าหน้าตรง: ทุก `src/app/portal/*/page.tsx` เรียก `requirePageAccess(key)` (`src/lib/auth/page-roles.ts`) → ไม่มีสิทธิ์ redirect ไปเมนูแรกที่เปิดได้ / `/portal/no-access`; sidebar กรองจาก `AccessProvider` ที่ layout ส่งลงมา (ไม่ fetch, ไม่ flicker)
- จัดการที่ `/portal/staff` แท็บ "สิทธิ์และเมนู" (`roles-crud.tsx`) → `/api/roles` (เขียนผ่าน service role เพราะ RLS `roles` เป็น select-only); พนักงาน 1 คน = 1 role (`setUserRole` soft-delete grant เก่า); เปลี่ยนสิทธิ์ตัวเอง/ลบตัวเองไม่ได้, ต้องเหลือ admin-level ≥ 1 คน; ลบพนักงานแล้ว revoke `user_roles` ด้วย
- RLS `user_roles` เขียนได้เฉพาะ `has_access_level('admin')` (เดิมทุกคนในร้านเขียนได้ = self-grant admin ได้); `i18n_is_admin_or_owner()` ใช้ access_level แทน code

- `requireAuthContext({ roles: ['admin'] })` สำหรับงานตั้งค่า/ยืนยัน · `['admin', 'staff']` สำหรับงานหน้างาน
- ทั้งสอง role เห็นทั้ง site (`SHOP_WIDE_ROLES` ใน `src/lib/auth/branch-scope.ts`, `is_branch_bound()` คืน false)
- สร้าง admin คนแรก: `node scripts/create-admin.mjs <email> <password> "ชื่อ" admin` · คนอื่น ๆ เชิญทางอีเมลจาก `/portal/staff` (`inviteUserByEmail` → ลิงก์ไป `/auth/callback` → `/set-password`); ไม่มีหน้าสมัครเอง
- Supabase Auth → URL Configuration ต้องมี redirect URL `<APP_URL>/auth/callback` (ทั้ง localhost และ production) ไม่งั้นลิงก์เชิญเด้งไป Site URL แทน

---

## Single-site Rule

มี `companies` 1 แถว + `shops` 1 แถว (`shop_key = 'fameline'`, env `SITE_SHOP_KEY`) — โค้ดยังคง pattern เดิม:

```ts
// ทุก query ยังต้อง scope ด้วย shop_id จาก profile (RLS + กันบั๊ก)
.eq('shop_id', profile.shop_id)
```

- Public routes (`/api/public/*`) ใช้ `createAdminClient()` ได้ **แต่ต้อง resolve token → row ก่อน** แล้ว scope ทุก query ด้วย `shop_id` ของ row นั้น
- ห้ามเพิ่ม shop ที่สอง โดยไม่ผ่าน design review
- **หลายสาขาอยู่ใต้ shop เดียว** (`branches`, 2026-09-18): ท่า เวลาทำการ วันหยุด และเอกสาร SO/PO ผูกกับ `branch_id`; topbar `BranchSwitch` (`useBranchScope`) กรองรายการ/บอร์ด/ท่า/เอกสาร และเป็นค่าเริ่มต้นตอนสร้าง; คิวรับ `branch_id` จากเอกสารก่อน ไม่มีค่อยใช้ที่เลือก แล้วค่อย fallback สาขาแรก (`resolveDefaultBranchId`); ลิงก์จองของลูกค้าใช้สาขาของเอกสารเสมอ; `branches.code` ใช้ระบุสาขาใน CSV/ERP (คอลัมน์ `branch`)

---

## Domain Model (ตารางเดิมของ Queue ถูก map เป็นโดเมนคลัง)

| ตาราง | ความหมายใน Fameline | คอลัมน์สำคัญที่เพิ่ม |
|---|---|---|
| `services` | **ประเภทรถ** (4 ล้อ / 6 ล้อ / 10 ล้อ / เทรลเลอร์) | `duration_minutes` (เวลาที่ท่า), `buffer_minutes` (เผื่อ turnaround), `direction` (null = ทั้งสองขา), `sort_order`, `plate_format` any\|car\|truck (รูปแบบทะเบียนที่ลิงก์ลูกค้ายอมรับ — `matchesPlateFormat`/`formatPlateInput` ใน `src/lib/booking/plate.ts`; staff หน้าประตูยังใช้ `isPlausiblePlate` แบบหลวม) |
| `booking_resources` | **ท่า / dock** (`resource_type = 'dock'`) | `direction`, `service_ids` (ประเภทรถที่เข้าท่านี้ได้; null = ทุกประเภท), `capacity` (=1) |
| `working_hours` | เวลาเปิดท่า ต่อวันในสัปดาห์ | `direction` (null = ทั้งสองขา), `slot_interval_minutes`, `break_*` |
| `holidays` | วันหยุดคลัง (ต่อสาขา) | — |
| `branches` | **สาขา / คลัง** | `code` (รหัสสำหรับ CSV/ERP), `branch_name`, `address`, `phone`, `latitude`/`longitude`/`checkin_radius_m` (geofence เช็คอินคนขับ) |
| `customers` | **คู่ค้า** | `partner_type` customer\|supplier, `code` (รหัส ERP), `email`, `address` |
| `external_documents` | **SO / PO** | `doc_type` so\|po, `doc_no`, `branch_id` (สาขาที่รับ-ส่ง), `partner_id`, `items jsonb`, `status`, `source` api\|csv\|manual, `booking_token_hash`, `raw` |
| `bookings` | **คิว** | `direction`, `document_id`, `service_id` (ประเภทรถ), `resource_id` (ท่า), `plate_number`, `plate_number_actual`, `driver_*`, `receiver_*`, `booking_source`, `confirmed_*`, `arrived_at`, `grace_deadline`, `called_*`, `serving_started_at`, `completed_at`, `auto_called`, `driver_token_hash`, `do_number`, `do_issued_*` |
| `booking_logs` | **audit log** ของคิว | `action`, `from_value`, `to_value`, `actor_kind` admin\|staff\|customer\|driver\|system |
| `site_settings` | ตั้งค่าของ site (1 แถว) | `grace_minutes`, `early_arrival_minutes`, `auto_call_mode`, `called_timeout_minutes`, `auto_no_show_after_grace`, `booking_token_ttl_days`, `driver_token_ttl_days`, `booking_lead_min_hours`, `booking_horizon_days`, `require_admin_confirm`, `driver_self_checkin`, `do_number_format`, `item_minutes_enabled`, `minutes_per_item`, `auto_call_last_run_at` |
| `roles` / `user_roles` | สิทธิ์ (admin สร้างเพิ่มได้) | `code`, `name`, `access_level` admin\|staff, `menu_keys text[]` (null = ทุกเมนูของระดับ), `is_system`, `sort_order`; user 1 คน = 1 grant ต่อ shop |
| `api_keys` | key สำหรับ ERP push SO/PO | `key_hash` (sha256), `key_prefix`, `scopes` |
| `do_counters` + `next_do_number(shop_id, format)` | เลข DO ไม่ซ้ำ/ไม่ข้าม ต่อเดือน | format `DO-{YYYYMM}-{NNNN}` |

คอลัมน์ที่ยังเหลือจาก Queue แต่ **ไม่ใช้แล้ว** (รอลบพร้อมโค้ดที่อ้างถึง): `shops.demo_mode_enabled/demo_business_type/business_type/liff_id/line_setup_completed`, `customers.line_user_id`, `bookings.line_user_id/party_size/change_*`, `line_users`, `queue_slots`, `permissions`

---

## Booking Status Flow (เป้าหมาย Phase 1 — `src/lib/booking/status-flow.ts`)

```
customer link submit ─(require_admin_confirm หรือ SO ยังไม่ชำระ)─▶ pending ─(admin/staff อนุมัติ + ออก DO; SO ต้อง paid/credit)─▶ confirmed
admin สร้างเอง / require_admin_confirm=false ─────────────────────────────────▶ confirmed

confirmed ─(staff เช็คอินหน้าประตู)─▶ checked_in ─(staff เรียก / auto-call เมื่อท่าว่าง)─▶ called ─▶ serving ─▶ completed
confirmed ─(เลย grace_deadline)─▶ late ─(มาถึง)─▶ checked_in
late ─(เลย 2× grace, auto_no_show_after_grace)─▶ no_show
called ─(เลย called_timeout_minutes)─▶ no_show      called ─(ยกเลิกการเรียก)─▶ checked_in
pending | confirmed | late ─▶ cancelled
```

Enum ใน DB ยังมีค่าเก่าของ Queue (`waiting`, `seating`, `in_service`, `skipped`, `pending_approval`) — ห้ามใช้ในโค้ดใหม่

---

## Slot Engine

- `get_dock_slots(shop, branch, direction, service_id, date, resource_id?, exclude_booking_id?)` — capacity = จำนวนท่าที่ direction + ประเภทรถตรง (`eligible_docks`); คิวเดิมกันท่าไว้ `start .. end + buffer_minutes` (`is_dock_free`); slot ที่เวลาบริการล้ำช่วงพักหรือเลยเวลาปิดจะไม่ถูกสร้าง
- `get_available_days(..., p_not_before)` — ปฏิทิน "เฉพาะวันว่าง" (ตัด slot ที่ผ่านแล้ว / ไม่ถึง lead time)
- `create_dock_booking(...)` (service role เท่านั้น) — advisory lock ต่อ shop+วัน, ตรวจ slot ซ้ำ, เลือกท่า (ท่าเฉพาะขาก่อนท่าร่วม), ออกเลขคิว `R-nnn`/`S-nnn`, stamp `grace_deadline`, ออก DO ถ้าสร้างเป็น confirmed
- `confirm_dock_booking` (status + DO ใน statement เดียว), `move_dock_booking(..., p_service_minutes default null)` (ย้ายข้ามวัน = ออกเลขคิวใหม่ของวันปลายทาง; ส่งนาทีมาด้วย = ตั้ง `service_minutes` ใน transaction เดียวกัน, `invalid_minutes` ถ้านอก 5–1440 — `202609220003`)
- **กันคิวซ้อน (2026-09-21, `202609210002_dock_overlap_guard`)** — กฎ: ห้ามซ้อนเฉพาะ **ท่าเดียวกัน** (`start .. end + buffer`); คนละท่าเวลาซ้อนได้ แม้ลูกค้าเดียวกัน บังคับ 2 ชั้น: `confirm_dock_booking` ถือ day lock + ตรวจ `is_dock_free` ทุกครั้งที่อนุมัติ และ trigger `bookings_dock_overlap_guard` กันทุก write ที่วาง/ย้ายคิวลงท่า (insert, เปลี่ยนท่า/วัน/เวลา/buffer, คิวปิดหรือลบแล้วกลับมา) — เดินสถานะปกติไม่ถูกตรวจ; error `dock_conflict` → 409 (`dockErrorResponse`); smoke test `supabase/tests/dock_overlap_guard.sql` + `dock_overlap_multibranch.sql` (หลายสาขา ผ่าน RPC จริง; ทั้งคู่ rollback ท้ายไฟล์ รันกับ DB จริงได้)
- RPC เก่าของ Queue (`get_available_slots`, `get_slot_availability`) ยังอยู่ใน DB แต่ไม่มีโค้ดเรียกแล้ว
- `src/lib/booking/slot-time.ts` — `isSlotPast`, Bangkok clock; server เป็นคนใส่ `is_past` เสมอ

---

## Payment gate + เวลาที่ท่า (2026-09-21)

- `external_documents.payment_status` = `unpaid` (default) | `paid` | `credit` — **เฉพาะ SO**; PO และคิวที่ไม่มีเอกสารไม่ถูกตรวจ กติกา pure อยู่ `src/lib/booking/payment.ts` (`isPaymentCleared`)
- ลูกค้าจอง SO ที่ยังไม่ชำระได้ แต่คิวเป็น `pending` เสมอ (`resolveInitialBookingStatus({ paymentCleared })`) และ **อนุมัติไม่ได้** จนกว่าจะเป็น paid/credit — บังคับ 2 ชั้น: RPC `confirm_dock_booking` raise `payment_required` + trigger `bookings_payment_gate` กันทุกทางที่ทำให้แถวเป็น `confirmed` (admin สร้างเอง, auto-confirm, update ตรง)
- บันทึกการชำระ: `PATCH /api/documents/[id]/payment` (admin + staff, ใช้ service role หลังตรวจ role + shop_id) → audit log + แจ้งทีมว่าคิวไหนอนุมัติได้แล้ว; เปลี่ยนกลับเป็น unpaid ไม่ได้ถ้ามีคิวที่อนุมัติแล้ว; CSV/ฟอร์มรับ `payment_status` (ไทย/อังกฤษ) — re-import ที่ไม่ส่งค่ามา **ไม่ทับ** ของเดิม
- ฝั่งลูกค้าเห็นแค่ `payment.pending` (ไม่เห็นเลขอ้างอิง/หมายเหตุ) → แถบ "รอชำระเงิน" + Flex LINE; ไม่มีจ่ายออนไลน์/แนบสลิป
- **Staff อนุมัติคิวได้** (`ADMIN_ONLY` ว่าง) — สิ่งที่คุม DO คือ payment gate ไม่ใช่ role
- `bookings.service_minutes` = เวลาที่ท่าของคิวนั้น (ค่าตั้งต้นจากประเภทรถ, snapshot ตอน insert) ปรับได้ตอนอนุมัติ (`p_service_minutes`) หรือภายหลัง `PATCH /api/bookings/[id]/duration` → `set_booking_service_minutes`; ชนคิวถัดไปของท่าเดียวกัน/ข้ามวัน = `duration_conflict`; **ไม่บังคับ**เวลาปิด/พักเที่ยง (คลังตัดสินใจเอง); `move_dock_booking` ใช้ `service_minutes` ของคิว
- **เวลาแนะนำตามรายการสินค้า (2026-09-21, `202609210003_item_based_minutes`)** — ตอนอนุมัติ ถ้าเอกสารมีรายการ (`external_documents.item_count`, generated จาก `items`) ค่าเริ่มต้นใน `ApproveDialog` = จำนวนรายการ × `site_settings.minutes_per_item` (default 10, **ไม่นับจำนวนชิ้น**, ทุกเที่ยวของเอกสารเดียวกันคิดเต็ม); ไม่มีรายการ / ปิด `item_minutes_enabled` = เวลารถตามเดิม; ถ้าเวลาของคิวถูกปรับมือไปแล้วจะไม่ทับ; กติกา pure อยู่ `src/lib/booking/suggest-minutes.ts` (vitest); เป็น **ค่าแนะนำตอนอนุมัติเท่านั้น** — slot grid / `create_dock_booking` ยังใช้เวลารถ (ช่วง pending ท่าถูกกันตามเวลารถ อาจเจอ `dock_conflict`/`duration_conflict` ตอนอนุมัติ); ตั้งค่าที่ `/portal/site-settings` section "เวลาตามรายการสินค้า"
- **แถบเวลาของท่าตอนอนุมัติ (2026-09-22)** — `ApproveDialog` แสดง `DockDayTimeline` (`src/components/bookings/dock-day-timeline.tsx`) ใต้ช่องนาที: คิวอื่นบนท่าเดียวกันวันนั้น, บล็อกคิวนี้ยืดตามตัวเลข, เส้นแดง "ต้องจบก่อน", ช่วงว่างทั้งวันเป็น chip, แตะบนแถบ/chip = ตั้งนาที; ข้อมูลจาก `GET /api/bookings/[id]/dock-day` (admin+staff, read-only); กติกา pure ใน `src/lib/booking/dock-day.ts` (vitest) ตรงกับ `booking_end_for_minutes`: `maxMinutes = next.start − buffer ของคิวนี้ − start` (พัก/เวลาปิดโชว์แต่ไม่บังคับ); quick chip ที่ชนถูก disable + ปุ่มบันทึกปิดเมื่อเกิน max แต่ server ยังเป็น authority (โหลดไม่ได้ = ไม่บล็อก)
- **จัดตารางคิว = dialog เดียว (2026-09-22, `202609220003_move_dock_booking_minutes`)** — ปุ่มเดียวใน drawer เปิด `BookingScheduleDialog` (`src/components/bookings/booking-schedule-dialog.tsx`) แทน "เลื่อนคิว" + "ปรับเวลาที่ท่า" เดิม: chip วัน → ท่าที่รับคิวนี้ได้เป็นเลนแนวตั้ง (`GET /api/bookings/[id]/dock-board?date=` คืนคิวอื่น + `slotStarts` ต่อท่าจาก `get_dock_slots(resource_id, exclude self)`), ลากบล็อกไปท่า/เวลาอื่น **snap เข้า slot จริงเท่านั้น** (`snapToSlot`) เพราะ `move_dock_booking` รับเฉพาะ slot ที่ `remaining_capacity > 0`, ลากขอบล่างยืด 5 นาที, กรอบประ = ตำแหน่งเดิม, diff card + คืนค่าเดิม, ปุ่มบันทึกชื่อตามสิ่งที่ทำ; ชน = `computeDockDay(...).overlaps` (กติกา `is_dock_free`) บล็อกแดง + ปุ่มปิด; บันทึก: ย้าย (จะเปลี่ยนนาทีด้วยหรือไม่ก็ได้) → `PATCH /reschedule` (admin+**staff**, ส่ง `service_minutes` → RPC `p_service_minutes` ใน transaction เดียว) / เปลี่ยนแค่นาที → `PATCH /duration`; สถานะนอก `MOVABLE` = ลากไม่ได้ เหลือยืด/หด; smoke SQL `supabase/tests/move_dock_booking_minutes.sql`
- ยกเลิกจาก portal ต้องมี `cancel_reason` ≥ 3 ตัวอักษร (`bookingStatusPatchSchema`) — ลูกค้าเห็นเหตุผลในหน้าลิงก์
- UI รวมอยู่ที่ `src/components/bookings/booking-action-dialogs.tsx` (`ApproveDialog`, `DurationDialog`, `CancelDialog`, `PaymentDialog`, `PaymentChip`)

## Driver self check-in + geofence (2026-09-19)

- `site_settings.driver_self_checkin` = **true** (default) → หน้า `/driver/[token]` มีปุ่ม "ฉันมาถึงแล้ว — เช็คอิน" เฉพาะวันที่นัด + สถานะใน `CHECKIN_STATUSES`
- สาขาที่มี `latitude`+`longitude` = บังคับ GPS: หน้าเรียก `navigator.geolocation` แล้วส่ง `{lat,lng,accuracy}` ให้ `POST /api/public/driver/[token]/arrive` → `checkGeofence` (`src/lib/booking/geofence.ts`, pure + vitest) ผ่านเมื่อ `distance ≤ checkin_radius_m + min(accuracy, 100)`; accuracy > 500 ม. = ปฏิเสธ; สาขาไม่มีพิกัด = ไม่ตรวจ
- พิกัดคลัง **ไม่ส่งออก** ไป client (meta คืนแค่ `check_in_requires_location`, `check_in_radius_m`); ระยะที่เช็คอินถูกเก็บใน `booking_logs.to_value`
- ตั้งพิกัดที่ `/portal/branches` (วางจาก Google Maps หรือ "ใช้ตำแหน่งปัจจุบัน")
- ข้อจำกัด: ตำแหน่งจากเบราว์เซอร์ปลอมได้ด้วยแอป mock location — ใช้กันกดล่วงหน้าโดยสุจริต ไม่ใช่หลักฐานทางกฎหมาย staff ยังตรวจทะเบียนที่ประตูได้ตามเดิม

## Auto-call (Phase 2)

- `site_settings.auto_call_mode` = `off | dock_free (default) | time | hybrid`
- Event path: `PATCH /api/bookings` เมื่อคิวบนท่าจบ (`completed|no_show|cancelled` จาก `called|serving`) → `runAutoCall(dockId)` เลือกคิว `checked_in` ที่ท่า/ประเภทรถ/direction ตรง เรียง `start_time, checked_in_at`
- Cron path: pg_cron ทุก 1 นาที → `GET /api/cron/auto-call` (overdue sweep: `confirmed→late`, `late→no_show`, `called→no_show`) + stamp `site_settings.auto_call_last_run_at`
- Update แบบ optimistic `where id = $1 and status = 'checked_in'` — ห้ามเรียกซ้ำ
- Pure logic อยู่ `src/lib/booking/auto-call.ts`, `overdue.ts` (vitest บังคับ)

---

## Token Links (Phase 1–2)

| ลิงก์ | เก็บที่ | TTL |
|---|---|---|
| ลูกค้าจองต่อ SO/PO `/book/[token]` | `external_documents.booking_token_hash` | `booking_token_ttl_days` |
| คนขับดู DO `/driver/[token]` | `bookings.driver_token_hash` | `driver_token_ttl_days` หลังวันคิว |

- Token = `HMAC-SHA256(TOKEN_SECRET, kind:id:version)` (`deriveLinkToken` ใน `src/lib/tokens.ts`) — DB เก็บ **sha256 + version เท่านั้น** จึงแสดงลิงก์/QR เดิมซ้ำได้โดยไม่เก็บ raw; regenerate = version+1 (ลิงก์เก่าตาย)
- ลิงก์คนขับออกอัตโนมัติตอนยืนยันคิว (`ensureDriverLink`, `src/lib/booking/driver-link.ts`)
- Resolver: `src/lib/public/resolve.ts` — public route ต้อง resolve token ก่อน แล้ว scope ทุก query ด้วย `shop_id` ของ row นั้น
- Public API: `/api/public/book/[token]/{meta,days,slots,submit,cancel}`, `/api/public/driver/[token]`, `/api/public/display` — 404 เมื่อ token ผิด, 410 เมื่อหมดอายุ
- ห้าม log raw token / raw API key

---

## Integration (SO/PO)

- Phase 1: CSV import `POST /api/documents/import` + สร้างเอง `POST /api/documents` (`source = csv|manual`)
- Phase 2: `POST /api/integration/v1/sales-orders|purchase-orders` header `X-API-Key` → `requireApiKey()` (`src/lib/integration/auth.ts`); upsert บน `(shop_id, doc_type, doc_no)`; คู่ค้า upsert บน `(shop_id, partner_type, code)`; เก็บ `raw`
- Zod เดียวกันทั้ง CSV และ API: `src/lib/integration/schemas.ts`

---

## DO (Delivery Order)

- ออกเมื่อ `pending → confirmed` (admin) หรือทันทีเมื่อ admin สร้างคิวเอง: `select next_do_number(shop_id, site_settings.do_number_format)` ใน statement เดียวกับการเปลี่ยนสถานะ
- PDF = **browser print** ผ่าน pattern ของ `src/components/reports/report-print-sheet.tsx` (ไม่มี PDF lib, ฟอนต์ไทยตรงกับหน้าจอ) — component `src/components/delivery-order/do-document.tsx` ใช้ตัวเดียวทั้ง portal / หน้าลูกค้า / หน้าคนขับ
- Reissue = เลขเดิม สร้างเอกสารใหม่

---

## Coding Conventions

### API Route Pattern
```ts
// src/app/api/<resource>/route.ts
import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { z } from 'zod';

const BodySchema = z.object({ /* ... */ });

export async function POST(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['admin', 'staff'] });
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
    const { error } = await supabase
      .from('table')
      .insert({ ...parsed.data, company_id: profile.company_id, shop_id: profile.shop_id, created_by: user.id });
    if (error) throw error;
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
```

### Portal UI
- MUI เท่านั้น (`sx` prop), ห้าม `window.confirm` — ใช้ `useConfirm()` จาก `src/components/ui/confirm-dialog.tsx`
- Toast: `useToast()` จาก `src/components/ui/toast`
- ทุกหน้าต้องมี loading / empty / error state
- ข้อความผ่าน `useI18n()` / `useTranslation(ns)` พร้อม fallback ไทย (`src/lib/i18n/fallback.ts` + ตาราง `translations`)

### Public pages (`/book`, `/driver`, `/display`)
- Tailwind, mobile-first, ไม่มี MUI provider
- ห้ามเรียก `createAdminClient()` โดยไม่ resolve token ก่อน

### Import Alias
```ts
import { xxx } from '@/lib/...';      // ถูก
import { xxx } from '../../lib/...';  // ผิด
```

---

## Database

- Chain: `supabase/migrations/` = Queue chain เดิม (`202605090001` … `202609160001`, root SQL ของ Queue ถูกย้ายเข้ามาเป็น `202605090002_functions`, `…0003_seed_roles`, `…0004_rls`, `202605100005_seed_i18n`) ตามด้วย `202609170001_fameline_strip`, `202609170002_fameline_core`, `202609170003_fameline_seed`
- **ห้ามแก้ไฟล์ migration เก่า** — สร้างไฟล์ใหม่ `YYYYMMDDNNNN_description.sql` ใช้ `if not exists` / `if exists`
- Apply: Supabase SQL editor ตามลำดับ หรือ `DATABASE_URL=... scripts/apply-migrations.sh` หรือ `supabase db reset` (local stack, `supabase/config.toml`)
- ทดสอบ chain บน Postgres เปล่าได้ (ต้อง stub `auth.users` + `auth.uid()` ถ้าไม่ใช่ Supabase)

---

## Security Rules

- ทุก API route ต้องผ่าน `requireAuthContext` ยกเว้น `/api/public/*` (token) `/api/integration/*` (API key) `/api/cron/*` (`CRON_SECRET`)
- ห้าม leak error detail / raw token / API key ใน response หรือ log
- ห้าม query ข้าม `shop_id`
- ต้อง validate Zod ก่อน process ทุก route
- ห้าม expose `SUPABASE_SERVICE_ROLE_KEY` ใน client component

---

## LINE OA (2026-09-18)

- ตั้งค่าที่ `/portal/line-settings` → ตาราง `line_config` (token/secret/LIFF ID/Login channel ID/OA id/กลุ่ม/switch) env `LINE_*` เป็น fallback (`getLineConfig` ใน `src/lib/line/config.ts`)
- **Bind ผ่านลิงก์เดิม:** ลิงก์แบบ LINE = `https://liff.line.me/{liff_id}/book/{token}?via=line` (`liffUrl`) · LIFF endpoint = root `/` → `src/app/page.tsx` เห็น `?liff.state` แล้ว render `LiffGate` ให้ SDK redirect ไป path → หน้า `/book`,`/driver` เห็น `?via=line` → `useLiffBind` (`src/components/public-booking/use-liff-bind.ts`) init/login/getIDToken → `POST …/line-link` → `bindLineUser` (`src/lib/line/bind.ts`) verify ID token กับ Login channel → upsert `line_users` → เขียน `customers.line_user_id` + `bookings.line_user_id` (ลูกค้า) หรือ `bookings.driver_line_user_id` (คนขับ)
- **Push:** `src/lib/line/notify.ts` — `safeNotifyPartner` (submitted/confirmed/called/rescheduled/cancelled/no_show), `safeNotifyDriver` (job/called), `safeNotifyStaffGroup` (submitted/customer_cancelled/arrived/plate_mismatch/no_show/late/auto_called) — ไม่ throw, บันทึก `booking_logs` action `line_push`, stamp `bookings.last_line_notify_at` Flex ใน `messages.ts` (pure + vitest)
- **Webhook** `POST /api/line/webhook`: ตรวจลายเซ็น, `follow` → welcome + upsert, `join` → วิธีลงทะเบียน, ข้อความ `ลงทะเบียนกลุ่ม` ในกลุ่ม → เก็บ `staff_group_id`, ข้อความ 1:1 → help ทุก event ลง `line_events` ยังไม่ตั้งค่า = ตอบ 200 เปล่า (ให้ปุ่ม Verify ผ่าน)
- **Hard limits:** ห้าม log token/secret, ห้ามเชื่อ `line_user_id` จาก request (ต้องมาจาก ID token เท่านั้น), push ทุกจุดต้องผ่าน `safeNotify*`
- ค่าใช้จ่าย: แผนฟรี 200 ข้อความ/เดือน (push + กลุ่ม) — reply ไม่นับ

## Notification System

`safeCreateNotification(supabase, {...})` (`src/lib/notifications/createNotification.ts`) = notification center ของ **staff/admin** เท่านั้น ไม่ throw
ลูกค้า/คนขับไม่มี push — ดูสถานะจากหน้าลิงก์ของตัวเอง (poll)

---

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | service-role client |
| `NEXT_PUBLIC_APP_URL` | ✅ | base URL สำหรับลิงก์/QR |
| `SITE_SHOP_KEY` | ✅ | `fameline` — shop_key ของ site |
| `TOKEN_SECRET` | แนะนำ | HMAC สำหรับ derive ลิงก์จอง/คนขับ (ไม่ตั้ง = ใช้ service role key); เปลี่ยน = ลิงก์เดิมตายทั้งหมด |
| `CRON_SECRET` | auto-call | Bearer สำหรับ `/api/cron/*` (ค่าเดียวกับ Vault `cron_secret`) |
| `DISPLAY_KEY` | optional | บังคับ `/display?key=` |
| `SMTP_*` | optional | ส่ง DO / ลิงก์ทางอีเมล |

---

## Hard Limits — ห้ามทำเด็ดขาด

- ห้าม query ข้าม `shop_id`
- ห้ามแก้ migration ไฟล์เก่า — ต้องสร้างไฟล์ใหม่
- ห้าม expose service-role key ใน client
- ห้าม log / ตอบกลับ raw token หรือ raw API key
- ห้ามข้ามการตรวจ API key บน `/api/integration/*`
- ห้ามเอา LINE / Omise / multi-tenant / demo code กลับมา
- ห้ามแตะโปรเจกต์ `../Queue` จากที่นี่

---

## Development Commands

```bash
npm run dev          # dev server (port 3000)
npm run build        # production build
npm run typecheck    # next typegen + tsc --noEmit (ต้องผ่านก่อน commit)
npm run lint         # ESLint
npm run test         # vitest (pure logic)
npm run create:admin -- <email> <password> "ชื่อ" admin   # สร้าง admin user
supabase start / supabase db reset                        # local stack + replay chain
```

Quality gate ก่อน commit: `npm run typecheck && npm run lint && npm run test`

---

## Roadmap / Status

- **Phase 0 (done 2026-09-17):** clone + strip + roles + DB chain + seed
- **Phase 1–2 code (done 2026-09-17, ยังไม่ได้ทดสอบกับ Supabase จริง):**
  - DB: `202609170004_dock_slots` (`get_dock_slots`, `get_available_days`, `create_dock_booking`), `…0005_dock_booking_ops` (`confirm_dock_booking`, `move_dock_booking`, token versions), `…0006_auto_call_cron`
  - Portal: คิว (list / create / detail / DO print / driver link / plate edit / reschedule), บอร์ดคิว, เอกสาร SO/PO (+CSV import dry-run, booking link + QR), คู่ค้า, ประเภทรถ, ท่า, เวลาทำการ (+direction), ตั้งค่าระบบคิว
  - Public: `/book/[token]`, `/driver/[token]`, `/display`
  - Auto-call: event path ใน `PATCH /api/bookings` + `/api/cron/auto-call`
- **LINE (โค้ดเสร็จ 2026-09-18, ยังไม่ได้ทดสอบกับ OA จริง — Fameline ยังไม่มี OA):** ดู section LINE OA และขั้นตอนตั้งค่าใน README
- **ค้าง (ต้องทำก่อน UAT):**
  - E2E กับ Supabase จริง/ local stack (`supabase start`) — SQL ทดสอบบน Postgres 16 แล้ว, API/UI ผ่านแค่ typecheck + build
  - Integration API `POST /api/integration/v1/{sales-orders,purchase-orders}` + หน้า API keys (ตาราง `api_keys`, `generateApiKey()`, `upsertDocument()` พร้อมแล้ว)
  - Dashboard / Reports / Calendar ยังเป็นของ Queue (ใช้ได้ แต่ยังไม่มี KPI ตามท่า / direction, ยังอ้าง `customers.nickname`)
  - Dock lane view บนบอร์ดคิว, i18n keys ใหม่ (ตอนนี้ใช้ fallback ไทยในโค้ด), ลบคอลัมน์/ตารางมรดกที่ไม่ใช้
  - Vault secrets `cron_app_url` + `cron_secret` บน Supabase จริง (ไม่ตั้ง = auto-call ทำงานเฉพาะ event path)
- **Phase 3:** reports, calendar ต่อท่า, handover

## AI Skills

- `ai/skills/engineer/SKILL.md` — patterns + quality gate
- `ai/skills/fixbug/SKILL.md` — bug workflow
