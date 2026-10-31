import { useT } from '@bemmoly/core-web';
import type { AdoptionPlan, AdoptionService } from '@bemmoly/module-pipelines/shared';
import { Checkbox, Field, Select, Tag } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { FIELD_LABEL } from '../../application/settings/fields.ts';
import { adoptable, type AdoptChoice } from './draft.ts';

const STATE_LABEL = {
  adopted: 'pipelines.adopt.state.adopted',
  deployed: 'pipelines.adopt.state.deployed',
  unmatched: 'pipelines.adopt.state.unmatched',
} as const;

/**
 * One running service in the adoption plan: whether to adopt it and as which application,
 * and everything adopting it would import. A secret shows where it lives and its version,
 * never a value; an address of another service offers to become a reference.
 */
export function AdoptService({
  service,
  applications,
  choice,
  onChange,
}: {
  service: AdoptionService;
  applications: AdoptionPlan['applications'];
  choice: AdoptChoice;
  onChange: (choice: AdoptChoice) => void;
}) {
  const t = useT(pipelinesText);
  const open = adoptable(service);
  const settings = service.settings
    .map((entry) => `${t(FIELD_LABEL[entry.field])} ${entry.value ?? ''}`)
    .join(' · ');
  const toggleReference = (name: string, on: boolean) => {
    const references = new Set(choice.references);
    if (on) references.add(name);
    else references.delete(name);
    onChange({ ...choice, references });
  };
  return (
    <section
      aria-label={service.service}
      className="flex flex-col gap-2 rounded-card border border-line bg-card p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Checkbox
          checked={choice.adopt}
          disabled={!open || !choice.application}
          label={<span className="font-mono font-medium text-tx">{service.service}</span>}
          aria-label={t('pipelines.adopt.adoptOne', { service: service.service })}
          onChange={(event) => onChange({ ...choice, adopt: event.target.checked })}
        />
        {service.state !== 'ready' && <Tag size="sm">{t(STATE_LABEL[service.state])}</Tag>}
        {service.url && (
          <span className="min-w-0 truncate font-mono text-11 text-tx-3">{service.url}</span>
        )}
      </div>
      {open && (
        <Field label={t('pipelines.adopt.asApplication')}>
          <Select
            searchable
            value={choice.application}
            placeholder={t('pipelines.adopt.chooseApplication')}
            options={applications.map((app) => ({ value: app.key, label: app.key }))}
            onChange={(event) =>
              onChange({ ...choice, application: event.value, adopt: Boolean(event.value) })
            }
          />
        </Field>
      )}
      {service.problem && (
        <p className="flex items-start gap-1.5 text-12 text-amber-tx">
          <Icon name="warning" size={12} />
          {service.problem}
        </p>
      )}
      {service.image && (
        <p className="min-w-0 truncate text-12 text-tx-3">
          {t('pipelines.adopt.releaseZero', { image: service.image })}
        </p>
      )}
      {service.variables.length > 0 && (
        <ul
          className="flex flex-col gap-1"
          aria-label={t('pipelines.adopt.variablesOf', { service: service.service })}
        >
          {service.variables.map((variable) => (
            <li key={variable.name} className="flex min-w-0 flex-col gap-0.5 text-12">
              <span className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 font-mono text-tx">{variable.name}</span>
                {variable.kind === 'plain' ? (
                  <span className="min-w-0 truncate font-mono text-tx-2">{variable.value}</span>
                ) : (
                  <span className="flex min-w-0 items-center gap-1.5 text-tx-2">
                    <Icon name="lock" size={12} />
                    <span className="truncate">
                      {t('pipelines.adopt.secretAt', {
                        location: variable.location,
                        version: variable.version,
                      })}
                    </span>
                  </span>
                )}
              </span>
              {variable.kind === 'secret' && variable.problem && (
                <span className="text-amber-tx">{variable.problem}</span>
              )}
              {variable.kind === 'plain' && variable.reference && (
                <Checkbox
                  size="sm"
                  checked={choice.references.has(variable.name)}
                  disabled={!open}
                  label={t('pipelines.adopt.useReference', { value: variable.reference.value })}
                  description={t('pipelines.adopt.referenceHint', {
                    application: variable.reference.application,
                  })}
                  onChange={(event) => toggleReference(variable.name, event.target.checked)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {settings && (
        <p className="text-12 text-tx-2">{t('pipelines.adopt.settings', { settings })}</p>
      )}
    </section>
  );
}
