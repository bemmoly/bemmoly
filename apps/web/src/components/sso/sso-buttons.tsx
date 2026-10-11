import type { SsoSignInOption } from '@bemmoly/shared';
import { Button } from '@bemmoly/ui';
import { useState } from 'react';
import { presetFor } from '../../lib/sso-presets.ts';
import type { SsoPreset } from '../../lib/sso-presets.ts';
import { SsoMark } from './sso-mark.tsx';

interface SsoButtonsProps {
  options: readonly SsoSignInOption[];
  onStart: (providerId: string) => void;
  /** Single sign-on is the only way in: the first button takes the focus. */
  only?: boolean;
  /** The provider this device last signed in with: badged "Last used" and focused. */
  lastUsedId?: string | null;
  /** Focus a button on arrival (the sign-in page, not a page with its own first field). */
  autoFocus?: boolean;
}

/**
 * The mark's chip. On the filled button a full-colour mark sits on white so it stays true; a
 * one-colour mark or the key takes the accent on the button's own ink, a pair the theme checks
 * already hold to contrast in every theme.
 */
function MarkChip({ preset, primary }: { preset: SsoPreset; primary: boolean }) {
  const image = preset.logoStyle === 'image' && preset.logo;
  const surface = !primary ? '' : image ? 'bg-on-solid' : 'bg-on-acc text-acc-fill';
  return (
    <span className={`flex size-7 shrink-0 items-center justify-center rounded-chip ${surface}`}>
      <SsoMark preset={preset} ink={primary && !image ? 'bg-acc-fill' : undefined} />
    </span>
  );
}

/**
 * "Continue with {provider}" buttons. Single sign-on leads wherever it is offered, so the first
 * is the page's primary action (accent fill, the provider's mark on a white chip so full-colour
 * marks stay true) and the rest are secondary. The full provider name wraps rather than
 * truncates on phones. "Last used" marks the one this device used before. Each leaves for the
 * identity provider, so it shows progress ("Opening Okta…") until the page goes.
 */
export function SsoButtons({ options, onStart, only, lastUsedId, autoFocus }: SsoButtonsProps) {
  const [leaving, setLeaving] = useState<string | null>(null);
  const focusId =
    options.find((option) => option.id === lastUsedId)?.id ?? (only ? options[0]?.id : null);
  return (
    <div className="flex flex-col gap-3">
      {options.map((option, index) => {
        const opening = leaving === option.id;
        const primary = index === 0;
        return (
          <Button
            key={option.id}
            size="touch"
            block
            variant={primary ? 'primary' : 'secondary'}
            className={`h-auto min-h-11 justify-start gap-2.5 py-2 pl-2 text-left whitespace-normal ${
              primary ? '' : 'text-tx'
            }`}
            icon={<MarkChip preset={presetFor(option)} primary={primary} />}
            iconEnd={
              option.id === lastUsedId && !opening ? (
                <span
                  className={`ml-auto shrink-0 rounded-full px-2 text-11 font-medium ${
                    primary ? 'bg-on-acc/15 text-on-acc' : 'bg-acc-50 text-acc'
                  }`}
                >
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
