'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { DEFAULT_SIGNAGE_CONFIG } from '@/lib/signage/settings';
import type { SignageConfig, SignageData, SignageScopeSource } from '@/lib/signage/types';
import { MOCK_SIGNAGE_DATA } from '@/components/signage/mock-data';
import { TemplatePicker } from './template-picker';
import { DesignerControls } from './designer-controls';
import { PreviewPanel } from './preview-panel';

type Branch = { id: string; branch_name: string; active: boolean };

type QueueDisplayPayload = {
  date: string;
  branches: Branch[];
  shop: { name: string | null; shop_key: string | null; logo_url: string | null; demo_mode_enabled: boolean; demo_business_type: string | null };
  config: SignageConfig;
  scope: { branch_id: string | null; source: SignageScopeSource; settings_id: string | null };
  signage: SignageData;
};

type SettingsPayload = {
  config: SignageConfig;
  scope: { branch_id: string | null; source: SignageScopeSource; settings_id: string | null };
  shop: { shop_key: string | null; name: string; logo_url: string | null; liff_id: string | null; demo_mode_enabled: boolean; demo_business_type: string | null };
  can_edit_shop_wide: boolean;
};

const ALL_BRANCHES = '';

function isSameConfig(a: SignageConfig, b: SignageConfig): boolean {
  return (Object.keys(a) as Array<keyof SignageConfig>).every((k) => a[k] === b[k]);
}

/**
 * Portal signage designer: pick template/theme/layout and toggles on the left,
 * see a live preview on the right, then save per branch or shop-wide.
 */
export function SignageDesignerClient() {
  const { t } = useTranslation('signage');
  const { push } = useToast();
  const confirm = useConfirm();

  const [branchId, setBranchId] = useState<string>(ALL_BRANCHES);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [live, setLive] = useState<QueueDisplayPayload | null>(null);
  const [saved, setSaved] = useState<SignageConfig>(DEFAULT_SIGNAGE_CONFIG);
  const [draft, setDraft] = useState<SignageConfig>(DEFAULT_SIGNAGE_CONFIG);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [calling, setCalling] = useState(false);
  const branchInitialised = useRef(false);
  // Keep the loaders' identity stable across dictionary reloads: they sit in the
  // deps of the initial-load effect, and a changing identity there would cancel
  // the in-flight load and leave the page on its skeleton forever.
  const tRef = useRef(t);
  tRef.current = t;

  const dirty = !isSameConfig(saved, draft);

  const loadSettings = useCallback(async (branch: string) => {
    const qs = branch ? `?branch_id=${encodeURIComponent(branch)}` : '';
    const res = await fetch(`/api/signage-settings${qs}`, { cache: 'no-store' });
    const json = (await res.json()) as { data?: SettingsPayload; error?: string };
    if (!res.ok || !json.data) throw new Error(json.error ?? tRef.current('load_failed', 'โหลดการตั้งค่าจอไม่สำเร็จ'));
    return json.data;
  }, []);

  const loadLive = useCallback(async (branch: string) => {
    const qs = branch ? `?branch_id=${encodeURIComponent(branch)}` : '';
    const res = await fetch(`/api/queue-display${qs}`, { cache: 'no-store' });
    const json = (await res.json()) as { data?: QueueDisplayPayload; error?: string };
    if (!res.ok || !json.data) throw new Error(json.error ?? tRef.current('load_failed', 'โหลดข้อมูลคิวไม่สำเร็จ'));
    return json.data;
  }, []);

  // Initial load: figure out whether the caller may edit shop-wide; branch managers start on their first branch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [s, l] = await Promise.all([loadSettings(ALL_BRANCHES).catch(() => null), loadLive(ALL_BRANCHES)]);
        if (cancelled) return;
        setBranches(l.branches);
        const canShopWide = s?.can_edit_shop_wide ?? false;
        const initialBranch = canShopWide ? ALL_BRANCHES : l.branches[0]?.id ?? ALL_BRANCHES;
        branchInitialised.current = true;
        if (initialBranch !== ALL_BRANCHES) {
          const [s2, l2] = await Promise.all([loadSettings(initialBranch), loadLive(initialBranch)]);
          if (cancelled) return;
          setBranchId(initialBranch);
          setSettings(s2);
          setLive(l2);
          setSaved(s2.config);
          setDraft(s2.config);
        } else {
          setSettings(s);
          setLive(l);
          const cfg = s?.config ?? l.config;
          setSaved(cfg);
          setDraft(cfg);
        }
        setLoadError(null);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'load failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadLive, loadSettings]);

  // Branch switch (after initial load).
  const switchBranch = useCallback(async (next: string) => {
    if (dirty) {
      const nameOf = (id: string) => (id === ALL_BRANCHES ? t('all_branches', 'ทุกสาขา') : branches.find((b) => b.id === id)?.branch_name ?? id);
      const ok = await confirm({
        tone: 'warning',
        title: t('discard_confirm_title', 'เปลี่ยนสาขาโดยไม่บันทึก?'),
        description: t('discard_confirm', 'การแก้ไขหน้าจอที่ยังไม่บันทึกจะหายไป'),
        context: { primary: `${nameOf(branchId)} → ${nameOf(next)}`, avatar: '⇄', avatarSquare: true },
        confirmLabel: t('discard_and_switch', 'เปลี่ยนสาขา'),
        cancelLabel: t('back_to_save', 'กลับไปบันทึกก่อน'),
      });
      if (!ok) return;
    }
    setBranchId(next);
    try {
      const [s, l] = await Promise.all([loadSettings(next), loadLive(next)]);
      setSettings(s);
      setLive(l);
      setSaved(s.config);
      setDraft(s.config);
    } catch (e) {
      push(e instanceof Error ? e.message : 'load failed', 'error');
    }
  }, [branchId, branches, confirm, dirty, loadLive, loadSettings, push, t]);

  // Live preview polling at the draft's refresh interval.
  useEffect(() => {
    if (loading) return;
    const interval = Math.min(120, Math.max(5, draft.refresh_seconds)) * 1000;
    const timer = setInterval(() => {
      if (document.hidden) return;
      loadLive(branchId).then(setLive).catch(() => undefined);
    }, interval);
    return () => clearInterval(timer);
  }, [branchId, draft.refresh_seconds, loadLive, loading]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/signage-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch_id: branchId || null, config: draft }),
      });
      const json = (await res.json()) as { data?: { config: SignageConfig; scope: SettingsPayload['scope'] }; error?: string };
      if (!res.ok || !json.data) throw new Error(json.error ?? t('save_failed', 'บันทึกไม่สำเร็จ'));
      setSaved(json.data.config);
      setDraft(json.data.config);
      setSettings((prev) => (prev ? { ...prev, config: json.data!.config, scope: json.data!.scope } : prev));
      push(t('saved', 'บันทึกการตั้งค่าจอแล้ว'));
    } catch (e) {
      push(e instanceof Error ? e.message : t('save_failed', 'บันทึกไม่สำเร็จ'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function callNext() {
    setCalling(true);
    try {
      const res = await fetch('/api/demo-sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'call_next', ...(branchId ? { branch_id: branchId } : {}) }),
      });
      const json = (await res.json()) as { data?: { called?: boolean; queue_number?: string }; error?: string };
      if (!res.ok) throw new Error(json.error ?? t('demo_call_failed', 'เรียกคิวไม่สำเร็จ'));
      push(json.data?.called ? `${t('demo_called', 'เรียกคิว')} ${json.data.queue_number ?? ''}` : t('demo_no_queue', 'ไม่มีคิวรอเรียก'));
      setLive(await loadLive(branchId));
    } catch (e) {
      push(e instanceof Error ? e.message : 'error', 'error');
    } finally {
      setCalling(false);
    }
  }

  const tvUrl = useMemo(() => {
    const key = live?.shop.shop_key ?? settings?.shop.shop_key;
    if (!key || typeof window === 'undefined') return null;
    const url = new URL(`/display/${encodeURIComponent(key)}`, window.location.origin);
    if (branchId) url.searchParams.set('branch_id', branchId);
    return url.toString();
  }, [branchId, live?.shop.shop_key, settings?.shop.shop_key]);

  const canShopWide = settings?.can_edit_shop_wide ?? false;
  const scopeLabel =
    settings?.scope.source === 'branch'
      ? t('scope_branch', 'ตั้งค่าเฉพาะสาขานี้')
      : settings?.scope.source === 'shop'
        ? t('scope_shop', 'ใช้ค่าของทั้งร้าน')
        : t('scope_default', 'ค่าเริ่มต้นของระบบ');

  const previewData = live?.signage ?? null;
  const thumbnailData = previewData && (previewData.now_calling.length > 0 || previewData.next_queue.length > 0) ? previewData : MOCK_SIGNAGE_DATA;

  if (loading) {
    return (
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 4 }}><Skeleton variant="rounded" height={520} /></Grid>
        <Grid size={{ xs: 12, lg: 8 }}><Skeleton variant="rounded" height={420} /></Grid>
      </Grid>
    );
  }

  if (loadError) {
    return (
      <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => window.location.reload()}>{t('retry', 'ลองใหม่')}</Button>}>
        {loadError}
      </Alert>
    );
  }

  return (
    <Grid container spacing={2} alignItems="flex-start">
      <Grid size={{ xs: 12, lg: 4 }}>
        <Card variant="outlined" sx={{ borderRadius: 2, position: { lg: 'sticky' }, top: { lg: 16 } }}>
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Stack spacing={1}>
              <FormControl size="small" fullWidth>
                <InputLabel id="signage-branch-label">{t('branch', 'สาขา')}</InputLabel>
                <Select
                  labelId="signage-branch-label"
                  label={t('branch', 'สาขา')}
                  value={branchId}
                  onChange={(e) => void switchBranch(String(e.target.value))}
                >
                  {canShopWide ? <MenuItem value={ALL_BRANCHES}>{t('branch_scope_shop', 'ทุกสาขา (ค่าของทั้งร้าน)')}</MenuItem> : null}
                  {branches.map((b) => (
                    <MenuItem key={b.id} value={b.id}>{b.branch_name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip size="small" variant="outlined" label={scopeLabel} />
                {!canShopWide && branches.length === 0 ? (
                  <Typography variant="caption" color="warning.main">{t('no_branch_hint', 'ยังไม่ได้ผูกสาขากับบัญชีนี้')}</Typography>
                ) : null}
              </Stack>
            </Stack>

            <Divider />

            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle2" fontWeight={700}>{t('template', 'เทมเพลต')}</Typography>
              <Typography variant="caption" color="text.secondary">{t('template_hint', 'กดเพื่อดูตัวอย่างทันที')}</Typography>
            </Stack>
            <Box sx={{ maxHeight: { lg: 'calc(100vh - 420px)' }, overflowY: { lg: 'auto' }, pr: { lg: 0.5 } }}>
              <TemplatePicker
                value={draft.template}
                config={draft}
                data={thumbnailData}
                recommendedFor={live?.shop.demo_business_type ?? settings?.shop.demo_business_type ?? null}
                recommendedLabel={t('recommended', 'แนะนำ')}
                onChange={(template) => setDraft((d) => ({ ...d, template }))}
              />
            </Box>

            <Divider />

            <DesignerControls
              draft={draft}
              hasLiff={Boolean(settings?.shop.liff_id)}
              onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
              labels={{
                theme: t('theme', 'ชุดสี'),
                layout: t('layout', 'แนวจอ'),
                layout_landscape: t('layout_landscape', 'แนวนอน 16:9'),
                layout_portrait: t('layout_portrait', 'แนวตั้ง 9:16'),
                show_logo: t('show_logo', 'แสดงโลโก้ร้าน'),
                show_service_name: t('show_service_name', 'แสดงชื่อบริการ'),
                show_resource_name: t('show_resource_name', 'แสดงโต๊ะ / ห้อง / ช่าง'),
                show_clock: t('show_clock', 'แสดงนาฬิกา'),
                show_qr: t('show_qr', 'แสดง QR จองคิวผ่าน LINE'),
                show_qr_hint: t('show_qr_hint', 'ต้องตั้งค่า LIFF ID ก่อนจึงจะแสดง QR ได้'),
                enabled: t('enabled', 'เปิดใช้งานจอแสดงคิว'),
                customer_name_mode: t('customer_name_mode', 'ชื่อลูกค้าบนจอ'),
                name_hidden: t('name_hidden', 'ซ่อน'),
                name_masked: t('name_masked', 'ปิดบางส่วน'),
                name_full: t('name_full', 'แสดงเต็ม'),
                announcement: t('announcement', 'ข้อความประกาศ (วิ่งด้านล่างจอ)'),
                next_limit: t('next_limit', 'จำนวนคิวถัดไป'),
                waiting_limit: t('waiting_limit', 'จำนวนคิวรอเรียก'),
                refresh_seconds: t('refresh_seconds', 'รีเฟรชทุก'),
              }}
            />

            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveRoundedIcon />}
                disabled={saving || !dirty || (!canShopWide && !branchId)}
                onClick={() => void save()}
                sx={{ borderRadius: 1.5, flex: 1 }}
              >
                {t('save', 'บันทึก')}
              </Button>
              <Button
                variant="text"
                startIcon={<RestartAltRoundedIcon />}
                disabled={saving}
                onClick={() => setDraft({ ...DEFAULT_SIGNAGE_CONFIG })}
                sx={{ borderRadius: 1.5 }}
              >
                {t('reset_defaults', 'ค่าเริ่มต้น')}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, lg: 8 }}>
        <PreviewPanel
          data={previewData}
          config={draft}
          dirty={dirty}
          tvUrl={tvUrl}
          demoMode={Boolean(live?.shop.demo_mode_enabled)}
          calling={calling}
          onRefresh={() => {
            loadLive(branchId).then(setLive).catch((e: unknown) => push(e instanceof Error ? e.message : 'error', 'error'));
          }}
          onCallNext={() => void callNext()}
          notify={push}
          labels={{
            preview_live: t('preview_live', 'ตัวอย่างจากคิวจริงวันนี้'),
            unsaved_hint: t('unsaved_hint', 'ยังไม่บันทึก'),
            refresh: t('refresh', 'รีเฟรช'),
            fullscreen: t('fullscreen', 'ดูเต็มจอ'),
            fullscreen_unsupported: t('fullscreen_unsupported', 'เบราว์เซอร์นี้ไม่รองรับเต็มจอ ให้เปิดหน้า TV แทน'),
            open_tv: t('open_tv', 'เปิดบนจอ TV'),
            copy_link: t('copy_link', 'คัดลอกลิงก์'),
            link_copied: t('link_copied', 'คัดลอกลิงก์แล้ว'),
            qr_title: t('qr_title', 'QR สำหรับเปิดบนจอ'),
            qr_hint: t('qr_hint', 'สแกนด้วย Smart TV / แท็บเล็ต แล้วเปิดลิงก์แบบเต็มจอ'),
            demo_call_next: t('demo_call_next', 'เรียกคิวถัดไป (ทดลอง)'),
            calling: t('calling', 'กำลังเรียก...'),
          }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          {t('tv_hint', 'เปิดลิงก์ TV บน Smart TV, Chromecast หรือแท็บเล็ตที่ต่อจอ แล้วกดปุ่มเต็มจอ ระบบจะอัปเดตคิวอัตโนมัติ')}
        </Typography>
      </Grid>
    </Grid>
  );
}
