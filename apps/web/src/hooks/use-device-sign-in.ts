import { queryKeys } from '@bemmoly/api-client';
import { deviceUserCodeSchema } from '@bemmoly/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { oauthApi } from '../lib/oauth-api.ts';

/** "wdjb mjht" or "WDJB-MJHT" as the server stores it, or null while it is not eight letters. */
export function normaliseUserCode(text: string): string | null {
  const parsed = deviceUserCodeSchema.safeParse(text);
  return parsed.success ? parsed.data : null;
}

/**
 * The /device page: the code the person typed (or the link filled in), what the tool asked
 * for, and the decision. The request is read only after the person submits the code, so a
 * half-typed code never asks the server anything.
 */
export function useDeviceSignIn(initialCode: string | undefined) {
  const [text, setText] = useState(initialCode ?? '');
  const [submitted, setSubmitted] = useState<string | null>(() =>
    initialCode ? normaliseUserCode(initialCode) : null,
  );
  const [codeError, setCodeError] = useState<string | null>(null);
  const request = useQuery({
    queryKey: queryKeys.oauth.device(submitted ?? ''),
    queryFn: () => oauthApi.deviceRequest(submitted ?? ''),
    enabled: submitted !== null,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const decide = useMutation({
    mutationFn: (approve: boolean) => oauthApi.decideDevice({ userCode: submitted ?? '', approve }),
  });
  return {
    text,
    setText: (value: string) => {
      setText(value);
      setCodeError(null);
    },
    codeError,
    submit: () => {
      const code = normaliseUserCode(text);
      if (!code) {
        setCodeError('Codes have eight letters, like WDJB-MJHT.');
        return;
      }
      setSubmitted(code);
    },
    /** Back to the code field, for "Use another code". */
    reset: () => {
      setSubmitted(null);
      decide.reset();
    },
    submitted,
    request,
    decide,
  };
}
