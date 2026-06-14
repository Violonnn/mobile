import { FunctionsHttpError } from '@supabase/supabase-js';

const GENERIC_EDGE_FUNCTION_ERROR = 'Edge Function returned a non-2xx status code';

async function readErrorFromResponse(response: Response): Promise<string | null> {
  try {
    const body = (await response.clone().json()) as { error?: unknown };
    if (typeof body.error === 'string' && body.error.trim()) {
      return body.error.trim();
    }
  } catch {
    // response body was not JSON
  }
  return null;
}

export async function readEdgeFunctionErrorMessage(
  error: unknown,
  response: Response | undefined,
  fallback: string,
): Promise<string> {
  if (error instanceof FunctionsHttpError && error.context instanceof Response) {
    const message = await readErrorFromResponse(error.context);
    if (message) return message;
  }

  if (response) {
    const message = await readErrorFromResponse(response);
    if (message) return message;
  }

  if (error instanceof Error && error.message) {
    if (
      error.message !== GENERIC_EDGE_FUNCTION_ERROR &&
      error.name !== 'FunctionsHttpError'
    ) {
      return error.message;
    }
  }

  return fallback;
}

export type EdgeFunctionMeta = {
  sendCount?: number;
  maxSends?: number;
  cooldownSeconds?: number;
  limitReached?: boolean;
};

export function parseEdgeFunctionMeta(data: unknown): EdgeFunctionMeta {
  if (!data || typeof data !== 'object') return {};
  const record = data as Record<string, unknown>;
  return {
    sendCount: typeof record.sendCount === 'number' ? record.sendCount : undefined,
    maxSends: typeof record.maxSends === 'number' ? record.maxSends : undefined,
    cooldownSeconds:
      typeof record.cooldownSeconds === 'number' ? record.cooldownSeconds : undefined,
    limitReached:
      typeof record.limitReached === 'boolean' ? record.limitReached : undefined,
  };
}
