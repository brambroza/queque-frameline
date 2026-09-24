import type { BookingDirection } from '@/types/db';

/** Everything the DO prints. Plain data so the portal, customer page and driver page can all feed it. */
export type DoDocumentData = {
  siteName: string;
  doNumber: string | null;
  queueNumber: string;
  direction: BookingDirection;
  docNo: string | null;
  partnerName: string | null;
  bookingDate: string;
  startTime: string;
  endTime: string | null;
  dockName: string | null;
  vehicleType: string | null;
  plate: string | null;
  driverName: string | null;
  driverPhone: string | null;
  receiverName: string | null;
  receiverPhone: string | null;
  note: string | null;
  issuedAt: string | null;
  items: Array<{ sku?: string | null; name: string; qty: number; uom?: string | null }>;
  /** Close sign-off captured on the tablet; a party is absent when nobody signed. */
  signatures?: { staff?: DoSignature | null; customer?: DoSignature | null } | null;
  /** When the sign-off was captured (ISO). */
  signedAt?: string | null;
};

/** One printed signature: the PNG (same-origin URL or data URL) and the typed name. */
export type DoSignature = { name: string; imageUrl: string };

const cell: React.CSSProperties = { border: '1px solid #cbd5e1', padding: '6px 8px', fontSize: 13, verticalAlign: 'top' };
const head: React.CSSProperties = { ...cell, background: '#f1f5f9', fontWeight: 600, textAlign: 'left' };
const label: React.CSSProperties = { fontSize: 11, color: '#64748b' };
const value: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: '#0f172a' };

function thaiDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y + 543}`;
}

function Field({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={label}>{k}</div>
      <div style={value}>{v || '-'}</div>
    </div>
  );
}

/**
 * Delivery order sheet. Inline styles only (no MUI / Tailwind) so the same
 * markup renders in the portal, on the public token pages and in the print
 * window with identical Thai typography.
 */
export function DoDocument({ data, qr }: { data: DoDocumentData; qr?: React.ReactNode }) {
  const outbound = data.direction === 'outbound';
  return (
    <div style={{ background: '#fff', color: '#0f172a', padding: 24, fontFamily: 'var(--font-sans), Kanit, sans-serif', maxWidth: 794, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{outbound ? 'ใบรับสินค้า / Delivery Order' : 'ใบนัดส่งสินค้า / Inbound Delivery'}</div>
          <div style={{ fontSize: 13, color: '#475569' }}>{data.siteName}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={label}>เลขที่ DO</div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 0.5 }}>{data.doNumber ?? 'รอยืนยัน'}</div>
          <div style={{ fontSize: 12, color: '#475569' }}>{data.issuedAt ? `ออกเมื่อ ${thaiDate(data.issuedAt)}` : ''}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 16, alignItems: 'stretch' }}>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          <Field k={outbound ? 'ลูกค้า' : 'ผู้ขาย (Supplier)'} v={data.partnerName} />
          <Field k={outbound ? 'เลขที่ SO' : 'เลขที่ PO'} v={data.docNo} />
          <Field k="วันที่นัด" v={thaiDate(data.bookingDate)} />
          <Field k="เวลา" v={`${data.startTime.slice(0, 5)}${data.endTime ? ` – ${data.endTime.slice(0, 5)}` : ''} น.`} />
          <Field k="ท่า (Dock)" v={data.dockName} />
          <Field k="ประเภทรถ" v={data.vehicleType} />
          <Field k="ทะเบียนรถ" v={data.plate} />
          <Field k="คนขับ" v={[data.driverName, data.driverPhone].filter(Boolean).join(' · ')} />
          <Field k={outbound ? 'ผู้รับสินค้า' : 'ผู้ติดต่อ'} v={[data.receiverName, data.receiverPhone].filter(Boolean).join(' · ')} />
          <Field k="หมายเหตุ" v={data.note} />
        </div>
        <div style={{ width: 170, border: '2px solid #0f172a', borderRadius: 8, padding: 10, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <div style={label}>เลขคิว</div>
          <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1 }}>{data.queueNumber}</div>
          {qr}
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
        <thead>
          <tr>
            <th style={{ ...head, width: 40, textAlign: 'center' }}>#</th>
            <th style={{ ...head, width: 120 }}>รหัสสินค้า</th>
            <th style={head}>รายการ</th>
            <th style={{ ...head, width: 90, textAlign: 'right' }}>จำนวน</th>
            <th style={{ ...head, width: 70 }}>หน่วย</th>
          </tr>
        </thead>
        <tbody>
          {data.items.length === 0 ? (
            <tr><td style={{ ...cell, textAlign: 'center', color: '#64748b' }} colSpan={5}>ตามเอกสารแนบ</td></tr>
          ) : data.items.map((it, i) => (
            <tr key={`${it.sku ?? ''}-${i}`}>
              <td style={{ ...cell, textAlign: 'center' }}>{i + 1}</td>
              <td style={cell}>{it.sku || '-'}</td>
              <td style={cell}>{it.name}</td>
              <td style={{ ...cell, textAlign: 'right' }}>{Number(it.qty).toLocaleString('th-TH')}</td>
              <td style={cell}>{it.uom || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginTop: 36 }}>
        {([
          [outbound ? 'ผู้รับสินค้า' : 'ผู้ส่งสินค้า', data.signatures?.customer ?? null],
          ['เจ้าหน้าที่คลัง', data.signatures?.staff ?? null],
          ['เจ้าหน้าที่ รปภ.', null],
        ] as Array<[string, DoSignature | null]>).map(([who, sig]) => (
          <div key={who} style={{ textAlign: 'center', fontSize: 12, color: '#475569' }}>
            <div style={{ borderBottom: '1px dotted #64748b', height: 48, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- print sheet uses inline markup only; the PNG is tiny and same-origin */}
              {sig ? <img src={sig.imageUrl} alt={`ลายเซ็น ${who}`} style={{ maxHeight: 46, maxWidth: '100%', objectFit: 'contain' }} /> : null}
            </div>
            <div style={{ marginTop: 6 }}>{sig ? <span style={{ color: '#0f172a', fontWeight: 600 }}>{sig.name}</span> : who}</div>
            <div>{sig ? `${who} · ${data.signedAt ? thaiDate(data.signedAt) : ''}` : 'วันที่ ....../....../......'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
