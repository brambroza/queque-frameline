# การเชื่อมต่อ Dynamics AX 2012 → ระบบคิวรับ-ส่งสินค้า (ERP Push API v1)

เอกสารสำหรับทีม IT ของ Fameline ที่จะพัฒนางานส่งข้อมูลฝั่ง Dynamics AX 2012
เวอร์ชันเอกสาร 1.0 — 23 กันยายน 2026 — จัดทำโดย GoAlong

---

## 1. ภาพรวม

- ระบบคิว **ไม่ดึงข้อมูลจาก AX** — ฝั่ง AX เป็นผู้ **ส่ง (push)** ใบสั่งขาย (SO) และใบสั่งซื้อ (PO) มาที่ REST API ของระบบคิวผ่าน HTTPS ในรูปแบบ JSON
- ระบบคิวใช้เอกสารเหล่านี้เพื่อ (1) ออกลิงก์/QR ให้ลูกค้าหรือผู้ขายจองคิวเข้าท่า (2) ตรวจการชำระเงินของ SO ก่อนอนุมัติคิวและออกใบ DO (3) แนะนำเวลาที่ท่าจากจำนวนรายการสินค้า
- ระบบคิว **ไม่ส่งสถานะคิวกลับไป AX** (นอกขอบเขตโครงการนี้)
- ส่งซ้ำได้เสมอ: เอกสารเลขที่เดิมจะถูก **อัปเดต** ไม่สร้างซ้ำ (idempotent บน `doc_no`)

```
Dynamics AX 2012 (AOS)  ──HTTPS POST JSON + X-API-Key──▶  https://<โดเมนระบบคิว>/api/integration/v1/sales-orders
                                                            https://<โดเมนระบบคิว>/api/integration/v1/purchase-orders
```

---

## 2. ขั้นตอนเริ่มต้น (checklist วันแรก)

| # | รายการ | ผู้รับผิดชอบ |
|---|---|---|
| 1 | ผู้ดูแลระบบคิวสร้าง **API key** ที่เมนู "เชื่อมต่อ ERP" แล้วส่งให้ทีม IT ทางช่องทางที่ปลอดภัย (key ขึ้นต้น `flq_` แสดงครั้งเดียว) | Fameline admin |
| 2 | ตั้งค่า **รหัสสาขา** ในระบบคิว (เมนู สาขา → ช่อง "รหัส") ให้ตรงกับ `InventSiteId` ของ AX ทุกคลังที่จะส่ง | Fameline admin + IT |
| 3 | AOS เรียก `GET /api/integration/v1/health` ด้วย key ได้ HTTP 200 → เครือข่าย/TLS/header ถูกต้อง | Fameline IT |
| 4 | ส่งตัวอย่าง 3–5 ใบด้วย `?dry_run=1` จน `failed = 0` | Fameline IT |
| 5 | ส่งจริง แล้วตรวจในระบบคิวว่าเอกสารขึ้น (แหล่งที่มา "API") | ทั้งสองฝ่าย |

### ข้อกำหนดการเชื่อมต่อจาก AX 2012 (สำคัญ)

- **TLS 1.2 เท่านั้น** — เซิร์ฟเวอร์ปลายทางไม่รับ TLS 1.0/1.1 ใน X++ ต้องตั้งก่อนเรียกทุกครั้ง:
  ```x++
  System.Net.ServicePointManager::set_SecurityProtocol(System.Net.SecurityProtocolType::Tls12);
  ```
  AOS ต้องมี .NET Framework 4.5 ขึ้นไป (หรือ 4.0 + registry `SchUseStrongCrypto`) — นี่คือสาเหตุอันดับหนึ่งของ "เชื่อมต่อไม่ได้"
- **UTF-8** — เขียน body ด้วย `System.Text.Encoding::get_UTF8()` (ห้าม TIS-620 / Windows-874) ไม่งั้นชื่อลูกค้า/สินค้าภาษาไทยเสีย
- **วันที่เป็นข้อความ `YYYY-MM-DD`** — ใช้ `date2str(d, 321, DateDay::Digits2, DateSeparator::Hyphen, DateMonth::Digits2, DateSeparator::Hyphen, DateYear::Digits4)`; ระบบรับ `YYYY-MM-DDTHH:mm:ss` ด้วย (ตัดเวลาทิ้ง) แต่ **ไม่รับ** รูปแบบ `/Date(1695340800000)/` ของ `JavaScriptSerializer`
- **ตัวเลขเป็น number** ไม่ใช่ข้อความที่มีลูกน้ำ (ระบบพยายามแปลง `"1,200"` ให้ แต่อย่าพึ่ง)
- ใช้ `System.Net.HttpWebRequest` (`Method = "POST"`, `ContentType = "application/json"`, `Headers.Add("X-API-Key", …)`) — ไม่แนะนำ AIF outbound port (ต้องทำ document service + adapter และได้ XML ที่ต้อง map อีกชั้น)
- ห้ามใส่ key ใน URL/query string และห้ามเขียน key ลง log

---

## 3. Endpoint

| Method | Path | ใช้ทำอะไร |
|---|---|---|
| `GET` | `/api/integration/v1/health` | ตรวจการเชื่อมต่อ + key (ไม่เขียนอะไร) |
| `POST` | `/api/integration/v1/sales-orders` | ส่งใบสั่งขาย (SO) — ลูกค้ามารับสินค้า |
| `POST` | `/api/integration/v1/purchase-orders` | ส่งใบสั่งซื้อ (PO) — ผู้ขายมาส่งสินค้า |

Header ทุกคำขอ:

| Header | ค่า |
|---|---|
| `X-API-Key` | key จากระบบคิว (`flq_…`) — หรือ `Authorization: Bearer flq_…` |
| `Content-Type` | `application/json` |
| `X-Request-Id` | (ไม่บังคับ) รหัสอ้างอิงฝั่ง AX ≤ 100 ตัวอักษร — ระบบส่งกลับและเก็บใน log เพื่อไล่ปัญหา |

Query string (ไม่บังคับ): `?dry_run=1` = ตรวจสอบและตอบผลรายเอกสารโดย **ไม่บันทึก**

ขีดจำกัดต่อคำขอ: **≤ 100 เอกสาร**, body **≤ 1 MB**, รายการสินค้า **≤ 500 บรรทัด/เอกสาร**

---

## 4. รูปแบบข้อมูล (payload)

```json
{
  "documents": [
    {
      "doc_no": "SO-2026-000123",
      "partner": { "code": "C00042", "name": "บริษัท ตัวอย่างการค้า จำกัด", "phone": "021234567", "email": "ap@example.co.th" },
      "doc_date": "2026-09-22",
      "due_date": "2026-09-25",
      "branch": "HQ",
      "status": "open",
      "payment_status": "credit",
      "remark": "ลูกค้ารับเองที่คลัง",
      "erp_status": "Backorder",
      "ax": { "SalesStatus": 1, "DocumentStatus": 1, "InventLocationId": "FG", "modifiedDateTime": "2026-09-22T02:15:00Z" },
      "items": [
        { "sku": "FL-1001", "name": "Aluminium Louver 600x600", "qty": 120, "uom": "PCS" },
        { "sku": "FL-2210", "name": "ระแนงอะลูมิเนียม สีเทา 3 ม.", "qty": 45.5, "uom": "M" }
      ]
    }
  ]
}
```

| ฟิลด์ | บังคับ | ชนิด | คำอธิบาย |
|---|---|---|---|
| `doc_no` | ✅ | string ≤ 60 | เลขที่เอกสารตาม AX **ตรงตัว** (case-sensitive) — เป็นกุญแจอัปเดต |
| `partner.code` | ✅ | string ≤ 60 | รหัสลูกค้า / รหัสผู้ขายใน AX — ระบบจับคู่คู่ค้าด้วยรหัสนี้เท่านั้น |
| `partner.name` | ✅ | string ≤ 200 | ชื่อ **master** ของลูกค้า/ผู้ขาย (ไม่ใช่ชื่อบนใบ) — ค่านี้จะทับชื่อคู่ค้าในระบบคิวทุกครั้ง |
| `partner.phone` | — | string ≤ 30 | เบอร์หลัก; ส่งเฉพาะที่มี |
| `partner.email` | — | string ≤ 200 | ส่งเฉพาะที่ถูกรูปแบบ (ผิดรูปแบบ = ระบบทิ้งค่านี้ ไม่ทิ้งทั้งใบ) |
| `branch` | ✅ | string ≤ 80 | รหัสสาขา/คลัง = `branches.code` ในระบบคิว (ตกลงกันว่า = AX `InventSiteId`) ไม่ตรง = เอกสารนั้น `unknown_branch` |
| `doc_date` | — | `YYYY-MM-DD` | วันที่เอกสาร (เวลาไทย) |
| `due_date` | — | `YYYY-MM-DD` | วันกำหนดรับ/ส่งของ — แสดงให้ลูกค้าและพนักงาน ไม่ได้บังคับวันจอง |
| `status` | — | `open` \| `cancelled` | ไม่ส่ง = `open` |
| `payment_status` | SO เท่านั้น | `paid` \| `credit` \| `unpaid` | ดูข้อ 7; ไม่ส่ง = ไม่แตะค่าเดิม; PO ไม่ใช้ |
| `remark` | — | string ≤ 500 | **ลูกค้าเห็นบนลิงก์จอง** — ห้ามใส่วงเงิน/ยอดค้าง/ข้อมูลการเงิน |
| `erp_status` | — | string ≤ 40 | ชื่อสถานะใน AX เพื่อการ support (ไม่ถูกตีความ) |
| `ax` | — | object | ฟิลด์เสริมใด ๆ ของ AX — เก็บไว้ดูย้อนหลัง ไม่ถูกตีความ |
| `items[]` | ✅ (ว่างได้) | array ≤ 500 | รายการสินค้าที่ **ยังต้องรับ/ส่ง** |
| `items[].sku` | — | string ≤ 80 | รหัสสินค้า |
| `items[].name` | ✅ | string ≤ 300 | ชื่อสินค้า (ว่าง = ระบบใช้ sku แทน; ทั้งคู่ว่าง = บรรทัดนั้นถูกตัด) |
| `items[].qty` | ✅ | number > 0 | จำนวนที่ยังต้องรับ/ส่ง (ทศนิยมได้) — ≤ 0 = บรรทัดถูกตัดทิ้ง |
| `items[].uom` | — | string ≤ 30 | หน่วย |

---

## 5. ผลลัพธ์ (response)

**HTTP 200 เสมอเมื่อคำขอถูกประมวลผล** แม้บางเอกสารจะไม่สำเร็จ — ให้ AX อ่านผลรายเอกสารใน `results[]` (ลำดับเดียวกับที่ส่ง)

```json
{
  "data": {
    "request_id": "AX-20260922-0001",
    "doc_type": "so",
    "dry_run": false,
    "received": 3, "created": 1, "updated": 1, "failed": 1,
    "results": [
      { "doc_no": "SO-2026-000123", "status": "created", "id": "5c1e…" },
      { "doc_no": "SO-2026-000124", "status": "updated", "id": "9a0b…", "warnings": ["payment_downgrade_ignored"] },
      { "doc_no": "SO-2026-000125", "status": "failed", "code": "unknown_branch", "message": "ไม่พบสาขา \"WH9\"" }
    ]
  }
}
```

`results[].status`: `created` สร้างใหม่ · `updated` อัปเดต · `valid` (เฉพาะ dry run) · `failed`

| รหัสข้อผิดพลาดรายเอกสาร (`code`) | ความหมาย | ฝั่ง AX ควรทำ |
|---|---|---|
| `validation_error` | ฟิลด์ผิดรูปแบบ (`message` บอกฟิลด์) | แก้ mapping แล้วส่งใหม่ |
| `unknown_branch` | `branch` ไม่ตรงรหัสสาขาในระบบคิว | ตรวจรหัสสาขา / แจ้ง admin เพิ่มสาขา |
| `has_live_bookings` | ส่ง `cancelled` แต่ยังมีคิวที่ยังไม่ปิด — ระบบแจ้งพนักงานคลังแล้ว | ไม่ต้องทำอะไร — รอบ resync ถัดไปจะสำเร็จเมื่อพนักงานยกเลิกคิว |
| `branch_locked` | เปลี่ยนสาขาของใบที่ยังมีคิวค้าง — ระบบแจ้งพนักงานคลังแล้ว | เหมือนข้างบน |
| `db_error` | ผิดพลาดภายใน | ส่งซ้ำในรอบถัดไป; ถ้าซ้ำติดต่อ GoAlong |

`warnings[]` (สำเร็จแต่มีเงื่อนไข): `payment_downgrade_ignored` (ดูข้อ 7) · `completed_kept` (ใบปิดงานแล้ว สถานะไม่เปลี่ยน) · `no_items` (ใบใหม่ไม่มีรายการสินค้า)

**สถานะ HTTP อื่น** (ไม่มี `results`):

| HTTP | `code` | ความหมาย |
|---|---|---|
| 400 | `invalid_body` | ไม่ใช่ JSON / ไม่มี `documents` / เกิน 100 ใบ |
| 401 | `invalid_api_key` / `api_key_revoked` | key ผิด หรือถูกเพิกถอน |
| 403 | `insufficient_scope` | key ไม่มีสิทธิ์ส่งเอกสาร |
| 413 | `payload_too_large` | body เกิน 1 MB |
| 5xx | — | ระบบขัดข้อง — retry |

**กติกา retry ฝั่ง AX:** 2xx = อ่าน `results` (ไม่ retry ทันทีแม้มี `failed` เพราะเป็น business error — แต่ต้อง **แจ้งเตือน** ผู้ดูแลเมื่อ `failed > 0`) · 5xx / timeout / เชื่อมต่อไม่ได้ = retry ด้วย backoff 1, 5, 15 นาที แล้วปล่อยให้รอบ resync กลางคืนเก็บตก · 4xx = หยุดและแจ้งผู้ดูแล (ต้องแก้ config)

---

## 6. การ map ข้อมูลจาก AX 2012

### 6.1 ใบสั่งขาย (SalesTable / SalesLine)

| ฟิลด์ payload | แหล่งใน AX 2012 | หมายเหตุ |
|---|---|---|
| `doc_no` | `SalesTable.SalesId` | ห้าม reset number sequence ข้ามปีจนเลขซ้ำ (ถ้าเลี่ยงไม่ได้ให้ใส่ปีในเลขที่ และคงที่ตลอดอายุใบ) |
| `partner.code` | `SalesTable.CustAccount` | ผู้สั่ง = ผู้มารับ (ไม่ใช้ `InvoiceAccount`) |
| `partner.name` | `DirPartyTable.Name` ของ `CustTable` | ชื่อ master ไม่ใช่ `SalesName` (ชื่อบนใบแก้รายใบได้) |
| `partner.phone` / `email` | `LogisticsElectronicAddress` (Phone / Email, IsPrimary) ของ party | ไม่บังคับ |
| `branch` | `SalesTable.InventSiteId` | ต้องตรง `branches.code`; ถ้าบรรทัดต่าง site ใช้ site ของบรรทัดแรกที่ยังค้างส่ง + ใส่ remark |
| `doc_date` | `SalesTable.createdDateTime` → `DateTimeUtil::applyTimeZoneOffset` (+07:00) → date | createdDateTime เป็น UTC ต้อง offset ก่อนตัดวัน |
| `due_date` | `ShippingDateConfirmed` ถ้ามี ไม่งั้น `ShippingDateRequested` | วันของออกจากคลัง (ไม่ใช่ ReceiptDate) |
| `status` | `SalesStatus = Canceled` → `cancelled`, อื่น ๆ → `open` | ดู 6.3 |
| `payment_status` | คำนวณตามข้อ 7 | |
| `remark` | `DeliveryName` (ถ้าต่างจากชื่อลูกค้า), ชื่อ `DlvMode`, `CustomerRef` | ลูกค้าเห็น |
| `erp_status` | `enum2str(SalesStatus)` | |
| `items[]` | `SalesLine` ที่ `SalesId` ตรง เรียง `LineNum` | กรองตาม 6.4 |
| `items[].sku` | `SalesLine.ItemId` | |
| `items[].name` | `SalesLine.Name` (fallback ชื่อสินค้าจาก `InventTable`, fallback `ItemId`) | |
| `items[].qty` | `SalesLine.RemainSalesPhysical` | จำนวนที่ **ยังต้องมารับ** (ไม่ใช่ `SalesQty`) — ใส่ `SalesQty` ใน `ax` ได้ |
| `items[].uom` | `SalesLine.SalesUnit` | |

### 6.2 ใบสั่งซื้อ (PurchTable / PurchLine)

| ฟิลด์ payload | แหล่งใน AX 2012 |
|---|---|
| `doc_no` | `PurchTable.PurchId` |
| `partner.code` | `PurchTable.OrderAccount` (ผู้ส่งของ) |
| `partner.name` | `DirPartyTable.Name` ของ `VendTable` |
| `branch` | `PurchTable.InventSiteId` |
| `doc_date` | `PurchTable.createdDateTime` → +07:00 → date |
| `due_date` | `PurchTable.DeliveryDate`; ถ้าบรรทัดต่างกัน ใช้วัน **เร็วสุด** ของบรรทัดที่ยังค้างรับ |
| `status` | `PurchStatus = Canceled` → `cancelled`, อื่น ๆ → `open` |
| `payment_status` | **ไม่ต้องส่ง** |
| `items[]` | `PurchLine.ItemId` / `Name` / `RemainPurchPhysical` / `PurchUnit` |

### 6.3 เมื่อไหร่ต้องส่ง (push gate ฝั่ง AX)

| ประเภท | ส่งเมื่อ | ไม่ส่ง |
|---|---|---|
| SO | `SalesType = Sales` **และ** `DocumentStatus ∈ {Confirmation, PickingList, PackingSlip, Invoice}` (เคยยืนยันแล้ว) **หรือ** `SalesStatus = Canceled` ของใบที่เคยส่ง | ใบที่ยังไม่ Confirm (`DocumentStatus = None`), quotation, `Journal`, `Blanket`, `ItemReq`, `Subscription`, **`ReturnItem`** |
| PO | `PurchaseType = Purch` **และ** `DocumentState = Confirmed` **หรือ** `PurchStatus = Canceled` ของใบที่เคยส่ง | `Draft / InReview / Rejected / Approved`, `Journal`, `Blanket`, `ReturnItem` |

เหตุผล: ก่อน confirm จำนวน/วัน/ราคายังเปลี่ยนได้ ถ้าส่งมาก่อน พนักงานจะออกลิงก์จองบนของที่ยังไม่แน่นอน

**การลบใบใน AX** (ไม่ใช่ cancel) ต้อง hook `delete` แล้วส่ง `status: "cancelled"` มาด้วย ไม่งั้นใบจะค้างเปิดในระบบคิวตลอด

**สถานะที่ระบบคิวไม่รับจาก AX:** ระบบคิวมีสถานะเอกสาร `open → booked (มีคิว) → completed (คลังปิดเอง)` — AX ส่ง `Delivered`/`Invoiced` = ยังเป็น `open` (ส่ง `items` ที่เหลือ + `payment_status`) ระบบ**ไม่**ปิดใบให้อัตโนมัติ, ใบที่ `booked` แล้วจะไม่ถอยกลับเป็น `open` เมื่อส่งซ้ำ, และถ้าพนักงานยกเลิกใบในระบบคิวเองแต่ AX ยัง open รอบ resync จะเปิดกลับ → **ยกเลิกต้องทำใน AX**

### 6.4 กรองรายการสินค้าฝั่ง AX

ตัดบรรทัดต่อไปนี้ออกก่อนส่ง (ระบบกรองซ้ำให้ แต่ควรตัดที่ต้นทาง):
- `RemainSalesPhysical` / `RemainPurchPhysical` ≤ 0 (รับ/ส่งครบแล้ว)
- บรรทัดที่ถูกยกเลิก (`SalesLine.SalesStatus = Canceled`)
- สินค้าประเภทบริการ / ไม่มีสต็อก (ค่าขนส่ง ค่าติดตั้ง) — ไม่มีของให้หยิบ
- บรรทัดที่ไม่มีทั้งชื่อและรหัสสินค้า

รหัสสินค้าซ้ำหลายบรรทัดส่งเป็นคนละบรรทัดได้ (ระบบไม่รวม) · เมื่อทุกบรรทัดหมดให้ส่ง `"items": []` พร้อม `status: "open"` ระบบจะเก็บใบไว้ให้พนักงานปิดเอง

---

## 7. สถานะการชำระเงินของ SO (`payment_status`)

ระบบคิว **ไม่อนุมัติคิวและไม่ออกใบ DO** ให้ SO ที่ `unpaid` — ค่านี้จึงสำคัญที่สุดในการเชื่อมต่อ

| ลำดับตรวจ | เงื่อนไขใน AX | ส่ง |
|---|---|---|
| 1 | ใบแจ้งหนี้ทั้งหมดของ SO ถูก settle ครบ (`CustTrans` ไม่มียอดค้าง) **หรือ** มี prepayment/มัดจำที่ mark กับ SO ครอบคลุม 100% | `paid` |
| 2 | ไม่เข้าข้อ 1 **และ** `CustTable.PaymTermId` เป็นเทอมเครดิตที่ finance กำหนด (ไม่ใช่ COD/เงินสด) **และ** ลูกค้าไม่ถูก `Blocked` **และ** ไม่เกินวงเงิน (`CreditMax`) | `credit` |
| 3 | อื่น ๆ ทั้งหมด (เงินสดยังไม่จ่าย, จ่ายบางส่วน, blocked, เกินวงเงิน, COD) | `unpaid` |

**กติกาสำคัญ — AX ลดสถานะไม่ได้:** ถ้าระบบคิวมีค่า `paid` หรือ `credit` อยู่แล้ว (เช่น พนักงานคลังตรวจสลิปแล้วบันทึกเอง) การส่ง `unpaid` จาก AX จะ **ถูกเพิกเฉย** และตอบ `warnings: ["payment_downgrade_ignored"]` — เพราะ AX 2012 ออกใบแจ้งหนี้หลังของออกจากคลัง จึงตามหลังเงินสด/สลิปเสมอ · ส่ง `paid` ↔ `credit` สลับกันได้ · ไม่ส่งฟิลด์ = ไม่แตะค่าเดิม

**คำถามที่ต้องยืนยันกับฝ่ายการเงิน Fameline ก่อนใช้งานจริง:**
1. ลูกค้าเงินสดที่มารับของ **ก่อน** AX ออกใบแจ้งหนี้ — ใครเป็นผู้ยืนยัน "จ่ายแล้ว": บัญชีบันทึก prepayment ใน AX ทันเวลา หรือพนักงานคลัง/ฝ่ายขายกดในระบบคิว?
2. มัดจำบางส่วน (เช่น ≥ 50%) ถือว่าปล่อยของได้หรือไม่ — ถ้าได้ AX คำนวณเป็น `paid` เอง
3. ลูกค้าเครดิตที่ค้างเกินกำหนดแต่ยังไม่ blocked — ให้ `credit` (ค่าเริ่มต้น) หรือ `unpaid`?

---

## 8. จังหวะการส่ง (cadence)

| แบบ | เมื่อไหร่ | รายละเอียด |
|---|---|---|
| Event (ทันที ≤ 1 นาที) | SO: post Confirmation, แก้ไข+re-confirm, post PackingSlip, post Invoice, cancel/delete · PO: DocumentState → Confirmed, แก้ไข+re-confirm, post ProductReceipt, cancel/delete | ใส่คิวฝั่ง AX แล้ว batch job ส่งทุก 1 นาที ทีละ ≤ 100 ใบ |
| Payment sweep | ทุก 1 ชั่วโมง ในเวลาทำการ | SO เปิดที่ `payment_status` เปลี่ยนจากครั้งก่อน (หรือส่งทั้งหมดในหน้าต่างก็ได้ เพราะ idempotent) — settlement เกิดใน journal ไม่ใช่ที่ SO จึง hook ยาก |
| Nightly full resync | 02:00 เวลาไทย | ทุก SO/PO ที่ผ่าน push gate และ `due_date` อยู่ใน `[วันนี้ − 14, วันนี้ + 45]` **บวก** ทุกใบที่ `modifiedDateTime` ภายใน 3 วัน (จับ cancel/ลบ/payment ที่ event พลาด) · ใบ `cancelled` ที่ถูกตอบ `has_live_bookings` ส่งซ้ำได้ทุกคืนจนสำเร็จ |

- ต่อ `doc_no` เดียวกัน ส่งตาม **ลำดับเวลา** (single-thread หรือคิวต่อใบ) — ระบบใช้ค่าล่าสุดที่มาถึง
- คำขอเดียวกันส่งซ้ำกี่ครั้งก็ได้ ผลเหมือนเดิม ไม่สร้างซ้ำ ไม่แจ้งเตือนซ้ำ
- การนำเข้าครั้งแรก (initial load): ทดสอบด้วย `dry_run` ก่อน แล้วส่งจริงนอกเวลาทำการ ทีละ 100 ใบ

---

## 9. ข้อควรรู้ / ข้อจำกัด

- `doc_no` เป็น case-sensitive และเทียบตรงตัว — ส่งค่าจากฐานข้อมูล AX โดยไม่แก้ไข
- ก่อนเริ่มใช้งานจริง ผู้ดูแลระบบคิวต้องกรอก **รหัสคู่ค้า** ให้คู่ค้าที่เคยสร้างจาก CSV/มือ ไม่งั้นการส่งครั้งแรกจะสร้างคู่ค้าใหม่ (ชื่อซ้ำ 2 แถว)
- AX เปลี่ยนชื่อลูกค้า → ชื่อคู่ค้าในระบบคิวเปลี่ยนตาม (AX เป็น master) · AX รวม/เปลี่ยนรหัสลูกค้า → ระบบมองเป็นคู่ค้าใหม่
- AX เพิ่ม/ลดรายการหลังคิวถูกอนุมัติแล้ว → เวลาที่ท่าของคิวนั้น **ไม่** เปลี่ยนอัตโนมัติ (พนักงานปรับเอง) และใบ DO ที่พิมพ์ซ้ำจะแสดงรายการปัจจุบัน
- AX เปลี่ยน `due_date` → ระบบเก็บค่าใหม่ แต่ไม่ย้ายคิวที่จองไว้และไม่แจ้งเตือน
- ลิงก์จองของลูกค้ามีอายุตามที่ตั้งค่า (ค่าเริ่มต้น 7 วัน) — SO ที่รับหลายเที่ยวอาจต้องออกลิงก์ใหม่จากระบบคิว
- ระบบเก็บ payload ต้นฉบับของทุกใบ (`raw`) และ log ทุกคำขอ 90 วัน (นับผล + เอกสารที่ตก 50 รายการแรก ไม่เก็บ payload) — ดูได้ที่เมนู "เชื่อมต่อ ERP"

---

## 10. ตัวอย่างและเครื่องมือทดสอบ

- ตัวอย่าง payload: `docs/integration/samples/sales-orders.json`, `docs/integration/samples/purchase-orders.json` (แต่ละไฟล์มี 1 ใบที่ตั้งใจให้ผิด เพื่อดูผลรายเอกสาร)
- ทดสอบด้วย curl:

```bash
# 1) ตรวจการเชื่อมต่อ
curl -H "X-API-Key: flq_..." https://<โดเมน>/api/integration/v1/health

# 2) ตรวจข้อมูลโดยไม่บันทึก
curl -X POST -H "X-API-Key: flq_..." -H "Content-Type: application/json" \
     --data-binary @sales-orders.json "https://<โดเมน>/api/integration/v1/sales-orders?dry_run=1"

# 3) ส่งจริง
curl -X POST -H "X-API-Key: flq_..." -H "Content-Type: application/json" \
     -H "X-Request-Id: AX-TEST-0001" \
     --data-binary @sales-orders.json https://<โดเมน>/api/integration/v1/sales-orders
```

- โครง X++ (แนวทาง):

```x++
static void pushSalesOrders(str json)
{
    System.Net.HttpWebRequest  req;
    System.Net.HttpWebResponse resp;
    System.IO.StreamWriter     writer;
    System.IO.StreamReader     reader;
    System.Byte[]              bytes;
    str                        body;

    System.Net.ServicePointManager::set_SecurityProtocol(System.Net.SecurityProtocolType::Tls12);
    req = System.Net.WebRequest::Create("https://<โดเมน>/api/integration/v1/sales-orders");
    req.set_Method("POST");
    req.set_ContentType("application/json");
    req.get_Headers().Add("X-API-Key", "flq_...");   // อ่านจาก parameter table ห้าม hardcode
    req.set_Timeout(60000);

    bytes = System.Text.Encoding::get_UTF8().GetBytes(json);
    req.set_ContentLength(bytes.get_Length());
    req.GetRequestStream().Write(bytes, 0, bytes.get_Length());

    resp   = req.GetResponse();                       // non-2xx → WebException → retry ตามข้อ 5
    reader = new System.IO.StreamReader(resp.GetResponseStream(), System.Text.Encoding::get_UTF8());
    body   = reader.ReadToEnd();                      // parse data.results[] แล้ว alert เมื่อ failed > 0
}
```

ติดต่อ GoAlong เมื่อพบ `db_error` ซ้ำ หรือต้องการเพิ่มฟิลด์/สถานะ (เปลี่ยนแปลงแบบเพิ่มเติมจะอยู่ใน v1; แบบไม่เข้ากันจะออกเป็น v2 คู่ขนาน)
