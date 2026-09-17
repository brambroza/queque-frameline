'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormControl,
  Grid,
  InputLabel,
  List,
  ListItem,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import PlayCircleRoundedIcon from '@mui/icons-material/PlayCircleRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import QrCode2RoundedIcon from '@mui/icons-material/QrCode2Rounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { DemoLineExperiencePanel } from '@/components/demo/demo-line-experience-panel';
import { drawDemoSlipPng } from '@/lib/demo/slip-image';

type BusinessType = 'barber' | 'clinic' | 'restaurant' | 'buffet' | 'meeting_room' | 'general_service';

const options: Array<{ value: BusinessType; th: string; en: string }> = [
  { value: 'barber', th: 'ร้านทำผม', en: 'Barber' },
  { value: 'clinic', th: 'คลินิก', en: 'Clinic' },
  { value: 'restaurant', th: 'ร้านอาหาร', en: 'Restaurant' },
  { value: 'buffet', th: 'บุฟเฟ่ต์', en: 'Buffet' },
  { value: 'meeting_room', th: 'ห้องประชุม', en: 'Meeting Room' },
  { value: 'general_service', th: 'ศูนย์บริการทั่วไป', en: 'General Service' },
];

export default function DemoSandboxPage() {
  const { push } = useToast();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [businessType, setBusinessType] = useState<BusinessType>('barber');
  const [shop, setShop] = useState<{ name?: string; demo_mode_enabled?: boolean; shop_key?: string } | null>(null);
  const [session, setSession] = useState<{ business_type?: BusinessType; reset_count?: number; started_at?: string; checklist?: Record<string, boolean> } | null>(null);
  const [hasDemoData, setHasDemoData] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [keepBranches, setKeepBranches] = useState(true);
  const [keepServices, setKeepServices] = useState(true);
  const [keepResources, setKeepResources] = useState(true);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    dashboard: false,
    create_booking: false,
    call_queue: false,
    payment_qr: false,
    payment_slip: false,
    signage: false,
    mock_chat: false,
    connect_line: false,
  });

  const selected = useMemo(() => options.find((o) => o.value === businessType), [businessType]);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/demo-sandbox', { cache: 'no-store' });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) return push(json.error ?? 'โหลดข้อมูล demo sandbox ไม่สำเร็จ', 'error');
    setShop(json.data?.shop ?? null);
    setSession(json.data?.session ?? null);
    setHasDemoData(Boolean(json.data?.has_demo_data));
    setChecklist({
      dashboard: Boolean(json.data?.session?.checklist?.dashboard),
      create_booking: Boolean(json.data?.session?.checklist?.create_booking),
      call_queue: Boolean(json.data?.session?.checklist?.call_queue),
      payment_qr: Boolean(json.data?.session?.checklist?.payment_qr),
      payment_slip: Boolean(json.data?.session?.checklist?.payment_slip),
      signage: Boolean(json.data?.session?.checklist?.signage),
      mock_chat: Boolean(json.data?.session?.checklist?.mock_chat),
      connect_line: Boolean(json.data?.session?.checklist?.connect_line),
    });
    if (json.data?.shop?.demo_business_type) setBusinessType(json.data.shop.demo_business_type);
    else if (json.data?.session?.business_type) setBusinessType(json.data.session.business_type);
  }

  useEffect(() => {
    void load();
  }, []);

  async function runAction(action: 'create' | 'reset' | 'disable') {
    if (action === 'reset') {
      const ok = await confirm({
        tone: 'warning',
        title: 'รีเซ็ตข้อมูลตัวอย่าง?',
        description: 'ข้อมูล demo ทั้งหมดจะถูกแทนที่ด้วยชุดใหม่ ข้อมูลจริงของร้านไม่ถูกแตะ',
        context: selected ? { primary: selected.th, secondary: selected.en, avatar: 'DEMO', avatarSquare: true } : undefined,
        confirmLabel: 'รีเซ็ตข้อมูล',
      });
      if (!ok) return;
    }
    setSaving(true);
    const res = await fetch('/api/demo-sandbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, business_type: businessType }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) return push(json.error ?? 'ดำเนินการไม่สำเร็จ', 'error');
    push(action === 'create' ? 'สร้างข้อมูลตัวอย่างแล้ว' : action === 'reset' ? 'รีเซ็ตข้อมูลตัวอย่างแล้ว' : 'ปิดโหมดตัวอย่างแล้ว');
    await load();
  }

  async function runDemoAction(action: 'create_booking' | 'call_next' | 'send_mock', messageText?: string, direction?: 'customer' | 'bot' | 'system') {
    setSaving(true);
    const res = await fetch('/api/demo-sandbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, business_type: businessType, message_text: messageText, direction }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) return push(json.error ?? 'ดำเนินการไม่สำเร็จ', 'error');
    if (action === 'call_next' && json.data?.called) push(`เรียกคิว ${json.data.queue_number} แล้ว`);
    if (action === 'create_booking') push('สร้าง Booking ตัวอย่างแล้ว');
    if (action === 'send_mock') push('ส่งข้อความ mock แล้ว');
    await load();
  }

  /** QR path: one call, booking comes back paid. Nothing is charged. */
  async function runQrPaymentDemo() {
    setSaving(true);
    try {
      const res = await fetch('/api/demo-sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'demo_pay_qr' }),
      });
      const json = await res.json();
      if (!res.ok) return push(json.error ?? 'จำลองการชำระเงินไม่สำเร็จ', 'error');
      push(`คิว ${json.data?.queue_number} ชำระผ่าน QR แล้ว (${json.data?.amount} บาท)`);
      await saveChecklist({ ...checklist, payment_qr: true });
      await load();
    } catch (e) {
      push(e instanceof Error ? e.message : 'จำลองการชำระเงินไม่สำเร็จ', 'error');
    } finally {
      setSaving(false);
    }
  }

  /** Transfer path: draw a demo slip, upload it, land it in the real review queue. */
  async function runSlipPaymentDemo() {
    setSaving(true);
    try {
      // Ask which booking the server will pick first, so the drawn slip shows
      // the amount that booking actually owes.
      const targetRes = await fetch('/api/demo-sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'demo_payment_target' }),
      });
      const targetJson = await targetRes.json();
      if (!targetRes.ok) return push(targetJson.error ?? 'ไม่พบคิวที่ยังไม่ได้ชำระเงิน', 'error');

      const blob = await drawDemoSlipPng({
        shopName: shop?.name ?? 'ร้านตัวอย่าง',
        amountLabel: Number(targetJson.data?.amount ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        timestampLabel: new Date().toLocaleString('th-TH'),
      });
      const form = new FormData();
      form.append('action', 'demo_upload_slip');
      form.append('file', new File([blob], 'demo-slip.png', { type: 'image/png' }));

      const res = await fetch('/api/demo-sandbox', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) return push(json.error ?? 'จำลองการส่งสลิปไม่สำเร็จ', 'error');
      push(`ส่งสลิปของคิว ${json.data?.queue_number} แล้ว — ไปกดอนุมัติที่หน้าตรวจสอบสลิป`);
      await saveChecklist({ ...checklist, payment_slip: true });
      await load();
    } catch (e) {
      push(e instanceof Error ? e.message : 'จำลองการส่งสลิปไม่สำเร็จ', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function saveChecklist(next: Record<string, boolean>) {
    setChecklist(next);
    const res = await fetch('/api/demo-sandbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_checklist', checklist: next }),
    });
    const json = await res.json();
    if (!res.ok) push(json.error ?? 'บันทึก checklist ไม่สำเร็จ', 'error');
  }

  async function convertToReal() {
    setSaving(true);
    const res = await fetch('/api/demo-sandbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'convert_to_real',
        keep_branches: keepBranches,
        keep_services: keepServices,
        keep_resources: keepResources,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) return push(json.error ?? 'Convert ไม่สำเร็จ', 'error');
    push('Convert Demo Data เป็นข้อมูลจริงแล้ว');
    setConvertOpen(false);
    await load();
  }

  return (
    <Stack spacing={2.5}>
      <Card
        sx={{
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: 'none',
          background: 'linear-gradient(135deg,#ffffff 0%,#f8fbf8 100%)',
        }}
      >
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2.5}>
            <Box>
              <Chip
                label="SANDBOX MODE"
                size="small"
                sx={{ mb: 1, bgcolor: '#EAF3DE', color: '#0a7043', fontWeight: 700, letterSpacing: 0.3 }}
              />
              <Typography variant="h5" fontWeight={800}>Demo Sandbox</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 620 }}>
                สมัครแล้วทดลองระบบได้ทันที โดยไม่ต้องเชื่อม LINE OA/LIFF จริง
              </Typography>
              {shop?.name ? (
                <Chip
                  sx={{ mt: 1.2, borderRadius: 1.5 }}
                  variant="outlined"
                  label={`ร้าน: ${shop.name}`}
                />
              ) : null}
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="flex-start">
              <Button
                component={Link}
                href="/portal/line-settings"
                variant="contained"
                startIcon={<LinkRoundedIcon />}
                sx={{ borderRadius: 1.5 }}
              >
                เชื่อม LINE OA
              </Button>
              <Button component={Link} href="/portal/onboarding/line-setup" variant="outlined" sx={{ borderRadius: 1.5 }}>
                ตั้งค่า LIFF
              </Button>
              <Button component={Link} href="/portal/rich-menu-guide" variant="outlined" sx={{ borderRadius: 1.5 }}>
                คู่มือ Rich Menu
              </Button>
              <Button variant="outlined" color="success" onClick={() => setConvertOpen(true)} sx={{ borderRadius: 1.5 }}>
                ใช้ข้อมูลตัวอย่างนี้ต่อเป็นข้อมูลจริง
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Alert
        severity="info"
        sx={{
          borderRadius: 2,
          border: '1px solid',
          borderColor: '#d8e8ff',
          bgcolor: '#f7fbff',
        }}
      >
        คุณกำลังใช้งานโหมดตัวอย่าง ข้อมูลนี้ใช้สำหรับทดลองเท่านั้น
      </Alert>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none', height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700}>Business Type</Typography>
              <Typography variant="body2" color="text.secondary" mb={1.8}>
                เลือกประเภทธุรกิจเพื่อสร้างข้อมูลตัวอย่าง
              </Typography>
              <FormControl fullWidth size="small">
                <InputLabel>ประเภทธุรกิจ</InputLabel>
                <Select
                  value={businessType}
                  label="ประเภทธุรกิจ"
                  onChange={(e) => setBusinessType(e.target.value as BusinessType)}
                >
                  {options.map((o) => (
                    <MenuItem key={o.value} value={o.value}>{o.th} ({o.en})</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} mt={2.2}>
                <Button
                  variant="contained"
                  disabled={saving}
                  startIcon={<PlayCircleRoundedIcon />}
                  sx={{ borderRadius: 1.5 }}
                  onClick={() => void runAction('create')}
                >
                  สร้างข้อมูลตัวอย่าง
                </Button>
                <Button
                  variant="outlined"
                  color="warning"
                  disabled={saving || !hasDemoData}
                  startIcon={<RestartAltRoundedIcon />}
                  sx={{ borderRadius: 1.5 }}
                  onClick={() => void runAction('reset')}
                >
                  รีเซ็ตข้อมูลตัวอย่าง
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  disabled={saving}
                  sx={{ borderRadius: 1.5 }}
                  onClick={() => void runAction('disable')}
                >
                  ปิดโหมดตัวอย่าง
                </Button>
              </Stack>

              <Stack direction="row" spacing={1} mt={2.2} flexWrap="wrap">
                <Button component={Link} href="/portal/queue-board" variant="text">เปิด Queue Board</Button>
                <Button component={Link} href="/portal/queue-display" variant="text">เปิด Digital Signage</Button>
                <Button component={Link} href="/portal/dashboard" variant="text">เปิด Dashboard</Button>
                {shop?.shop_key ? <Button component={Link} href={`/display/${encodeURIComponent(shop.shop_key)}`} variant="text">เปิด Public Display</Button> : null}
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} mt={1.5}>
                <Button sx={{ borderRadius: 1.5 }} variant="outlined" disabled={saving} onClick={() => void runDemoAction('create_booking')}>สร้าง Booking ตัวอย่าง</Button>
                <Button sx={{ borderRadius: 1.5 }} variant="outlined" disabled={saving} onClick={() => void runDemoAction('call_next')}>เรียกคิวถัดไป</Button>
                <Button sx={{ borderRadius: 1.5 }} variant="outlined" disabled={saving} onClick={() => void runDemoAction('send_mock')}>ส่ง Mock LINE Message</Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none', height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700}>ทดลองรับชำระเงิน 2 แบบ</Typography>
              <Typography variant="body2" color="text.secondary" mb={1.6}>
                ทดลองบนข้อมูลตัวอย่างเท่านั้น — ไม่มีการตัดเงินจริง และไม่เปิดการรับชำระเงินให้ร้านของคุณ
              </Typography>

              <Stack spacing={1.2}>
                <Box sx={{ p: 1.4, borderRadius: 1.5, border: '1px solid #e8edf3', bgcolor: '#f8fafc' }}>
                  <Typography variant="subtitle2" fontWeight={700}>1. สแกน QR PromptPay</Typography>
                  <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                    ลูกค้าสแกนจ่าย ระบบยืนยันให้อัตโนมัติ ร้านไม่ต้องกดอะไรเพิ่ม
                  </Typography>
                  <Button
                    variant="outlined"
                    disabled={saving || !hasDemoData}
                    startIcon={<QrCode2RoundedIcon />}
                    sx={{ borderRadius: 1.5 }}
                    onClick={() => void runQrPaymentDemo()}
                  >
                    จำลองลูกค้าจ่ายผ่าน QR
                  </Button>
                </Box>

                <Box sx={{ p: 1.4, borderRadius: 1.5, border: '1px solid #e8edf3', bgcolor: '#f8fafc' }}>
                  <Typography variant="subtitle2" fontWeight={700}>2. โอนเงิน + ส่งสลิป</Typography>
                  <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                    ลูกค้าอัปโหลดสลิป แล้วร้านกดอนุมัติหรือปฏิเสธเองที่หน้าตรวจสอบสลิป
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <Button
                      variant="outlined"
                      disabled={saving || !hasDemoData}
                      startIcon={<ReceiptLongRoundedIcon />}
                      sx={{ borderRadius: 1.5 }}
                      onClick={() => void runSlipPaymentDemo()}
                    >
                      จำลองลูกค้าโอน + ส่งสลิป
                    </Button>
                    <Button component={Link} href="/portal/payment-verification" variant="text" sx={{ borderRadius: 1.5 }}>
                      ไปหน้าตรวจสอบสลิป
                    </Button>
                  </Stack>
                </Box>
              </Stack>

              <Alert severity="info" sx={{ mt: 1.6, borderRadius: 1.5 }}>
                อยากเปิดรับชำระเงินจริง ตั้งค่าได้ที่{' '}
                <Link href="/portal/payment-settings">หน้าตั้งค่าการชำระเงิน</Link>
              </Alert>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none', height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700}>Guided Tour Checklist</Typography>
              <List dense>
                <ListItem sx={{ px: 0 }}><FormControlLabel control={<Checkbox checked={checklist.dashboard} onChange={(e) => void saveChecklist({ ...checklist, dashboard: e.target.checked })} />} label="ทดลองดู Dashboard" /></ListItem>
                <ListItem sx={{ px: 0 }}><FormControlLabel control={<Checkbox checked={checklist.create_booking} onChange={(e) => void saveChecklist({ ...checklist, create_booking: e.target.checked })} />} label="ทดลองสร้างคิว" /></ListItem>
                <ListItem sx={{ px: 0 }}><FormControlLabel control={<Checkbox checked={checklist.call_queue} onChange={(e) => void saveChecklist({ ...checklist, call_queue: e.target.checked })} />} label="ทดลองเรียกคิว" /></ListItem>
                <ListItem sx={{ px: 0 }}><FormControlLabel control={<Checkbox checked={checklist.payment_qr} onChange={(e) => void saveChecklist({ ...checklist, payment_qr: e.target.checked })} />} label="ทดลองรับชำระผ่าน QR PromptPay" /></ListItem>
                <ListItem sx={{ px: 0 }}><FormControlLabel control={<Checkbox checked={checklist.payment_slip} onChange={(e) => void saveChecklist({ ...checklist, payment_slip: e.target.checked })} />} label="ทดลองรับสลิปโอนเงินและอนุมัติ" /></ListItem>
                <ListItem sx={{ px: 0 }}><FormControlLabel control={<Checkbox checked={checklist.signage} onChange={(e) => void saveChecklist({ ...checklist, signage: e.target.checked })} />} label="ทดลองดู Digital Signage" /></ListItem>
                <ListItem sx={{ px: 0 }}><FormControlLabel control={<Checkbox checked={checklist.mock_chat} onChange={(e) => void saveChecklist({ ...checklist, mock_chat: e.target.checked })} />} label="ทดลอง Mock LINE Chat" /></ListItem>
                <ListItem sx={{ px: 0 }}><FormControlLabel control={<Checkbox checked={checklist.connect_line} onChange={(e) => void saveChecklist({ ...checklist, connect_line: e.target.checked })} />} label="เชื่อม LINE OA จริง" /></ListItem>
              </List>
              <Box sx={{ mt: 1.2, p: 1.3, borderRadius: 1.5, bgcolor: '#f8fafc', border: '1px solid #e8edf3' }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  สถานะ: {loading ? 'กำลังโหลด...' : hasDemoData ? 'พร้อมใช้งาน' : 'ยังไม่มีข้อมูลตัวอย่าง'}
                </Typography>
                {session?.started_at ? (
                  <Typography variant="caption" color="text.secondary" display="block">
                    เริ่มเมื่อ: {new Date(session.started_at).toLocaleString('th-TH')}
                  </Typography>
                ) : null}
                <Typography variant="caption" color="text.secondary" display="block">
                  reset count: {session?.reset_count ?? 0}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  ประเภทธุรกิจ: {selected?.th ?? '-'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
        <CardContent sx={{ p: { xs: 1.2, md: 2 } }}>
          <DemoLineExperiencePanel />
        </CardContent>
      </Card>

      <Dialog open={convertOpen} onClose={() => setConvertOpen(false)}>
        <DialogTitle>Convert Demo To Real</DialogTitle>
        <DialogContent>
          <Stack spacing={1} mt={0.5}>
            <Typography variant="body2" color="text.secondary">เลือกข้อมูลตัวอย่างที่จะใช้ต่อเป็นข้อมูลจริง</Typography>
            <FormControlLabel control={<Checkbox checked={keepBranches} onChange={(e) => setKeepBranches(e.target.checked)} />} label="เก็บสาขา (Branches)" />
            <FormControlLabel control={<Checkbox checked={keepServices} onChange={(e) => setKeepServices(e.target.checked)} />} label="เก็บบริการ (Services)" />
            <FormControlLabel control={<Checkbox checked={keepResources} onChange={(e) => setKeepResources(e.target.checked)} />} label="เก็บทรัพยากร (Resources)" />
            <Alert severity="warning">รายการจอง demo จะถูก archive และปิด demo mode</Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConvertOpen(false)}>ยกเลิก</Button>
          <Button variant="contained" color="success" disabled={saving} onClick={() => void convertToReal()}>
            ยืนยัน Convert
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
