'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import BugReportRoundedIcon from '@mui/icons-material/BugReportRounded';
import LightbulbRoundedIcon from '@mui/icons-material/LightbulbRounded';
import { useI18n } from '@/components/i18n/i18n-provider';
import { useToast } from '@/components/ui/toast';
import {
  FEEDBACK_CC_MAX,
  FEEDBACK_DESCRIPTION_MAX,
  FEEDBACK_DESCRIPTION_MIN,
  FEEDBACK_KIND_LABEL,
  FEEDBACK_NAME_MAX,
  FEEDBACK_PHONE_MAX,
  FEEDBACK_PRIORITIES,
  FEEDBACK_PRIORITY_COLOR,
  FEEDBACK_PRIORITY_LABEL,
  type FeedbackKind,
  type FeedbackPriority,
} from '@/lib/feedback/constants';
import { isEmailAddress, parseEmailList } from '@/lib/feedback/schemas';

export type FeedbackDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Data URL captured before the dialog opened; null when capture failed. */
  screenshot: string | null;
  /** Portal path the user is on (`/portal/bookings?tab=x`). */
  pagePath: string;
  /** Localised menu label for that path, if the path belongs to a menu. */
  pageLabel: string | null;
  /** Name from the profile, used to prefill the reporter field. */
  defaultName?: string | null;
  /** Sign-in e-mail, used to prefill the reply-to field. */
  defaultEmail?: string | null;
  branchId?: string | null;
};

type MeProfile = { data?: { phone?: string | null } };

type SubmitResponse = { data?: { id: string; emailed: boolean; screenshot_saved: boolean }; error?: string };

/**
 * Form of the floating feedback button: kind, reporter name, priority,
 * description and the screenshot preview. Posts to `/api/feedback`.
 */
export function FeedbackDialog({ open, onClose, screenshot, pagePath, pageLabel, defaultName, defaultEmail, branchId }: FeedbackDialogProps) {
  const { t, lang } = useI18n();
  const { push } = useToast();
  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [priority, setPriority] = useState<FeedbackPriority>('medium');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cc, setCc] = useState('');
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  const [attach, setAttach] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const th = lang !== 'en';
  const label = (v: { th: string; en: string }) => (th ? v.th : v.en);

  useEffect(() => {
    if (!open) return;
    setKind('bug');
    setPriority('medium');
    setName(defaultName?.trim() ?? '');
    setEmail(defaultEmail?.trim() ?? '');
    setCc('');
    setPhone('');
    setDescription('');
    setAttach(Boolean(screenshot));
    setError(null);
    setTouched(false);
    setSaving(false);

    // Phone lives on users_profile only; fetch it lazily so the button itself
    // never costs a request. Best-effort — the field stays editable either way.
    let cancelled = false;
    fetch('/api/me-profile', { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<MeProfile>) : null))
      .then((j) => {
        if (!cancelled && j?.data?.phone) setPhone((prev) => prev || j.data?.phone || '');
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, defaultName, defaultEmail, screenshot]);

  const nameError = touched && !name.trim();
  const emailTrimmed = email.trim();
  const emailError = touched && emailTrimmed.length > 0 && !isEmailAddress(emailTrimmed);
  const ccParsed = parseEmailList(cc);
  const ccError = touched && (ccParsed.invalid.length > 0 || ccParsed.emails.length > FEEDBACK_CC_MAX);
  const phoneTrimmed = phone.trim();
  const phoneError = touched && phoneTrimmed.length > 0 && !/^[0-9+()\-\s]{6,}$/.test(phoneTrimmed);
  const descTrimmed = description.trim();
  const descError = touched && descTrimmed.length < FEEDBACK_DESCRIPTION_MIN;

  async function submit() {
    if (saving) return;
    setTouched(true);
    if (!name.trim() || descTrimmed.length < FEEDBACK_DESCRIPTION_MIN) return;
    if (emailTrimmed && !isEmailAddress(emailTrimmed)) return;
    if (ccParsed.invalid.length > 0 || ccParsed.emails.length > FEEDBACK_CC_MAX) return;
    if (phoneTrimmed && !/^[0-9+()\-\s]{6,}$/.test(phoneTrimmed)) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          priority,
          reporter_name: name.trim(),
          contact_email: emailTrimmed || null,
          cc: ccParsed.emails.join(', ') || null,
          contact_phone: phoneTrimmed || null,
          description: descTrimmed,
          page_path: pagePath,
          page_label: pageLabel,
          screenshot: attach ? screenshot : null,
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : null,
          viewport: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : null,
          branch_id: branchId || null,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as SubmitResponse;
      if (!res.ok || !j.data) {
        setError(j.error ?? t('feedback.submit_failed', 'ส่งรายงานไม่สำเร็จ กรุณาลองใหม่'));
        return;
      }
      if (j.data.emailed) {
        push(t('feedback.sent', 'ส่งรายงานแล้ว ขอบคุณครับ'));
      } else {
        push(t('feedback.saved_no_email', 'บันทึกรายงานแล้ว แต่ส่งอีเมลไม่สำเร็จ (ทีมยังเห็นในระบบ)'), 'error');
      }
      onClose();
    } catch {
      setError(t('feedback.network_error', 'เชื่อมต่อไม่ได้ กรุณาลองใหม่'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 1 }}>{t('feedback.title', 'แจ้งปัญหา / แนะนำการใช้งาน')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            color="primary"
            value={kind}
            onChange={(_e, v: FeedbackKind | null) => { if (v) setKind(v); }}
            aria-label={t('feedback.kind', 'ประเภท')}
          >
            <ToggleButton value="bug" sx={{ gap: 0.75, textTransform: 'none' }}>
              <BugReportRoundedIcon fontSize="small" />
              {t('feedback.kind_bug', FEEDBACK_KIND_LABEL.bug.th)}
            </ToggleButton>
            <ToggleButton value="suggestion" sx={{ gap: 0.75, textTransform: 'none' }}>
              <LightbulbRoundedIcon fontSize="small" />
              {t('feedback.kind_suggestion', FEEDBACK_KIND_LABEL.suggestion.th)}
            </ToggleButton>
          </ToggleButtonGroup>

          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1,
              alignItems: 'center',
              px: 1.5,
              py: 1,
              borderRadius: 2,
              bgcolor: 'action.hover',
            }}
          >
            <Typography variant="caption" color="text.secondary">{t('feedback.page', 'หน้าที่แจ้ง')}</Typography>
            {pageLabel ? <Chip size="small" label={pageLabel} /> : null}
            <Typography variant="caption" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{pagePath}</Typography>
          </Box>

          <TextField
            id="feedback-name"
            size="small"
            required
            label={t('feedback.reporter_name', 'ชื่อผู้แจ้ง')}
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, FEEDBACK_NAME_MAX))}
            error={nameError}
            helperText={nameError ? t('feedback.err_name', 'กรุณากรอกชื่อผู้แจ้ง') : ' '}
            autoComplete="name"
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              id="feedback-email"
              size="small"
              fullWidth
              type="email"
              label={t('feedback.contact_email', 'อีเมลติดต่อกลับ')}
              value={email}
              onChange={(e) => setEmail(e.target.value.slice(0, 200))}
              error={emailError}
              helperText={emailError ? t('feedback.err_email', 'รูปแบบอีเมลไม่ถูกต้อง') : ' '}
              autoComplete="email"
            />
            <TextField
              id="feedback-phone"
              size="small"
              fullWidth
              type="tel"
              label={t('feedback.contact_phone', 'เบอร์โทรติดต่อกลับ')}
              value={phone}
              onChange={(e) => setPhone(e.target.value.slice(0, FEEDBACK_PHONE_MAX))}
              error={phoneError}
              helperText={phoneError ? t('feedback.err_phone', 'รูปแบบเบอร์โทรไม่ถูกต้อง') : ' '}
              autoComplete="tel"
            />
          </Stack>

          <TextField
            id="feedback-cc"
            size="small"
            label={t('feedback.cc', 'CC อีเมล (ไม่บังคับ)')}
            placeholder="a@example.com, b@example.com"
            value={cc}
            onChange={(e) => setCc(e.target.value.slice(0, 1000))}
            error={ccError}
            helperText={
              ccError
                ? ccParsed.invalid.length > 0
                  ? `${t('feedback.err_cc', 'อีเมลไม่ถูกต้อง')}: ${ccParsed.invalid.join(', ')}`
                  : t('feedback.err_cc_max', `CC ได้ไม่เกิน ${FEEDBACK_CC_MAX} อีเมล`)
                : t('feedback.cc_hint', 'มีมากกว่า 1 อีเมล คั่นด้วยเครื่องหมายจุลภาค (,)')
            }
          />

          <FormControl>
            <FormLabel id="feedback-priority-label" sx={{ fontSize: 13 }}>{t('feedback.priority', 'ลำดับความสำคัญ')}</FormLabel>
            <RadioGroup
              row
              aria-labelledby="feedback-priority-label"
              value={priority}
              onChange={(e) => setPriority(e.target.value as FeedbackPriority)}
            >
              {FEEDBACK_PRIORITIES.map((p) => (
                <FormControlLabel
                  key={p}
                  value={p}
                  control={<Radio size="small" color={FEEDBACK_PRIORITY_COLOR[p] === 'default' ? 'primary' : FEEDBACK_PRIORITY_COLOR[p]} />}
                  label={t(`feedback.priority_${p}`, label(FEEDBACK_PRIORITY_LABEL[p]))}
                />
              ))}
            </RadioGroup>
          </FormControl>

          <TextField
            id="feedback-description"
            size="small"
            required
            multiline
            minRows={4}
            label={t('feedback.description', 'รายละเอียด')}
            placeholder={
              kind === 'bug'
                ? t('feedback.description_ph_bug', 'ทำอะไรอยู่ / เกิดอะไรขึ้น / คาดว่าควรเป็นอย่างไร')
                : t('feedback.description_ph_suggestion', 'อยากให้ปรับตรงไหน เพราะอะไร')
            }
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, FEEDBACK_DESCRIPTION_MAX))}
            error={descError}
            helperText={
              descError
                ? t('feedback.err_description', `กรุณาอธิบายอย่างน้อย ${FEEDBACK_DESCRIPTION_MIN} ตัวอักษร`)
                : `${descTrimmed.length}/${FEEDBACK_DESCRIPTION_MAX}`
            }
          />

          {screenshot ? (
            <Box>
              <FormControlLabel
                control={<Checkbox size="small" checked={attach} onChange={(e) => setAttach(e.target.checked)} />}
                label={t('feedback.attach_screenshot', 'แนบภาพหน้าจอ')}
              />
              <Box
                sx={{
                  mt: 0.5,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  overflow: 'hidden',
                  opacity: attach ? 1 : 0.4,
                  transition: 'opacity 150ms',
                  bgcolor: 'background.default',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={screenshot} alt="" style={{ display: 'block', width: '100%', maxHeight: 260, objectFit: 'contain' }} />
              </Box>
            </Box>
          ) : (
            <Alert severity="warning" variant="outlined">
              {t('feedback.capture_failed', 'แคปหน้าจอไม่ได้ในเบราว์เซอร์นี้ — ส่งรายงานได้โดยไม่แนบรูป')}
            </Alert>
          )}

          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>{t('common.cancel', 'ยกเลิก')}</Button>
        <Button variant="contained" disabled={saving} onClick={() => void submit()}>
          {saving ? t('feedback.sending', 'กำลังส่ง…') : t('feedback.send', 'ส่งรายงาน')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
