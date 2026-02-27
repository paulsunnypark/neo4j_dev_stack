import { isAxiosError } from 'axios';

export class ApiDomainError extends Error {
  readonly domain: string;
  readonly operation: string;
  readonly statusCode?: number;
  readonly detail?: string;

  constructor(params: {
    domain: string;
    operation: string;
    statusCode?: number;
    detail?: string;
    message: string;
  }) {
    super(params.message);
    this.name = 'ApiDomainError';
    this.domain = params.domain;
    this.operation = params.operation;
    this.statusCode = params.statusCode;
    this.detail = params.detail;
  }
}

const normalizeDetail = (value: unknown) => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
    try {
      return JSON.stringify(value);
    } catch {
      return 'Unserializable error payload';
    }
  }
  return undefined;
};

export const toApiDomainError = (error: unknown, domain: string, operation: string) => {
  if (isAxiosError(error)) {
    const detail = normalizeDetail(error.response?.data);
    const statusCode = error.response?.status;
    return new ApiDomainError({
      domain,
      operation,
      statusCode,
      detail,
      message: `[${domain}] ${operation} failed${statusCode ? ` (${statusCode})` : ''}`,
    });
  }

  if (error instanceof Error) {
    return new ApiDomainError({
      domain,
      operation,
      message: `[${domain}] ${operation} failed`,
      detail: error.message,
    });
  }

  return new ApiDomainError({
    domain,
    operation,
    message: `[${domain}] ${operation} failed`,
  });
};

export const withApiErrorMapping = async <T>(
  domain: string,
  operation: string,
  action: () => Promise<T>
) => {
  try {
    return await action();
  } catch (error) {
    throw toApiDomainError(error, domain, operation);
  }
};
