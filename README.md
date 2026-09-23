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

## LINE OA (optional)

ต้องมี URL https จริง (Vercel) ก่อน เพราะ LINE เรียก webhook และเปิด LIFF ไม่ได้บน localhost

1. สร้าง LINE Official Account ที่ manager.line.biz → จด Basic ID (@xxxx) → Settings → Messaging API → เปิดใช้งาน
2. developers.line.biz → Messaging API channel → ออก **Channel access token (long-lived)**, จด **Channel secret**, Webhook URL = `https://<โดเมน>/api/line/webhook` → Verify → เปิด Use webhook, เปิด Allow bot to join group chats · ใน OA Manager ปิด Auto-reply และ Greeting message
3. สร้าง **LINE Login channel** ใน Provider เดียวกัน → แท็บ LIFF → Add: Endpoint `https://<โดเมน>/`, Scope `profile openid chat_message.write`, Size Full, Bot link feature **Aggressive** → จด **LIFF ID** และ **Channel ID** ของ Login channel
4. ใส่ค่าทั้งหมดที่ `/portal/line-settings` → กด "ทดสอบการเชื่อมต่อ"
5. เชิญ OA เข้ากลุ่ม LINE ของทีมคลัง แล้วพิมพ์ `ลงทะเบียนกลุ่ม`

หลังจากนี้ ลิงก์จอง/ลิงก์คนขับใน portal จะมีแบบ "ลิงก์สำหรับส่งใน LINE" — ผู้ที่เปิดผ่าน LINE จะถูกผูกบัญชีอัตโนมัติและได้รับแจ้งเตือน แผนฟรีส่งได้ 200 ข้อความ/เดือน

## Local Supabase (optional)

```bash
supabase start       # ครั้งแรกดาวน์โหลด image และ apply migration ทั้งหมด
supabase status      # ดู URL / anon key / service role key ใส่ใน .env
supabase db reset    # replay migration chain ใหม่ทั้งหมด
```

## เชื่อมต่อ ERP (Dynamics AX push)

1. Apply migration `supabase/migrations/202609230001_integration_api.sql` (ตาราง `integration_logs` + คอลัมน์เพิ่มของ `api_keys`)
2. Admin สร้าง API key ที่ `/portal/api-keys` — ค่าเต็มแสดงครั้งเดียว ส่งให้ทีม IT ของ Fameline ทางช่องทางที่ปลอดภัย
3. ฝั่ง AX ตั้ง `branches.code` ให้ตรง `InventSiteId` (`/portal/branches`) แล้วส่ง JSON ตาม [docs/integration/ERP-API-v1.md](docs/integration/ERP-API-v1.md)
4. ทดสอบจากเครื่องตัวเอง:

```bash
APP_URL=https://<โดเมน> API_KEY=flq_... scripts/dev/erp-push-sample.sh both   # health → dry run → push ตัวอย่าง
```

ประวัติทุกคำขอ (นับใหม่/อัปเดต/ไม่สำเร็จ + เอกสารที่ตก) ดูได้ในหน้าเดียวกัน เก็บ 90 วัน

## Quality gate

```bash
npm run typecheck && npm run lint && npm run test
```

## Deploy

Vercel project แยก (region `sin1`) — ตั้ง env ตาม `.env.example` · `NEXT_PUBLIC_APP_URL` ต้องเป็น https URL จริง เพราะใช้สร้างลิงก์/QR ให้ลูกค้า
