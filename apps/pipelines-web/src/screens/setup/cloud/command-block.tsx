import { useT } from '@bemmoly/core-web';
import { Button, useToast } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { ReactNode } from 'react';
import { setupText } from '../../../i18n/catalog.ts';

/** A command to run, in mono on the sunken surface, with Copy and any other actions after it. */
export function CommandBlock({
  label,
  command,
  actions,
}: {
  label: string;
  command: string;
  actions?: ReactNode;
}) {
  const t = useT(setupText);
  const toast = useToast();
  const copy = () =>
    void navigator.clipboard
      ?.writeText(command)
      .then(() => toast.show({ tone: 'ok', title: t('pipelinesSetup.cloud.copied') }));
  return (
    <div className="flex flex-col gap-2">
      <pre
        aria-label={label}
        tabIndex={0}
        className="overflow-x-auto rounded-control border border-line bg-sunken px-3.5 py-3 font-mono text-12 leading-body whitespace-pre text-tx"
      >
        {command}
      </pre>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" icon={<Icon name="copy" size={14} />} onClick={copy}>
          {t('pipelinesSetup.cloud.copy')}
        </Button>
        {actions}
      </div>
    </div>
  );
}
