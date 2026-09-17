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
| UI | MUI v7 (portal) · Tailwind CSS (public booking / driver pages) |
| Auth | Supabase Auth (portal users only; customers/drivers ใช้ token link) |
| Database | Supabase PostgreSQL + RLS (project แยกเฉพาะ site นี้) |
| Deployment | Vercel (region sin1) |
| Scheduler | Supabase pg_cron + pg_net → `/api/cron/*` (Bearer `CRON_SECRET`) |
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
admin  — ตั้งค่า, จัดการเอกสาร SO/PO, ยืนยันคิว, ออก DO, จัดการพนักงาน, API keys
staff  — หน้างาน: เช็คอิน, เรียกคิว, เริ่ม/ปิดงาน, แก้ทะเบียน
driver — ไม่มี login: เข้าผ่านลิงก์ token ดู DO ของตัวเอง
```

- `requireAuthContext({ roles: ['admin'] })` สำหรับงานตั้งค่า/ยืนยัน · `['admin', 'staff']` สำหรับงานหน้างาน
- ทั้งสอง role เห็นทั้ง site (`SHOP_WIDE_ROLES` ใน `src/lib/auth/branch-scope.ts`, `is_branch_bound()` คืน false)
- สร้าง user: `node scripts/create-admin.mjs <email> <password> "ชื่อ" admin|staff`

---

## Single-site Rule

มี `companies` 1 แถว + `shops` 1 แถว (`shop_key = 'fameline'`, env `SITE_SHOP_KEY`) — โค้ดยังคง pattern เดิม:

```ts
// ทุก query ยังต้อง scope ด้วย shop_id จาก profile (RLS + กันบั๊ก)
.eq('shop_id', profile.shop_id)
```

- Public routes (`/api/public/*`) ใช้ `createAdminClient()` ได้ **แต่ต้อง resolve token → row ก่อน** แล้ว scope ทุก query ด้วย `shop_id` ของ row นั้น
- ห้ามเพิ่ม shop ที่สอง โดยไม่ผ่าน design review

---

## Domain Model (ตารางเดิมของ Queue ถูก map เป็นโดเมนคลัง)

| ตาราง | ความหมายใน Fameline | คอลัมน์สำคัญที่เพิ่ม |
|---|---|---|
| `services` | **ประเภทรถ** (4 ล้อ / 6 ล้อ / 10 ล้อ / เทรลเลอร์) | `duration_minutes` (เวลาที่ท่า), `buffer_minutes` (เผื่อ turnaround), `direction` (null = ทั้งสองขา), `sort_order` |
| `booking_resources` | **ท่า / dock** (`resource_type = 'dock'`) | `direction`, `service_ids` (ประเภทรถที่เข้าท่านี้ได้; null = ทุกประเภท), `capacity` (=1) |
| `working_hours` | เวลาเปิดท่า ต่อวันในสัปดาห์ | `direction` (null = ทั้งสองขา), `slot_interval_minutes`, `break_*` |
| `holidays` | วันหยุดคลัง | — |
| `customers` | **คู่ค้า** | `partner_type` customer\|supplier, `code` (รหัส ERP), `email`, `address` |
| `external_documents` | **SO / PO** | `doc_type` so\|po, `doc_no`, `partner_id`, `items jsonb`, `status`, `source` api\|csv\|manual, `booking_token_hash`, `raw` |
| `bookings` | **คิว** | `direction`, `document_id`, `service_id` (ประเภทรถ), `resource_id` (ท่า), `plate_number`, `plate_number_actual`, `driver_*`, `receiver_*`, `booking_source`, `confirmed_*`, `arrived_at`, `grace_deadline`, `called_*`, `serving_started_at`, `completed_at`, `auto_called`, `driver_token_hash`, `do_number`, `do_issued_*` |
| `booking_logs` | **audit log** ของคิว | `action`, `from_value`, `to_value`, `actor_kind` admin\|staff\|customer\|driver\|system |
| `site_settings` | ตั้งค่าของ site (1 แถว) | `grace_minutes`, `early_arrival_minutes`, `auto_call_mode`, `called_timeout_minutes`, `auto_no_show_after_grace`, `booking_token_ttl_days`, `driver_token_ttl_days`, `booking_lead_min_hours`, `booking_horizon_days`, `require_admin_confirm`, `driver_self_checkin`, `do_number_format`, `auto_call_last_run_at` |
| `api_keys` | key สำหรับ ERP push SO/PO | `key_hash` (sha256), `key_prefix`, `scopes` |
| `do_counters` + `next_do_number(shop_id, format)` | เลข DO ไม่ซ้ำ/ไม่ข้าม ต่อเดือน | format `DO-{YYYYMM}-{NNNN}` |

คอลัมน์ที่ยังเหลือจาก Queue แต่ **ไม่ใช้แล้ว** (รอลบพร้อมโค้ดที่อ้างถึง): `shops.demo_mode_enabled/demo_business_type/business_type/liff_id/line_setup_completed`, `customers.line_user_id`, `bookings.line_user_id/party_size/change_*`, `line_users`, `queue_slots`, `permissions`

---

## Booking Status Flow (เป้าหมาย Phase 1 — `src/lib/booking/status-flow.ts`)

```
customer link submit ─(require_admin_confirm)─▶ pending ─(admin ยืนยัน + ออก DO)─▶ confirmed
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
- `confirm_dock_booking` (status + DO ใน statement เดียว), `move_dock_booking` (ย้ายข้ามวัน = ออกเลขคิวใหม่ของวันปลายทาง)
- RPC เก่าของ Queue (`get_available_slots`, `get_slot_availability`) ยังอยู่ใน DB แต่ไม่มีโค้ดเรียกแล้ว
- `src/lib/booking/slot-time.ts` — `isSlotPast`, Bangkok clock; server เป็นคนใส่ `is_past` เสมอ

---

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
