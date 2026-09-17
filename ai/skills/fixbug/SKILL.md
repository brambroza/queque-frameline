# QueueBooking FixBug Skill (QA + Debug)

## Purpose
แนวทางสำหรับ QA, reproduction, root-cause analysis, และแก้บั๊กใน QueueBooking โดยลด regression และไม่ทำให้ tenant อื่นได้รับผลกระทบ

## Scope
- Public pages (`/`, `/pricing`, `/contact`, `/use-cases`, `/sandbox-demo`)
- Portal (`/portal/*`)
- API (`/api/*`)
- LIFF/Public booking flow (`/liff/*`, `/api/public/shop/*`)

## Debug Workflow (Required)
1. Define bug clearly
   - expected behavior
   - actual behavior
   - environment (role, route, payload, tenant context)
2. Reproduce minimally
   - ระบุ step-by-step แบบสั้น
   - lock input ให้ซ้ำได้
3. Isolate layer
   - UI issue -> `src/components/*` / `src/app/*/page.tsx`
   - API issue -> `src/app/api/*/route.ts`
   - Auth/RBAC issue -> `src/lib/auth/*`
   - Data issue -> `supabase` migration/RLS/function
4. Identify root cause ก่อนแก้
5. Implement smallest safe fix
6. Verify with focused tests/checks

## Investigation Commands
- หาโค้ดเร็ว: `rg "keyword" src`
- ดูไฟล์เฉพาะช่วง: `sed -n 'start,endp' <file>`
- ตรวจ type: `npm run typecheck`
- ตรวจ lint: `npm run lint`

## Bug Categories Checklist

### A) UI / Layout Bug
- ตรวจ responsive ที่ `xs/sm/md`
- เช็คว่าใช้ component ซ้ำตาม design system เดิม
- ตรวจ Link path ไม่พัง

### B) API / Validation Bug
- เช็ค schema validate (`zod`) ครบทั้ง required/optional
- เช็ค status code ถูกต้อง (4xx vs 5xx)
- เช็คข้อความ error ไม่เปิดเผยข้อมูลภายใน

### C) Auth / Permission Bug
- ตรวจ role guard และ tenant scope
- ทดสอบอย่างน้อย 2 role (เช่น `shop_owner` และ `staff`)
- ยืนยันว่าไม่มีการเห็นข้อมูลข้ามร้าน/ข้ามบริษัท

### D) Data / RLS Bug
- ตรวจ query condition สำหรับ `company_id`/`shop_id`
- ถ้ามี schema change ให้แยก migration ใหม่ ไม่แก้ไฟล์เก่าย้อนหลัง
- ประเมินผลกระทบกับข้อมูลเดิมและ seed

## Fix Principles
1. แก้ให้น้อยที่สุดแต่จบปัญหา
2. หลีกเลี่ยง refactor กว้างในงาน bugfix
3. ไม่แก้หลาย concern ใน commit เดียว
4. ระบุความเสี่ยง regression ทุกครั้ง

## QA Validation Template
- Repro case: PASS/FAIL
- Neighboring flow check: PASS/FAIL
- Role/tenant isolation: PASS/FAIL
- Typecheck/Lint: PASS/FAIL
- Notes

## Done Criteria
- Repro เดิมต้องหาย
- ไม่มี error ใหม่ใน flow ข้างเคียงหลัก
- ผ่าน `typecheck` อย่างน้อย
- รายงาน root cause และไฟล์ที่แก้ชัดเจน
