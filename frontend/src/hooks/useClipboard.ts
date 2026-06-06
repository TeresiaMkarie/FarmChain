import { useCallback, useState } from 'react';

export function useClipboard(timeoutMs = 2000) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), timeoutMs);
    } catch {
      // clipboard API may be unavailable in non-secure contexts
    }
  }, [timeoutMs]);

  return { copied, copy };
}
