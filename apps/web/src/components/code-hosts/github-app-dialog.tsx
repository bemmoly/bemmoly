import { startGithubAppSchema, type CodeHost } from '@bemmoly/shared';
import { Button, Field, Input, Modal, SegmentedControl } from '@bemmoly/ui';
import { useState } from 'react';
import type { CodeHosts } from '../../hooks/use-code-hosts.ts';
import { validateForm, type FieldErrors } from '../../lib/errors.ts';
import { FormError, Notice } from '../form.tsx';

interface GithubAppDialogProps {
  hosts: CodeHosts;
  onClose: () => void;
  /** Switches to the form for an app or a token made by hand. */
  onManual: () => void;
}

/**
 * Connect GitHub in one click: Bemmoly describes the app it needs, GitHub creates it and
 * asks which repositories it may read, and the admin comes back connected. The fields are
 * optional; the defaults suit github.com and the admin's own account.
 */
export function GithubAppDialog({ hosts, onClose, onManual }: GithubAppDialogProps) {
  const [organization, setOrganization] = useState('');
  const [server, setServer] = useState<'cloud' | 'self'>('cloud');
  const [baseUrl, setBaseUrl] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<unknown>(null);
  /** Set once the admin has seen that GitHub cannot reach this address. */
  const [unreachable, setUnreachable] = useState<string | null>(null);

  const go = async () => {
    if (unreachable) {
      window.location.assign(unreachable);
      return;
    }
    const owner = organization.trim();
    const input = {
      name: owner ? `GitHub ${owner}`.slice(0, 80) : 'GitHub',
      baseUrl: server === 'self' ? baseUrl.trim().replace(/\/+$/, '') : null,
      organization: owner || null,
    };
    const checked = validateForm(startGithubAppSchema, input);
    const found: FieldErrors = { ...(checked.errors ?? {}) };
    if (server === 'self' && !input.baseUrl) found['baseUrl'] = 'Add the address of your server';
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setError(null);
    try {
      const started = await hosts.startGithubApp(input);
      if (started.webhooks) window.location.assign(started.formUrl);
      else setUnreachable(started.formUrl);
    } catch (failure) {
      setError(failure);
    }
  };

  return (
    <Modal
      open
      width="md"
      onClose={onClose}
      title="Connect GitHub"
      description="GitHub opens with a Bemmoly app ready to create. Create it, choose its repositories, and you are back here connected."
      footer={
        <>
          <span className="mr-auto">
            <Button variant="ghost" onClick={onManual}>
              Enter app details by hand
            </Button>
          </span>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={hosts.startingGithubApp} onClick={() => void go()}>
            {unreachable ? 'Continue without webhooks' : 'Continue on GitHub'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <Field
          label="Organization"
          hint="Where your repositories are. Leave empty to create the app under your own account."
          error={errors['organization']}
        >
          <Input
            value={organization}
            placeholder="acme"
            spellCheck={false}
            autoComplete="off"
            onChange={(event) => setOrganization(event.target.value)}
          />
        </Field>
        <SegmentedControl
          aria-label="Where it runs"
          value={server}
          onChange={setServer}
          options={[
            { value: 'cloud', label: 'github.com' },
            { value: 'self', label: 'Enterprise Server' },
          ]}
        />
        {server === 'self' && (
          <Field label="GitHub address" error={errors['baseUrl']}>
            <Input
              value={baseUrl}
              placeholder="https://github.acme.dev"
              spellCheck={false}
              onChange={(event) => setBaseUrl(event.target.value)}
            />
          </Field>
        )}
        {unreachable && (
          <Notice tone="caution">
            GitHub can’t reach this Bemmoly’s address, so pull requests won’t update as they happen.
            Backfill still reads the last 30 days. Set BEMMOLY_PUBLIC_URL to a public address to
            receive them.
          </Notice>
        )}
        <FormError error={error} />
      </div>
    </Modal>
  );
}

/** An app Bemmoly created: GitHub holds its settings, so this shows them and links there. */
export function ManagedAppFields({ host }: { host: CodeHost }) {
  const repos = host.repositories;
  return (
    <div className="flex flex-col gap-3 text-13 leading-body text-tx-2">
      <p className="m-0">
        Bemmoly created this GitHub App (ID {host.appId}). Its key and webhook secret are stored
        encrypted;{' '}
        {host.installationId
          ? `it reads ${repos.length} ${repos.length === 1 ? 'repository' : 'repositories'}.`
          : 'it is not installed on any repositories yet.'}
      </p>
      {repos.length > 0 && <p className="m-0 font-mono text-12 text-tx-3">{repos.join(' · ')}</p>}
      {host.installUrl && (
        <span>
          <Button onClick={() => window.location.assign(host.installUrl ?? '')}>
            {host.installationId ? 'Change repositories on GitHub' : 'Install on GitHub'}
          </Button>
        </span>
      )}
    </div>
  );
}
