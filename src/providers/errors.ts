/** Normalized error every provider throws, so the UI can react uniformly. */
export type ProviderErrorCode =
  | 'network' // unreachable host, DNS, timeout
  | 'auth' // bad credentials / expired account
  | 'parse' // malformed provider payload
  | 'unsupported' // capability not offered by this provider
  | 'cancelled' // aborted by caller
  | 'unknown';

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  override readonly cause?: unknown;

  constructor(code: ProviderErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    this.cause = cause;
  }

  static from(error: unknown, fallback: ProviderErrorCode = 'unknown'): ProviderError {
    if (error instanceof ProviderError) return error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      return new ProviderError('cancelled', 'Request cancelled', error);
    }
    const message = error instanceof Error ? error.message : String(error);
    return new ProviderError(fallback, message, error);
  }
}
