import type { AdminModule } from '@bemmoly/shared';
import { Badge, Button, Field, Modal, Select, SelectableCard, Tag } from '@bemmoly/ui';
import {
  ACCESS_LATER,
  ACCESS_OPTIONS,
  suggestionLine,
  type useAccessChoice,
} from '../../hooks/use-module-access-choice.ts';

type AccessChoice = ReturnType<typeof useAccessChoice>;

interface EnableModuleModalProps {
  module: AdminModule | null;
  access: AccessChoice;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function TeamPicker({ access }: { access: AccessChoice }) {
  const empty = access.teams.length === 0;
  return (
    <Field label="Teams">
      <div className="flex flex-col gap-2">
        <Select
          aria-label="Add a team"
          placeholder={empty ? 'No teams yet' : 'Add a team…'}
          disabled={empty || access.teamOptions.length === 0}
          options={access.teamOptions}
          value=""
          onChange={(event) => access.addTeam(event.target.value)}
        />
        {access.pickedTeams.length ? (
          <div className="flex flex-wrap gap-1.5">
            {access.pickedTeams.map((team) => (
              <Tag
                key={team.id}
                size="lg"
                onRemove={() => access.removeTeam(team.id)}
                removeLabel={`Remove ${team.name}`}
              >
                {team.name}
              </Tag>
            ))}
          </div>
        ) : (
          <span className="text-12 text-tx5">
            {empty ? 'Create a team under Users › Teams first.' : 'Pick at least one team.'}
          </span>
        )}
      </div>
    </Field>
  );
}

/** Enable asks who may open the module first; the least access is preselected. */
export function EnableModuleModal({
  module,
  access,
  busy,
  onClose,
  onConfirm,
}: EnableModuleModalProps) {
  if (!module) return null;
  const name = module.name;
  return (
    <Modal
      open
      width="md"
      onClose={onClose}
      title={`Who can use ${name}?`}
      description={suggestionLine(name, module.defaultAccess)}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!access.ready} loading={busy} onClick={onConfirm}>
            Enable {name}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <div role="radiogroup" aria-label={`Who can use ${name}`} className="flex flex-col gap-2">
          {ACCESS_OPTIONS.map((option) => (
            <SelectableCard
              key={option.mode}
              selected={access.mode === option.mode}
              onClick={() => access.setMode(option.mode)}
              className="gap-1 px-3.5 py-3"
            >
              <span className="flex w-full items-center gap-2">
                <span className="text-13 font-semibold">{option.name}</span>
                {option.recommended ? (
                  <Badge tone="accent" className="ml-auto">
                    RECOMMENDED
                  </Badge>
                ) : null}
              </span>
              <span className="text-12h leading-body text-tx4">{option.description}</span>
            </SelectableCard>
          ))}
        </div>
        {access.mode === 'teams' ? <TeamPicker access={access} /> : null}
        <p className="m-0 text-12h leading-body text-tx4">{ACCESS_LATER}</p>
      </div>
    </Modal>
  );
}
