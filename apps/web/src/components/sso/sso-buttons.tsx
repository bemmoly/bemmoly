import type { SsoSignInOption } from '@bemmoly/shared';
import { Button } from '@bemmoly/ui';
import { useState } from 'react';
import { presetFor } from '../../lib/sso-presets.ts';
import { SsoMark } from './sso-mark.tsx';

interface SsoButtonsProps {
  options: readonly SsoSignInOption[];
  onStart: (providerId: string) => void;
  /** Primary when single sign-on is the way in; secondary beside a password form. */
  primary: boolean;
}

/**
 * "Continue with SSO" on the sign-in page: one button for a single provider, one per provider
 * (by its name) when there are several. Each shows the preset's mark and leaves for the
 * identity provider, so it shows progress until the page goes.
 */
export function SsoButtons({ options, onStart, primary }: SsoButtonsProps) {
  const [leaving, setLeaving] = useState<string | null>(null);
  const start = (id: string) => {
    setLeaving(id);
    onStart(id);
  };
  return (
    <div className="flex flex-col gap-2">
      {options.map((option) => (
        <Button
          key={option.id}
          size="lg"
          block
          variant={primary && options.length === 1 ? 'primary' : 'secondary'}
          icon={<SsoMark preset={presetFor(option)} />}
          loading={leaving === option.id}
          disabled={leaving !== null}
          onClick={() => start(option.id)}
        >
          {options.length === 1 ? 'Continue with SSO' : `Continue with ${option.displayName}`}
        </Button>
      ))}
      {options.length === 1 ? (
        <p className="m-0 text-center text-12 text-tx-3">
          Signs you in through {options[0]?.displayName}.
        </p>
      ) : null}
    </div>
  );
}

/** The quiet rule between single sign-on and the password form. */
export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-12 text-tx-3" aria-hidden="true">
      <span className="h-px flex-1 bg-line" />
      or
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
