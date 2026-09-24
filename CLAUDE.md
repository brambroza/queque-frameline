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
- **จัดตารางคิว = dialog เดียว (2026-09-22, `202609220003_move_dock_booking_minutes`)** — ปุ่มเดียวใน drawer เปิด `BookingScheduleDialog` (`src/components/bookings/booking-schedule-dialog.tsx`) แทน "เลื่อนคิว" + "ปรับเวลาที่ท่า" เดิม: chip วัน → ท่าที่รับคิวนี้ได้เป็นเลนแนวตั้ง (`GET /api/bookings/[id]/dock-board?date=` คืนคิวอื่น + `slotStarts` ต่อท่าจาก `get_dock_slots(resource_id, exclude self)`), 2 มุมมองสลับได้ (จำใน `localStorage` `fameline.schedule.view` / `fameline.schedule.fitOnly`, try/catch): **"เลือกช่องเวลา"** (default) = `SlotGrid` ตาราง เวลา × ท่า แตะ cell ว่าง (cell บอก ว่างถึงกี่โมง / ได้แค่ N′ ชนใคร / คิวอื่น / พัก / ไม่เปิด / เวลาเดิม; ตัวกรอง "พอสำหรับ N นาที" ซ่อนแถวที่ไม่พอ) และ **"บอร์ด (ลาก)"** = `DockBoard` เลนแนวตั้ง ลากบล็อกไปท่า/เวลาอื่น (snap เข้า slot จริง `snapToSlot`; ไม่มี slot ตรงนั้น = snap 30 นาทีแล้ว verdict บอกว่าไม่ใช่ช่องที่เปิด) เพราะ `move_dock_booking` รับเฉพาะ slot ที่ `remaining_capacity > 0`, ลากขอบล่างยืด 5 นาที, กรอบประ = ตำแหน่งเดิม; ทั้ง 2 มุมมองใช้ `draft` เดียวกัน; diff card + คืนค่าเดิม, ปุ่มบันทึกชื่อตามสิ่งที่ทำ; ชน = `computeDockDay(...).overlaps` (กติกา `is_dock_free`) บล็อกแดง + ปุ่มปิด; บันทึก: ย้าย (จะเปลี่ยนนาทีด้วยหรือไม่ก็ได้) → `PATCH /reschedule` (admin+**staff**, ส่ง `service_minutes` → RPC `p_service_minutes` ใน transaction เดียว) / เปลี่ยนแค่นาที → `PATCH /duration`; สถานะนอก `MOVABLE` = ลากไม่ได้ เหลือยืด/หด; smoke SQL `supabase/tests/move_dock_booking_minutes.sql`
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
- Public API: `/api/public/book/[token]/{meta,days,slots,submit,cancel,vehicle}`, `/api/public/driver/[token]`, `/api/public/display` — 404 เมื่อ token ผิด, 410 เมื่อหมดอายุ
- **ฟอร์มจองของลูกค้าถามแค่ 3 ช่อง (2026-09-24):** ขั้น "ข้อมูลรถและคนขับ" = ทะเบียนรถ + ชื่อคนขับ + เบอร์คนขับ (**บังคับทั้ง 3** ใน `submitSchema` เพราะเบอร์คนขับเป็นช่องทางติดต่อเดียวของคิว); ไม่ถามผู้รับ/ผู้ติดต่อ/หมายเหตุอีก → `receiver_*` เป็น null สำหรับคิวจากลิงก์ (คอลัมน์/RPC ยังรับอยู่, portal "สร้างคิว" ยังกรอกได้), ผู้ติดต่อฝั่งเอกสารคือคู่ค้าบน SO/PO
- **ลูกค้าเปลี่ยนทะเบียน/คนขับเอง (2026-09-24):** หน้า `/book/[token]` (รวมเปิดผ่าน LIFF) ปุ่ม "เปลี่ยนทะเบียนรถ / คนขับ" ใต้การ์ดคิว → `VehicleEditForm` (`src/components/public-booking/vehicle-edit-form.tsx`) → `PATCH …/vehicle` (`customerVehicleChangeSchema`): ตรวจว่าคิวเป็นของเอกสารที่ token เปิด, สถานะต้องอยู่ใน `CUSTOMER_VEHICLE_EDITABLE_STATUSES` = pending|confirmed|late (`canCustomerEditVehicle`; เช็คอินแล้ว = 409 `not_editable` ให้แจ้งป้อมยาม), ทะเบียนต้องตรง `plate_format` ของประเภทรถ (`services(plate_format)` อยู่ใน `PUBLIC_BOOKING_SELECT`), update แบบ optimistic `where status = <เดิม>`; diff pure ใน `src/lib/booking/vehicle-change.ts` (vitest) — เปลี่ยน **`plate_number` ที่จอง** (ไม่ใช่ `plate_number_actual` ของป้อมยาม; ถ้า actual เดิมตรงกับทะเบียนใหม่จะล้าง actual), พิมพ์ทะเบียนเดิมต่างรูปแบบ = ไม่นับเป็นเปลี่ยน; แจ้งคลัง 3 ทาง: `booking_logs` action `vehicle_change` (actor customer), notification `booking_vehicle_changed` (priority high ถ้าคิว confirmed/late เพราะ DO ออกแล้ว), LINE กลุ่มทีม `vehicle_changed`; ไม่ออก DO ใหม่/ไม่เปลี่ยนลิงก์คนขับ (ลิงก์เดิมผูกกับคิว ลูกค้าส่งต่อให้คนขับคนใหม่ได้เลย)
- ห้าม log raw token / raw API key

---

## Integration (SO/PO)

- Phase 1: CSV import `POST /api/documents/import` + สร้างเอง `POST /api/documents` (`source = csv|manual`)
- **Phase 2 — ERP push API (โค้ดเสร็จ 2026-09-23, `202609230001_integration_api`):** Dynamics AX 2012 ของ Fameline **push** JSON มาที่ `POST /api/integration/v1/{sales-orders,purchase-orders}` (+ `GET …/health`, `?dry_run=1`) header `X-API-Key` → `requireApiKey()` (`src/lib/integration/auth.ts`, key = `flq_…` เก็บ sha256 ใน `api_keys`, stamp `last_used_*` throttle 60 วิ); handler `src/lib/integration/api-handler.ts`: body `{ documents: [...] }` ≤ 100 ใบ / 1 MB, ประมวลผลทีละใบ, **HTTP 200 + ผลรายใบ** (`created|updated|valid|failed` + `warnings[]`; non-2xx เฉพาะ 400 body ผิด / 401 / 403 / 413) เพราะ .NET `HttpWebRequest` throw บน non-2xx; ทุก request ลง `integration_logs` (นับ + failures 50 รายการแรก, ไม่เก็บ payload, เก็บ 90 วัน); แจ้งเตือน `document_imported` เมื่อมีใหม่/ไม่สำเร็จ
- Zod เดียวกันทั้ง CSV และ API: `src/lib/integration/schemas.ts` — API ใช้ `apiDocumentUpsertSchema` (บังคับ `partner.code` = CustAccount/VendAccount และ `branch` = `branches.code` ที่ตรง AX `InventSiteId`; ตัด `T00:00:00` ท้ายวันที่); `normalizeApiItem` (`batch.ts`) ตัดบรรทัด qty ≤ 0 / ไม่มีชื่อ และอีเมลผิดรูปแบบก่อน validate เพื่อไม่ให้ทั้งใบตก; ฟิลด์เสริม (`ax.*`, `erp_status`) ไม่ถูก interpret แต่อยู่ใน `raw`
- กติกา upsert (`src/lib/integration/upsert.ts` + pure `rules.ts`): upsert บน `(shop_id, doc_type, doc_no)` (23505 race → update path), คู่ค้าบน `(shop_id, partner_type, code)`; **payment**: `source = 'api'` ลด paid/credit → unpaid ไม่ได้เลย (AX ออก invoice หลังของออก จึงตามหลังสลิปที่คลังกดมือ), CSV/manual ลดได้เฉพาะเมื่อไม่มีคิว confirmed — ข้ามแล้วส่ง warning `payment_downgrade_ignored`; unpaid → cleared จาก API แจ้ง "อนุมัติคิวได้" เหมือน PATCH payment (`notifyPaymentCleared`, `src/lib/booking/payment-notify.ts`); AX cancel ขณะมีคิว live → `has_live_bookings` (API ห้าม `forceCancel`) + notification `document_cancel_blocked` ให้ staff ยกเลิกคิวก่อน แล้ว nightly resync ของ AX ส่งซ้ำเอง; เปลี่ยนสาขาขณะมีคิว live → `branch_locked` + `document_branch_locked`; เอกสาร `completed` ไม่ถูก AX เปลี่ยนสถานะ (`completed_kept`); ใบใหม่ที่ส่ง `cancelled` มาเลยจะถูกสร้างเป็น `cancelled` (ไม่ใช่ open); `status` เดินแค่ open↔cancelled — `booked` คงเดิมเมื่อส่งซ้ำ, `completed` เป็น manual ของคลังเท่านั้น
- หน้า `/portal/api-keys` (menu key `api_keys`, admin) — สร้าง key (แสดง raw ครั้งเดียว), เพิกถอน (`PATCH /api/api-keys/[id]`, ไม่มี un-revoke), ดู `integration_logs` 50 รายการล่าสุด; เขียน `api_keys` ผ่าน service role หลังตรวจ admin (RLS อ่านอย่างเดียว); `api_keys` ใช้งานพร้อมกันได้ ≤ 10
- Spec ให้ Fameline IT: `docs/integration/ERP-API-v1.md` (mapping AX 2012, push gate, payment derivation, cadence, TLS 1.2) · ตัวอย่าง `docs/integration/samples/*.json` · ทดสอบ `APP_URL=… API_KEY=… scripts/dev/erp-push-sample.sh`
- Rate limit ยังไม่ทำ (caller เดียว, key 256-bit, งานต่อ request ถูก cap) — ถ้า Vercel Pro ตั้ง Firewall rule ที่ `/api/integration/*`; `maxDuration = 60` ต้อง Pro (Hobby cap 10 วิ → ลด batch เป็น 50)

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
- **จอ TV `/display` (2026-09-23) = 2 ช่อง** สีแบรนด์ Fameline (`tailwind.config.ts` → `fameline.green #002c1f / mint #aedbc0 / mint-soft / lime #adc32b`, จาก fameline.com): ซ้าย `YardScene` (`src/components/display/yard-scene.tsx`) = SVG ผังลานมุมสูงจาก feed เดียวกัน — ประตูท่าละช่อง (ลาย idle / มินต์ serving / มะนาวกะพริบ called), รถถอยเข้าท่า + badge เลขคิว/ทะเบียน, "ลานรอเรียก" ต่อแถวตามลำดับ (cap 6 + `+N`); กติกา pure ใน `src/lib/display/yard.ts` (`truckKind` จากชื่อประเภทรถ, `sceneLayout`; vitest) — ขวา = tile ท่า (1 คอลัมน์ ≤2 ท่า, 2 คอลัมน์ 3–4) + รายการรอเรียกเดิม; header ใช้ `site.logo_url` ถ้ามี ไม่มีก็ badge "F" + wordmark FAMELINE
- **E2E จริง** (portal + หน้าคนขับ + cron บน DB จริง, ต้อง dev server รันด้วย `CRON_SECRET=<x>` และ user portal ทดสอบ): `QA_PASSWORD=… CRON_SECRET=<x> node scripts/dev/e2e-driver-alerts.mjs` → seed ชุด `--tag=E2E --allow-past` (ท่า outbound มีท่าเดียว วันนี้เต็ม จึงจองช่องที่ผ่านแล้ว) → late → check-in → wait notice → auto-call, PNG + README ลง `docs/test-evidence/<date>-driver-alerts/`; ระวัง cron ที่ยิงจะ timeout คิว `called` ของคนอื่นเป็น `no_show` ตามกติกา; หน้า login ต้องรอ hydration ก่อนกด ไม่งั้น form ส่งเป็น GET (ผลรัน 2026-09-24 ผ่านทุกขั้น)
- **E2E จริง ลูกค้าเปลี่ยนรถ/คนขับ**: `QA_PASSWORD=… node scripts/dev/e2e-vehicle-change.mjs [--edit=<doc_no>] [--locked=<doc_no>]` — derive ลิงก์ลูกค้า/คนขับจาก DB (HMAC เดียวกับ seed), กรอกฟอร์ม inline จริง, ตรวจ notification/บอร์ด/drawer, PNG + README ลง `docs/test-evidence/<date>-vehicle-change/` (ผลรัน 2026-09-24 ผ่าน 11 ภาพ; ข้อสังเกต: การ์ดลูกค้าโชว์ทะเบียน normalize `819999` ไม่ใส่ขีด)
- Capture หน้าคนขับ (390×844 @2x, mock `/api/public/driver/<token>` + fake Notification/PushManager เพราะ headless Chromium คืน permission denied): `node docs/proposal/capture_driver.mjs` → `10-driver-called-offer.png` (ก่อนกดเปิดแจ้งเตือน), `10a-driver-called.png`, `10b-driver-called-again.png`, `10c-driver-late.png`
- Capture ภาพ proposal: `node docs/proposal/capture_display.mjs` (dev server รันอยู่; `APP_URL` ถ้าไม่ใช่ :3000) — mock `/api/public/display` ด้วย fixture ในไฟล์ → `09-display-tv.png` / `09b-display-tv-waiting.png` 1600×900 @2x, Playwright จาก npx cache (`PLAYWRIGHT_CORE` override)

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
- **Push:** `src/lib/line/notify.ts` — `safeNotifyPartner` (submitted/confirmed/called/rescheduled/cancelled/no_show), `safeNotifyDriver` (job/called), `safeNotifyStaffGroup` (submitted/customer_cancelled/arrived/plate_mismatch/vehicle_changed/no_show/late/auto_called) — ไม่ throw, บันทึก `booking_logs` action `line_push`, stamp `bookings.last_line_notify_at` Flex ใน `messages.ts` (pure + vitest)
- **Webhook** `POST /api/line/webhook`: ตรวจลายเซ็น, `follow` → welcome + upsert, `join` → วิธีลงทะเบียน, ข้อความ `ลงทะเบียนกลุ่ม` ในกลุ่ม → เก็บ `staff_group_id`, ข้อความ 1:1 → help ทุก event ลง `line_events` ยังไม่ตั้งค่า = ตอบ 200 เปล่า (ให้ปุ่ม Verify ผ่าน)
- **Hard limits:** ห้าม log token/secret, ห้ามเชื่อ `line_user_id` จาก request (ต้องมาจาก ID token เท่านั้น), push ทุกจุดต้องผ่าน `safeNotify*`
- ค่าใช้จ่าย: แผนฟรี 200 ข้อความ/เดือน (push + กลุ่ม) — reply ไม่นับ

### Rich menu ลูกค้า — เช็คคิว / สถานะ SO (2026-09-24, `202609240005_line_rich_menu`)

- เมนู compact 2500×843 3 ปุ่ม (`RICH_MENU_TILES` ใน `src/lib/line/rich-menu.ts`, pure + vitest): **คิวของฉัน** (`action=my_queues`) · **สถานะ SO** (`action=my_docs`) · **ติดต่อคลัง** (`action=contact`) — ทุกปุ่มเป็น postback (`displayText` = ชื่อปุ่ม) ตอบด้วย **reply** (ไม่นับโควตา) ; พิมพ์คำว่า `คิว` / `SO` / `สถานะ` / `ติดต่อ` ใน 1:1 ได้ผลเดียวกัน (`actionForText`)
- **เผยแพร่จาก portal** `/portal/line-settings` section 4: browser วาดภาพด้วย canvas (`src/components/forms/rich-menu-canvas.ts`, ฟอนต์ Kanit ของหน้า, ไอคอนวาดเอง ไม่ใช้ emoji) → `POST /api/line-settings/rich-menu` `{ image_base64 }` (admin) ตรวจ PNG 2500×843 ≤ 1 MB (`richMenuImageProblem`) → `createRichMenu` → `uploadRichMenuImage` (api-data host) → `setDefaultRichMenu` → เก็บ `line_config.rich_menu_id` + `rich_menu_published_at` → ลบเมนูเก่าที่ระบบเคยสร้าง; upload/set พังจะลบเมนูที่สร้างครึ่งเดียวทิ้ง; `DELETE` = unset default (เฉพาะเมื่อ default ปัจจุบันคือของเรา) + ลบ + ล้างคอลัมน์; ปุ่ม "ทดสอบการเชื่อมต่อ" เช็คว่า default ของ OA ยังเป็นเมนูของระบบ (`getDefaultRichMenuId`)
- **Webhook ตอบ** (`src/lib/line/self-service.ts`): `resolveLineIdentity` = `line_users` (shop + userId จาก event ที่ตรวจลายเซ็นแล้ว) → `customers.line_user_id` (คู่ค้า) + `bookings.line_user_id` (เอกสารที่จองเอง) + `bookings.driver_line_user_id` (งานคนขับ); ไม่เจอ = `notLinkedText` บอกให้เปิดลิงก์ผ่าน LINE ก่อน
  - `my_queues` = คิว `LIVE_STATUSES` วันนี้เป็นต้นไปที่ `line_user_id` / `customer_id in partners` / `driver_line_user_id` ตรง → `myQueuesFlex` carousel (≤ `REPLY_LIST_LIMIT` 10 + `moreItemsText`) สถานะ/ท่า/ทะเบียน/DO/SO, ปุ่มเปิดหน้า `/book` (คู่ค้า) หรือ `/driver` (คนขับ, เฉพาะ token ยังไม่หมดอายุ); `pending` บน SO unpaid = "รอชำระเงิน"
  - `my_docs` = `external_documents` `open|booked` ของคู่ค้า + ที่เคยจอง (`due_date` ใกล้ก่อน) → `myDocsFlex`: สถานะเอกสาร + ชำระเงิน (SO) + จำนวนรายการ + คิว live ≤ 3 ใบ + ปุ่ม "จองคิว"/"ดูรายละเอียด"; **ออก booking token ให้เอกสารที่ยังไม่มี/หมดอายุ** (`bookingPageUrl`, กติกาเดียวกับ `GET /api/documents/[id]/booking-link`, เฉพาะ 10 ใบที่แสดง) เพื่อให้คู่ค้าเข้าถึงทุก SO ของตัวเองจากเมนูได้แม้ยังไม่เคยถูกส่งลิงก์
  - `contact` = `shops.phone/address` + `branches` ที่ active (`contactText`)
  - lookup พัง = ตอบ `helpText` (ไม่เงียบ) ; index ใหม่ `customers_line_user_idx`, `bookings_line_user_idx`
- ยังไม่มีหน้า LIFF "รายการทั้งหมด" (ลูกค้าที่มี SO เปิด > 10 ใบเห็นแค่ 10 + ข้อความบอกจำนวนที่เหลือ) — ค่อยทำเมื่อมี use case จริง

## Feedback / แจ้งปัญหา (2026-09-24, `202609240001_feedback_reports`)

- ปุ่มลอย**มุมซ้ายล่าง** ทุกหน้า portal (`FeedbackFab` mount ครั้งเดียวใน `PortalFrameInner`, z-index 1450 เหนือ drawer/dialog — กดได้ขณะเปิด dialog/drawer, ใต้ tooltip/toast) → แคปหน้าจอด้วย `html-to-image` (dynamic import, ตัด element ที่มี `data-feedback-ignore` = ปุ่ม/toast, ย่อ ≤ 1600px **PNG** ≤ 2.5 MB, เกิน cap ค่อย fallback JPEG — `src/components/feedback/capture.ts`) → `FeedbackDialog`: ประเภท bug|suggestion, ชื่อผู้แจ้ง (prefill), อีเมลติดต่อกลับ (prefill = อีเมล login, ใช้เป็น Reply-To), เบอร์โทร (prefill จาก `/api/me-profile`), CC หลายอีเมลคั่น comma ≤ 5 (`parseEmailList`, `202609240002_feedback_contact`: `contact_email`, `contact_phone`, `cc_emails text[]`), ความสำคัญ low|medium|high|urgent, รายละเอียด 5–2000, preview + ติ๊กแนบรูป, เมนู (จาก `menuItemForPath`) + path
- `POST /api/feedback` (admin+staff): zod `feedbackReportSchema` (`src/lib/feedback/schemas.ts`, path ต้องเป็น `/portal…`) → insert `feedback_reports` (RLS insert own) → upload bucket private `feedback-screenshots/<shop_id>/<id>.png|jpg` ผ่าน service role → `safeSendMail` ไป env `FEEDBACK_TO_EMAIL` (subject `[site][BUG|แนะนำ][ความสำคัญ] เมนู — สรุป`, แนบรูป inline cid; builder pure `src/lib/feedback/email.ts` + vitest) → stamp `screenshot_path` / `email_sent_at` / `email_error` (`mail_not_configured` | `smtp_failed`) → audit `feedback_submitted`; Storage/SMTP พังไม่ทำให้ request ล้ม (แถวยังอยู่, toast บอกว่าส่งเมลไม่สำเร็จ)
- Mail helper กลาง `src/lib/mail/send.ts` (`getSmtpConfig` / `safeSendMail`, nodemailer, ไม่ log credential) — ใช้ต่อกับ DO/ลิงก์ได้; SMTP ครึ่ง ๆ (ขาด host/user/pass) = ปิด
- `feedback_reports.status` (new|acknowledged|in_progress|done|rejected) + RLS อ่าน/แก้เฉพาะ admin เตรียมไว้สำหรับหน้า `/portal/feedback` ในอนาคต (ยังไม่มี UI)

## Notification System

`safeCreateNotification(supabase, {...})` (`src/lib/notifications/createNotification.ts`) = notification center ของ **staff/admin** เท่านั้น ไม่ throw
ลูกค้าดูสถานะจากหน้าลิงก์ของตัวเอง (poll) + LINE ถ้าผูกไว้ · คนขับมี 3 ช่องทาง: poll หน้าลิงก์, LINE, **Web Push บนเบราว์เซอร์** (ด้านล่าง)

### Driver browser alerts / Web Push (2026-09-24, `202609240003_push_subscriptions`)

- ทางเลือกสำหรับคนขับที่ไม่ใช้ LINE: หน้า `/driver/[token]` มีแถบ `AlertsBanner` ปุ่ม "เปิดแจ้งเตือน" → `useDriverAlerts` (`src/components/public-booking/use-driver-alerts.ts`) ขอ `Notification.requestPermission` + ปลดล็อกเสียง (WebAudio, ต้องอยู่ใน tap) + ถ้าเบราว์เซอร์รองรับ Push API → register `public/sw.js` (scope `/driver/`, ไม่มี fetch handler) → `pushManager.subscribe(VAPID public key จาก meta)` → `POST /api/public/driver/[token]/push` upsert `push_subscriptions` บน `(booking_id, endpoint)`; `DELETE` = ปิดบนเครื่องนี้; จำสถานะเปิดใน `localStorage` `fameline.alerts.<bookingId>` (try/catch) แล้ว re-sync subscription ตอนเปิดหน้าใหม่
- **2 ชั้น**: (1) in-page — poll ทุก 10 วิ + refetch ตอน `visibilitychange` เห็นสถานะเปลี่ยน → `alertKindForChange` (`src/lib/push/driver-alerts.ts`, pure + vitest: called รวมเรียกซ้ำเมื่อ `call_count` เพิ่ม, late, cancelled, no_show) → สั่น + เสียง + `reg.showNotification` (Android Chrome ห้าม `new Notification()` ในหน้า จึงใช้ SW เมื่อมี) (2) server push — `safeNotifyDriverPush(admin, { shopId, bookingId, kind })` (`src/lib/push/send.ts`, `web-push`, TTL 15 นาที, urgency high, ไม่ throw, log `booking_logs` action `web_push`, 404/410 = soft-delete subscription) เรียกที่ `runAutoCall` + `PATCH /api/bookings` (called) + cron (late); ทั้ง 2 ชั้นใช้ `driverAlert()` เดียวกัน → `tag` เดียวกัน OS แทนที่ไม่ซ้อน
- env `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` (`src/lib/push/config.ts`, `npx web-push generate-vapid-keys`); ไม่ตั้ง = meta คืน `push.enabled=false`, ปุ่มยังเปิดได้แต่แจ้งเฉพาะตอนเปิดหน้าอยู่; private key ไม่ออกจาก server, endpoint เป็น capability URL ห้าม log
- ข้อจำกัด: iOS Safari ต้อง "เพิ่มไปยังหน้าจอโฮม" ก่อน (แถบบอกวิธี; ยังไม่มี manifest/PWA — ถ้าจะทำต้องเพิ่ม `manifest` ไม่ใส่ `start_url`); เบราว์เซอร์ throttle poll ตอนอยู่เบื้องหลัง — ชั้น server push คือตัวจริง

### แจ้ง "กรุณารอสักครู่" — เช็คอินแล้ว เลยเวลานัด ท่ายังไม่ว่าง (2026-09-24, `202609240004_wait_notice`)

- ความหมายของ "คิวช้า" ที่ลูกค้าต้องการ: รถมาถึง+เช็คอินแล้ว ถึงเวลานัดแต่ท่ายังไม่ว่าง (ยังไม่ถูกเรียก) → แจ้งคนขับ **ครั้งเดียวต่อคิว** ว่าท่าล่าช้า กรุณารอ
- `site_settings.wait_notice_enabled` (default true) + `wait_notice_minutes` (default 5, 0–240; 0 = ทันทีที่ถึงเวลานัด) ตั้งที่ `/portal/site-settings` section "เรียกคิวอัตโนมัติ"; `bookings.wait_notified_at` = stamp กันซ้ำ
- cron `/api/cron/auto-call` step 3 (หลัง `runAutoCall` เพื่อให้คิวที่เรียกได้ถูกเรียกก่อน): `computeWaitNotices` (`src/lib/booking/overdue.ts`, pure + vitest) เลือก `checked_in` วันนี้ที่ `now ≥ start_time + wait_notice_minutes` และ `wait_notified_at is null` → update conditional → log `wait_notice` → `safeNotifyDriver kind 'waiting'` (`bookingWaitingFlex`) + `safeNotifyDriverPush kind 'waiting'`; response มี `waited[]`
- หน้า `/driver`: `PUBLIC_BOOKING_SELECT` ส่ง `wait_notified_at` → แถบเหลือง "คิวล่าช้ากว่ากำหนด — ท่า X ยังไม่ว่าง กรุณารอ"; in-page alert ผ่าน `alertKindForChange` เมื่อ stamp โผล่ขณะ status ยัง `checked_in` (ไม่แจ้งตอนโหลดครั้งแรก)
- ไม่แจ้งลูกค้า/staff (คนขับเท่านั้น) — staff เห็นบนบอร์ดอยู่แล้ว

### แจ้งคิวช้ากว่ากำหนด (late)

cron `confirmed→late` → LINE คนขับ + Web Push คนขับ (`kind: 'late'`) + LINE ลูกค้า/supplier (`bookingLateFlex`, `who: 'driver'|'partner'` — บอกเวลานัด, ยังเข้าได้, เหลือ `grace_minutes` นาทีก่อนปิดคิวถ้า `auto_no_show_after_grace`) + LINE กลุ่มทีมคลัง (เดิม); หน้า `/driver` มีแถบส้ม "เลยเวลานัด" (meta ส่ง `auto_no_show_after_grace`); **ไม่**ลง notification center ของ staff (ตัดสินใจ 2026-09-24 — กลุ่ม LINE พอ)

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
| `SMTP_*` | optional | อีเมลขาออก (feedback; DO / ลิงก์ในอนาคต) — Gmail: `smtp.gmail.com` 587 + App Password |
| `FEEDBACK_TO_EMAIL` | feedback | ผู้รับรายงาน bug/ข้อเสนอแนะจากปุ่มลอย (ไม่ตั้ง = เก็บ DB อย่างเดียว) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | optional | Web Push ให้คนขับที่ไม่ใช้ LINE (`npx web-push generate-vapid-keys`; ไม่ตั้ง = แจ้งเฉพาะตอนเปิดหน้า) |

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
npm run seed:test -- [--code=C002] [--date=YYYY-MM-DD] [--reset] [--dry-run]   # ข้อมูลทดสอบ: ลูกค้า C002 + SO paid/confirmed ทุกประเภทรถ + SO unpaid (pending) + SO ยังไม่จอง, พิมพ์ลิงก์คนขับ/ลิงก์จอง (เอกสาร SO-TEST-<code>-nnn; --reset ลบชุดเดิมแบบ hard delete แล้วสร้างใหม่)
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
  - Integration API + หน้า API keys โค้ดเสร็จ 2026-09-23 (ดู section Integration) — ค้าง: รัน migration `202609230001` บน Supabase จริง, joint test กับ X++ job ของ Fameline, ยืนยัน `branches.code` = `InventSiteId` และกติกา paid ก่อน invoice กับ finance
  - Feedback FAB โค้ดเสร็จ 2026-09-24 — ค้าง: รัน migration `202609240002` (คอลัมน์ติดต่อกลับ; `202609240001` รันแล้ว) บน Supabase จริง, ตั้ง `SMTP_*` + `FEEDBACK_TO_EMAIL`, ทดสอบแคปหน้าจอบนเบราว์เซอร์จริง
  - Rich menu ลูกค้า (เช็คคิว / สถานะ SO) โค้ดเสร็จ 2026-09-24 — ค้าง: รัน migration `202609240005_line_rich_menu` (ไม่รัน = `getLineConfig` select คอลัมน์ที่ไม่มี → query error → ได้ config ว่าง → LINE ทั้งระบบเงียบเหมือนยังไม่ตั้งค่า ยกเว้นค่าจาก env), กด "เผยแพร่" กับ OA จริง + ทดสอบกดปุ่มจากมือถือ (ภาพเมนู render ทดสอบแล้ว 2500×843 ~160 KB)
  - Driver Web Push + แจ้ง late + แจ้ง "กรุณารอสักครู่" โค้ดเสร็จ 2026-09-24 — ค้าง: รัน migration `202609240003_push_subscriptions` + `202609240004_wait_notice` (ไม่รัน 0004 = cron 500 เพราะ select `wait_notified_at`) (ไม่รัน = `POST …/push` 500 แต่หน้า driver ยังใช้ได้), gen + ตั้ง `VAPID_*` บน Vercel, ทดสอบบน Android Chrome จริง (ปิดแท็บแล้วยังเด้ง) + iOS home-screen
  - Dashboard / Reports / Calendar ยังเป็นของ Queue (ใช้ได้ แต่ยังไม่มี KPI ตามท่า / direction, ยังอ้าง `customers.nickname`)
  - Dock lane view บนบอร์ดคิว, i18n keys ใหม่ (ตอนนี้ใช้ fallback ไทยในโค้ด), ลบคอลัมน์/ตารางมรดกที่ไม่ใช้
  - Vault secrets `cron_app_url` + `cron_secret` บน Supabase จริง (ไม่ตั้ง = auto-call ทำงานเฉพาะ event path)
- **Phase 3:** reports, calendar ต่อท่า, handover

## AI Skills

- `ai/skills/engineer/SKILL.md` — patterns + quality gate
- `ai/skills/fixbug/SKILL.md` — bug workflow
