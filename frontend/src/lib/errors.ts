interface HttpError {
  response: {
    status: number;
    data?: { error?: unknown; message?: unknown };
  };
  code?: string;
  message?: string;
}

interface NetworkError {
  response?: undefined;
  code?: string;
  message?: string;
}

function isHttpError(err: unknown): err is HttpError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    typeof (err as HttpError).response?.status === 'number'
  );
}

function isNetworkError(err: unknown): err is NetworkError {
  return typeof err === 'object' && err !== null && !('response' in err);
}

function serverMsg(err: HttpError): string | undefined {
  const { data } = err.response;
  if (typeof data?.error === 'string') return data.error;
  if (typeof data?.message === 'string') return data.message;
  return undefined;
}

/**
 * Converts any thrown value into a user-facing string.
 * Never leaks localhost URLs, stack traces, or raw HTTP status codes.
 */
export function parseError(err: unknown): string {
  if (!err) return 'An unexpected error occurred.';

  // ── Axios / HTTP errors ──────────────────────────────────────────────────
  if (isHttpError(err)) {
    const msg = serverMsg(err);
    switch (err.response.status) {
      case 400: return msg ?? 'Invalid request. Check your input.';
      case 401: return 'Session expired. Please reconnect your wallet.';
      case 403: return msg ?? "You don't have permission to do this.";
      case 404: return msg ?? 'Not found.';
      case 409: return msg ?? 'This action conflicts with the current state.';
      case 429: return 'Too many requests. Please slow down and try again.';
      case 500: return 'Something went wrong on the server. Please try again.';
      case 503: return 'Service unavailable. Please try again shortly.';
      default:  return `Request failed (${err.response.status}). Please try again.`;
    }
  }

  // ── Network / connection errors ──────────────────────────────────────────
  if (isNetworkError(err)) {
    const { code, message = '' } = err;
    if (
      code === 'ERR_NETWORK' ||
      message === 'Network Error' ||
      message.includes('ECONNREFUSED') ||
      message.includes('localhost') ||
      message.includes('127.0.0.1')
    ) {
      return 'Cannot reach the server. Check your connection.';
    }
    if (code === 'ECONNABORTED') {
      return 'Request timed out. Please try again.';
    }
  }

  // ── Soroban / Freighter / wallet errors ──────────────────────────────────
  const raw = typeof err === 'string' ? err : err instanceof Error ? err.message : '';

  if (/user.*(declined|rejected|cancel)/i.test(raw) || /cancel/i.test(raw)) {
    return 'Transaction cancelled.';
  }
  if (/timed? ?out/i.test(raw)) {
    return 'Transaction timed out. Check your wallet for the latest status.';
  }
  if (/failed on.?chain/i.test(raw)) {
    return 'The on-chain transaction failed. Please try again.';
  }
  if (/transaction rejected/i.test(raw)) {
    return 'Transaction rejected by the network. Please try again.';
  }
  if (/freighter/i.test(raw)) {
    return 'Wallet error. Check that Freighter is unlocked and try again.';
  }
  if (/insufficient/i.test(raw)) {
    return raw; // "Insufficient product quantity" etc. are already user-facing
  }

  // ── Pass through short, clean messages ──────────────────────────────────
  const clean = raw.replace(/^Error:\s*/i, '').trim();
  if (clean && clean.length < 150 && !/\bat\b/.test(clean) && !/localhost|127\.0\.0\.1/.test(clean)) {
    return clean;
  }

  return 'An unexpected error occurred. Please try again.';
}
