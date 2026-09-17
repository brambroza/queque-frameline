# Queue Booking SaaS — AI Skill Index

โปรเจคนี้มี skill เฉพาะทางสำหรับ AI agent ดังนี้

---

## Skills ที่มีอยู่

| Skill | Path | ใช้เมื่อ |
|---|---|---|
| Engineer | `ai/skills/engineer/SKILL.md` | เพิ่ม feature, route, component ใหม่ |
| FixBug | `ai/skills/fixbug/SKILL.md` | debug, QA, แก้ bug |

---

## Quick Reference

### เมื่อ Add Feature ใหม่
1. อ่าน `ai/skills/engineer/SKILL.md`
2. ดู pattern จาก route/component ที่คล้ายกัน
3. ตรวจ tenant scope + RBAC ก่อน merge

### เมื่อ Fix Bug
1. อ่าน `ai/skills/fixbug/SKILL.md`
2. Reproduce → Root cause → Minimal fix
3. รัน `npm run typecheck` + `npm run lint` ก่อน done

### เมื่อไม่แน่ใจ schema / table
1. ดู `supabase/migrations/202605090001_init.sql` สำหรับ base schema
2. ดู migration ล่าสุดใน `supabase/migrations/` สำหรับ column ใหม่
3. ดู `supabase/rls.sql` สำหรับ policy

---

## สิ่งที่ต้องรู้ก่อนเริ่มทุกงาน

- Multi-tenant: ทุก query ต้องมี `company_id` หรือ `shop_id`
- RBAC: ใช้ `requireAuthContext({ roles: [...] })` จาก `src/lib/auth/context.ts`
- Schema change: เพิ่ม migration file ใหม่เท่านั้น ห้ามแก้ไฟล์เก่า
- Public route: `/api/public/*` และ `/api/line/webhook/*` ไม่ต้องมี session แต่ต้อง validate input
- Notifications: ใช้ `safeCreateNotification` เสมอ — ไม่ break core flow
