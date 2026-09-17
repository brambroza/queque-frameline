'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Box, Button, Card, CardContent, Grid, Skeleton, Stack, TextField, Typography } from '@mui/material';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { BUSINESS_TYPE_LABELS, type BusinessType } from '@/lib/line/rich-menu/business-types';
import { canvasToBlobUnderCap, downloadBlob, ensureFontsLoaded, loadSvgImage, resolveFontStack } from '@/lib/line/rich-menu/canvas';
import { LAYOUTS, type LayoutKey } from '@/lib/line/rich-menu/layouts';
import { renderRichMenu } from '@/lib/line/rich-menu/render';
import { RICH_MENU_CHAT_BAR_MAX, RichMenuConfigSchema, type RichMenuConfig, type StyleKey } from '@/lib/line/rich-menu/schema';
import type { RichMenuState } from '@/lib/line/rich-menu/shop-state';
import { refitButtonsForLayout, templateForBusiness } from '@/lib/line/rich-menu/templates';
import { BusinessTypePicker } from './business-type-picker';
import { ButtonEditor } from './button-editor';
import { ExportBar } from './export-bar';
import { LayoutPicker } from './layout-picker';
import { PhonePreview } from './phone-preview';
import { StylePicker } from './style-picker';
import { isDirty, type BuilderState } from './rich-menu-types';

type ApiResponse = { data?: RichMenuState; error?: string };

function stateFromServer(data: RichMenuState, previous?: BuilderState): BuilderState {
  const saved = data.config;
  return {
    loaded: true,
    shopName: data.shop_name,
    // Keep unsaved local edits across a refresh from the server.
    config: previous && isDirty(previous) ? previous.config : (saved ?? data.template),
    saved,
    imageUrl: data.image_url,
    lineRichMenuId: data.line_rich_menu_id,
    publishedAt: data.published_at,
    caps: { has_token: data.has_token, has_liff_booking: data.has_liff_booking, has_liff_member: data.has_liff_member },
    busy: null,
  };
}

const EMPTY: BuilderState = {
  loaded: false,
  shopName: '',
  config: templateForBusiness(null),
  saved: null,
  imageUrl: null,
  lineRichMenuId: null,
  publishedAt: null,
  caps: { has_token: false, has_liff_booking: false, has_liff_member: false },
  busy: null,
};

/** Render the config at full size and encode it under LINE's 1 MB cap. */
async function exportImage(config: RichMenuConfig, shopName: string) {
  const layout = LAYOUTS[config.layout];
  const fontStack = resolveFontStack();
  await ensureFontsLoaded(fontStack);
  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('เบราว์เซอร์ไม่รองรับ canvas');
  await renderRichMenu(ctx, config, { scale: 1, fontStack, loadImage: loadSvgImage, shopName });
  return canvasToBlobUnderCap(canvas);
}

/** Section card used for each builder step. */
function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="baseline" mb={1.5} gap={1}>
          <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
          {hint ? <Typography variant="caption" color="text.secondary">{hint}</Typography> : null}
        </Stack>
        {children}
      </CardContent>
    </Card>
  );
}

/**
 * Rich Menu builder: pick a business type → template → tweak → preview →
 * save config / image → publish to LINE.
 */
export function RichMenuBuilder() {
  const { push } = useToast();
  const confirm = useConfirm();
  const [state, setState] = useState<BuilderState>(EMPTY);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/rich-menu', { cache: 'no-store' });
        const json = (await res.json()) as ApiResponse;
        if (!res.ok || !json.data) throw new Error(json.error ?? 'โหลดข้อมูลไม่สำเร็จ');
        setState(stateFromServer(json.data));
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ');
      }
    })();
  }, []);

  const updateConfig = useCallback((patch: Partial<RichMenuConfig>) => {
    setState((prev) => ({ ...prev, config: { ...prev.config, ...patch } }));
  }, []);

  const pickBusiness = useCallback(async (type: BusinessType) => {
    if (isDirty(state)) {
      const ok = await confirm({
        tone: 'warning',
        title: 'เปลี่ยนประเภทธุรกิจ?',
        description: 'การแก้ไขเมนูที่ยังไม่บันทึกจะหายไป และแทนที่ด้วยเทมเพลตของประเภทใหม่',
        context: { primary: BUSINESS_TYPE_LABELS[type] },
        confirmLabel: 'เปลี่ยนและทิ้งการแก้ไข',
        cancelLabel: 'กลับไปบันทึกก่อน',
      });
      if (!ok) return;
    }
    setState((prev) => ({ ...prev, config: templateForBusiness(type) }));
  }, [confirm, state]);

  const setLayout = useCallback((layout: LayoutKey) => {
    setState((prev) => ({ ...prev, config: { ...prev.config, layout, buttons: refitButtonsForLayout(prev.config, layout) } }));
  }, []);

  const updateButton = useCallback((index: number, patch: Partial<RichMenuConfig['buttons'][number]>) => {
    setState((prev) => {
      const buttons = prev.config.buttons.map((b, i) => (i === index ? { ...b, ...patch } : b));
      return { ...prev, config: { ...prev.config, buttons } };
    });
  }, []);

  /** Run an async action with busy state + toast on failure. */
  const run = useCallback(
    async (busy: BuilderState['busy'], fn: () => Promise<void>) => {
      setState((prev) => ({ ...prev, busy }));
      try {
        await fn();
      } catch (e) {
        push(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด', 'error');
      } finally {
        setState((prev) => ({ ...prev, busy: null }));
      }
    },
    [push],
  );

  const validate = useCallback((): RichMenuConfig | null => {
    const parsed = RichMenuConfigSchema.safeParse(state.config);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      push(issue?.message ?? 'ข้อมูลไม่ถูกต้อง', 'error');
      return null;
    }
    return parsed.data;
  }, [push, state.config]);

  const save = useCallback(async () => {
    const config = validate();
    if (!config) return;
    await run('save', async () => {
      const res = await fetch('/api/rich-menu', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_type: config.businessType, config }),
      });
      const json = (await res.json()) as ApiResponse;
      if (!res.ok || !json.data) throw new Error(json.error ?? 'บันทึกไม่สำเร็จ');
      setState((prev) => ({ ...stateFromServer(json.data as RichMenuState), config: prev.config }));
      push('บันทึกการตั้งค่าแล้ว');
    });
  }, [push, run, validate]);

  const download = useCallback(async () => {
    const config = validate();
    if (!config) return;
    await run('export', async () => {
      const { blob, mime } = await exportImage(config, state.shopName);
      const layout = LAYOUTS[config.layout];
      downloadBlob(blob, `richmenu-${config.businessType ?? 'custom'}-${layout.width}x${layout.height}.${mime === 'image/png' ? 'png' : 'jpg'}`);
      push(`ดาวน์โหลดแล้ว (${Math.round(blob.size / 1024)} KB${mime === 'image/jpeg' ? ' · แปลงเป็น JPEG ให้ต่ำกว่า 1 MB' : ''})`);
    });
  }, [push, run, state.shopName, validate]);

  const upload = useCallback(async () => {
    const config = validate();
    if (!config) return;
    await run('upload', async () => {
      const { blob, mime } = await exportImage(config, state.shopName);
      const form = new FormData();
      form.append('image', new File([blob], mime === 'image/png' ? 'richmenu.png' : 'richmenu.jpg', { type: mime }));
      const res = await fetch('/api/rich-menu/image', { method: 'POST', body: form });
      const json = (await res.json()) as { data?: { image_url: string; bytes: number }; error?: string };
      if (!res.ok || !json.data) throw new Error(json.error ?? 'บันทึกรูปไม่สำเร็จ');
      const imageUrl = json.data.image_url;
      setState((prev) => ({ ...prev, imageUrl }));
      push(`บันทึกรูปลงระบบแล้ว (${Math.round(json.data.bytes / 1024)} KB${mime === 'image/jpeg' ? ' · JPEG' : ''})`);
    });
  }, [push, run, state.shopName, validate]);

  const publish = useCallback(async () => {
    const ok = await confirm({
      tone: 'primary',
      title: 'เผยแพร่ Rich Menu ไป LINE OA?',
      description: 'ลูกค้าทุกคนที่แอดร้านจะเห็นเมนูนี้เป็นเมนูเริ่มต้นภายในไม่กี่วินาที',
      context: {
        primary: state.shopName || 'LINE OA',
        secondary: [state.config.businessType ? BUSINESS_TYPE_LABELS[state.config.businessType] : null, LAYOUTS[state.config.layout].label].filter(Boolean).join(' · '),
        avatar: 'LINE',
        avatarSquare: true,
      },
      acknowledge: 'เข้าใจแล้วว่าเมนูเดิมที่ระบบเผยแพร่ไว้จะถูกแทนที่ และเมนูนี้จะไม่แสดงใน LINE OA Manager',
      confirmLabel: 'เผยแพร่เมนู',
    });
    if (!ok) return;
    await run('publish', async () => {
      const res = await fetch('/api/rich-menu/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ set_default: true }) });
      const json = (await res.json()) as ApiResponse;
      if (!res.ok || !json.data) throw new Error(json.error ?? 'เผยแพร่ไม่สำเร็จ');
      setState((prev) => stateFromServer(json.data as RichMenuState, prev));
      push('เผยแพร่ไป LINE แล้ว');
    });
  }, [confirm, push, run, state.config.businessType, state.config.layout, state.shopName]);

  const unpublish = useCallback(async () => {
    const ok = await confirm({
      tone: 'warning',
      title: 'ยกเลิกการเผยแพร่?',
      description: 'ลูกค้าจะไม่เห็น Rich Menu นี้อีก จนกว่าจะเผยแพร่ใหม่',
      context: state.lineRichMenuId
        ? {
            primary: state.lineRichMenuId,
            secondary: state.publishedAt ? `เผยแพร่เมื่อ ${new Date(state.publishedAt).toLocaleString('th-TH')}` : undefined,
            avatar: 'LINE',
            avatarSquare: true,
          }
        : undefined,
      confirmLabel: 'ยกเลิกการเผยแพร่',
      cancelLabel: 'เก็บเมนูไว้',
    });
    if (!ok) return;
    await run('unpublish', async () => {
      const res = await fetch('/api/rich-menu/publish', { method: 'DELETE' });
      const json = (await res.json()) as ApiResponse;
      if (!res.ok || !json.data) throw new Error(json.error ?? 'ยกเลิกไม่สำเร็จ');
      setState((prev) => stateFromServer(json.data as RichMenuState, prev));
      push('ยกเลิกการเผยแพร่แล้ว');
    });
  }, [confirm, push, run, state.lineRichMenuId, state.publishedAt]);

  if (loadError) {
    return (
      <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => window.location.reload()}>ลองใหม่</Button>}>
        {loadError}
      </Alert>
    );
  }
  if (!state.loaded) {
    return (
      <Stack spacing={2}>
        <Skeleton variant="rounded" height={140} />
        <Skeleton variant="rounded" height={90} />
        <Skeleton variant="rounded" height={260} />
      </Stack>
    );
  }

  const { config } = state;

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5" fontWeight={800}>สร้าง Rich Menu ให้ตรงกับธุรกิจ</Typography>
        <Typography variant="body2" color="text.secondary">
          เลือกประเภทธุรกิจ ระบบจัดเลย์เอาต์ ไอคอน ข้อความ และสีให้ แก้ได้ทุกจุด แล้วดาวน์โหลดหรือเผยแพร่เข้า LINE OA ได้เลย
        </Typography>
      </Box>

      <Grid container spacing={2} alignItems="flex-start">
        <Grid size={{ xs: 12, lg: 8 }}>
          <Stack spacing={2}>
            <Section title="1. ธุรกิจของคุณ" hint="ค่านี้ดึงมาจากตอนสมัคร แก้ได้">
              <BusinessTypePicker value={config.businessType} onChange={pickBusiness} />
            </Section>

            <Section title="2. เลย์เอาต์" hint={`${LAYOUTS[config.layout].width} × ${LAYOUTS[config.layout].height} px`}>
              <LayoutPicker value={config.layout} onChange={setLayout} />
            </Section>

            <Section title="3. สไตล์และสี">
              <Stack spacing={2}>
                <StylePicker
                  style={config.style}
                  primary={config.palette.primary}
                  onStyleChange={(style: StyleKey) => updateConfig({ style })}
                  onPrimaryChange={(primary) => updateConfig({ palette: { primary } })}
                />
                <TextField
                  size="small"
                  label={`ข้อความแถบเมนู (chat bar, ≤${RICH_MENU_CHAT_BAR_MAX} ตัว)`}
                  value={config.chatBarText}
                  inputProps={{ maxLength: RICH_MENU_CHAT_BAR_MAX }}
                  onChange={(e) => updateConfig({ chatBarText: e.target.value })}
                  sx={{ maxWidth: 320 }}
                />
              </Stack>
            </Section>

            <Section title="4. ปุ่มและลิงก์" hint="ตามจำนวนช่องของเลย์เอาต์ · ★ = ช่องใหญ่">
              <ButtonEditor config={config} caps={state.caps} onChange={updateButton} />
            </Section>

            <Section title="5. บันทึกและเผยแพร่">
              <ExportBar state={state} onSave={save} onDownload={download} onUpload={upload} onPublish={publish} onUnpublish={unpublish} />
            </Section>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }} sx={{ position: { lg: 'sticky' }, top: { lg: 16 } }}>
          <PhonePreview config={config} shopName={state.shopName} />
        </Grid>
      </Grid>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Button component={Link} href="/portal/line-settings" variant="outlined">ไปหน้า LINE Settings</Button>
        <Button component={Link} href="/portal/rich-menu-guide" variant="text">คู่มือ Rich Menu</Button>
      </Stack>
    </Stack>
  );
}
