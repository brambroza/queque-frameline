function formatTHB(amount: number) {
  return amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Flex Message ส่ง QR PromptPay ให้ลูกค้าสแกนชำระ */
export function qrPaymentFlex(payload: {
  shopName: string;
  queueNumber: string;
  service: string;
  branch: string;
  date: string;
  time: string;
  amountTHB: number;
  qrImageUrl: string;
  expiresAt?: string | null;
  isTest?: boolean;
}) {
  const expireLabel = payload.expiresAt
    ? new Date(payload.expiresAt).toLocaleString('th-TH', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok',
      })
    : null;

  const noteContents: Array<Record<string, unknown>> = [
    { type: 'text', text: 'สแกน QR Code ด้วยแอปธนาคารเพื่อชำระเงิน', size: 'xs', color: '#4b5563', wrap: true },
  ];
  if (expireLabel) {
    noteContents.push({ type: 'text', text: `หมดอายุ: ${expireLabel}`, size: 'xs', color: '#ef4444', margin: 'sm', wrap: true });
  }
  if (payload.isTest) {
    noteContents.push({ type: 'text', text: '[TEST MODE]', size: 'xs', color: '#6b7280', margin: 'sm' });
  }

  return {
    type: 'flex',
    altText: `ชำระเงิน ${formatTHB(payload.amountTHB)} บาท – คิว ${payload.queueNumber}`,
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#1d4ed8',
        paddingAll: '16px',
        contents: [
          { type: 'text', text: payload.shopName, color: '#ffffff99', size: 'xs' },
          { type: 'text', text: 'ชำระเงิน', color: '#ffffff', weight: 'bold', size: 'xl', margin: 'sm' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'xs',
            contents: [
              { type: 'text', text: `คิว ${payload.queueNumber}`, weight: 'bold', size: 'lg', color: '#111827' },
              { type: 'text', text: `บริการ: ${payload.service}`, size: 'sm', color: '#374151', wrap: true },
              { type: 'text', text: `สาขา: ${payload.branch}`, size: 'sm', color: '#374151', wrap: true },
              { type: 'text', text: `${payload.date}  ${payload.time}`, size: 'sm', color: '#374151' },
            ],
          },
          {
            type: 'separator',
          },
          {
            type: 'box',
            layout: 'vertical',
            alignItems: 'center',
            contents: [
              {
                type: 'text',
                text: `${formatTHB(payload.amountTHB)} บาท`,
                weight: 'bold',
                size: 'xxl',
                color: '#1d4ed8',
              },
              {
                type: 'image',
                url: payload.qrImageUrl,
                size: 'full',
                aspectMode: 'fit',
                aspectRatio: '1:1',
                margin: 'md',
              },
            ],
          },
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#f0fdf4',
            cornerRadius: '8px',
            paddingAll: '10px',
            contents: noteContents,
          },
        ],
      },
    },
  };
}

/** Flex Message ส่ง QR PromptPay ของร้านเอง พร้อมปุ่มอัปโหลดสลิป (ช่องทางโอนเงิน) */
export function transferPaymentFlex(payload: {
  shopName: string;
  queueNumber: string;
  service: string;
  branch: string;
  date: string;
  time: string;
  amountTHB: number;
  qrImageUrl: string;
  payeeName?: string | null;
  promptpayMasked?: string | null;
  bankName?: string | null;
  bankAccountNo?: string | null;
  expiresAt?: string | null;
  uploadUrl?: string | null;
}) {
  const expireLabel = payload.expiresAt
    ? new Date(payload.expiresAt).toLocaleString('th-TH', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok',
      })
    : null;

  const payeeLines: Array<Record<string, unknown>> = [];
  if (payload.payeeName) {
    payeeLines.push({ type: 'text', text: `ผู้รับ: ${payload.payeeName}`, size: 'xs', color: '#374151', wrap: true });
  }
  if (payload.promptpayMasked) {
    payeeLines.push({ type: 'text', text: `PromptPay: ${payload.promptpayMasked}`, size: 'xs', color: '#374151' });
  }
  if (payload.bankName && payload.bankAccountNo) {
    payeeLines.push({ type: 'text', text: `${payload.bankName} ${payload.bankAccountNo}`, size: 'xs', color: '#374151', wrap: true });
  }

  const noteContents: Array<Record<string, unknown>> = [
    { type: 'text', text: 'สแกน QR ด้วยแอปธนาคาร แล้วอัปโหลดสลิปเพื่อให้ร้านตรวจสอบ', size: 'xs', color: '#4b5563', wrap: true },
  ];
  if (expireLabel) {
    noteContents.push({ type: 'text', text: `ชำระภายใน: ${expireLabel}`, size: 'xs', color: '#ef4444', margin: 'sm', wrap: true });
  }

  const bubble: Record<string, unknown> = {
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#1d4ed8',
      paddingAll: '16px',
      contents: [
        { type: 'text', text: payload.shopName, color: '#ffffff99', size: 'xs' },
        { type: 'text', text: 'โอนเงิน + แนบสลิป', color: '#ffffff', weight: 'bold', size: 'xl', margin: 'sm' },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        {
          type: 'box',
          layout: 'vertical',
          spacing: 'xs',
          contents: [
            { type: 'text', text: `คิว ${payload.queueNumber}`, weight: 'bold', size: 'lg', color: '#111827' },
            { type: 'text', text: `บริการ: ${payload.service}`, size: 'sm', color: '#374151', wrap: true },
            { type: 'text', text: `สาขา: ${payload.branch}`, size: 'sm', color: '#374151', wrap: true },
            { type: 'text', text: `${payload.date}  ${payload.time}`, size: 'sm', color: '#374151' },
          ],
        },
        { type: 'separator' },
        {
          type: 'box',
          layout: 'vertical',
          alignItems: 'center',
          contents: [
            { type: 'text', text: `${formatTHB(payload.amountTHB)} บาท`, weight: 'bold', size: 'xxl', color: '#1d4ed8' },
            { type: 'image', url: payload.qrImageUrl, size: 'full', aspectMode: 'fit', aspectRatio: '1:1', margin: 'md' },
          ],
        },
        ...(payeeLines.length ? [{ type: 'box', layout: 'vertical', spacing: 'xs', contents: payeeLines }] : []),
        {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#eff6ff',
          cornerRadius: '8px',
          paddingAll: '10px',
          contents: noteContents,
        },
      ],
    },
  };

  if (payload.uploadUrl) {
    bubble.footer = {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: '#1d4ed8',
          action: { type: 'uri', label: 'อัปโหลดสลิป', uri: payload.uploadUrl },
        },
      ],
    };
  }

  return {
    type: 'flex',
    altText: `โอนเงิน ${formatTHB(payload.amountTHB)} บาท – คิว ${payload.queueNumber}`,
    contents: bubble,
  };
}

/**
 * Flex Message สำหรับชำระผ่านแอปธนาคาร (deeplink) — ปุ่มหลักเปิดแอปธนาคาร
 * ปุ่มรองกลับเข้า LIFF เพื่อออกลิงก์ใหม่ถ้าหมดอายุ
 *
 * LINE accepts only http(s)/line/tel URIs in Flex actions, so a bank scheme
 * link (`scbeasy://…`) is routed through `fallbackUrl` (our return page, which
 * re-opens the deeplink in the system browser) instead of being put in the
 * button directly.
 */
export function deeplinkPaymentFlex(payload: {
  shopName: string;
  queueNumber: string;
  service: string;
  branch: string;
  date: string;
  time: string;
  amountTHB: number;
  bankName: string;
  deeplinkUrl: string;
  /** https page that can relaunch the bank app when the deeplink itself is not https. */
  fallbackUrl: string;
  expiresAt?: string | null;
  accountUrl?: string | null;
}) {
  const expireLabel = payload.expiresAt
    ? new Date(payload.expiresAt).toLocaleString('th-TH', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok',
      })
    : null;

  const buttonUri = /^https:\/\//i.test(payload.deeplinkUrl) ? payload.deeplinkUrl : payload.fallbackUrl;

  const noteContents: Array<Record<string, unknown>> = [
    { type: 'text', text: `กดปุ่มเพื่อเปิดแอป ${payload.bankName} ยอดเงินและผู้รับถูกตั้งไว้แล้ว ยืนยันด้วย PIN ได้เลย`, size: 'xs', color: '#4b5563', wrap: true },
  ];
  if (expireLabel) {
    noteContents.push({ type: 'text', text: `ชำระภายใน: ${expireLabel}`, size: 'xs', color: '#ef4444', margin: 'sm', wrap: true });
  }

  const footerButtons: Array<Record<string, unknown>> = [
    {
      type: 'button',
      style: 'primary',
      color: '#1d4ed8',
      action: { type: 'uri', label: `เปิดแอป ${payload.bankName}`, uri: buttonUri },
    },
  ];
  if (payload.accountUrl) {
    footerButtons.push({
      type: 'button',
      style: 'link',
      height: 'sm',
      action: { type: 'uri', label: 'ดูสถานะ / ออกลิงก์ใหม่', uri: payload.accountUrl },
    });
  }

  return {
    type: 'flex',
    altText: `ชำระเงิน ${formatTHB(payload.amountTHB)} บาท ผ่าน ${payload.bankName} – คิว ${payload.queueNumber}`,
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#1d4ed8',
        paddingAll: '16px',
        contents: [
          { type: 'text', text: payload.shopName, color: '#ffffff99', size: 'xs' },
          { type: 'text', text: `ชำระผ่าน ${payload.bankName}`, color: '#ffffff', weight: 'bold', size: 'xl', margin: 'sm' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'xs',
            contents: [
              { type: 'text', text: `คิว ${payload.queueNumber}`, weight: 'bold', size: 'lg', color: '#111827' },
              { type: 'text', text: `บริการ: ${payload.service}`, size: 'sm', color: '#374151', wrap: true },
              { type: 'text', text: `สาขา: ${payload.branch}`, size: 'sm', color: '#374151', wrap: true },
              { type: 'text', text: `${payload.date}  ${payload.time}`, size: 'sm', color: '#374151' },
            ],
          },
          { type: 'separator' },
          {
            type: 'box',
            layout: 'vertical',
            alignItems: 'center',
            contents: [
              { type: 'text', text: `${formatTHB(payload.amountTHB)} บาท`, weight: 'bold', size: 'xxl', color: '#1d4ed8' },
            ],
          },
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#eff6ff',
            cornerRadius: '8px',
            paddingAll: '10px',
            contents: noteContents,
          },
        ],
      },
      footer: { type: 'box', layout: 'vertical', spacing: 'sm', contents: footerButtons },
    },
  };
}

/** Flex Message ยืนยันว่าได้รับสลิปแล้ว กำลังรอร้านตรวจสอบ */
export function slipReceivedFlex(payload: {
  shopName: string;
  queueNumber: string;
  amountTHB: number;
}) {
  return {
    type: 'flex',
    altText: `ได้รับสลิปแล้ว – คิว ${payload.queueNumber}`,
    contents: {
      type: 'bubble',
      size: 'kilo',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          { type: 'text', text: payload.shopName, size: 'xs', color: '#9ca3af' },
          { type: 'text', text: 'ได้รับสลิปแล้ว', weight: 'bold', size: 'lg', color: '#111827', margin: 'sm' },
          { type: 'separator', margin: 'md' },
          { type: 'text', text: `คิว: ${payload.queueNumber}`, size: 'sm', color: '#374151', margin: 'md' },
          { type: 'text', text: `ยอด: ${formatTHB(payload.amountTHB)} บาท`, size: 'sm', color: '#374151' },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            backgroundColor: '#fffbeb',
            cornerRadius: '8px',
            paddingAll: '10px',
            contents: [
              { type: 'text', text: 'กำลังรอร้านตรวจสอบ จะแจ้งผลให้ทราบทางนี้ค่ะ', size: 'xs', color: '#b45309', wrap: true },
            ],
          },
        ],
      },
    },
  };
}

/** Flex Message แจ้งลูกค้าว่าสลิปไม่ผ่าน พร้อมเหตุผลและลิงก์อัปใหม่ */
export function slipRejectedFlex(payload: {
  shopName: string;
  queueNumber: string;
  amountTHB: number;
  reason: string;
  uploadUrl?: string | null;
}) {
  const bubble: Record<string, unknown> = {
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#e11d48',
      paddingAll: '16px',
      contents: [
        { type: 'text', text: payload.shopName, color: '#ffffff99', size: 'xs' },
        { type: 'text', text: 'สลิปไม่ผ่านการตรวจสอบ', color: '#ffffff', weight: 'bold', size: 'lg', margin: 'sm', wrap: true },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        { type: 'text', text: `คิว: ${payload.queueNumber}`, size: 'sm', color: '#374151', weight: 'bold' },
        { type: 'text', text: `ยอด: ${formatTHB(payload.amountTHB)} บาท`, size: 'sm', color: '#374151' },
        { type: 'separator', margin: 'md' },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'md',
          backgroundColor: '#fff1f2',
          cornerRadius: '8px',
          paddingAll: '10px',
          contents: [
            { type: 'text', text: 'เหตุผล', size: 'xs', color: '#9f1239', weight: 'bold' },
            { type: 'text', text: payload.reason, size: 'xs', color: '#9f1239', wrap: true, margin: 'sm' },
          ],
        },
        { type: 'text', text: 'กรุณาอัปโหลดสลิปใหม่อีกครั้งค่ะ', size: 'xs', color: '#6b7280', margin: 'md', wrap: true },
      ],
    },
  };

  if (payload.uploadUrl) {
    bubble.footer = {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: '#e11d48',
          action: { type: 'uri', label: 'อัปโหลดสลิปใหม่', uri: payload.uploadUrl },
        },
      ],
    };
  }

  return {
    type: 'flex',
    altText: `สลิปไม่ผ่าน – คิว ${payload.queueNumber}`,
    contents: bubble,
  };
}

/** Flex Message ใบเสร็จรับเงิน หลังชำระสำเร็จ */
export function paymentReceiptFlex(payload: {
  shopName: string;
  queueNumber: string;
  service: string;
  branch: string;
  date: string;
  time: string;
  amountTHB: number;
  receiptRef: string;
  paidAt: string;
}) {
  const paidLabel = new Date(payload.paidAt).toLocaleString('th-TH', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok',
  });

  return {
    type: 'flex',
    altText: `ใบเสร็จรับเงิน ${formatTHB(payload.amountTHB)} บาท – คิว ${payload.queueNumber}`,
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#16a34a',
        paddingAll: '16px',
        contents: [
          { type: 'text', text: payload.shopName, color: '#ffffff99', size: 'xs' },
          { type: 'text', text: 'ชำระเงินสำเร็จ', color: '#ffffff', weight: 'bold', size: 'xl', margin: 'sm' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            justifyContent: 'center',
            contents: [
              { type: 'text', text: '✓', size: 'xxl', color: '#16a34a', weight: 'bold' },
            ],
          },
          { type: 'separator', margin: 'md' },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'md',
            spacing: 'sm',
            contents: [
              { type: 'text', text: 'ใบเสร็จรับเงิน', weight: 'bold', size: 'md', color: '#111827' },
              { type: 'text', text: `เลขที่: ${payload.receiptRef}`, size: 'xs', color: '#6b7280' },
              { type: 'text', text: `ชำระเมื่อ: ${paidLabel}`, size: 'xs', color: '#6b7280', margin: 'sm' },
            ],
          },
          { type: 'separator' },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'md',
            spacing: 'xs',
            contents: [
              { type: 'text', text: `คิว: ${payload.queueNumber}`, size: 'sm', color: '#374151', weight: 'bold' },
              { type: 'text', text: `บริการ: ${payload.service}`, size: 'sm', color: '#374151', wrap: true },
              { type: 'text', text: `สาขา: ${payload.branch}`, size: 'sm', color: '#374151', wrap: true },
              { type: 'text', text: `วันที่: ${payload.date}  ${payload.time}`, size: 'sm', color: '#374151' },
            ],
          },
          { type: 'separator' },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            justifyContent: 'space-between',
            contents: [
              { type: 'text', text: 'ยอดชำระ', weight: 'bold', size: 'md', color: '#111827' },
              { type: 'text', text: `${formatTHB(payload.amountTHB)} บาท`, weight: 'bold', size: 'md', color: '#16a34a' },
            ],
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            backgroundColor: '#f0fdf4',
            cornerRadius: '8px',
            paddingAll: '10px',
            contents: [
              { type: 'text', text: 'ขอบคุณที่ใช้บริการค่ะ', size: 'xs', color: '#15803d', align: 'center' },
            ],
          },
        ],
      },
    },
  };
}
