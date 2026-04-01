import { describe, expect, it } from 'vitest';
import { defaultPermissionsForType, listConnectorCatalog } from './connector-registry-service.js';

describe('connector-registry-service', () => {
  it('lists catalog entries', () => {
    const c = listConnectorCatalog();
    expect(c.some((x) => x.connectorType === 'CALENDAR')).toBe(true);
  });

  it('defaults calendar permissions', () => {
    expect(defaultPermissionsForType('CALENDAR')).toContain('READ_EVENTS');
  });
});
