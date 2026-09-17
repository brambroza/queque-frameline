/**
 * Optional resource ↔ service link.
 *
 * `booking_resources.service_ids` lists the services a resource can serve
 * (a yoga teacher serves "คลาสโยคะ", a massage room serves "นวดไทย").
 * NULL or an empty list means "serves everything", which keeps every shop that
 * never touched the setting working exactly as before.
 */

export type ServiceLinked = { service_ids?: string[] | null };

/**
 * True when the resource may be booked for the given service.
 * Unlinked resources (no `service_ids`) serve every service; an empty
 * `serviceId` (no service chosen yet) also passes so pickers never go blank.
 */
export function resourceServesService(resource: ServiceLinked, serviceId?: string | null): boolean {
  const ids = resource.service_ids ?? [];
  if (ids.length === 0 || !serviceId) return true;
  return ids.includes(serviceId);
}

/** Keep only resources that can serve `serviceId`; identity when no service is chosen. */
export function filterResourcesForService<T extends ServiceLinked>(resources: T[], serviceId?: string | null): T[] {
  if (!serviceId) return resources;
  return resources.filter((r) => resourceServesService(r, serviceId));
}

/** Customer-facing message when a resource is picked for a service it does not serve. */
export function resourceServiceMismatchMessage(resourceLabel: string): string {
  return `${resourceLabel}ที่เลือกไม่ได้ให้บริการนี้ กรุณาเลือก${resourceLabel}อื่นหรือไม่ระบุ`;
}
