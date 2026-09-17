import type { SignageConfig, SignageData } from '@/lib/signage/types';
import type { SignageLabels } from './labels';
import type { SignageMode } from './parts';

/** Props every signage template receives from `SignageBoard`. */
export type SignageTemplateProps = {
  data: SignageData;
  config: SignageConfig;
  mode: SignageMode;
  labels: SignageLabels;
  clock: string | null;
  dateLabel: string;
};
