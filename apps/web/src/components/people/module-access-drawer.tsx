import type { ModuleGrantSubjectKind } from '@bemmoly/shared';
import { Button, Drawer, EmptyState, Select } from '@bemmoly/ui';
import { KIND_OPTIONS, useModuleAccess } from '../../hooks/use-module-access.ts';
import { NO_PEOPLE_ACCESS } from '../../hooks/use-people.ts';
import { FormError, Loading, Notice } from '../form.tsx';

type Access = ReturnType<typeof useModuleAccess>;
type Section = Access['sections'][number];

function AddGrant({ access, moduleId }: { access: Access; moduleId: string }) {
  const draft = access.draftFor(moduleId);
  const everyone = draft.kind === 'everyone';
  const options = everyone ? [] : access.subjectOptions(moduleId, draft.kind);
  const blocked = everyone ? access.everyoneGranted(moduleId) : !draft.subjectId;
  return (
    <div className="flex items-center gap-2">
      <Select
        size="sm"
        aria-label="Grant to"
        options={KIND_OPTIONS}
        value={draft.kind}
        onChange={(event) =>
          access.setDraft(moduleId, { kind: event.target.value as ModuleGrantSubjectKind })
        }
      />
      {!everyone && (
        <Select
          size="sm"
          aria-label="Who"
          wrapperClassName="min-w-0 flex-1"
          placeholder={options.length ? 'Choose…' : 'Everyone here has access'}
          options={options}
          value={draft.subjectId}
          onChange={(event) => access.setDraft(moduleId, { subjectId: event.target.value })}
        />
      )}
      <Button
        size="xs"
        className="ml-auto"
        disabled={blocked}
        loading={access.add.isPending && access.add.variables?.moduleId === moduleId}
        onClick={() => access.submit(moduleId)}
      >
        Add
      </Button>
    </div>
  );
}

function ModuleSection({ access, section }: { access: Access; section: Section }) {
  return (
    <section aria-label={section.label} className="flex flex-col gap-2">
      <h3 className="m-0 text-13 font-semibold">{section.label}</h3>
      <div className="flex flex-col rounded-panel border border-br">
        {section.grants.length === 0 && (
          <p className="m-0 px-3 py-2.5 text-12 text-tx5">Nobody can open this module yet.</p>
        )}
        {section.grants.map((grant) => (
          <div
            key={grant.id}
            className="flex items-center gap-2 border-b border-br-row px-3 py-2 last:border-b-0"
          >
            <span className="min-w-0 flex-1 truncate">{grant.label}</span>
            {access.canManage && (
              <Button
                size="xs"
                variant="ghost"
                aria-label={`Remove ${grant.label} from ${section.label}`}
                loading={access.remove.isPending && access.remove.variables?.id === grant.id}
                onClick={() => access.remove.mutate(grant)}
              >
                Remove
              </Button>
            )}
          </div>
        ))}
      </div>
      {access.canManage && <AddGrant access={access} moduleId={section.id} />}
    </section>
  );
}

/** Who may open each module: grants to everyone, a team, a role or one person. */
export function ModuleAccessDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const access = useModuleAccess(open);
  return (
    <Drawer
      open={open}
      onClose={onClose}
      label="Module access"
      variant="overlay"
      header={<span className="text-13 font-semibold text-tx">Module access</span>}
    >
      <p className="m-0 text-12h leading-body text-tx4">
        A person sees a module only when a grant reaches them. Roles still decide what they can do
        inside it.
      </p>
      {!access.canManage && <Notice>{NO_PEOPLE_ACCESS}</Notice>}
      {access.query.error ? (
        <FormError error={access.query.error} />
      ) : access.query.isPending ? (
        <Loading label="Loading module access" />
      ) : access.sections.length === 0 ? (
        <EmptyState
          title="No modules enabled"
          description="Enable a module in Settings, Modules, then choose who may open it here."
        />
      ) : (
        access.sections.map((section) => (
          <ModuleSection key={section.id} access={access} section={section} />
        ))
      )}
    </Drawer>
  );
}
