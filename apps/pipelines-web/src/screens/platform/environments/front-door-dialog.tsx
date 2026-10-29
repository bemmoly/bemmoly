import { useT } from '@bemmoly/core-web';
import {
  frontDoorDomainSchema,
  type Environment,
  type FrontDoor,
} from '@bemmoly/module-pipelines/shared';
import { Button, Field, Input, Modal, Switch } from '@bemmoly/ui';
import { useState } from 'react';
import { useSetFrontDoor } from '../../../hooks/use-front-doors.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { ActionError } from '../../../parts/action-error.tsx';

/**
 * Turn an environment's front door on or off, and name the domain its applications answer
 * under. Without one they answer on the address over HTTP. What each choice means for DNS,
 * certificates and the applications is said beside it. Mounted per opening.
 */
export function FrontDoorDialog({
  environment,
  door,
  onClose,
}: {
  environment: Environment;
  door: FrontDoor | undefined;
  onClose: () => void;
}) {
  const t = useT(pipelinesText);
  const set = useSetFrontDoor();
  const [enabled, setEnabled] = useState(door?.enabled ?? true);
  const [domain, setDomain] = useState(door?.domain ?? '');
  const trimmed = domain.trim().toLowerCase();
  const valid = trimmed === '' || frontDoorDomainSchema.safeParse(trimmed).success;
  const save = () => {
    if (!valid || set.isPending) return;
    set.mutate(
      { environment: environment.key, body: { enabled, domain: trimmed === '' ? null : trimmed } },
      { onSuccess: onClose },
    );
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={t('pipelines.frontDoor.dialogTitle', { env: environment.name })}
      description={t('pipelines.frontDoor.dialogDescription')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('pipelines.common.cancel')}
          </Button>
          <Button variant="primary" disabled={!valid} loading={set.isPending} onClick={save}>
            {t('pipelines.frontDoor.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <label className="flex items-center gap-2.5 text-13 text-tx">
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
            aria-label={t('pipelines.frontDoor.enabled')}
          />
          {t('pipelines.frontDoor.enabled')}
        </label>
        {enabled ? (
          <Field
            label={t('pipelines.frontDoor.domain')}
            hint={
              trimmed
                ? t('pipelines.frontDoor.domainHint', { domain: trimmed })
                : t('pipelines.frontDoor.domainNone')
            }
            error={valid ? null : t('pipelines.frontDoor.domainInvalid')}
          >
            <Input
              mono
              autoFocus
              value={domain}
              placeholder={t('pipelines.frontDoor.domainExample')}
              onChange={(event) => setDomain(event.target.value)}
            />
          </Field>
        ) : (
          <p className="text-12 leading-body text-tx-2">{t('pipelines.frontDoor.offMeans')}</p>
        )}
        <ActionError error={set.error} />
      </div>
    </Modal>
  );
}
