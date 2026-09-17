# Fameline Dock Queue — Engineer Skill

## Purpose
แนวทางสำหรับการเขียนโค้ดในโปรเจค Fameline Dock Queue (Next.js App Router + TypeScript + MUI + Supabase) ให้สอดคล้องกับโครงสร้างเดิม, scope ด้วย shop_id เสมอ, และพร้อมใช้งาน production

## Project Context
- Framework: Next.js App Router (`src/app`)
- Language: TypeScript
- UI: MUI (`@mui/material`, `@mui/icons-material`)
- Data/Auth: Supabase (`src/lib/supabase`, `src/lib/auth`)
- Public pages: `/book/[token]`, `/driver/[token]`, `/display` เป็น Tailwind (ไม่มี MUI provider) และไม่มี SEO — `robots: noindex`
- Backoffice: อยู่ใต้ `/portal/*`

## Golden Rules
1. แก้เฉพาะ scope ที่ได้รับมอบหมาย และหลีกเลี่ยงการกระทบ business logic เดิม
2. ถ้าเป็น route/API ใหม่ ให้คงรูปแบบไฟล์ตาม `src/app/**/page.tsx` และ `src/app/api/**/route.ts`
3. ตรวจ tenant-scope ทุกครั้งเมื่อแตะ API ที่มีข้อมูลลูกค้า
4. ใช้ Server Component เป็นค่าเริ่มต้น; ใช้ Client Component เฉพาะที่จำเป็น
5. อย่าสร้าง abstraction ใหม่เกินจำเป็น หากของเดิมใน `src/components`/`src/lib` ใช้ซ้ำได้

## Coding Conventions
- Import alias ใช้ `@/...`
- ตั้งชื่อชัดเจน สอดคล้องโดเมน (`bookings`, `documents`, `partners`, `docks`, `vehicle types` — ดูตาราง mapping ใน CLAUDE.md)
- MUI style ใช้ `sx` ตาม pattern เดิม
- Internal links ใช้ `next/link`
- รูปภาพใช้ `next/image` เมื่อเหมาะสม และระบุ `width/height/alt`

## API Implementation Checklist
- วาง route ใน `src/app/api/<resource>/route.ts`
- ใช้ auth context helper จาก `src/lib/auth/context.ts` สำหรับ RBAC
- Validate input ด้วย `zod` (สอดคล้องกับของเดิม)
- ครอบ error ด้วย response ที่อ่านง่าย และไม่ leak secret
- คงพฤติกรรม backward-compatible

## Database / Supabase Checklist
- ถ้าต้องเปลี่ยน schema: เพิ่ม migration ใหม่ใน `supabase/migrations/`
- ต้องคำนึงถึง RLS policy (ดู `202605090004_rls.sql` และ migration ที่เกี่ยวข้อง)
- ห้าม query โดยไม่มีเงื่อนไข `shop_id`
- ทดสอบ chain ด้วย `scripts/apply-migrations.sh` บน DB เปล่าก่อน commit

## Frontend Page Checklist
- Mobile-first และ responsive (`Grid`, `Stack`, `Container`)
- Reuse คอมโพเนนต์สาธารณะเดิมก่อนสร้างใหม่
- สร้าง section แบบแยก function component ภายในไฟล์เมื่อหน้าใหญ่
- เลี่ยง hardcode สี/spacing ที่ขัดกับ pattern เดิม

## Quality Gate Before Done
1. รัน `npm run typecheck`
2. รัน `npm run lint` (ถ้าสcopeงานแตะ frontend/API)
3. ทดสอบเส้นทางที่เปลี่ยนทั้ง happy path และ error path
4. รัน `npm run test` เมื่อแตะ `src/lib/**` (pure logic ต้องมี vitest)

## Output Format (when reporting work)
- What changed
- Files touched
- Why this approach
- Validation run + result
- Remaining risks / follow-up
