import { describe, expect, it } from 'vitest';
import { computeDockDay, labelOfMinutes, minutesOfDay, snapToSlot, type DockDayOther } from './dock-day';

const other = (queue_number: string, start_time: string, end_time: string | null, extra: Partial<DockDayOther> = {}): DockDayOther => ({
  id: queue_number, queue_number, start_time, end_time, buffer_minutes: 10, status: 'confirmed', ...extra,
});

const hours = { open_time: '08:00:00', close_time: '17:00:00', break_start: '12:00:00', break_end: '13:00:00' };

describe('minutesOfDay / labelOfMinutes', () => {
  it('round-trips HH:MM and HH:MM:SS', () => {
    expect(minutesOfDay('10:30')).toBe(630);
    expect(minutesOfDay('10:30:00')).toBe(630);
    expect(labelOfMinutes(630)).toBe('10:30');
    expect(labelOfMinutes(1440)).toBe('24:00');
    expect(Number.isNaN(minutesOfDay('x'))).toBe(true);
  });
});

describe('snapToSlot', () => {
  const slots = [8 * 60, 8 * 60 + 30, 9 * 60, 14 * 60];
  it('lands on the latest slot at or before the point', () => {
    expect(snapToSlot(8 * 60 + 45, slots)).toBe(8 * 60 + 30);
    expect(snapToSlot(9 * 60, slots)).toBe(9 * 60);
    expect(snapToSlot(12 * 60, slots)).toBe(9 * 60);
  });
  it('gives null before the first slot or with no slots', () => {
    expect(snapToSlot(7 * 60, slots)).toBeNull();
    expect(snapToSlot(10 * 60, [])).toBeNull();
  });
});

describe('computeDockDay', () => {
  it('caps the stay at the next queue minus this queue\'s own buffer', () => {
    const day = computeDockDay({ start_time: '10:00', buffer_minutes: 10, others: [other('R-016', '11:30', '12:00')], ...hours });
    expect(day.maxMinutes).toBe(80);
    expect(day.mustEndBefore).toBe(11 * 60 + 20);
    expect(day.next?.queue_number).toBe('R-016');
  });

  it('uses no buffer when this queue has none', () => {
    const day = computeDockDay({ start_time: '10:00', buffer_minutes: 0, others: [other('R-016', '11:30', '12:00')], ...hours });
    expect(day.maxMinutes).toBe(90);
    expect(day.mustEndBefore).toBe(11 * 60 + 30);
  });

  it('runs to midnight (not closing time) when nothing follows', () => {
    const day = computeDockDay({ start_time: '16:00', buffer_minutes: 10, others: [other('R-011', '08:30', '09:30')], ...hours });
    expect(day.next).toBeNull();
    expect(day.mustEndBefore).toBeNull();
    expect(day.maxMinutes).toBe(24 * 60 - 10 - 16 * 60);
  });

  it('gives 0 when the next queue starts inside the buffer', () => {
    const day = computeDockDay({ start_time: '10:00', buffer_minutes: 10, others: [other('R-016', '10:05', '10:35')], ...hours });
    expect(day.maxMinutes).toBe(0);
  });

  it('ignores released queues and queues that started earlier', () => {
    const day = computeDockDay({
      start_time: '10:00', buffer_minutes: 10, ...hours,
      others: [
        other('R-009', '09:00', '09:50'),
        other('R-010', '10:30', '11:00', { status: 'cancelled' }),
        other('R-012', '10:45', '11:15', { status: 'completed' }),
        other('R-013', '11:00', '11:30', { status: 'no_show' }),
        other('R-014', '11:15', '11:45', { status: 'skipped' }),
        other('R-016', '12:00', '12:30'),
      ],
    });
    expect(day.blocks.map((b) => b.queue.queue_number)).toEqual(['R-009', 'R-016']);
    expect(day.next?.queue_number).toBe('R-016');
    expect(day.maxMinutes).toBe(110);
  });

  it('assumes 30 minutes for a queue without end_time, like is_dock_free', () => {
    const day = computeDockDay({ start_time: '10:00', buffer_minutes: 0, others: [other('R-016', '11:00', null, { buffer_minutes: 5 })], ...hours });
    const blk = day.blocks[0];
    expect(blk.end).toBe(11 * 60 + 30);
    expect(blk.bufferEnd).toBe(11 * 60 + 35);
  });

  it('lists free windows net of other queues\' buffers and the break, flagging the one this queue sits in', () => {
    const day = computeDockDay({
      start_time: '10:00', buffer_minutes: 10, ...hours,
      others: [other('R-011', '08:30', '09:30'), other('R-016', '11:30', '12:00'), other('R-019', '14:00', '15:00')],
    });
    expect(day.freeWindows).toEqual([
      { start: 8 * 60, end: 8 * 60 + 30, containsSelf: false },
      { start: 9 * 60 + 40, end: 11 * 60 + 30, containsSelf: true },
      { start: 13 * 60, end: 14 * 60, containsSelf: false },
      { start: 15 * 60 + 10, end: 17 * 60, containsSelf: false },
    ]);
    expect(day.breakRange).toEqual({ start: 12 * 60, end: 13 * 60 });
  });

  it('reports every block a moved start would overlap, using the is_dock_free rule', () => {
    const list = [other('R-011', '08:30', '09:30'), other('R-016', '11:30', '12:00')];
    // start inside R-011
    expect(computeDockDay({ start_time: '09:00', buffer_minutes: 10, minutes: 30, others: list, ...hours }).overlaps.map((b) => b.queue.queue_number)).toEqual(['R-011']);
    // start before R-016 but long enough (incl. own buffer) to reach it
    expect(computeDockDay({ start_time: '10:00', buffer_minutes: 10, minutes: 85, others: list, ...hours }).overlaps.map((b) => b.queue.queue_number)).toEqual(['R-016']);
    // start right after R-011's buffer, ends before R-016 minus own buffer: clean
    expect(computeDockDay({ start_time: '09:40', buffer_minutes: 10, minutes: 100, others: list, ...hours }).overlaps).toEqual([]);
    // other's buffer counts too: 09:35 is inside R-011's 09:30–09:40 buffer
    expect(computeDockDay({ start_time: '09:35', buffer_minutes: 0, minutes: 30, others: list, ...hours }).overlaps.map((b) => b.queue.queue_number)).toEqual(['R-011']);
    // no minutes given = not checked
    expect(computeDockDay({ start_time: '09:00', buffer_minutes: 10, others: list, ...hours }).overlaps).toEqual([]);
  });

  it('widens the bar to cover queues outside working hours and falls back without hours', () => {
    const withHours = computeDockDay({ start_time: '10:00', buffer_minutes: 0, others: [other('R-030', '18:30', '19:00')], ...hours });
    expect(withHours.viewOpen).toBe(8 * 60);
    expect(withHours.viewClose).toBe(20 * 60);
    const noHours = computeDockDay({ start_time: '10:00', buffer_minutes: 0, others: [] });
    expect(noHours.viewOpen).toBe(6 * 60);
    expect(noHours.viewClose).toBe(20 * 60);
    expect(noHours.breakRange).toBeNull();
  });
});
