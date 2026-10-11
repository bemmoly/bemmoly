import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';
import { providerState, useSsoProviders } from '../../hooks/use-sso-admin.ts';
import { presetById, presetFor, SSO_PRESETS } from '../../lib/sso-presets.ts';
import { StatePill } from '../settings/state-pill.tsx';
import { ProviderDialog, type ProviderDialogState } from '../sso/provider-dialog.tsx';
import { SsoMark, SsoTile } from '../sso/sso-mark.tsx';
import { ChoiceCard } from './choice-card.tsx';

export const SSO_SETUP_NOTE =
  'You can also do this later in Settings › Sign-in and SSO, where you can test it and require it.';

/** The first preset the mock recommends, then every other provider through the picker. */
const FEATURED = SSO_PRESETS[0];

/**
 * People › Single sign-on: connect an identity provider without leaving the wizard. The mock's
 * two cards: the featured preset, and any other OpenID Connect or SAML provider. Connected ones
 * show as rows with their state; testing and requiring single sign-on live in Settings.
 */
export function SetupSso() {
  const providers = useSsoProviders();
  const [dialog, setDialog] = useState<ProviderDialogState>(null);
  const featured = FEATURED && presetById(FEATURED.id);
  return (
    <section aria-labelledby="setup-sso" className="flex flex-col gap-2">
      <h2 id="setup-sso" className="m-0 text-13 font-semibold text-tx">
        Single sign-on
      </h2>
      {providers.items.length ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {providers.items.map((provider) => {
            const state = providerState(provider);
            return (
              <li
                key={provider.id}
                className="flex items-center gap-2.5 rounded-card border border-line bg-card px-3 py-2.5"
              >
                <SsoTile preset={presetFor(provider)} />
                <span className="min-w-0 flex-1 truncate text-13 font-medium text-tx">
                  {provider.displayName}
                </span>
                <StatePill tone={state.tone}>{state.label}</StatePill>
              </li>
            );
          })}
        </ul>
      ) : null}
      <div role="radiogroup" aria-labelledby="setup-sso" className="grid gap-2 sm:grid-cols-2">
        {featured ? (
          <ChoiceCard
            initials={featured.name.slice(0, 2)}
            icon={<SsoMark preset={featured} />}
            name={featured.name}
            description="Anyone with an account on your domain can sign in. New people become Viewers."
            selected={false}
            onSelect={() => setDialog(`new:${featured.id}`)}
          />
        ) : null}
        <ChoiceCard
          initials="ID"
          icon={<Icon name="key" size={16} />}
          name="Another identity provider"
          description="Any OpenID Connect or SAML 2.0 provider, with SCIM provisioning and group-to-team mapping."
          selected={false}
          onSelect={() => setDialog('new')}
        />
      </div>
      <p className="m-0 text-12 text-tx-3">{SSO_SETUP_NOTE}</p>
      <ProviderDialog state={dialog} providers={providers} onState={setDialog} />
    </section>
  );
}
