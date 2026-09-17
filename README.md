# LINE Queue Booking SaaS Platform (Phase 1 MVP)

ระบบจองคิวแบบ SaaS สำหรับร้านค้า รองรับ multi-tenant ด้วย Supabase + Next.js (App Router)

## Tech Stack
- Next.js App Router + TypeScript
- Tailwind CSS (mobile-first)
- Supabase PostgreSQL + Supabase Auth + RLS
- API Routes for CRUD MVP

## Implemented in Phase 1
- Auth/Register/Login (Supabase Auth)
- Auto create `company` + `shop` + `shop_key` + `users_profile` + assign `shop_owner`
- Portal layout + dashboard
- Branch CRUD (create/list/delete)
- Service CRUD (create/list/delete)
- Working hours CRUD (create/list)
- Booking CRUD MVP (create/list/status update/delete)
- Available slot RPC scaffold: `get_available_slots`
- Supabase SQL schema + seed + RLS + function scripts

## Project Structure
- `src/app`: pages + API routes
- `src/components`: UI and forms
- `src/lib`: supabase/auth/booking/intent helpers
- `supabase/migrations`: schema migration
- `supabase/seed.sql`: role/permission seed
- `supabase/rls.sql`: row level security policies
- `supabase/functions.sql`: business SQL functions

## Environment
Copy `.env.example` to `.env.local` and fill values:

```bash
cp .env.example .env.local
```

Required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`

## Local Run
1. Install dependencies
```bash
npm install
```

2. Run SQL on Supabase (SQL Editor or CLI)
- `supabase/migrations/202605090001_init.sql`
- `supabase/functions.sql`
- `supabase/seed.sql`
- `supabase/rls.sql`

3. Start dev server
```bash
npm run dev
```

4. Open
- `http://localhost:3000/register`
- create shop owner account
- login and access `http://localhost:3000/portal/dashboard`

## Deploy Vercel
1. Push repository to GitHub
2. Import project in Vercel
3. Set env vars in Vercel Project Settings
4. Deploy

## Notes
- LINE webhook and LIFF booking full flow are placeholder in Phase 1 andจะพัฒนาต่อใน Phase 2
- For production, use encrypted secrets storage for LINE tokens and audit logging enhancement

## Implemented in Phase 2
- Public booking APIs for LIFF:
  - `GET /api/public/shop/[shopKey]/meta`
  - `GET /api/public/shop/[shopKey]/slots`
  - `POST /api/public/shop/[shopKey]/book`
- LIFF booking page (mobile-first): `/liff/[shopKey]`
  - choose branch/service/date/time
  - fill profile and confirm booking
- Rule-based Thai intent parser with date/time extraction
- LINE webhook: `POST /api/line/webhook/[shopKey]`
  - signature validation
  - save inbound messages
  - detect intent
  - reply with quick reply and booking guidance

## Implemented in Phase 3
- Chat Inbox
  - `GET/POST /api/chat-inbox`
  - view conversations and send LINE Push messages from portal
- Calendar View
  - `GET /api/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD`
  - grouped booking timeline by date
- Queue Board (Kanban)
  - use booking statuses `confirmed/waiting/serving/completed`
  - update status in board via booking API
- Reports + CSV Export
  - `GET /api/reports` for JSON summary
  - `GET /api/reports?mode=csv` for file export
- Notifications
  - `GET/POST/PATCH /api/notifications`
  - header notification menu with mark-as-read

## Production Hardening
- API RBAC guard by role in server routes (`super_admin/shop_owner/branch_manager/staff`)
  - centralized in `src/lib/auth/context.ts` via `requireAuthContext({ roles: [...] })`
- Deep pagination/filter
  - `GET /api/bookings`: `page,page_size,date,status,branch_id,service_id,q`
  - `GET /api/branches`: `page,page_size,active,q`
  - `GET /api/services`: `page,page_size,active,q`
  - `GET /api/chat-inbox`: `page,page_size,q,msg_page,msg_page_size`
  - `GET /api/calendar`: `from,to,status,branch_id,service_id`
  - `GET /api/reports`: `from,to,branch_id,service_id,mode=csv`
- Dashboard real charts
  - `GET /api/dashboard` for 14-day trend + status distribution
  - visualized in `/portal/dashboard` (line trend + status bars)

## Demo Sandbox (Phase 1)
- Goal: new tenant can understand product flow in 1-2 minutes without real LINE OA setup.
- Added schema/migrations:
  - `202605150001_demo_sandbox_phase1.sql`
  - `202605150002_demo_i18n.sql`
- Added API:
  - `GET /api/demo-sandbox` (load demo status/session)
  - `POST /api/demo-sandbox` with actions:
    - `create` + `business_type`
    - `reset` + optional `business_type`
    - `disable`
- Added services:
  - `src/lib/demo/sandbox.ts`
  - `createDemoSandbox({ companyId, shopId, userId, businessType })`
  - `resetDemoSandbox({ companyId, shopId, userId, businessType? })`
- Added portal UI:
  - `/portal/demo-sandbox`
  - Demo mode banner on all `/portal/*` pages when `shops.demo_mode_enabled = true`
- Safety:
  - Demo data tagged with `is_demo = true`
  - Reset only removes/recreates demo-tagged data
  - Tenant scope enforced by authenticated user context (`company_id/shop_id`)

## Demo Sandbox (Phase 3)
- Convert Demo To Real:
  - API action `convert_to_real` on `POST /api/demo-sandbox`
  - Choose whether to keep demo `branches/services/resources`
  - Demo bookings are archived (not reused as live bookings)
  - Shop demo mode is disabled after conversion
- Guided Tour Checklist:
  - Persist checklist state in `demo_sandbox_sessions.checklist` (jsonb)
  - API action `update_checklist` on `POST /api/demo-sandbox`
- Added migration:
  - `202605150003_demo_phase3.sql` (checklist + conversion audit columns)

## Demo LINE Experience (Phase 1)
- New interactive page:
  - `/portal/demo-line-experience`
  - alias: `/portal/demo/line`
- Purpose:
  - Simulate LINE-like booking journey without real LINE OA/LIFF connection.
- Implemented UI components:
  - `src/components/demo/line-chat-simulator.tsx`
  - `src/components/demo/rich-menu-simulator.tsx`
  - `src/components/demo/liff-booking-simulator.tsx`
  - `src/components/demo/flex-booking-success.tsx`
  - `src/components/demo/quick-reply-bar.tsx`
- Phase 1 behavior:
  - LINE dark-style chat simulator with quick replies
  - Rich Menu simulator with menu interactions
  - LIFF booking simulator (member info -> service/time -> confirm)
  - Booking success shown as flex-style card in chat
  - Fully local simulation (no real LINE API call)

## Notification Center (Phase 1)
- Added notification module without breaking existing booking/LIFF/LINE flows.
- New migration files:
  - `202605150006_notifications_phase1.sql`
  - `202605150007_notifications_i18n.sql`
- New API capabilities in `GET/POST/PATCH /api/notifications`:
  - list with filters/search/pagination
  - unread count
  - mark read / mark all read / archive
  - create notification
- New service helpers:
  - `src/lib/notifications/createNotification.ts`
  - `createNotification`, `safeCreateNotification`, `getNotifications`, `getUnreadNotificationCount`, `markNotificationAsRead`, `markAllNotificationsAsRead`, `archiveNotification`
- New UI:
  - Bell + dropdown in portal header
  - `/portal/notifications` center page
- Safety:
  - notification errors are isolated from core business flow
  - safe helper available for side-effect usage in booking flow later phases

## Notification Phase 2 (Safe Event Hooks)
- Added best-effort notification side effects to booking events:
  - `POST /api/bookings` -> `booking_created`
  - `PATCH /api/bookings` -> `queue_called` / `booking_cancelled` / `booking_rescheduled` / `booking_confirmed`
  - `DELETE /api/bookings` -> `booking_cancelled`
  - `POST /api/public/shop/[shopKey]/book` -> `booking_created` (shop-wide)
- Implemented using `safeCreateNotification(...)` to avoid breaking existing booking flows.
- If notification insert fails, booking APIs still return normal success/failure behavior for core logic.
