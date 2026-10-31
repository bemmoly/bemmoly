import type {
  AdoptBody,
  AdoptionPlan,
  AdoptionService,
  ApplyCopyBody,
  CopyPlan,
  CopySecretMode,
} from '@bemmoly/module-pipelines/shared';

/*
 * The choices the adopt and copy dialogs hold, apart from their drawing: which services to
 * adopt and as which application, which addresses become references, which copy items are
 * ticked and how each secret travels; and the request each set of choices makes.
 */

export interface AdoptChoice {
  adopt: boolean;
  application: string;
  references: ReadonlySet<string>;
}

export type AdoptDraft = Readonly<Record<string, AdoptChoice>>;

/** Whether a service can be adopted as it stands, once it has an application. */
export function adoptable(service: AdoptionService): boolean {
  const secretProblem = service.variables.some((v) => v.kind === 'secret' && v.problem);
  return (
    (service.state === 'ready' || service.state === 'unmatched') &&
    !service.problem &&
    !secretProblem
  );
}

/** Every service that can be adopted is ticked, with every offered reference kept. */
export function adoptDraftOf(plan: AdoptionPlan): AdoptDraft {
  return Object.fromEntries(
    plan.services.map((service) => [
      service.service,
      {
        adopt: adoptable(service) && service.state === 'ready',
        application: service.application?.key ?? '',
        references: new Set(
          service.variables.flatMap((v) => (v.kind === 'plain' && v.reference ? [v.name] : [])),
        ),
      },
    ]),
  );
}

export function adoptBodyOf(plan: AdoptionPlan, draft: AdoptDraft): AdoptBody | null {
  const services = plan.services.flatMap((service) => {
    const choice = draft[service.service];
    if (!choice?.adopt || !choice.application || !adoptable(service)) return [];
    const offered = service.variables.flatMap((v) =>
      v.kind === 'plain' && v.reference && choice.references.has(v.name) ? [v.name] : [],
    );
    return [{ service: service.service, application: choice.application, references: offered }];
  });
  return services.length > 0 ? { services } : null;
}

export interface CopyDraft {
  ticked: ReadonlySet<string>;
  modes: ReadonlyMap<string, CopySecretMode>;
}

export function copyDraftOf(plan: CopyPlan): CopyDraft {
  const items = plan.applications.flatMap((app) => app.items);
  return {
    ticked: new Set(items.filter((item) => item.ticked).map((item) => item.id)),
    modes: new Map(items.flatMap((item) => (item.kind === 'secret' ? [[item.id, item.mode]] : []))),
  };
}

export function copyBodyOf(plan: CopyPlan, draft: CopyDraft): ApplyCopyBody | null {
  const items = plan.applications
    .flatMap((app) => app.items)
    .filter((item) => draft.ticked.has(item.id) && (item.kind !== 'setting' || item.applies))
    .map((item) => {
      const mode = item.kind === 'secret' ? draft.modes.get(item.id) : undefined;
      return { id: item.id, ...(mode ? { secret: mode } : {}) };
    });
  return items.length > 0 ? { from: plan.from.key, items } : null;
}
