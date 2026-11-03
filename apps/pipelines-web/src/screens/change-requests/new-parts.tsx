import { useT } from '@bemmoly/core-web';
import type {
  ChangeRequestOptionService,
  ChangeRequestOptionStep,
} from '@bemmoly/module-pipelines/shared';
import { Avatar, Button, Card, CardHeader, Checkbox, Field, IconButton, Select } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';
import { changeRequestsText } from '../../i18n/catalog.ts';

/*
 * The New change request form's two pickers: the versions that move (one per service, only
 * versions the environment allows), and who approves (per step, from its group, never you).
 */

export function VersionsField({
  services,
  items,
  environment,
  previous,
  gated,
  onChange,
}: {
  services: readonly ChangeRequestOptionService[];
  items: Record<string, string>;
  environment: string;
  previous: string | null;
  gated: boolean;
  onChange: (service: string, releaseId: string | null) => void;
}) {
  const t = useT(changeRequestsText);
  const [adding, setAdding] = useState(false);
  const chosen = services.filter((service) => items[service.key]);
  const others = services.filter(
    (service) => !items[service.key] && service.versions.some((v) => v.allowed),
  );
  return (
    <Field
      label={t('pipelinesChangeRequests.new.versions')}
      hint={
        gated && previous
          ? t('pipelinesChangeRequests.new.versionsGated', { previous, name: environment })
          : t('pipelinesChangeRequests.new.versionsAny')
      }
    >
      <div className="flex flex-col gap-2">
        {chosen.map((service) => (
          <div
            key={service.key}
            className="flex flex-wrap items-center gap-2 rounded-control border border-line p-2"
          >
            <span className="w-36 shrink-0 truncate font-mono text-13 font-semibold">
              {service.key}
            </span>
            <span className="font-mono text-12 text-tx-3">
              {service.current?.version ?? t('pipelinesChangeRequests.common.nothing')}
            </span>
            <Icon name="arrow" size={12} className="text-tx-3" />
            <Select
              size="sm"
              aria-label={t('pipelinesChangeRequests.new.versionOf', { service: service.key })}
              value={items[service.key] ?? ''}
              options={service.versions.map((version) => ({
                value: version.releaseId,
                label: version.version,
                ...(version.summary ? { description: version.summary } : {}),
                disabled: !version.allowed,
              }))}
              onChange={(event) => onChange(service.key, event.value)}
              wrapperClassName="min-w-40 flex-1"
            />
            <IconButton
              label={t('pipelinesChangeRequests.new.removeService', { service: service.key })}
              icon={<Icon name="close" size={14} />}
              onClick={() => onChange(service.key, null)}
            />
          </div>
        ))}
        {adding ? (
          <Select
            aria-label={t('pipelinesChangeRequests.new.addService')}
            placeholder={t('pipelinesChangeRequests.new.pickService')}
            searchable
            options={others.map((service) => ({ value: service.key, label: service.key }))}
            onChange={(event) => {
              const service = others.find((s) => s.key === event.value);
              const first = service?.versions.find((v) => v.allowed);
              if (service && first) onChange(service.key, first.releaseId);
              setAdding(false);
            }}
          />
        ) : others.length > 0 ? (
          <span>
            <Button
              variant="ghost"
              size="sm"
              icon={<Icon name="plus" size={14} />}
              onClick={() => setAdding(true)}
            >
              {chosen.length
                ? t('pipelinesChangeRequests.new.addAnother')
                : t('pipelinesChangeRequests.new.addService')}
            </Button>
          </span>
        ) : chosen.length === 0 ? (
          <span className="text-12 text-tx-3">{t('pipelinesChangeRequests.new.noVersions')}</span>
        ) : null}
      </div>
    </Field>
  );
}

export function ApproverPicker({
  steps,
  environment,
  picked,
  onToggle,
}: {
  steps: readonly ChangeRequestOptionStep[];
  environment: string;
  picked: (position: number) => readonly string[];
  onToggle: (position: number, userId: string) => void;
}) {
  const t = useT(changeRequestsText);
  return (
    <Card>
      <CardHeader
        title={t('pipelinesChangeRequests.new.whoApproves')}
        hint={t('pipelinesChangeRequests.new.youPick')}
      />
      <ol className="flex flex-col gap-4 p-4">
        {steps.map((step, index) => {
          const mine = picked(step.position);
          const done = mine.length >= step.count;
          return (
            <li key={step.position} className="flex flex-col gap-2">
              <span className="flex items-center gap-2 text-13">
                <Icon
                  name={done ? 'check' : 'people'}
                  size={14}
                  className={done ? 'text-green-tx' : 'text-tx-3'}
                />
                <b className="font-semibold">
                  {t('pipelinesChangeRequests.route.step', {
                    index: index + 1,
                    name: step.group.name,
                  })}
                </b>
              </span>
              <span className="text-12 text-tx-3">
                {t('pipelinesChangeRequests.new.pickCount', {
                  count: step.count,
                  name: environment,
                })}
              </span>
              {step.candidates.length === 0 ? (
                <span className="text-12 text-amber-tx">
                  {t('pipelinesChangeRequests.new.nobodyInGroup')}
                </span>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {step.candidates.map((person) => (
                    <li
                      key={person.id}
                      className="flex items-center gap-2 rounded-control border border-line px-2.5 py-1.5"
                    >
                      <Checkbox
                        checked={mine.includes(person.id)}
                        onChange={() => onToggle(step.position, person.id)}
                        label={
                          <span className="inline-flex items-center gap-2">
                            <Avatar name={person.name} size={20} />
                            {person.name}
                          </span>
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
        <li className="flex items-center gap-2 text-13">
          <Icon name="rocket" size={14} className="text-tx-3" />
          <span className="flex flex-col">
            <b className="font-semibold">
              {t('pipelinesChangeRequests.route.deployTo', { name: environment })}
            </b>
            <span className="text-12 text-tx-3">{t('pipelinesChangeRequests.new.byItself')}</span>
          </span>
        </li>
      </ol>
      <p className="px-4 pb-4 text-12 text-tx-3">{t('pipelinesChangeRequests.new.notYourself')}</p>
    </Card>
  );
}
