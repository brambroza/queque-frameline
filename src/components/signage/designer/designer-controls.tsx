'use client';

import {
  Divider,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Slider,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import CropLandscapeRoundedIcon from '@mui/icons-material/CropLandscapeRounded';
import CropPortraitRoundedIcon from '@mui/icons-material/CropPortraitRounded';
import type { SignageConfig, SignageLayout } from '@/lib/signage/types';
import { SIGNAGE_ANNOUNCEMENT_MAX } from '@/lib/signage/settings';
import { ThemeSwatches } from './theme-swatches';

export type DesignerLabels = {
  theme: string;
  layout: string;
  layout_landscape: string;
  layout_portrait: string;
  show_logo: string;
  show_service_name: string;
  show_resource_name: string;
  show_clock: string;
  show_qr: string;
  show_qr_hint: string;
  enabled: string;
  customer_name_mode: string;
  name_hidden: string;
  name_masked: string;
  name_full: string;
  announcement: string;
  next_limit: string;
  waiting_limit: string;
  refresh_seconds: string;
};

export function DesignerControls({
  draft,
  labels,
  hasLiff,
  onChange,
}: {
  draft: SignageConfig;
  labels: DesignerLabels;
  hasLiff: boolean;
  onChange: (patch: Partial<SignageConfig>) => void;
}) {
  return (
    <Stack spacing={2.2}>
      <div>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>{labels.theme}</Typography>
        <ThemeSwatches value={draft.theme} onChange={(theme) => onChange({ theme })} />
      </div>

      <div>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>{labels.layout}</Typography>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={draft.layout}
          onChange={(_, v: SignageLayout | null) => {
            if (v) onChange({ layout: v });
          }}
        >
          <ToggleButton value="landscape" sx={{ gap: 0.6, px: 1.5 }}>
            <CropLandscapeRoundedIcon fontSize="small" /> {labels.layout_landscape}
          </ToggleButton>
          <ToggleButton value="portrait" sx={{ gap: 0.6, px: 1.5 }}>
            <CropPortraitRoundedIcon fontSize="small" /> {labels.layout_portrait}
          </ToggleButton>
        </ToggleButtonGroup>
      </div>

      <Divider />

      <Stack spacing={0.2}>
        <FormControlLabel control={<Switch checked={draft.show_logo} onChange={(e) => onChange({ show_logo: e.target.checked })} />} label={labels.show_logo} />
        <FormControlLabel control={<Switch checked={draft.show_service_name} onChange={(e) => onChange({ show_service_name: e.target.checked })} />} label={labels.show_service_name} />
        <FormControlLabel control={<Switch checked={draft.show_resource_name} onChange={(e) => onChange({ show_resource_name: e.target.checked })} />} label={labels.show_resource_name} />
        <FormControlLabel control={<Switch checked={draft.show_clock} onChange={(e) => onChange({ show_clock: e.target.checked })} />} label={labels.show_clock} />
        <FormControlLabel
          control={<Switch checked={draft.show_qr} disabled={!hasLiff} onChange={(e) => onChange({ show_qr: e.target.checked })} />}
          label={labels.show_qr}
        />
        {!hasLiff ? <Typography variant="caption" color="text.secondary" sx={{ pl: 6 }}>{labels.show_qr_hint}</Typography> : null}
      </Stack>

      <FormControl>
        <FormLabel sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary', mb: 0.5 }}>{labels.customer_name_mode}</FormLabel>
        <RadioGroup row value={draft.customer_name_mode} onChange={(e) => onChange({ customer_name_mode: e.target.value as SignageConfig['customer_name_mode'] })}>
          <FormControlLabel value="hidden" control={<Radio size="small" />} label={labels.name_hidden} />
          <FormControlLabel value="masked" control={<Radio size="small" />} label={labels.name_masked} />
          <FormControlLabel value="full" control={<Radio size="small" />} label={labels.name_full} />
        </RadioGroup>
      </FormControl>

      <TextField
        label={labels.announcement}
        value={draft.announcement_text ?? ''}
        onChange={(e) => onChange({ announcement_text: e.target.value.slice(0, SIGNAGE_ANNOUNCEMENT_MAX) || null })}
        multiline
        minRows={2}
        size="small"
        helperText={`${(draft.announcement_text ?? '').length}/${SIGNAGE_ANNOUNCEMENT_MAX}`}
        slotProps={{ htmlInput: { maxLength: SIGNAGE_ANNOUNCEMENT_MAX } }}
      />

      <SliderField label={labels.next_limit} value={draft.next_queue_limit} min={1} max={10} onChange={(v) => onChange({ next_queue_limit: v })} />
      <SliderField label={labels.waiting_limit} value={draft.waiting_queue_limit} min={0} max={20} onChange={(v) => onChange({ waiting_queue_limit: v })} />
      <SliderField label={labels.refresh_seconds} value={draft.refresh_seconds} min={5} max={120} step={5} unit="s" onChange={(v) => onChange({ refresh_seconds: v })} />

      <Divider />

      <FormControlLabel control={<Switch checked={draft.enabled} onChange={(e) => onChange({ enabled: e.target.checked })} />} label={labels.enabled} />
    </Stack>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="body2" fontWeight={600}>{label}</Typography>
        <Typography variant="body2" color="text.secondary">{value}{unit}</Typography>
      </Stack>
      <Slider size="small" value={value} min={min} max={max} step={step} onChange={(_, v) => onChange(Array.isArray(v) ? v[0] : v)} sx={{ mt: -0.5 }} />
    </div>
  );
}
