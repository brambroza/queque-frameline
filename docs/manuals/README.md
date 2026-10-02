# คู่มือผู้ใช้งานแยกตามบทบาท

PDF ขนาด A4 จำนวน 5 เล่ม อยู่ใน `out/`

| ไฟล์ | บทบาท (role code) |
|---|---|
| `คู่มือ-ผู้ดูแลระบบ.pdf` | ผู้ดูแลระบบ (`admin`) |
| `คู่มือ-แอดมินฝ่ายขาย.pdf` | แอดมินฝ่ายขาย (`sales_admin`) |
| `คู่มือ-ฝ่ายจัดซื้อ.pdf` | ฝ่ายจัดซื้อ (`purchasing`) |
| `คู่มือ-ผู้จัดการคลัง.pdf` | ผู้จัดการคลัง (`wh_manager`) |
| `คู่มือ-ผู้บริหาร.pdf` | ผู้บริหาร (`director`) |

## โครงสร้าง

| ไฟล์ | หน้าที่ |
|---|---|
| `content.mjs` | เนื้อหาทุกเล่ม (1 รายการ = 1 หน้า A4) — แก้ข้อความที่นี่ |
| `assets/manual.css` | รูปแบบหน้า (สี ฟอนต์ IBM Plex Sans Thai ปก ส่วนท้าย) |
| `build_manuals.mjs` | ประกอบ HTML แล้วพิมพ์เป็น PDF เตือนเมื่อเนื้อหาล้นหน้าหรือภาพหาย |
| `capture_manual.mjs` + `capture_lib.mjs` | แคปภาพหน้าจอจริงโดยล็อกอินด้วยบัญชีของแต่ละบทบาท |
| `seed_manual_demo.mjs` | ข้อมูลตัวอย่างสำหรับแคปภาพ — **รันได้เฉพาะ Supabase local** |
| `screenshots/<role>/` | ภาพที่แคปได้ |

## แก้ข้อความแล้วสร้าง PDF ใหม่

```bash
node docs/manuals/build_manuals.mjs                 # ทุกเล่ม
node docs/manuals/build_manuals.mjs --only=ฝ่ายขาย   # เฉพาะเล่ม
```

ต้องต่ออินเทอร์เน็ต (โหลดฟอนต์จาก Google Fonts) Playwright ใช้ตัวเดียวกับ `docs/proposal/capture_*.mjs`
(npx cache; กำหนดเองได้ด้วย `PLAYWRIGHT_CORE`)

## แคปภาพใหม่

ภาพถูกแคปจาก dev server ที่ต่อกับ **Supabase local** เท่านั้น เพราะ script กดปุ่มจริงและสร้างคิวจริง
ห้ามชี้ไปที่ฐานข้อมูลจริง

1. เปิด local stack จากสำเนาของ `supabase/` (ดูเหตุผลเรื่อง bucket ใน `CLAUDE.md` หัวข้อ Roadmap)

   ```bash
   cp -R supabase /tmp/fameline-manual/ && cd /tmp/fameline-manual
   # ในสำเนา: แก้เงื่อนไข `nspname = 'storage'` ของ 202609240001 และ 202609250003 ให้ข้าม block bucket
   supabase start --workdir /tmp/fameline-manual -x studio,realtime,storage-api,imgproxy,edge-runtime,logflare,vector,supavisor,mailpit
   supabase status --workdir /tmp/fameline-manual -o env   # API_URL, ANON_KEY, SERVICE_ROLE_KEY
   ```

2. ตั้ง env ให้ชี้ local (ค่าใน process ชนะ `.env`) และปิดช่องทางส่งออกจริง

   ```bash
   export NEXT_PUBLIC_SUPABASE_URL=<API_URL> NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY> SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
   export TOKEN_SECRET=<ค่าใดก็ได้> SMTP_HOST= FEEDBACK_TO_EMAIL= DISPLAY_KEY=
   export NEXT_PUBLIC_APP_URL=<URL ของระบบจริง>   # ใช้แสดงในลิงก์/QR บนภาพเท่านั้น
   export MANUAL_PASSWORD=<รหัสผ่านของบัญชีทดสอบ>
   ```

3. สร้างบัญชีทดสอบของแต่ละบทบาท แล้ว seed ข้อมูลตัวอย่าง

   ```bash
   node scripts/create-admin.mjs admin@manual.local      "$MANUAL_PASSWORD" "สมชาย ผู้ดูแลระบบ"   admin
   node scripts/create-admin.mjs sales@manual.local      "$MANUAL_PASSWORD" "วราภรณ์ ฝ่ายขาย"     sales_admin
   node scripts/create-admin.mjs purchasing@manual.local "$MANUAL_PASSWORD" "ธนพล ฝ่ายจัดซื้อ"     purchasing
   node scripts/create-admin.mjs whm@manual.local        "$MANUAL_PASSWORD" "ประเสริฐ ผู้จัดการคลัง" wh_manager
   node scripts/create-admin.mjs director@manual.local   "$MANUAL_PASSWORD" "กิตติพงษ์ ผู้บริหาร"   director
   NEXT_PUBLIC_APP_URL=http://localhost:3100 node docs/manuals/seed_manual_demo.mjs --out=/tmp/fameline-manual/links.json
   ```

4. รัน dev server แล้วแคป

   ```bash
   npx next dev -p 3100
   node docs/manuals/capture_manual.mjs --links=/tmp/fameline-manual/links.json            # ทุกบทบาท
   node docs/manuals/capture_manual.mjs --links=... --role=whm --only=13,14                 # เฉพาะบางภาพ
   ```

ข้อควรรู้

- `seed_manual_demo.mjs` ล้างคู่ค้า เอกสาร และคิวของ site ก่อนสร้างใหม่ จึงปฏิเสธการรันถ้า URL ไม่ใช่ localhost
- ข้อมูลของ "วันนี้" อิงวันที่รัน ควร seed และแคปในวันทำการ
- ภาพ Walk-in ขึ้นกับเวลาปัจจุบัน: ภาพกรณี **ว่าง** (`sales|purchasing 06`, `whm 15-walkin`) แคปขณะขยาย `working_hours.close_time` ของสาขา BN ใน DB local เป็น 20:00 ชั่วคราว ส่วนภาพ **ต่อท้ายคิว** (`whm 15b`, `15c` — กดสร้างคิวจริง) แคปด้วยเวลาทำการปกติ 17:00 ช่วงท้ายวัน เลือกกรณีด้วย `MANUAL_WALKIN_CASE=15-walkin|15b`
- local DB ต้องมี migration `202610010001_walk_in_overflow` (ลงด้วย psql ใน container ถ้าเปิด stack จาก volume เดิม)
- ขั้นตอน `b1`–`b6` จองคิวจริงผ่านลิงก์ลูกค้า รันซ้ำต้อง seed ใหม่ก่อน
- `next dev` compile ทีละหน้า ครั้งแรกช้า ถ้า timeout ให้รันซ้ำด้วย `--only`
