import createClient from 'openapi-fetch';
import type { paths } from './apiSchema';

export const api = createClient<paths>({ baseUrl: '/api' });

/** Mirrors the backend's single error shape: `{ error: { code, message, details? } }`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const NETWORK_ERROR_CODE = 'NETWORK_ERROR';
export const UNKNOWN_ERROR_CODE = 'UNKNOWN_ERROR';

interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

function isErrorBody(body: unknown): body is ErrorBody {
  if (typeof body !== 'object' || body === null || !('error' in body)) return false;
  const { error } = body;
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    'message' in error &&
    typeof error.message === 'string'
  );
}

interface FetchResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

/**
 * Turns an openapi-fetch result into the data or a thrown `ApiError`, so TanStack Query sees
 * failures as errors and components never inspect raw responses.
 */
export async function unwrap<T>(
  request: Promise<FetchResult<T>>,
): Promise<{ data: T; response: Response }> {
  let result: FetchResult<T>;
  try {
    result = await request;
  } catch {
    throw new ApiError(0, NETWORK_ERROR_CODE, 'Could not reach the server');
  }

  const { data, error, response } = result;
  if (response.ok && data !== undefined) return { data, response };
  if (isErrorBody(error)) {
    throw new ApiError(response.status, error.error.code, error.error.message, error.error.details);
  }
  throw new ApiError(
    response.status,
    UNKNOWN_ERROR_CODE,
    'The server returned an unexpected response',
  );
}
