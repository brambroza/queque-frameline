const BANGKOK_TZ = 'Asia/Bangkok';

function getPartsInBangkok(date: Date, withTime = false) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: BANGKOK_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(withTime
      ? {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }
      : {}),
  });

  const parts = fmt.formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    day: map.day ?? '00',
    month: map.month ?? '00',
    year: map.year ?? '0000',
    hour: map.hour ?? '00',
    minute: map.minute ?? '00',
  };
}

export function formatDateDMY(input?: string | null): string {
  if (!input) return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [year, month, day] = input.split('-');
    return `${day}/${month}/${year}`;
  }

  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  const { day, month, year } = getPartsInBangkok(d);
  return `${day}/${month}/${year}`;
}

export function formatThaiDateLabel(input?: string | null): string {
  if (!input) return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [year, month, day] = input.split('-').map(Number);
    if (!year || !month || !day) return input;
    const d = new Date(Date.UTC(year, month - 1, day, 12));
    return d.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }

  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  return d.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: BANGKOK_TZ,
  });
}

export function formatDateDD(input?: string | null): string {
  if (!input) return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [year, month, day] = input.split('-');
    return `${day}/${month}/${year}`;
  }

  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  const { day, month, year } = getPartsInBangkok(d);
  return `${day}`;
}



export function formatDateTimeDMY(input?: string | null): string {
  if (!input) return '-';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  const { day, month, year, hour, minute } = getPartsInBangkok(d);
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${day}/${month}/${year} ${hh}:${mm}`;
}

export function getTodayISOInBangkok(): string {
  const { day, month, year } = getPartsInBangkok(new Date());
  return `${year}-${month}-${day}`;
}

/**
 * Current hour of day (0–23) in Asia/Bangkok.
 */
export function getNowHourInBangkok(): number {
  const { hour } = getPartsInBangkok(new Date(), true);
  const h = Number.parseInt(hour, 10);
  return Number.isFinite(h) ? h % 24 : 0;
}
