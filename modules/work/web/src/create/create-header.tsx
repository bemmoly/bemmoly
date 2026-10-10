import type { IssueType, Project } from '@bemmoly/module-work/shared';
import { IconButton, Select, TypeGlyph } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { typeGlyph } from '../issue/vocabulary.ts';
import { CHIP } from './create-chips.tsx';
import { ProjectTile } from '../shared/project-tile.tsx';

interface CreateHeaderProps {
  projects: readonly Project[];
  projectKey: string | undefined;
  onProject: (key: string) => void;
  types: readonly IssueType[];
  typeId: string | undefined;
  onType: (id: string) => void;
  /** A subtask's parent key: the project is fixed and the line says whose subtask it is. */
  parentKey: string | undefined;
  onClose: () => void;
}

/** Project › Type as compact pickers, what is being made, and Close. */
export function CreateHeader(props: CreateHeaderProps) {
  const { projects, projectKey, onProject, types, typeId, onType, parentKey, onClose } = props;
  return (
    <div className="flex shrink-0 items-center gap-1.5 px-4 pt-3.5">
      <Select
        aria-label="Project"
        size="sm"
        value={projectKey ?? ''}
        placeholder="Project"
        disabled={Boolean(parentKey)}
        options={projects.map((item) => ({
          value: item.key,
          label: item.name,
          description: item.key,
          icon: <ProjectTile project={item} size={16} />,
        }))}
        onChange={(event) => onProject(event.value)}
        className={CHIP}
      />
      <Icon name="chevron" size={12} className="shrink-0 text-tx-3" />
      <Select
        aria-label="Issue type"
        size="sm"
        value={typeId ?? ''}
        placeholder="Type"
        options={types.map((type) => ({
          value: type.id,
          label: type.name,
          icon: <TypeGlyph type={typeGlyph(type)} />,
        }))}
        onChange={(event) => onType(event.value)}
        className={CHIP}
      />
      <span className="ml-1.5 truncate text-13 text-tx-3 max-sm:hidden">
        {parentKey ? `Subtask of ${parentKey}` : 'New issue'}
      </span>
      <span className="flex-1" />
      <IconButton label="Close" icon="close" size="xs" onClick={onClose} />
    </div>
  );
}
