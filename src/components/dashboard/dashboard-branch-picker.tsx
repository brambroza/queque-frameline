'use client';

import { Checkbox, FormControl, InputLabel, ListItemText, MenuItem, Select, type SelectChangeEvent } from '@mui/material';
import type { BranchOption } from '@/components/layout/branch-scope-provider';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { fmt } from './dashboard-utils';

/** Menu value standing for "every branch I may see". */
const ALL = '__all__';

/**
 * Branch filter of the dashboard.
 *
 * With `multi` the user ticks any number of branches, or "all branches"
 * (an empty selection). Without it the role views one branch at a time, so the
 * picker is a plain single select and always holds a branch.
 *
 * @param value Selected branch ids; empty = every branch (multi only).
 */
export function DashboardBranchPicker({
  branches,
  value,
  onChange,
  multi,
  disabled,
}: {
  branches: BranchOption[];
  value: string[];
  onChange: (next: string[]) => void;
  multi: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation('dashboard');
  const label = t('branch', 'สาขา');

  if (!multi) {
    return (
      <FormControl size="small" sx={{ minWidth: 180 }} disabled={disabled}>
        <InputLabel id="dashboard-branch-label">{label}</InputLabel>
        <Select labelId="dashboard-branch-label" id="dashboard-branch" label={label} value={value[0] ?? ''} onChange={(e: SelectChangeEvent<string>) => onChange(e.target.value ? [e.target.value] : [])}>
          {branches.map((b) => (
            <MenuItem key={b.id} value={b.id}>{b.branch_name}</MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  }

  const handle = (e: SelectChangeEvent<string[]>) => {
    const raw = e.target.value;
    const picked = typeof raw === 'string' ? raw.split(',') : raw;
    // "All" clears the list; ticking every branch is the same as "all".
    if (picked.includes(ALL)) return onChange([]);
    onChange(picked.length === branches.length ? [] : picked);
  };

  return (
    <FormControl size="small" sx={{ minWidth: 200, maxWidth: 320 }} disabled={disabled}>
      <InputLabel id="dashboard-branches-label" shrink>{label}</InputLabel>
      <Select
        labelId="dashboard-branches-label"
        id="dashboard-branches"
        label={label}
        multiple
        displayEmpty
        notched
        value={value}
        onChange={handle}
        renderValue={(selected) => {
          if (selected.length === 0) return fmt(t('branch_all_count', 'ทุกสาขา ({{count}})'), { count: branches.length });
          if (selected.length <= 2) return selected.map((id) => branches.find((b) => b.id === id)?.branch_name ?? '').filter(Boolean).join(', ');
          return fmt(t('branch_selected_count', '{{count}} สาขา'), { count: selected.length });
        }}
      >
        <MenuItem value={ALL}>
          <Checkbox size="small" checked={value.length === 0} />
          <ListItemText primary={t('branch_all', 'ทุกสาขา')} />
        </MenuItem>
        {branches.map((b) => (
          <MenuItem key={b.id} value={b.id}>
            <Checkbox size="small" checked={value.includes(b.id)} />
            <ListItemText primary={b.branch_name} />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
