/**
 * Converts any thrown value into a user-facing string.
 * Never leaks localhost URLs, stack traces, or raw HTTP status codes.
 */
export function parseError(err: unknown): string {
  if (!err) return 'An unexpected error occurred.';

  const e = err as any;

  // ── Axios / HTTP errors ──────────────────────────────────────────────────
  if (e.response) {
    const serverMsg: string | undefined =
      typeof e.response.data?.error === 'string' ? e.response.data.error
      : typeof e.response.data?.message === 'string' ? e.response.data.message
      : undefined;

    // Show the backend's own message for client errors — they're usually meaningful
    switch (e.response.status) {
      case 400: return serverMsg ?? 'Invalid request. Check your input.';
      case 401: return 'Session expired. Please reconnect your wallet.';
      case 403: return serverMsg ?? 'You don\'t have permission to do this.';
      case 404: return serverMsg ?? 'Not found.';
      case 409: return serverMsg ?? 'This action conflicts with the current state.';
      case 429: return 'Too many requests. Please slow down and try again.';
      case 500: return 'Something went wrong on the server. Please try again.';
      case 503: return 'Service unavailable. Please try again shortly.';
      default:  return `Request failed (${e.response.status}). Please try again.`;
    }
  }

  // ── Network / connection errors ──────────────────────────────────────────
  if (
    e.code === 'ERR_NETWORK' ||
    e.message === 'Network Error' ||
    e.message?.includes('ECONNREFUSED') ||
    e.message?.includes('localhost') ||
    e.message?.includes('127.0.0.1')
  ) {
    return 'Cannot reach the server. Check your connection.';
  }
  if (e.code === 'ECONNABORTED') {
    return 'Request timed out. Please try again.';
  }

  // ── Soroban / Freighter / wallet errors ──────────────────────────────────
  const msg: string = typeof e === 'string' ? e : (e.message ?? '');

  if (/user.*(declined|rejected|cancel)/i.test(msg) || /cancel/i.test(msg)) {
    return 'Transaction cancelled.';
  }
  if (/timed? ?out/i.test(msg)) {
    return 'Transaction timed out. Check your wallet for the latest status.';
  }
  if (/failed on.?chain/i.test(msg)) {
    return 'The on-chain transaction failed. Please try again.';
  }
  if (/transaction rejected/i.test(msg)) {
    return 'Transaction rejected by the network. Please try again.';
  }
  if (/freighter/i.test(msg)) {
    return 'Wallet error. Check that Freighter is unlocked and try again.';
  }
  if (/insufficient/i.test(msg)) {
    return msg; // "Insufficient product quantity" etc. are user-facing already
  }

  // ── Pass through short, clean messages ──────────────────────────────────
  // Strip anything that looks like an Error prefix or a stack trace line
  const clean = msg.replace(/^Error:\s*/i, '').trim();
  if (clean && clean.length < 150 && !/\bat\b/.test(clean) && !/localhost|127\.0\.0\.1/.test(clean)) {
    return clean;
  }

  return 'An unexpected error occurred. Please try again.';
}
