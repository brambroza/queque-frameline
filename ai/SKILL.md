# Fameline Dock Queue — AI Skill Index

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
1. ดู `supabase/migrations/202605090001_init.sql` สำหรับ base schema (จาก Queue)
2. ดู `202609170002_fameline_core.sql` สำหรับตาราง/คอลัมน์ของโดเมนคลัง และตาราง "Domain Model" ใน CLAUDE.md
3. ดู `202605090004_rls.sql` + policy ในแต่ละ migration สำหรับ RLS

---

## สิ่งที่ต้องรู้ก่อนเริ่มทุกงาน

- Single-site แต่ทุก query ยังต้อง scope ด้วย `shop_id` (RLS + กันบั๊ก)
- RBAC: ใช้ `requireAuthContext({ roles: [...] })` จาก `src/lib/auth/context.ts`
- Schema change: เพิ่ม migration file ใหม่เท่านั้น ห้ามแก้ไฟล์เก่า
- Public route: `/api/public/*` ใช้ token, `/api/integration/*` ใช้ API key, `/api/cron/*` ใช้ `CRON_SECRET` — ทุกตัวต้อง validate input
- Notifications: ใช้ `safeCreateNotification` เสมอ — ไม่ break core flow
