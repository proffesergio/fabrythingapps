import axios from 'axios';

// The storefront API's error envelope: `{errors, field_errors, message}` — a
// different shape than the `{data, message}` success envelope. `field_errors`
// keeps the original `{field: [messages]}` map so a screen can attribute an
// error to the right input; `errors` is the flat list for a toast/banner.
export class StoreApiError extends Error {
  errors: string[];
  fieldErrors: Record<string, string[]>;
  status?: number;

  constructor(message: string, errors: string[], fieldErrors: Record<string, string[]>, status?: number) {
    super(message);
    this.name = 'StoreApiError';
    this.errors = errors;
    this.fieldErrors = fieldErrors;
    this.status = status;
  }
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string' && value) return [value];
  return [];
}

function toFieldErrors(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, string[]> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    out[key] = toStringArray(v);
  }
  return out;
}

// Normalizes any thrown error into a StoreApiError so screens only ever
// handle one shape, whether the failure was an API error response, a network
// error, or something unexpected.
export function toStoreApiError(error: unknown): StoreApiError {
  if (error instanceof StoreApiError) return error;
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as Record<string, unknown> | undefined;
    const message = (data?.message as string) ?? error.message ?? 'Request failed';
    return new StoreApiError(message, toStringArray(data?.errors), toFieldErrors(data?.field_errors), error.response?.status);
  }
  return new StoreApiError(error instanceof Error ? error.message : 'Unknown error', [], {});
}
