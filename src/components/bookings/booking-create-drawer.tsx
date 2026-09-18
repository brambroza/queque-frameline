'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Divider, Drawer, IconButton, MenuItem, Stack, Step, StepLabel, Stepper,
  TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import type { BookingDirection } from '@/types/db';
import { isPlausiblePlate } from '@/lib/booking/plate';
import { formatDateDMY } from '@/lib/utils/date-format';
import { DockSlotPicker } from './dock-slot-picker';
import { DIRECTION_META, type Dock, type DocumentOption, type VehicleType } from './booking-types';

export type CreateDraft = {
  direction: BookingDirection;
  branch_id: string;
  document_id: string;
  partner_name: string;
  partner_phone: string;
  service_id: string;
  resource_id: string;
  booking_date: string;
  start_time: string;
  plate_number: string;
  driver_name: string;
  driver_phone: string;
  receiver_name: string;
  receiver_phone: string;
  note: string;
};

export type CreateResult = { queueNo: string; doNumber: string | null; date: string; time: string; vehicle: string };

const EMPTY: CreateDraft = {
  direction: 'outbound', branch_id: '', document_id: '', partner_name: '', partner_phone: '', service_id: '', resource_id: '',
  booking_date: '', start_time: '', plate_number: '', driver_name: '', driver_phone: '', receiver_name: '', receiver_phone: '', note: '',
};

/**
 * Admin / staff "สร้างคิว": 1) direction, document or partner, vehicle
 * 2) free day + slot 3) result. The parent owns submission so the list refreshes.
 */
export function BookingCreateDrawer({
  open, onClose, branches, defaultBranchId, vehicleTypes, docks, creating, result, onSubmit, onReset,
}: {
  open: boolean;
  onClose: () => void;
  branches: Array<{ id: string; branch_name: string; active?: boolean }>;
  /** Topbar branch, pre-selected for a new queue. */
  defaultBranchId: string;
  vehicleTypes: VehicleType[];
  docks: Dock[];
  creating: boolean;
  result: CreateResult | null;
  onSubmit: (draft: CreateDraft) => void;
  onReset: () => void;
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<CreateDraft>({ ...EMPTY, branch_id: defaultBranchId });
  useEffect(() => { if (open && !draft.branch_id) setDraft((p) => ({ ...p, branch_id: defaultBranchId || (branches.length === 1 ? branches[0].id : '') })); }, [open, defaultBranchId, branches, draft.branch_id]);
  const [docOptions, setDocOptions] = useState<DocumentOption[]>([]);
  const [docQuery, setDocQuery] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<DocumentOption | null>(null);

  const activeStep = result ? 2 : step;
  const set = (key: keyof CreateDraft) => (e: React.ChangeEvent<HTMLInputElement>) => setDraft((p) => ({ ...p, [key]: e.target.value }));
  const docType = draft.direction === 'outbound' ? 'so' : 'po';
  const dir = DIRECTION_META[draft.direction];

  // Document search, debounced. Only open / booked documents of the matching type and branch.
  useEffect(() => {
    if (!open) return;
    const ctl = new AbortController();
    const id = setTimeout(() => {
      const dq = new URLSearchParams({ doc_type: docType, bookable: '1', page_size: '20', q: docQuery });
      if (draft.branch_id) dq.set('branch_id', draft.branch_id);
      fetch(`/api/documents?${dq}`, { cache: 'no-store', signal: ctl.signal })
        .then((r) => r.json())
        .then((j: { data?: DocumentOption[] }) => setDocOptions(j.data ?? []))
        .catch(() => undefined);
    }, 250);
    return () => { clearTimeout(id); ctl.abort(); };
  }, [open, docType, docQuery, draft.branch_id]);

  const vehicleOptions = useMemo(
    () => vehicleTypes.filter((v) => v.active !== false && (!v.direction || v.direction === draft.direction)),
    [vehicleTypes, draft.direction],
  );
  const dockOptions = useMemo(
    () => docks.filter((d) => d.active !== false && d.resource_type === 'dock' && (!d.branch_id || !draft.branch_id || d.branch_id === draft.branch_id) && (!d.direction || d.direction === draft.direction)
      && (!d.service_ids || d.service_ids.length === 0 || !draft.service_id || d.service_ids.includes(draft.service_id))),
    [docks, draft.branch_id, draft.direction, draft.service_id],
  );

  const plateOk = isPlausiblePlate(draft.plate_number);
  const partnerOk = Boolean(selectedDoc || draft.partner_name.trim());
  const branchOk = branches.length <= 1 || Boolean(draft.branch_id);
  const step1Ok = Boolean(branchOk && partnerOk && draft.service_id && plateOk);
  const step2Ok = Boolean(draft.booking_date && draft.start_time);

  function resetAll() {
    setStep(0);
    setDraft({ ...EMPTY, branch_id: defaultBranchId });
    setSelectedDoc(null);
    setDocQuery('');
    onReset();
  }

  function handleClose() {
    if (creating) return;
    onClose();
    setTimeout(resetAll, 200); // after the slide-out, so the form does not flash empty
  }

  function changeDirection(next: BookingDirection | null) {
    if (!next || next === draft.direction) return;
    // Documents, vehicle types and docks are all direction-specific.
    setSelectedDoc(null);
    setDraft((p) => ({ ...p, direction: next, document_id: '', service_id: '', resource_id: '', booking_date: '', start_time: '' }));
  }

  return (
    <Drawer anchor="right" open={open} onClose={handleClose} PaperProps={{ sx: { width: { xs: '100%', sm: 560 } } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 3, py: 2 }}>
        <Typography variant="h6" fontWeight={700}>สร้างคิว</Typography>
        <IconButton onClick={handleClose} aria-label="ปิด" disabled={creating}><CloseRoundedIcon /></IconButton>
      </Stack>
      <Divider />

      <Box sx={{ px: 3, pt: 2 }}>
        <Stepper activeStep={activeStep} alternativeLabel>
          <Step><StepLabel>เอกสารและรถ</StepLabel></Step>
          <Step><StepLabel>วันเวลา</StepLabel></Step>
          <Step><StepLabel>เสร็จสิ้น</StepLabel></Step>
        </Stepper>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 3 }}>
        {activeStep === 0 ? (
          <Stack spacing={2}>
            <ToggleButtonGroup exclusive fullWidth size="small" value={draft.direction} onChange={(_, v: BookingDirection | null) => changeDirection(v)} aria-label="ประเภทคิว">
              <ToggleButton value="outbound">{DIRECTION_META.outbound.label}</ToggleButton>
              <ToggleButton value="inbound">{DIRECTION_META.inbound.label}</ToggleButton>
            </ToggleButtonGroup>

            {branches.length > 1 ? (
              <TextField select required size="small" label="สาขา / คลัง" value={draft.branch_id}
                onChange={(e) => { setSelectedDoc(null); setDraft((p) => ({ ...p, branch_id: e.target.value, document_id: '', resource_id: '', booking_date: '', start_time: '' })); }}
                helperText="ท่า เวลาทำการ และเอกสารที่เลือกได้ ขึ้นกับสาขานี้">
                {branches.map((b) => <MenuItem key={b.id} value={b.id}>{b.branch_name}</MenuItem>)}
              </TextField>
            ) : null}

            <Autocomplete
              size="small"
              options={docOptions}
              value={selectedDoc}
              filterOptions={(x) => x}
              getOptionLabel={(o) => `${o.doc_no} · ${o.partner_name ?? '-'}`}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              noOptionsText={`ไม่พบ ${dir.docLabel} ที่เปิดอยู่`}
              onInputChange={(_, v, reason) => { if (reason === 'input') setDocQuery(v); }}
              onChange={(_, v) => {
                setSelectedDoc(v);
                // A document pins the branch: the goods are there.
                setDraft((p) => ({ ...p, document_id: v?.id ?? '', branch_id: v?.branch_id ?? p.branch_id, partner_name: v ? '' : p.partner_name, partner_phone: v ? '' : p.partner_phone }));
              }}
              renderInput={(params) => <TextField {...params} label={`เอกสาร ${dir.docLabel} (ไม่บังคับ)`} placeholder={`ค้นหาเลขที่ ${dir.docLabel} หรือชื่อคู่ค้า`} />}
              renderOption={(props, o) => <li {...props} key={o.id}>{o.doc_no} · {o.partner_name ?? '-'}{o.branches?.branch_name ? ` · ${o.branches.branch_name}` : ''}</li>}
            />

            {selectedDoc ? (
              <Alert severity="info" sx={{ py: 0.25 }}>{draft.direction === 'outbound' ? 'ลูกค้า' : 'Supplier'}: <b>{selectedDoc.partner_name ?? '-'}</b></Alert>
            ) : (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField required fullWidth size="small" label={draft.direction === 'outbound' ? 'ชื่อลูกค้า' : 'ชื่อ Supplier'} value={draft.partner_name} onChange={set('partner_name')} />
                <TextField fullWidth size="small" label="เบอร์โทร" value={draft.partner_phone} onChange={set('partner_phone')} placeholder="0812345678" slotProps={{ htmlInput: { inputMode: 'tel' } }} />
              </Stack>
            )}

            <TextField select required size="small" label="ประเภทรถ" value={draft.service_id}
              onChange={(e) => setDraft((p) => ({ ...p, service_id: e.target.value, resource_id: '', booking_date: '', start_time: '' }))}
              helperText={vehicleOptions.length === 0 ? 'ยังไม่มีประเภทรถสำหรับคิวประเภทนี้ — เพิ่มที่เมนู ประเภทรถ' : 'ประเภทรถกำหนดเวลาที่ใช้ท่า'}
            >
              {vehicleOptions.map((v) => <MenuItem key={v.id} value={v.id}>{v.service_name} — {v.duration_minutes ?? '-'} นาที</MenuItem>)}
            </TextField>

            <TextField required size="small" label="ทะเบียนรถ" value={draft.plate_number} onChange={set('plate_number')} placeholder="เช่น 70-1234 หรือ กข 1234"
              error={Boolean(draft.plate_number) && !plateOk} helperText={draft.plate_number && !plateOk ? 'ทะเบียนต้องมีตัวเลขอย่างน้อย 1 ตัว' : 'แก้ไขได้ภายหลังถ้ารถที่มาไม่ตรง'} />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField fullWidth size="small" label="ชื่อคนขับ" value={draft.driver_name} onChange={set('driver_name')} />
              <TextField fullWidth size="small" label="เบอร์คนขับ" value={draft.driver_phone} onChange={set('driver_phone')} slotProps={{ htmlInput: { inputMode: 'tel' } }} />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField fullWidth size="small" label={draft.direction === 'outbound' ? 'ชื่อผู้รับสินค้า' : 'ชื่อผู้ติดต่อ'} value={draft.receiver_name} onChange={set('receiver_name')} />
              <TextField fullWidth size="small" label="เบอร์โทร" value={draft.receiver_phone} onChange={set('receiver_phone')} slotProps={{ htmlInput: { inputMode: 'tel' } }} />
            </Stack>
            <TextField fullWidth size="small" label="หมายเหตุ" value={draft.note} onChange={set('note')} multiline minRows={2} />
          </Stack>
        ) : null}

        {activeStep === 1 ? (
          <Stack spacing={2}>
            <TextField select size="small" label="ท่า (Dock)" value={draft.resource_id} onChange={(e) => setDraft((p) => ({ ...p, resource_id: e.target.value, start_time: '' }))}>
              <MenuItem value="">ให้ระบบเลือกท่าที่ว่าง</MenuItem>
              {dockOptions.map((d) => <MenuItem key={d.id} value={d.id}>{d.resource_code ? `${d.resource_code} · ` : ''}{d.resource_name}</MenuItem>)}
            </TextField>
            <DockSlotPicker
              direction={draft.direction}
              serviceId={draft.service_id}
              branchId={draft.branch_id || undefined}
              dockId={draft.resource_id || undefined}
              date={draft.booking_date}
              time={draft.start_time}
              onChange={(n) => setDraft((p) => ({ ...p, booking_date: n.date, start_time: n.time }))}
            />
          </Stack>
        ) : null}

        {activeStep === 2 && result ? (
          <Stack spacing={2}>
            <Alert severity="success">สร้างคิวและออก DO แล้ว</Alert>
            <Box sx={{ borderRadius: 2, bgcolor: 'action.hover', p: 2.5, textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">เลขคิว</Typography>
              <Typography variant="h3" fontWeight={800} sx={{ lineHeight: 1.1 }}>{result.queueNo}</Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>{result.doNumber ?? '-'}</Typography>
            </Box>
            <Typography variant="body2"><b>วันเวลา:</b> {formatDateDMY(result.date)} {result.time}</Typography>
            <Typography variant="body2"><b>ประเภทรถ:</b> {result.vehicle}</Typography>
            <Typography variant="caption" color="text.secondary">เปิดรายการคิวเพื่อพิมพ์ DO หรือส่งลิงก์ให้คนขับ</Typography>
          </Stack>
        ) : null}
      </Box>

      <Divider />
      <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ px: 3, py: 2 }}>
        {activeStep === 0 ? (
          <>
            <Button color="inherit" onClick={handleClose}>ปิด</Button>
            <Button variant="contained" disabled={!step1Ok} onClick={() => setStep(1)}>ถัดไป: วันเวลา</Button>
          </>
        ) : null}
        {activeStep === 1 ? (
          <>
            <Button color="inherit" onClick={() => setStep(0)} disabled={creating}>ย้อนกลับ</Button>
            <Button variant="contained" disabled={creating || !step2Ok} onClick={() => onSubmit(draft)}>{creating ? 'กำลังสร้าง…' : 'สร้างคิว + ออก DO'}</Button>
          </>
        ) : null}
        {activeStep === 2 ? (
          <>
            <Button color="inherit" onClick={resetAll}>สร้างคิวใหม่</Button>
            <Button variant="contained" onClick={handleClose}>เสร็จสิ้น</Button>
          </>
        ) : null}
      </Stack>
    </Drawer>
  );
}
