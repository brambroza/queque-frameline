# Fameline Dock Queue

ระบบจองคิวรับ-ส่งสินค้าหน้าคลังสำหรับ Fameline (site เดียว, database แยก)

- **Outbound** — ลูกค้ามารับสินค้าตาม Sales Order (SO)
- **Inbound** — supplier มาส่งสินค้าตาม Purchase Order (PO)
- ลูกค้า/supplier จองผ่านลิงก์หรือ QR ที่ admin ส่งให้ต่อเอกสาร เลือกเฉพาะวัน/เวลาที่ว่าง
- Admin ยืนยันคิวและออก DO · staff หน้างานเช็คอิน/เรียกคิว · เรียกคิวอัตโนมัติเมื่อท่าว่าง · คนขับดู DO ผ่านลิงก์

Forked from GoAlong Queue (LINE queue booking SaaS) at commit `035e174`, 2026-09-17. รายละเอียดสถาปัตยกรรมและกติกาการเขียนโค้ดอยู่ใน [CLAUDE.md](CLAUDE.md)

## Stack

Next.js 15 (App Router) · TypeScript · MUI v7 · Tailwind (หน้า public) · Supabase (Postgres + Auth + RLS) · Vercel

## Setup

```bash
npm install
cp .env.example .env        # กรอกค่า Supabase ของ project นี้
```

### Database

สร้าง Supabase project ใหม่สำหรับ site นี้ แล้ว apply migration ตามลำดับ (เลือกวิธีใดวิธีหนึ่ง):

```bash
# 1) psql ต่อ connection string ของ project
DATABASE_URL='postgres://postgres:<password>@db.<ref>.supabase.co:5432/postgres' scripts/apply-migrations.sh

# 2) Supabase CLI
supabase link --project-ref <ref>
supabase db push

# 3) SQL editor — วางไฟล์ใน supabase/migrations/ ทีละไฟล์ตามชื่อ
```

Migration สุดท้าย (`202609170003_fameline_seed.sql`) สร้าง company/shop `fameline`, สาขา, site settings, ประเภทรถ, ท่า และเวลาทำการเริ่มต้น

### Admin user

```bash
npm run create:admin -- admin@fameline.co.th '<password>' 'ชื่อผู้ดูแล' admin
npm run create:admin -- gate@fameline.co.th '<password>' 'ป้อมยาม' staff
```

### Run

```bash
npm run dev          # http://localhost:3000 → /portal
```

### Auto-call / overdue sweep (pg_cron)

ตั้ง `CRON_SECRET` ใน env ของแอป แล้วสร้าง Vault secrets บน Supabase (ครั้งเดียว):

```sql
select vault.create_secret('https://<your-app-domain>', 'cron_app_url');
select vault.create_secret('<ค่าเดียวกับ CRON_SECRET>', 'cron_secret');
```

Migration `202609170006_auto_call_cron.sql` ตั้ง job ทุก 1 นาทีเรียก `/api/cron/auto-call` — ถ้ายังไม่มี secrets ระบบยังเรียกคิวอัตโนมัติได้ตอนปิดงานแต่ละคัน แต่จะไม่เปลี่ยนสถานะ “เลยเวลานัด / ไม่มา” เอง

### ทดสอบ migration บน Postgres เปล่า (ไม่ต้องใช้ Docker)

```bash
createdb fameline_test
psql fameline_test -f scripts/dev/stub-supabase-auth.sql     # stub auth schema — ห้ามรันกับ Supabase จริง
DATABASE_URL=postgres:///fameline_test scripts/apply-migrations.sh
```

## Local Supabase (optional)

```bash
supabase start       # ครั้งแรกดาวน์โหลด image และ apply migration ทั้งหมด
supabase status      # ดู URL / anon key / service role key ใส่ใน .env
supabase db reset    # replay migration chain ใหม่ทั้งหมด
```

## Quality gate

```bash
npm run typecheck && npm run lint && npm run test
```

## Deploy

Vercel project แยก (region `sin1`) — ตั้ง env ตาม `.env.example` · `NEXT_PUBLIC_APP_URL` ต้องเป็น https URL จริง เพราะใช้สร้างลิงก์/QR ให้ลูกค้า
