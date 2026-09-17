'use client';

import { useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  MenuItem,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { NICKNAME_MAX } from '@/lib/booking/customer-label';
import { formatDateDMY, getTodayISOInBangkok } from '@/lib/utils/date-format';
import type { Branch, LineUser, Resource, Service } from './booking-types';
import { filterResourcesForService } from '@/lib/booking/resource-service-link';

export type CreateDraft = {
  branch_id: string;
  service_id: string;
  booking_date: string;
  start_time: string;
  party_size: string;
  resource_id: string;
  customer_name: string;
  customer_nickname: string;
  customer_phone: string;
  note: string;
};

export type CreateResult = { queueNo: string; branch: string; service: string; date: string; time: string };

export const EMPTY_CREATE_DRAFT: CreateDraft = {
  branch_id: '', service_id: '', booking_date: '', start_time: '',
  party_size: '', resource_id: '', customer_name: '', customer_nickname: '', customer_phone: '', note: '',
};

/**
 * Three-step walk-in booking drawer: customer, slot, result.
 * The parent owns submission so the list can refresh after success.
 */
export function BookingCreateDrawer({
  open,
  onClose,
  branches,
  services,
  lineUsers,
  resources,
  resourceLabel,
  creating,
  result,
  onSubmit,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  branches: Branch[];
  services: Service[];
  lineUsers: LineUser[];
  resources: Resource[];
  resourceLabel: string;
  creating: boolean;
  /** Set by the parent after a successful create; switches to the result step. */
  result: CreateResult | null;
  onSubmit: (draft: CreateDraft, lineUserId: string) => void;
  onReset: () => void;
}) {
  const { t } = useTranslation('bookings');
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<CreateDraft>(EMPTY_CREATE_DRAFT);
  const [lineUserId, setLineUserId] = useState('');

  const activeStep = result ? 2 : step;
  const set = (key: keyof CreateDraft) => (e: React.ChangeEvent<HTMLInputElement>) => setDraft((p) => ({ ...p, [key]: e.target.value }));

  const step1Ok = Boolean(draft.branch_id && draft.service_id && draft.customer_name.trim() && draft.customer_phone.trim());
  const step2Ok = Boolean(draft.booking_date && draft.start_time);

  function resetAll() {
    setStep(0);
    setDraft(EMPTY_CREATE_DRAFT);
    setLineUserId('');
    onReset();
  }

  function handleClose() {
    if (creating) return;
    onClose();
    // Reset after the slide-out so the form does not flash empty while closing.
    setTimeout(resetAll, 200);
  }

  // Resources linked to specific services only show up for those services.
  const resourceOptions = filterResourcesForService(
    resources.filter((r) => !r.branch_id || r.branch_id === draft.branch_id),
    draft.service_id,
  );

  /** LINE profile avatar + "nickname (display name)" for the picker. */
  function renderLineUser(u: LineUser) {
    const displayName = u.display_name?.trim() || 'LINE User';
    const nickname = u.nickname?.trim() || '';
    return (
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
        <Avatar src={u.picture_url ?? undefined} alt={displayName} sx={{ width: 28, height: 28, fontSize: 13 }}>
          {(nickname || displayName).charAt(0)}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" noWrap>
            {nickname ? <><b>{nickname}</b> ({displayName})</> : displayName}
          </Typography>
        </Box>
      </Stack>
    );
  }

  const selectedLineUser = lineUsers.find((x) => x.id === lineUserId) ?? null;

  return (
    <Drawer anchor="right" open={open} onClose={handleClose} PaperProps={{ sx: { width: { xs: '100%', sm: 520 } } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 3, py: 2 }}>
        <Typography variant="h6" fontWeight={700}>{t('add_queue', 'เพิ่มคิวใหม่')}</Typography>
        <IconButton onClick={handleClose} aria-label={t('close', 'ปิด')} disabled={creating}><CloseRoundedIcon /></IconButton>
      </Stack>
      <Divider />

      <Box sx={{ px: 3, pt: 2 }}>
        <Stepper activeStep={activeStep} alternativeLabel>
          <Step><StepLabel>{t('step_customer', 'ลูกค้า')}</StepLabel></Step>
          <Step><StepLabel>{t('step_slot', 'วันเวลา')}</StepLabel></Step>
          <Step><StepLabel>{t('step_done', 'เสร็จสิ้น')}</StepLabel></Step>
        </Stepper>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 3 }}>
        {activeStep === 0 ? (
          <Stack spacing={2}>
            <TextField
              id="create-line-user"
              select
              size="small"
              label={t('line_user', 'LINE User (ไม่บังคับ — ส่งยืนยันอัตโนมัติ)')}
              value={lineUserId}
              onChange={(e) => {
                setLineUserId(e.target.value);
                const u = lineUsers.find((x) => x.id === e.target.value);
                if (!u) return;
                // Prefill untouched fields from the LINE profile; never overwrite what staff typed.
                setDraft((p) => ({
                  ...p,
                  customer_name: p.customer_name.trim() ? p.customer_name : (u.display_name ?? ''),
                  customer_nickname: p.customer_nickname.trim() ? p.customer_nickname : (u.nickname ?? ''),
                }));
              }}
              slotProps={{
                select: {
                  displayEmpty: false,
                  renderValue: () => (selectedLineUser ? renderLineUser(selectedLineUser) : null),
                  MenuProps: { PaperProps: { sx: { maxHeight: 360 } } },
                },
              }}
              // Keep the small-input height stable when the avatar row is rendered as the value.
              sx={{ '& .MuiSelect-select': { display: 'flex', alignItems: 'center', py: 0.75 } }}
            >
              <MenuItem value="">{t('none', 'ไม่เลือก')}</MenuItem>
              {lineUsers.map((u) => (
                <MenuItem key={u.id} value={u.id}>{renderLineUser(u)}</MenuItem>
              ))}
            </TextField>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField id="create-branch" select required fullWidth size="small" label={t('branch', 'สาขา')} value={draft.branch_id} onChange={set('branch_id')}>
                {branches.map((b) => <MenuItem key={b.id} value={b.id}>{b.branch_name}</MenuItem>)}
              </TextField>
              <TextField id="create-service" select required fullWidth size="small" label={t('service', 'บริการ')} value={draft.service_id} onChange={set('service_id')}>
                {services.map((s) => (
                  <MenuItem key={s.id} value={s.id}>{s.service_name}{s.price ? ` — ฿${s.price}` : ''}</MenuItem>
                ))}
              </TextField>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField id="create-name" required fullWidth size="small" label={t('customer_name', 'ชื่อลูกค้า')} value={draft.customer_name} onChange={set('customer_name')} />
              <TextField id="create-phone" required fullWidth size="small" label={t('customer_phone', 'เบอร์โทร')} value={draft.customer_phone} onChange={set('customer_phone')} placeholder="0812345678" slotProps={{ htmlInput: { inputMode: 'tel' } }} />
            </Stack>
            <TextField
              id="create-nickname"
              fullWidth
              size="small"
              label={t('customer_nickname', 'ชื่อเล่น (ไม่บังคับ)')}
              helperText={t('customer_nickname_hint', 'ใช้เรียกคิว แสดงบนจอคิว')}
              value={draft.customer_nickname}
              onChange={set('customer_nickname')}
              slotProps={{ htmlInput: { maxLength: NICKNAME_MAX } }}
            />
          </Stack>
        ) : null}

        {activeStep === 1 ? (
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField id="create-date" type="date" required fullWidth size="small" label={t('date', 'วันที่')} value={draft.booking_date} onChange={set('booking_date')} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: getTodayISOInBangkok() } }} />
              <TextField id="create-time" type="time" required fullWidth size="small" label={t('time_start', 'เวลาเริ่ม')} value={draft.start_time} onChange={set('start_time')} slotProps={{ inputLabel: { shrink: true } }} />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField id="create-party" type="number" fullWidth size="small" label={t('party_size', 'จำนวนคน (ไม่บังคับ)')} value={draft.party_size} onChange={set('party_size')} slotProps={{ htmlInput: { min: 1, max: 200 } }} />
              {resourceOptions.length > 0 ? (
                <TextField id="create-resource" select fullWidth size="small" label={`${resourceLabel} (${t('optional', 'ไม่บังคับ')})`} value={draft.resource_id} onChange={set('resource_id')}>
                  <MenuItem value="">{`${t('filter_unassigned', 'ยังไม่ระบุ')}${resourceLabel}`}</MenuItem>
                  {resourceOptions.map((r) => (
                    <MenuItem key={r.id} value={r.id}>{r.resource_code ? `${r.resource_code} · ` : ''}{r.resource_name} (cap {r.capacity})</MenuItem>
                  ))}
                </TextField>
              ) : null}
            </Stack>
            <TextField id="create-note" fullWidth size="small" label={t('note', 'หมายเหตุ (ไม่บังคับ)')} value={draft.note} onChange={set('note')} multiline minRows={2} />
          </Stack>
        ) : null}

        {activeStep === 2 && result ? (
          <Stack spacing={2}>
            <Alert severity="success">{t('create_success', 'สร้างคิวสำเร็จ')}</Alert>
            <Box sx={{ borderRadius: 2, bgcolor: 'action.hover', p: 2.5, textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">{t('queue_number', 'เลขคิว')}</Typography>
              <Typography variant="h3" fontWeight={800} sx={{ lineHeight: 1.1 }}>{result.queueNo}</Typography>
            </Box>
            <Stack spacing={0.5}>
              <Typography variant="body2"><b>{t('service', 'บริการ')}:</b> {result.service}</Typography>
              <Typography variant="body2"><b>{t('branch', 'สาขา')}:</b> {result.branch}</Typography>
              <Typography variant="body2"><b>{t('date', 'วันที่')}:</b> {formatDateDMY(result.date)} {result.time}</Typography>
            </Stack>
          </Stack>
        ) : null}
      </Box>

      <Divider />
      <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ px: 3, py: 2 }}>
        {activeStep === 0 ? (
          <>
            <Button color="inherit" onClick={handleClose}>{t('cancel', 'ยกเลิก')}</Button>
            <Button variant="contained" disabled={!step1Ok} onClick={() => setStep(1)}>{t('next_slot', 'ถัดไป: วันเวลา')}</Button>
          </>
        ) : null}
        {activeStep === 1 ? (
          <>
            <Button color="inherit" onClick={() => setStep(0)} disabled={creating}>{t('back', 'ย้อนกลับ')}</Button>
            <Button variant="contained" disabled={creating || !step2Ok} onClick={() => onSubmit(draft, lineUserId)}>
              {creating ? t('creating', 'กำลังสร้าง…') : t('create_confirm', 'ยืนยันสร้างคิว')}
            </Button>
          </>
        ) : null}
        {activeStep === 2 ? (
          <>
            <Button color="inherit" onClick={resetAll}>{t('create_another', 'จองคิวใหม่')}</Button>
            <Button variant="contained" onClick={handleClose}>{t('done', 'เสร็จสิ้น')}</Button>
          </>
        ) : null}
      </Stack>
    </Drawer>
  );
}
