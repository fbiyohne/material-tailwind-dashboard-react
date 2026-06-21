import { ProviderError } from '@/providers/errors';

export interface HttpOptions {
  /** Per-attempt timeout in ms. Default 15s. */
  readonly timeoutMs?: number;
  /** Number of retries on network failure (not on 4xx). Default 2. */
  readonly retries?: number;
  /** External cancellation. */
  readonly signal?: AbortSignal;
  readonly headers?: Readonly<Record<string, string>>;
}

const DEFAULT_TIMEOUT = 15_000;
const DEFAULT_RETRIES = 2;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * fetch() wrapper with per-attempt timeout and exponential backoff retry.
 *
 * Retries only transient network failures; a 4xx is returned immediately so
 * callers can distinguish auth/permission problems. Honors an external signal
 * so an in-flight catalog import can be cancelled cleanly.
 */
export async function httpRequest(
  url: string,
  options: HttpOptions = {},
): Promise<Response> {
  const {
    timeoutMs = DEFAULT_TIMEOUT,
    retries = DEFAULT_RETRIES,
    signal: externalSignal,
    headers,
  } = options;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (externalSignal?.aborted) {
      throw new ProviderError('cancelled', 'Request cancelled');
    }

    const controller = new AbortController();
    const onAbort = () => controller.abort();
    externalSignal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal, headers });
      // 4xx → no retry, surface as auth/parse upstream.
      if (response.status >= 400 && response.status < 500) {
        return response;
      }
      if (response.status >= 500) {
        lastError = new ProviderError('network', `Server error ${response.status}`);
      } else {
        return response;
      }
    } catch (error) {
      if (externalSignal?.aborted) {
        throw new ProviderError('cancelled', 'Request cancelled', error);
      }
      lastError = error;
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', onAbort);
    }

    // Exponential backoff: 2s, 4s, 8s… before the next attempt.
    if (attempt < retries) {
      await sleep(2_000 * 2 ** attempt);
    }
  }

  throw ProviderError.from(lastError, 'network');
}

/** Convenience: fetch JSON with the same resilience guarantees. */
export async function httpJson<T>(url: string, options?: HttpOptions): Promise<T> {
  const response = await httpRequest(url, options);
  if (response.status === 401 || response.status === 403) {
    throw new ProviderError('auth', `Authentication failed (${response.status})`);
  }
  if (!response.ok) {
    throw new ProviderError('network', `Request failed (${response.status})`);
  }
  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new ProviderError('parse', 'Invalid JSON from provider', error);
  }
}

/** Convenience: fetch text (M3U playlist, XMLTV when small). */
export async function httpText(url: string, options?: HttpOptions): Promise<string> {
  const response = await httpRequest(url, options);
  if (response.status === 401 || response.status === 403) {
    throw new ProviderError('auth', `Authentication failed (${response.status})`);
  }
  if (!response.ok) {
    throw new ProviderError('network', `Request failed (${response.status})`);
  }
  return response.text();
}
