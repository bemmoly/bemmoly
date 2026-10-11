import type { SsoSignInOption } from '@bemmoly/shared';
import { Button } from '@bemmoly/ui';
import { useState } from 'react';
import { presetFor } from '../../lib/sso-presets.ts';
import { SsoMark } from './sso-mark.tsx';

interface SsoButtonsProps {
  options: readonly SsoSignInOption[];
  onStart: (providerId: string) => void;
  /** Single sign-on is the only way in: the button takes the accent ring and the focus. */
  only?: boolean;
  /** The provider this device last signed in with: badged "Last used" and focused. */
  lastUsedId?: string | null;
  /** Focus a button on arrival (the sign-in page, not a page with its own first field). */
  autoFocus?: boolean;
}

/**
 * "Continue with {provider}" buttons: the provider's own mark on the left, a neutral surface,
 * "Last used" on the one this device used before. Each leaves for the identity provider, so it
 * shows progress ("Opening Okta…") until the page goes.
 */
export function SsoButtons({ options, onStart, only, lastUsedId, autoFocus }: SsoButtonsProps) {
  const [leaving, setLeaving] = useState<string | null>(null);
  const focusId =
    options.find((option) => option.id === lastUsedId)?.id ?? (only ? options[0]?.id : null);
  return (
    <div className="flex flex-col gap-3">
      {options.map((option) => {
        const opening = leaving === option.id;
        return (
          <Button
            key={option.id}
            size="touch"
            block
            variant="secondary"
            className={`justify-start gap-2.5 pl-3.5 text-tx ${
              only ? 'h-11 border-acc shadow-[inset_0_0_0_1px_var(--acc)]' : ''
            }`}
            icon={
              <span className="flex w-5.5 justify-center">
                <SsoMark preset={presetFor(option)} />
              </span>
            }
            iconEnd={
              option.id === lastUsedId && !opening ? (
                <span className="ml-auto rounded-full bg-acc-50 px-2 text-11 font-medium text-acc">
                  Last used
                </span>
              ) : undefined
            }
            loading={opening}
            disabled={leaving !== null && !opening}
            autoFocus={autoFocus && option.id === focusId}
            onClick={() => {
              setLeaving(option.id);
              onStart(option.id);
            }}
          >
            {opening ? `Opening ${option.displayName}…` : `Continue with ${option.displayName}`}
          </Button>
        );
      })}
    </div>
  );
}
