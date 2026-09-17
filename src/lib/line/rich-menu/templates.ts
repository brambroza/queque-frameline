import type { BusinessType } from './business-types';
import type { IconKey } from './icons';
import { LAYOUTS, type LayoutKey } from './layouts';
import type { RichMenuAction, RichMenuButton, RichMenuConfig } from './schema';

const liffBooking: RichMenuAction = { type: 'liff_booking' };
const liffMember: RichMenuAction = { type: 'liff_member' };
const msg = (text: string): RichMenuAction => ({ type: 'message', text });
/** Placeholder URL — the owner replaces it in the builder. */
const url = (): RichMenuAction => ({ type: 'url', url: 'https://example.com' });

const btn = (iconKey: IconKey, label: string, action: RichMenuAction): RichMenuButton => ({ iconKey, label, action });

type TemplateSeed = Omit<RichMenuConfig, 'version' | 'businessType'>;

const T = (layout: LayoutKey, style: RichMenuConfig['style'], primary: string, chatBarText: string, buttons: RichMenuButton[]): TemplateSeed => ({
  layout,
  style,
  palette: { primary },
  chatBarText,
  buttons,
});

/** Master template per business type. Every field is editable afterwards. */
const SEEDS: Record<BusinessType, TemplateSeed> = {
  salon: T('hero3', 'card', '#202939', 'จองคิว', [
    btn('booking', 'จองคิว', liffBooking),
    btn('member', 'สมาชิก', liffMember),
    btn('services', 'บริการ & ราคา', msg('ขอดูบริการและราคา')),
    btn('contact', 'ติดต่อร้าน', msg('ติดต่อร้าน')),
  ]),
  nail: T('hero3', 'card', '#e0508a', 'นัดทำเล็บ', [
    btn('nail', 'นัดทำเล็บ', liffBooking),
    btn('member', 'สมาชิก', liffMember),
    btn('promo', 'โปรโมชัน', msg('ขอดูโปรโมชัน')),
    btn('contact', 'ติดต่อร้าน', msg('ติดต่อร้าน')),
  ]),
  clinic: T('grid3x2', 'clean', '#2e8ad8', 'นัดหมาย', [
    btn('booking', 'นัดหมาย', liffBooking),
    btn('queue', 'เช็คคิว', liffMember),
    btn('member', 'ประวัติของฉัน', liffMember),
    btn('services', 'บริการ', msg('ขอดูบริการ')),
    btn('location', 'แผนที่', url()),
    btn('contact', 'ติดต่อ', msg('ติดต่อคลินิก')),
  ]),
  restaurant: T('grid3x2', 'bold', '#f07d29', 'จองโต๊ะ', [
    btn('table', 'จองโต๊ะ', liffBooking),
    btn('queue', 'เช็คคิว', liffMember),
    btn('food', 'เมนู', url()),
    btn('promo', 'โปรโมชัน', msg('ขอดูโปรโมชัน')),
    btn('location', 'แผนที่', url()),
    btn('contact', 'ติดต่อ', msg('ติดต่อร้าน')),
  ]),
  buffet: T('grid2x2', 'bold', '#e14b4a', 'รับคิว', [
    btn('table', 'จองโต๊ะ', liffBooking),
    btn('queue', 'คิวตอนนี้', liffMember),
    btn('food', 'ราคา / รอบ', msg('ขอดูราคาและรอบ')),
    btn('contact', 'ติดต่อ', msg('ติดต่อร้าน')),
  ]),
  fitness: T('grid3x2', 'bold', '#202939', 'จองคลาส', [
    btn('dumbbell', 'จองคลาส', liffBooking),
    btn('member', 'สมาชิก', liffMember),
    btn('hours', 'ตารางคลาส', url()),
    btn('promo', 'โปรโมชัน', msg('ขอดูโปรโมชัน')),
    btn('location', 'แผนที่', url()),
    btn('contact', 'ติดต่อ', msg('ติดต่อฟิตเนส')),
  ]),
  meeting_room: T('grid2x2', 'clean', '#1f3a8a', 'จองห้อง', [
    btn('room', 'จองห้อง', liffBooking),
    btn('queue', 'การจองของฉัน', liffMember),
    btn('services', 'ห้อง & ราคา', url()),
    btn('contact', 'ติดต่อ', msg('ติดต่อเจ้าหน้าที่')),
  ]),
  auto_repair: T('hero3', 'card', '#1f3a8a', 'จองคิวซ่อม', [
    btn('wrench', 'จองคิวซ่อม', liffBooking),
    btn('car', 'สถานะรถ', liffMember),
    btn('location', 'แผนที่', url()),
    btn('contact', 'ติดต่อ', msg('ติดต่อศูนย์บริการ')),
  ]),
  mobile_repair: T('grid3x1', 'clean', '#7b52d3', 'จองซ่อม', [
    btn('phone', 'จองซ่อม', liffBooking),
    btn('queue', 'เช็คสถานะ', liffMember),
    btn('contact', 'ติดต่อ', msg('ติดต่อร้าน')),
  ]),
  field_service: T('grid2x2', 'clean', '#0a7043', 'นัดช่าง', [
    btn('hardhat', 'นัดช่าง', liffBooking),
    btn('queue', 'ติดตามงาน', liffMember),
    btn('services', 'บริการ', msg('ขอดูบริการ')),
    btn('contact', 'ติดต่อ', msg('ติดต่อทีมช่าง')),
  ]),
  government: T('grid3x2', 'clean', '#3b4f7a', 'จองคิว', [
    btn('document', 'จองคิว', liffBooking),
    btn('queue', 'ตรวจสอบคิว', liffMember),
    btn('member', 'ข้อมูลของฉัน', liffMember),
    btn('services', 'บริการ', url()),
    btn('hours', 'เวลาทำการ', msg('ขอทราบเวลาทำการ')),
    btn('contact', 'ติดต่อ', msg('ติดต่อเจ้าหน้าที่')),
  ]),
  consult: T('grid2x1', 'card', '#12a862', 'นัดปรึกษา', [
    btn('talk', 'นัดปรึกษา', liffBooking),
    btn('contact', 'ติดต่อ', msg('ติดต่อสอบถาม')),
  ]),
};

/** Generic template when the shop has no business type yet. */
const GENERIC: TemplateSeed = T('grid2x2', 'clean', '#12a862', 'จองคิว', [
  btn('booking', 'จองคิว', liffBooking),
  btn('queue', 'เช็คคิวของฉัน', liffMember),
  btn('services', 'บริการ', msg('ขอดูบริการ')),
  btn('contact', 'ติดต่อร้าน', msg('ติดต่อร้าน')),
]);

/** Deep-cloned template config for a business type (generic when null/unknown). */
export function templateForBusiness(businessType: BusinessType | null): RichMenuConfig {
  const seed = businessType ? SEEDS[businessType] : GENERIC;
  return {
    version: 1,
    businessType,
    layout: seed.layout,
    style: seed.style,
    palette: { ...seed.palette },
    chatBarText: seed.chatBarText,
    buttons: seed.buttons.map((b) => ({ ...b, action: { ...b.action } })),
  };
}

/** Fallback button used to pad when a layout has more cells than the template. */
const FILLERS: IconKey[] = ['booking', 'queue', 'services', 'contact', 'location', 'promo'];

/**
 * Re-fit `config.buttons` to a new layout: keep existing buttons in order,
 * drop extras, and pad with template defaults (then generic fillers).
 */
export function refitButtonsForLayout(config: RichMenuConfig, layout: LayoutKey): RichMenuButton[] {
  const target = LAYOUTS[layout].cells.length;
  const kept = config.buttons.slice(0, target).map((b) => ({ ...b, action: { ...b.action } }));
  const template = templateForBusiness(config.businessType).buttons;
  while (kept.length < target) {
    const fromTemplate = template[kept.length];
    if (fromTemplate) kept.push({ ...fromTemplate, action: { ...fromTemplate.action } });
    else {
      const icon = FILLERS[kept.length % FILLERS.length];
      kept.push(btn(icon, `ปุ่ม ${kept.length + 1}`, msg(`ปุ่ม ${kept.length + 1}`)));
    }
  }
  return kept;
}
