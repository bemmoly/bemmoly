import { appReferenceText } from '../../../../shared/app-references.ts';
import type {
  AdoptedVariable,
  AdoptionService,
  AdoptionState,
} from '../../../../shared/adoption.ts';
import { nestDeploySettings, type DeploySettingField } from '../../../../shared/deploy-settings.ts';
import { variableNameSchema } from '../../../../shared/variables.ts';
import { fileLayerOf } from '../deploy-settings/resolve.ts';
import type { RunningService } from '../providers/contract.ts';

/*
 * What adopting each running service would import, worked out from what the cloud answered
 * and what Pipelines knows, without changing either. A plain value holding another adopted
 * service's address is offered as a reference to that application, so another environment
 * later fills in its own address there.
 */

export interface CatalogApplication {
  id: string;
  key: string;
  name: string;
}

export interface PlanInput {
  running: readonly RunningService[];
  catalog: readonly CatalogApplication[];
  /** Applications Pipelines adopted here before, or already deploys here, by id. */
  states: ReadonlyMap<string, 'adopted' | 'deployed'>;
  /** Attached projects by their id in the cloud → their id in Pipelines. */
  accounts: ReadonlyMap<string, string>;
  /** The application chosen for a service, by service name; its own name otherwise. */
  chosen?: ReadonlyMap<string, string>;
}

export interface PlannedService {
  view: AdoptionService;
  running: RunningService;
  application: CatalogApplication | null;
}

interface Address {
  url: string;
  application: string;
}

/** The value with another service's address swapped for a reference, when it holds one. */
export function referenceFor(value: string, own: string | null, addresses: readonly Address[]) {
  const match = addresses
    .filter((address) => address.application !== own)
    .filter((address) => {
      if (!value.startsWith(address.url)) return false;
      const next = value.charAt(address.url.length);
      return next === '' || next === '/' || next === '?' || next === '#';
    })
    .sort((a, b) => b.url.length - a.url.length)[0];
  if (!match) return null;
  return {
    application: match.application,
    value: `${appReferenceText(match.application, 'url')}${value.slice(match.url.length)}`,
  };
}

function variablesOf(
  service: RunningService,
  own: string | null,
  addresses: readonly Address[],
  accounts: ReadonlyMap<string, string>,
): AdoptedVariable[] {
  return service.variables
    .filter((variable) => variableNameSchema.safeParse(variable.name).success)
    .map((variable): AdoptedVariable => {
      if (variable.kind === 'plain') {
        return {
          name: variable.name,
          kind: 'plain',
          value: variable.value,
          reference: referenceFor(variable.value, own, addresses),
        };
      }
      return {
        name: variable.name,
        kind: 'secret',
        location: `${variable.account} / ${variable.secret}`,
        version: variable.version,
        problem: accounts.has(variable.account)
          ? null
          : `${variable.name} lives in ${variable.account}, which Pipelines has not attached. Attach it in Platform › Clouds, then adopt ${service.name}`,
      };
    });
}

export function planServices(input: PlanInput): PlannedService[] {
  const byKey = new Map(input.catalog.map((application) => [application.key, application]));
  const matched = input.running.map((running) => ({
    running,
    application: byKey.get(input.chosen?.get(running.name) ?? running.name) ?? null,
  }));
  const addresses: Address[] = matched.flatMap(({ running, application }) =>
    application ? running.urls.map((url) => ({ url, application: application.key })) : [],
  );
  return matched.map(({ running, application }) => {
    const state: AdoptionState = !application
      ? 'unmatched'
      : (input.states.get(application.id) ?? 'ready');
    const settings = fileLayerOf(nestDeploySettings(running.settings));
    const problem = running.image
      ? null
      : `Pipelines cannot tell which image ${running.name} runs by digest. Deploy it by digest once, then adopt it`;
    return {
      running,
      application,
      view: {
        service: running.name,
        url: running.urls[0] ?? null,
        application: application ? { key: application.key, name: application.name } : null,
        state,
        image: running.image ? `${running.image.repository}@${running.image.digest}` : null,
        revision: running.revision,
        variables: variablesOf(running, application?.key ?? null, addresses, input.accounts),
        settings: (Object.entries(settings) as Array<[DeploySettingField, number | string]>).map(
          ([field, value]) => ({ field, value }),
        ),
        problem,
      },
    };
  });
}
