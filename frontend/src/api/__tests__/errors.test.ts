import { describe, expect, it } from 'vitest';
import { ApiDomainError, toApiDomainError } from '../errors';

describe('api errors mapping', () => {
  it('maps axios-like errors with status and detail', () => {
    const mapped = toApiDomainError(
      {
        isAxiosError: true,
        response: {
          status: 404,
          data: { detail: 'Entity not found' },
        },
      },
      'entities',
      'deleteEntity'
    );

    expect(mapped).toBeInstanceOf(ApiDomainError);
    expect(mapped.statusCode).toBe(404);
    expect(mapped.domain).toBe('entities');
    expect(mapped.operation).toBe('deleteEntity');
    expect(mapped.detail).toContain('Entity not found');
  });

  it('maps generic errors with detail message', () => {
    const mapped = toApiDomainError(new Error('boom'), 'ops', 'getStats');
    expect(mapped).toBeInstanceOf(ApiDomainError);
    expect(mapped.statusCode).toBeUndefined();
    expect(mapped.detail).toBe('boom');
  });
});
