# คู่มือผู้ใช้งานแยกตามบทบาท

PDF และ DOCX ขนาด A4 จำนวน 7 เล่ม อยู่ใน `out/`

| ไฟล์ | บทบาท (role code) |
|---|---|
| `คู่มือ-ผู้ดูแลระบบ.pdf` | ผู้ดูแลระบบ (`admin`) |
| `คู่มือ-ฝ่ายขาย.pdf` | ฝ่ายขาย (`sales_admin`) |
| `คู่มือ-ฝ่ายจัดซื้อ.pdf` | ฝ่ายจัดซื้อ (`purchasing`) |
| `คู่มือ-ผู้จัดการคลัง.pdf` | ผู้จัดการคลัง (`wh_manager`) |
| `คู่มือ-ผู้บริหาร.pdf` | ผู้บริหาร (`director`) |
| `คู่มือ-LINE-ลูกค้าและคนขับ.pdf` | ลูกค้า / ผู้ขาย / คนขับ ที่ใช้ LINE OA |
| `คู่มือ-กลุ่ม-LINE-คลัง.pdf` | ทีมคลังหน้างานในกลุ่ม LINE (WMS) |

## โครงสร้าง

| ไฟล์ | หน้าที่ |
|---|---|
| `content.mjs` | เนื้อหาทุกเล่ม (1 รายการ = 1 หน้า A4) — แก้ข้อความที่นี่ |
| `assets/manual.css` | รูปแบบหน้า (สี ฟอนต์ IBM Plex Sans Thai ปก ส่วนท้าย) |
| `build_manuals.mjs` | ประกอบ HTML แล้วพิมพ์เป็น PDF เตือนเมื่อเนื้อหาล้นหน้าหรือภาพหาย |
| `build_docx.mjs` | ประกอบเนื้อหาเดียวกันเป็น Word (.docx) สำหรับส่งให้ลูกค้าแก้ไขต่อ |
| `capture_manual.mjs` + `capture_lib.mjs` | แคปภาพหน้าจอจริงโดยล็อกอินด้วยบัญชีของแต่ละบทบาท |
| `seed_manual_demo.mjs` | ข้อมูลตัวอย่างสำหรับแคปภาพ — **รันได้เฉพาะ Supabase local** |
| `screenshots/<role>/` | ภาพที่แคปได้ |

## แก้ข้อความแล้วสร้าง PDF ใหม่

```bash
node docs/manuals/build_manuals.mjs                 # ทุกเล่ม (PDF)
node docs/manuals/build_manuals.mjs --only=ฝ่ายขาย   # เฉพาะเล่ม
DOCX_LIB_DIR=<โฟลเดอร์ที่มี node_modules/docx และ cheerio> node docs/manuals/build_docx.mjs   # ทุกเล่ม (Word)
```

`build_docx.mjs` ใช้แพ็กเกจ `docx` กับ `cheerio` ซึ่งไม่ได้อยู่ใน package.json ให้ติดตั้งไว้ในโฟลเดอร์แยก
(`mkdir /tmp/docxlib && cd /tmp/docxlib && npm init -y && npm i docx@9 cheerio@1`) แล้วชี้ด้วย `DOCX_LIB_DIR`
ภาพใช้ชุดเดียวกับ PDF (รูปแบบ `crop` ถูกตัดด้วย `sharp` ของโปรเจกต์) หน้าใน Word ยาวกว่า PDF เพราะระยะบรรทัดของ Word
สารบัญเป็นลิงก์ภายในไม่มีเลขหน้า

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
   node scripts/create-admin.mjs newstaff@manual.local   "$MANUAL_PASSWORD" "อรุณี พนักงานใหม่"     wh_admin   # ภาพหน้าตั้งรหัสผ่าน
   NEXT_PUBLIC_APP_URL=http://localhost:3100 node docs/manuals/seed_manual_demo.mjs --out=/tmp/fameline-manual/links.json
   ```

4. รัน dev server แล้วแคป

   ```bash
   npx next dev -p 3100
   node docs/manuals/capture_manual.mjs --links=/tmp/fameline-manual/links.json            # ทุกบทบาท
   node docs/manuals/capture_manual.mjs --links=... --role=whm --only=13,14                 # เฉพาะบางภาพ
   ```

ข้อควรรู้

- `--role=common` = ภาพหน้า "เข้าใช้งานครั้งแรก" ที่ทุกเล่มใช้ร่วม (`screenshots/common/`): อีเมลเชิญ render จาก `supabase/templates/invite.html` (แก้ template แล้วแคปใหม่) + หน้า `/set-password` ของ `newstaff@manual.local`
- `seed_manual_demo.mjs` ล้างคู่ค้า เอกสาร และคิวของ site ก่อนสร้างใหม่ จึงปฏิเสธการรันถ้า URL ไม่ใช่ localhost
- ข้อมูลของ "วันนี้" อิงวันที่รัน ควร seed และแคปในวันทำการ
- ภาพ Walk-in ขึ้นกับเวลาปัจจุบัน: ภาพกรณี **ว่าง** (`sales|purchasing 06`, `whm 15-walkin`) แคปขณะขยาย `working_hours.close_time` ของสาขา BN ใน DB local เป็น 20:00 ชั่วคราว ส่วนภาพ **ต่อท้ายคิว** (`whm 15b`, `15c` — กดสร้างคิวจริง) แคปด้วยเวลาทำการปกติ 17:00 ช่วงท้ายวัน เลือกกรณีด้วย `MANUAL_WALKIN_CASE=15-walkin|15b`
- local DB ต้องมี migration `202610010001_walk_in_overflow` (ลงด้วย psql ใน container ถ้าเปิด stack จาก volume เดิม)
- ขั้นตอน `b1`–`b6` จองคิวจริงผ่านลิงก์ลูกค้า รันซ้ำต้อง seed ใหม่ก่อน
- `next dev` compile ทีละหน้า ครั้งแรกช้า ถ้า timeout ให้รันซ้ำด้วย `--only`

## ภาพแชท LINE (2 เล่ม LINE)

แคปจากแอป LINE จริงด้วย headless browser ไม่ได้ ภาพใน `screenshots/line/` จึงวาดเป็นหน้าจอแชทขนาดโทรศัพท์
โดยใช้ข้อความจริงจาก `src/lib/line/messages.ts` (Flex JSON ชุดเดียวกับที่ OA ส่ง) และเมนูจาก `rich-menu-canvas.ts`
ไม่ต้องใช้ฐานข้อมูลหรือ LINE API — แก้ข้อความในโค้ดแล้วรันใหม่ภาพจะตรงตาม

```bash
node docs/manuals/capture_line.mjs                 # ทุกภาพ
node docs/manuals/capture_line.mjs --only=l5,g2    # เฉพาะบางภาพ
OA_NAME="ชื่อ OA จริง" GROUP_NAME="WMS" node docs/manuals/capture_line.mjs
```

QR ของ OA (`screenshots/line/oa-qr.png`) ดาวน์โหลดจาก LINE ครั้งแรกที่รัน — ลบไฟล์ถ้า OA เปลี่ยน
ข้อมูลตัวอย่าง (SO-2609106 / R-004) ตรงกับภาพหน้าจองคิว `sales/b1–b6`
