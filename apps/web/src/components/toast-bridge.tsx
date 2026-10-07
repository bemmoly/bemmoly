import { useToast } from '@bemmoly/ui';
import { useEffect } from 'react';
import { registerToast } from '../lib/toast.ts';

/** Lets `toast()` from lib/toast.ts reach the ToastProvider above it. */
export function ToastBridge() {
  const { show } = useToast();
  useEffect(() => {
    registerToast(show);
    return () => registerToast(null);
  }, [show]);
  return null;
}
