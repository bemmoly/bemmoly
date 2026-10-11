import { useState } from 'react';
import { toast } from '../lib/toast.ts';

/**
 * Copies a value and remembers which one was copied, so its button can say so. The clipboard
 * API exists only on secure origins and a self-hosted install is often plain http, so every
 * copyable value is also on screen to select by hand.
 */
export function useClipboard() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (value: string, message = 'Copied') => {
    try {
      if (!navigator.clipboard) throw new Error('The clipboard is not available here');
      await navigator.clipboard.writeText(value);
      setCopied(value);
      toast(message);
    } catch {
      toast('Copying is blocked on this connection. Select the text and copy it.', 'danger');
    }
  };
  return { copied, copy };
}
