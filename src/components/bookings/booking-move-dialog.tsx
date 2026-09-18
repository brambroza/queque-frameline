'use client';

import { useEffect, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { effectivePlate } from '@/lib/booking/plate';
import { formatDateDMY } from '@/lib/utils/date-format';
import { DockSlotPicker } from './dock-slot-picker';
import { hhmm, type BookingRow, type Dock } from './booking-types';

export type MoveDraft = { date: string; time: string; resourceId: string };

/** Docks this booking may use: direction matches (or shared) and the vehicle type is allowed. */
function docksFor(b: BookingRow, docks: Dock[]): Dock[] {
  return docks.filter(
    (d) =>
      d.active !== false &&
      d.resource_type === 'dock' &&
      (!d.branch_id || !b.branch_id || d.branch_id === b.branch_id) &&
      (!d.direction || d.direction === b.direction) &&
      (!d.service_ids || d.service_ids.length === 0 || (b.service_id ? d.service_ids.includes(b.service_id) : true)),
  );
}

/**
 * Reschedule dialog (admin): pick a free day + slot, optionally pin a dock.
 * The booking's own slot is ignored when computing availability.
 */
export function BookingMoveDialog({
  booking, resources, saving, onClose, onSubmit,
}: {
  booking: BookingRow | null;
  resources: Dock[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (draft: MoveDraft) => void;
}) {
  const [draft, setDraft] = useState<MoveDraft>({ date: '', time: '', resourceId: '' });

  useEffect(() => {
    if (booking) setDraft({ date: booking.booking_date, time: hhmm(booking.start_time), resourceId: '' });
  }, [booking]);

  const b = booking;
  const options = b ? docksFor(b, resources) : [];
  const changed = b ? draft.date !== b.booking_date || draft.time !== hhmm(b.start_time) || (draft.resourceId !== '' && draft.resourceId !== (b.resource_id ?? '')) : false;

  return (
    <Dialog open={Boolean(b)} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      {b ? (
        <>
          <DialogTitle>เลื่อนคิว {b.queue_number}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                ปัจจุบัน: <b>{formatDateDMY(b.booking_date)} {hhmm(b.start_time)}</b> · {b.resource_name ?? 'ยังไม่ระบุท่า'} · {effectivePlate(b) || '-'}
                {b.do_number ? ' — เลข DO เดิมยังใช้ต่อ' : ''}
              </Typography>
              <TextField select size="small" label="ท่า (Dock)" value={draft.resourceId} onChange={(e) => setDraft((p) => ({ ...p, resourceId: e.target.value, time: '' }))}>
                <MenuItem value="">ให้ระบบเลือกท่าที่ว่าง</MenuItem>
                {options.map((d) => <MenuItem key={d.id} value={d.id}>{d.resource_code ? `${d.resource_code} · ` : ''}{d.resource_name}</MenuItem>)}
              </TextField>
              {b.service_id ? (
                <DockSlotPicker
                  direction={b.direction}
                  serviceId={b.service_id}
                  branchId={b.branch_id || undefined}
                  dockId={draft.resourceId || undefined}
                  excludeBookingId={b.id}
                  date={draft.date}
                  time={draft.time}
                  onChange={(n) => setDraft((p) => ({ ...p, ...n }))}
                />
              ) : null}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button color="inherit" onClick={onClose} disabled={saving}>ปิด</Button>
            <Button variant="contained" disabled={saving || !changed || !draft.date || !draft.time} onClick={() => onSubmit(draft)}>
              {saving ? 'กำลังบันทึก…' : 'เลื่อนคิว'}
            </Button>
          </DialogActions>
        </>
      ) : null}
    </Dialog>
  );
}
