import type { ComponentType } from 'react';
import type { SignageTemplate } from '@/lib/signage/types';
import type { SignageTemplateProps } from '../template-props';
import { ClassicTemplate } from './classic';
import { SpotlightTemplate } from './spotlight';
import { CounterTemplate } from './counter';
import { BoardTemplate } from './board';
import { MinimalTemplate } from './minimal';

export type SignageTemplateMeta = {
  id: SignageTemplate;
  component: ComponentType<SignageTemplateProps>;
  label_th: string;
  label_en: string;
  description_th: string;
  /** Demo business types this template is recommended for. */
  best_for: string[];
};

export const SIGNAGE_TEMPLATE_REGISTRY: Record<SignageTemplate, SignageTemplateMeta> = {
  classic: {
    id: 'classic',
    component: ClassicTemplate,
    label_th: 'คลาสสิก',
    label_en: 'Classic',
    description_th: 'คิวที่กำลังเรียกด้านซ้าย รายการคิวถัดไปด้านขวา ใช้ได้กับทุกธุรกิจ',
    best_for: ['barber', 'general_service'],
  },
  spotlight: {
    id: 'spotlight',
    component: SpotlightTemplate,
    label_th: 'สปอตไลท์',
    label_en: 'Spotlight',
    description_th: 'เลขคิวใหญ่กลางจอ อ่านได้จากอีกฝั่งร้าน เหมาะร้านอาหาร',
    best_for: ['restaurant'],
  },
  counter: {
    id: 'counter',
    component: CounterTemplate,
    label_th: 'หลายช่อง',
    label_en: 'Counter',
    description_th: 'การ์ดต่อห้อง/ช่าง/เคาน์เตอร์ แสดงว่าใครอยู่ช่องไหน เหมาะคลินิก ห้องประชุม',
    best_for: ['clinic', 'meeting_room'],
  },
  board: {
    id: 'board',
    component: BoardTemplate,
    label_th: 'ตารางคิว',
    label_en: 'Board',
    description_th: 'ตารางแบบสนามบิน เห็นคิวทั้งหมดในหน้าเดียว เหมาะบุฟเฟ่ต์ คิวเยอะ',
    best_for: ['buffet'],
  },
  minimal: {
    id: 'minimal',
    component: MinimalTemplate,
    label_th: 'มินิมอล',
    label_en: 'Minimal',
    description_th: 'เรียบ โล่ง ไม่มีกรอบ เข้ากับธีมสว่าง เหมาะร้านเล็บ บิวตี้ คาเฟ่',
    best_for: ['nail', 'beauty'],
  },
};

export const SIGNAGE_TEMPLATE_LIST: SignageTemplateMeta[] = Object.values(SIGNAGE_TEMPLATE_REGISTRY);
