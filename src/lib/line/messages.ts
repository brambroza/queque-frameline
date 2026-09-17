import { reminderLeadLabel } from '@/lib/line/booking-reminder';

export function quickReply(items: Array<{ label: string; text: string }>) {
  return {
    items: items.slice(0, 13).map((x) => ({
      type: 'action',
      action: { type: 'message', label: x.label.slice(0, 20), text: x.text },
    })),
  };
}

export function slotMessage(dateLabel: string, slots: string[]) {
  const times = slots.length ? slots.join(', ') : '-';
  return {
    type: 'text',
    text: `วันนี้มีคิวว่างดังนี้ค่ะ\n${times}\n\nต้องการจองเวลาไหนคะ? (${dateLabel})`,
    quickReply: quickReply([
      ...slots.slice(0, 4).map((s) => ({ label: s, text: `จองคิว ${dateLabel} ${s}` })),
      { label: 'ดูวันพรุ่งนี้', text: 'คิวว่างพรุ่งนี้' },
    ]),
  };
}

export function fallbackMessage() {
  return {
    type: 'text',
    text: 'ต้องการทำรายการใดคะ?',
    quickReply: quickReply([
      { label: 'ดูคิวว่าง', text: 'คิวว่างวันนี้' },
      { label: 'จองคิว', text: 'จองคิว' },
      { label: 'เช็คคิวของฉัน', text: 'เช็คคิวของฉัน' },
      { label: 'ติดต่อเจ้าหน้าที่', text: 'ติดต่อเจ้าหน้าที่' },
    ]),
  };
}

export function bookingConfirmMessage(payload: {
  queueNumber: string;
  branch: string;
  service: string;
  date: string;
  time: string;
  assignedTo?: string | null;
  assignedLabel?: string | null;
}) {
  const assignedLine = payload.assignedTo ? `\n${payload.assignedLabel || 'ผู้ให้บริการ'}: ${payload.assignedTo}` : '';
  return {
    type: 'text',
    text: `จองคิวสำเร็จค่ะ\nเลขคิว: ${payload.queueNumber}\nสาขา: ${payload.branch}\nบริการ: ${payload.service}${assignedLine}\nวันที่: ${payload.date}\nเวลา: ${payload.time}\n\nกรุณามาก่อนเวลาประมาณ 10 นาทีค่ะ`,
  };
}

export function bookingConfirmFlex(payload: {
  shopName: string;
  queueNumber: string;
  branch: string;
  service: string;
  date: string;
  time: string;
  /** Trainer / stylist / table assigned to this booking, when the shop uses resources. */
  assignedTo?: string | null;
  /** Thai label matching the resource type, e.g. "เทรนเนอร์". */
  assignedLabel?: string | null;
  liffUrl?: string;
  /** True when the service needs shop approval: header + note say "รอร้านยืนยัน" instead of "สำเร็จ". */
  pendingApproval?: boolean;
}) {
  const title = payload.pendingApproval ? 'รับคำขอจองแล้ว' : 'จองคิวสำเร็จ';
  const headerColor = payload.pendingApproval ? '#d97706' : '#12a862';
  const note = payload.pendingApproval
    ? 'คิวนี้รอร้านตรวจสอบและยืนยัน ร้านจะแจ้งผลผ่าน LINE อีกครั้ง'
    : 'กรุณามาก่อนเวลาประมาณ 10 นาที';
  const footerButtons: Array<Record<string, unknown>> = [
    {
      type: 'button',
      style: 'secondary',
      height: 'sm',
      action: { type: 'message', label: 'ดูคิวของฉัน', text: 'เช็คคิวของฉัน' },
    },
    {
      type: 'button',
      style: 'secondary',
      height: 'sm',
      action: { type: 'message', label: 'ยกเลิกคิว', text: 'ยกเลิกคิว' },
    },
  ];
  if (payload.liffUrl) {
    footerButtons.push({
      type: 'button',
      style: 'primary',
      color: '#12a862',
      height: 'sm',
      action: { type: 'uri', label: 'เปิด LIFF อีกครั้ง', uri: payload.liffUrl },
    });
  }

  return {
    type: 'flex',
    altText: `${title} เลขคิว ${payload.queueNumber}`,
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: headerColor,
        paddingAll: '16px',
        contents: [
          { type: 'text', text: payload.shopName, color: '#ffffffcc', size: 'xs' },
          { type: 'text', text: title, color: '#ffffff', weight: 'bold', size: 'xl', margin: 'sm' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          { type: 'text', text: `เลขคิว ${payload.queueNumber}`, weight: 'bold', size: 'lg', color: '#111827' },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'md',
            spacing: 'sm',
            contents: [
              { type: 'text', text: `สาขา: ${payload.branch}`, size: 'sm', color: '#374151', wrap: true },
              { type: 'text', text: `บริการ: ${payload.service}`, size: 'sm', color: '#374151', wrap: true },
              ...(payload.assignedTo
                ? [{
                    type: 'text',
                    text: `${payload.assignedLabel || 'ผู้ให้บริการ'}: ${payload.assignedTo}`,
                    size: 'sm',
                    color: '#374151',
                    wrap: true,
                  }]
                : []),
              { type: 'text', text: `วันที่: ${payload.date}`, size: 'sm', color: '#374151' },
              { type: 'text', text: `เวลา: ${payload.time}`, size: 'sm', color: '#374151' },
            ],
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            backgroundColor: '#f3f4f6',
            cornerRadius: '10px',
            paddingAll: '10px',
            contents: [
              { type: 'text', text: note, size: 'xs', color: '#4b5563', wrap: true },
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: footerButtons,
      },
    },
  };
}

/**
 * Flex pushed when staff approve a booking that was waiting for approval
 * (`pending_approval` → `confirmed`). Same shape as the confirmation so the
 * customer sees one familiar card.
 */
export function bookingApprovedFlex(payload: {
  shopName: string;
  queueNumber: string;
  branch: string;
  service: string;
  date: string;
  time: string;
  assignedTo?: string | null;
  assignedLabel?: string | null;
  liffUrl?: string;
}) {
  const flex = bookingConfirmFlex(payload);
  const header = flex.contents.header.contents[1] as { text: string };
  header.text = 'ร้านยืนยันคิวของคุณแล้ว';
  flex.altText = `ร้านยืนยันคิว ${payload.queueNumber} — ${payload.date} ${payload.time}`;
  return flex;
}

/**
 * Flex pushed when staff press "เรียกคิว": it is the customer's turn now.
 * `callCount` > 1 marks a repeat call so the customer knows the shop is waiting.
 */
export function bookingCalledFlex(payload: {
  shopName: string;
  queueNumber: string;
  branch: string;
  service: string;
  /** Person / room / table to go to, when assigned. */
  assignedTo?: string | null;
  assignedLabel?: string | null;
  callCount: number;
  liffUrl?: string;
}) {
  const repeat = payload.callCount > 1;
  const title = repeat ? `เรียกคิวของคุณอีกครั้ง (ครั้งที่ ${payload.callCount})` : 'ถึงคิวของคุณแล้ว';
  const bodyRows: Array<Record<string, unknown>> = [
    { type: 'text', text: `เลขคิว ${payload.queueNumber}`, weight: 'bold', size: 'xxl', color: '#111827' },
    { type: 'text', text: `${payload.service} · ${payload.branch}`, size: 'sm', color: '#374151', wrap: true },
  ];
  if (payload.assignedTo) {
    bodyRows.push({
      type: 'text',
      text: `เชิญที่ ${payload.assignedLabel || 'ผู้ให้บริการ'}: ${payload.assignedTo}`,
      size: 'md',
      weight: 'bold',
      color: '#111827',
      wrap: true,
      margin: 'md',
    });
  }

  const footerButtons: Array<Record<string, unknown>> = [];
  if (payload.liffUrl) {
    footerButtons.push({
      type: 'button',
      style: 'secondary',
      height: 'sm',
      action: { type: 'uri', label: 'ดูคิวของฉัน', uri: payload.liffUrl },
    });
  }
  footerButtons.push({
    type: 'button',
    style: 'secondary',
    height: 'sm',
    action: { type: 'message', label: 'ติดต่อเจ้าหน้าที่', text: 'ติดต่อเจ้าหน้าที่' },
  });

  return {
    type: 'flex',
    altText: `${title} เลขคิว ${payload.queueNumber}`,
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: repeat ? '#d97706' : '#2563eb',
        paddingAll: '16px',
        contents: [
          { type: 'text', text: payload.shopName, color: '#ffffffcc', size: 'xs' },
          { type: 'text', text: title, color: '#ffffff', weight: 'bold', size: 'xl', margin: 'sm', wrap: true },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          ...bodyRows,
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            backgroundColor: repeat ? '#fef3c7' : '#dbeafe',
            cornerRadius: '10px',
            paddingAll: '10px',
            contents: [
              {
                type: 'text',
                text: repeat
                  ? 'เจ้าหน้าที่กำลังรอคุณอยู่ กรุณามาที่จุดบริการทันที หากไม่มาภายในเวลาที่กำหนดร้านอาจข้ามคิวนี้'
                  : 'กรุณามาที่จุดบริการได้เลยค่ะ',
                size: 'xs',
                color: repeat ? '#92400e' : '#1e3a8a',
                wrap: true,
              },
            ],
          },
        ],
      },
      footer: { type: 'box', layout: 'vertical', spacing: 'sm', contents: footerButtons },
    },
  };
}

export function liffEntryMessage(url: string) {
  return {
    type: 'text',
    text: 'กดลิงก์เพื่อจองคิวผ่านหน้า LIFF ได้เลยค่ะ',
    quickReply: {
      items: [
        {
          type: 'action',
          action: {
            type: 'uri',
            label: 'เปิดหน้าจองคิว',
            uri: url,
          },
        },
      ],
    },
  };
}

/**
 * Flex pushed when the shop moves a booking to another slot and/or hands it to
 * another person (trainer, stylist). "รับทราบ" is a postback so the tap needs no
 * typing; cancelling goes through LIFF where the existing confirm step lives.
 */
export function bookingChangedFlex(payload: {
  shopName: string;
  queueNumber: string;
  bookingId: string;
  branch: string;
  service: string;
  prevDate: string;
  prevTime: string;
  newDate: string;
  newTime: string;
  /** True when only the assigned person changed, not the slot. */
  reassignedOnly?: boolean;
  prevAssignedTo?: string | null;
  assignedTo?: string | null;
  assignedLabel?: string | null;
  liffUrl?: string;
}) {
  const title = payload.reassignedOnly ? `เปลี่ยน${payload.assignedLabel || 'ผู้ให้บริการ'}ของคุณ` : 'ร้านเลื่อนคิวของคุณ';
  const slotChanged = payload.prevDate !== payload.newDate || payload.prevTime !== payload.newTime;
  const assignedChanged = (payload.prevAssignedTo ?? null) !== (payload.assignedTo ?? null);
  const label = payload.assignedLabel || 'ผู้ให้บริการ';

  const changeRows: Array<Record<string, unknown>> = [];
  if (slotChanged) {
    changeRows.push(
      { type: 'text', text: `เดิม: ${payload.prevDate} ${payload.prevTime}`, size: 'sm', color: '#9ca3af', wrap: true },
      { type: 'text', text: `ใหม่: ${payload.newDate} ${payload.newTime}`, size: 'md', weight: 'bold', color: '#111827', wrap: true },
    );
  }
  if (assignedChanged) {
    changeRows.push(
      { type: 'text', text: `${label}เดิม: ${payload.prevAssignedTo ?? 'ไม่ระบุ'}`, size: 'sm', color: '#9ca3af', wrap: true, margin: slotChanged ? 'md' : 'none' },
      { type: 'text', text: `${label}ใหม่: ${payload.assignedTo ?? 'ไม่ระบุ'}`, size: 'md', weight: 'bold', color: '#111827', wrap: true },
    );
  }

  const footerButtons: Array<Record<string, unknown>> = [
    {
      type: 'button',
      style: 'primary',
      color: '#12a862',
      height: 'sm',
      action: {
        type: 'postback',
        label: 'รับทราบ',
        data: `action=ack_change&booking_id=${encodeURIComponent(payload.bookingId)}`,
        displayText: `รับทราบค่ะ (คิว ${payload.queueNumber})`,
      },
    },
  ];
  if (payload.liffUrl) {
    footerButtons.push({
      type: 'button',
      style: 'secondary',
      height: 'sm',
      action: { type: 'uri', label: 'ไม่สะดวก / ยกเลิกคิว', uri: payload.liffUrl },
    });
  }

  return {
    type: 'flex',
    altText: `${title} เลขคิว ${payload.queueNumber} — ${payload.newDate} ${payload.newTime}`,
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#d97706',
        paddingAll: '16px',
        contents: [
          { type: 'text', text: payload.shopName, color: '#ffffffcc', size: 'xs' },
          { type: 'text', text: title, color: '#ffffff', weight: 'bold', size: 'xl', margin: 'sm', wrap: true },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          { type: 'text', text: `เลขคิว ${payload.queueNumber}`, weight: 'bold', size: 'lg', color: '#111827' },
          { type: 'text', text: `${payload.service} · ${payload.branch}`, size: 'sm', color: '#374151', wrap: true },
          { type: 'separator', margin: 'md' },
          { type: 'box', layout: 'vertical', margin: 'md', spacing: 'xs', contents: changeRows },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            backgroundColor: '#fef3c7',
            cornerRadius: '10px',
            paddingAll: '10px',
            contents: [
              { type: 'text', text: 'กรุณากด "รับทราบ" เพื่อยืนยันว่าคุณเห็นการเปลี่ยนแปลงนี้ หากไม่สะดวกสามารถยกเลิกคิวได้', size: 'xs', color: '#92400e', wrap: true },
            ],
          },
        ],
      },
      footer: { type: 'box', layout: 'vertical', spacing: 'sm', contents: footerButtons },
    },
  };
}

/**
 * Flex pushed by the booking-reminders cron shortly before the booking starts.
 * Informational only — nothing to acknowledge; the LIFF link covers "can't make it".
 */
export function bookingReminderFlex(payload: {
  shopName: string;
  queueNumber: string;
  branch: string;
  service: string;
  date: string;
  time: string;
  assignedTo?: string | null;
  /** Shop's configured lead time, used for the "อีก X" line. */
  minutesBefore: number;
  liffUrl?: string;
}) {
  const lead = reminderLeadLabel(payload.minutesBefore);
  const bodyRows: Array<Record<string, unknown>> = [
    { type: 'text', text: `เลขคิว ${payload.queueNumber}`, weight: 'bold', size: 'lg', color: '#111827' },
    { type: 'text', text: `${payload.service} · ${payload.branch}`, size: 'sm', color: '#374151', wrap: true },
    { type: 'text', text: `${payload.date} ${payload.time}`, size: 'md', weight: 'bold', color: '#111827' },
  ];
  if (payload.assignedTo) {
    bodyRows.push({ type: 'text', text: `ผู้ให้บริการ: ${payload.assignedTo}`, size: 'sm', color: '#374151', wrap: true });
  }

  const footerButtons: Array<Record<string, unknown>> = [];
  if (payload.liffUrl) {
    footerButtons.push({
      type: 'button',
      style: 'primary',
      color: '#12a862',
      height: 'sm',
      action: { type: 'uri', label: 'ดูคิวของฉัน', uri: payload.liffUrl },
    });
  }
  footerButtons.push({
    type: 'button',
    style: 'secondary',
    height: 'sm',
    action: { type: 'message', label: 'ติดต่อเจ้าหน้าที่', text: 'ติดต่อเจ้าหน้าที่' },
  });

  return {
    type: 'flex',
    altText: `เตือนคิว ${payload.queueNumber} อีก ${lead} — ${payload.date} ${payload.time}`,
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#12a862',
        paddingAll: '16px',
        contents: [
          { type: 'text', text: payload.shopName, color: '#ffffffcc', size: 'xs' },
          { type: 'text', text: `ถึงคิวของคุณในอีก ${lead}`, color: '#ffffff', weight: 'bold', size: 'xl', margin: 'sm', wrap: true },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          ...bodyRows,
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            backgroundColor: '#dcfce7',
            cornerRadius: '10px',
            paddingAll: '10px',
            contents: [
              { type: 'text', text: 'กรุณามาถึงก่อนเวลาเล็กน้อย หากไม่สะดวกสามารถยกเลิกคิวได้จากปุ่มด้านล่าง', size: 'xs', color: '#166534', wrap: true },
            ],
          },
        ],
      },
      footer: { type: 'box', layout: 'vertical', spacing: 'sm', contents: footerButtons },
    },
  };
}

/**
 * Flex pushed when staff cancel a booking from the portal.
 */
export function bookingCancelledFlex(payload: {
  shopName: string;
  queueNumber: string;
  branch: string;
  service: string;
  date: string;
  time: string;
  liffUrl?: string;
}) {
  const footerButtons: Array<Record<string, unknown>> = [];
  if (payload.liffUrl) {
    footerButtons.push({
      type: 'button',
      style: 'primary',
      color: '#12a862',
      height: 'sm',
      action: { type: 'uri', label: 'จองคิวใหม่', uri: payload.liffUrl },
    });
  }
  footerButtons.push({
    type: 'button',
    style: 'secondary',
    height: 'sm',
    action: { type: 'message', label: 'ติดต่อเจ้าหน้าที่', text: 'ติดต่อเจ้าหน้าที่' },
  });

  return {
    type: 'flex',
    altText: `ร้านยกเลิกคิว ${payload.queueNumber} (${payload.date} ${payload.time})`,
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#dc2626',
        paddingAll: '16px',
        contents: [
          { type: 'text', text: payload.shopName, color: '#ffffffcc', size: 'xs' },
          { type: 'text', text: 'ร้านยกเลิกคิวของคุณ', color: '#ffffff', weight: 'bold', size: 'xl', margin: 'sm' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          { type: 'text', text: `เลขคิว ${payload.queueNumber}`, weight: 'bold', size: 'lg', color: '#111827' },
          { type: 'text', text: `${payload.service} · ${payload.branch}`, size: 'sm', color: '#374151', wrap: true },
          { type: 'text', text: `${payload.date} ${payload.time}`, size: 'sm', color: '#374151' },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            backgroundColor: '#fee2e2',
            cornerRadius: '10px',
            paddingAll: '10px',
            contents: [
              { type: 'text', text: 'ขออภัยในความไม่สะดวก คุณสามารถจองคิวใหม่ได้ทันที หรือติดต่อเจ้าหน้าที่ค่ะ', size: 'xs', color: '#991b1b', wrap: true },
            ],
          },
        ],
      },
      footer: { type: 'box', layout: 'vertical', spacing: 'sm', contents: footerButtons },
    },
  };
}
