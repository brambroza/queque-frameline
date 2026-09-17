import { describe, expect, it } from 'vitest';
import { filterResourcesForService, resourceServesService, resourceServiceMismatchMessage } from './resource-service-link';

const yoga = 'a0000000-0000-4000-8000-000000000001';
const pilates = 'a0000000-0000-4000-8000-000000000002';

describe('resourceServesService', () => {
  it('serves every service when no link is set', () => {
    expect(resourceServesService({ service_ids: null }, yoga)).toBe(true);
    expect(resourceServesService({ service_ids: [] }, yoga)).toBe(true);
    expect(resourceServesService({}, yoga)).toBe(true);
  });

  it('passes when no service is chosen yet', () => {
    expect(resourceServesService({ service_ids: [yoga] }, '')).toBe(true);
    expect(resourceServesService({ service_ids: [yoga] }, null)).toBe(true);
  });

  it('restricts to linked services', () => {
    expect(resourceServesService({ service_ids: [yoga] }, yoga)).toBe(true);
    expect(resourceServesService({ service_ids: [yoga] }, pilates)).toBe(false);
  });
});

describe('filterResourcesForService', () => {
  const rows = [
    { id: 'teacher', service_ids: [yoga] },
    { id: 'room', service_ids: null },
    { id: 'reformer', service_ids: [pilates] },
  ];

  it('returns everything when no service is chosen', () => {
    expect(filterResourcesForService(rows, '')).toHaveLength(3);
  });

  it('keeps linked and unlinked resources for the chosen service', () => {
    expect(filterResourcesForService(rows, yoga).map((r) => r.id)).toEqual(['teacher', 'room']);
  });
});

describe('resourceServiceMismatchMessage', () => {
  it('names the resource type', () => {
    expect(resourceServiceMismatchMessage('เทรนเนอร์')).toContain('เทรนเนอร์');
  });
});
