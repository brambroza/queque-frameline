/**
 * Success toast wording for the queue status buttons, shared by the queue
 * list (`bookings-crud`) and the queue board so both pages say the same thing.
 * Pattern: "<verb> <queue> แล้ว" — one line, names the queue, never a bare "สำเร็จ".
 */

export type StatusToastKind = 'confirm' | 'arrive' | 'call' | 'recall' | 'uncall' | 'serve' | 'done' | 'no_show' | 'cancel' | 'other';

export type StatusToastInput = {
  kind: StatusToastKind;
  queueNumber: string;
  /** Dock the queue is on / was called to. */
  resourceName?: string | null;
  /** DO issued on approval. */
  doNumber?: string | null;
  /** Walk-in approved on the same day was checked in right away. */
  checkedIn?: boolean;
  /** Completion carried at least one signature. */
  signed?: boolean;
};

/** Map a status transition to the toast kind when the caller only knows the target status. */
export function kindForStatusChange(from: string, to: string): StatusToastKind {
  switch (to) {
    case 'confirmed':
      return 'confirm';
    case 'checked_in':
      return from === 'called' ? 'uncall' : 'arrive';
    case 'called':
      return from === 'called' ? 'recall' : 'call';
    case 'serving':
      return 'serve';
    case 'completed':
      return 'done';
    case 'no_show':
      return 'no_show';
    case 'cancelled':
      return 'cancel';
    default:
      return 'other';
  }
}

export function statusSuccessMessage(input: StatusToastInput): string {
  const q = input.queueNumber || 'คิว';
  const dock = input.resourceName?.trim() ? `ท่า ${input.resourceName.trim()}` : 'ท่า';
  switch (input.kind) {
    case 'confirm': {
      const parts = [`อนุมัติคิว ${q} แล้ว`];
      if (input.doNumber) parts.push(input.doNumber);
      if (input.checkedIn) parts.push('เช็คอิน Walk-in แล้ว');
      return parts.join(' · ');
    }
    case 'arrive':
      return `เช็คอิน ${q} แล้ว — รอเรียกเข้าท่า`;
    case 'call':
    case 'recall':
      return `เรียก ${q} เข้า${dock}แล้ว`;
    case 'uncall':
      return `ยกเลิกการเรียก ${q} แล้ว — กลับไปรอในลาน`;
    case 'serve':
      return `เริ่มขึ้น/ลงของ ${q} แล้ว`;
    case 'done':
      return input.signed ? `ปิดงาน ${q} พร้อมลายเซ็นแล้ว` : `ปิดงาน ${q} แล้ว`;
    case 'no_show':
      return `บันทึก ${q} ไม่มาแล้ว — ท่าว่างให้คิวถัดไป`;
    case 'cancel':
      return `ยกเลิกคิว ${q} แล้ว`;
    default:
      return `อัปเดตสถานะ ${q} แล้ว`;
  }
}
