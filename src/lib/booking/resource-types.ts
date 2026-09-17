/**
 * Resource types and their Thai labels.
 *
 * `booking_resources.resource_type` is free text in the database; this list is
 * what the portal offers and what the Zod schemas in `./schemas` accept.
 * A resource is whatever serves the customer — a table, a room, or a person
 * (`trainer`), so the labels have to read naturally in both worlds.
 */
export const RESOURCE_TYPES = ['table', 'buffet_zone', 'meeting_room', 'counter', 'service_area', 'trainer'] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];

const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  table: 'โต๊ะ',
  buffet_zone: 'โซนบุฟเฟ่ต์',
  meeting_room: 'ห้องประชุม',
  counter: 'เคาน์เตอร์',
  service_area: 'พื้นที่บริการ',
  trainer: 'เทรนเนอร์',
};

const RESOURCE_TYPE_ICONS: Record<ResourceType, string> = {
  table: '🍽️',
  buffet_zone: '🍲',
  meeting_room: '🏢',
  counter: '🧾',
  service_area: '📍',
  trainer: '🏋️',
};

/** Resource types that represent a person, not a physical spot. */
const PERSON_RESOURCE_TYPES: ReadonlySet<string> = new Set<string>(['trainer']);

/**
 * Thai label for a resource type. Falls back to a neutral word so an unknown
 * type coming from the database never renders as a raw enum key.
 */
export function resourceTypeLabel(resourceType?: string | null): string {
  const key = (resourceType || '').toLowerCase() as ResourceType;
  return RESOURCE_TYPE_LABELS[key] ?? 'ทรัพยากร';
}

/** Emoji used as the picker icon for a resource type. */
export function resourceTypeIcon(resourceType?: string | null): string {
  const key = (resourceType || '').toLowerCase() as ResourceType;
  return RESOURCE_TYPE_ICONS[key] ?? '📌';
}

/**
 * True when the resource is a person. Person resources always have capacity 1,
 * so screens must not show "N ที่นั่ง" for them.
 */
export function isPersonResourceType(resourceType?: string | null): boolean {
  return PERSON_RESOURCE_TYPES.has((resourceType || '').toLowerCase());
}

/**
 * Customer-facing message for a resource that is already taken at the requested
 * time. Kept here so every booking write path rejects with the same wording.
 */
export function resourceBusyMessage(resourceType?: string | null): string {
  const label = resourceTypeLabel(resourceType);
  return isPersonResourceType(resourceType)
    ? `${label}ท่านนี้มีคิวในช่วงเวลาที่เลือกแล้ว กรุณาเลือกเวลาอื่นหรือเปลี่ยน${label}`
    : `${label}นี้ถูกจองในช่วงเวลาที่เลือกแล้ว กรุณาเลือกเวลาอื่น`;
}
