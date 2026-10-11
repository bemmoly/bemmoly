import { isIconName } from '../../icons/page-icon.tsx';
import { ICON_NAMES, type IconName } from '../../icons/icon.tsx';
import { parseHex } from '../../theme/color.ts';
import { TYPE_COLORS, type TypeColorToken } from '../../tokens/semantic.ts';

export type IssueType = 'epic' | 'story' | 'task' | 'bug' | 'subtask' | 'incident';

/** A stored issue type as the server sends it; only `key` is required. */
export interface IssueTypeLike {
  key: string;
  name?: string | null;
  /** epic, standard or subtask: a custom type without an icon takes its level's default. */
  level?: string | null;
  /** An icon name from the icon set; anything else (the first release stored ◆ ▮ ●) is ignored. */
  icon?: string | null;
  /** A hex colour; it is drawn as the nearest type colour so the family holds in every theme. */
  color?: string | null;
}

/** A built-in type's key, or a stored type of any key. */
export type IssueTypeRef = IssueType | IssueTypeLike;

/** How a glyph is drawn inside its tile: an icon from the set, or one of two drawn marks. */
export type TypeMark = { icon: IconName; filled: boolean } | { drawn: 'bug' | 'alert' };

/** The six built-in types: name, fixed colour and mark (docs/design/premium/kit.js, `ty`). */
export const ISSUE_TYPES: Record<
  IssueType,
  { name: string; color: TypeColorToken; mark: TypeMark }
> = {
  epic: { name: 'Epic', color: 'type-epic', mark: { icon: 'zap', filled: true } },
  story: { name: 'Story', color: 'type-story', mark: { icon: 'bookmark', filled: true } },
  task: { name: 'Task', color: 'type-task', mark: { icon: 'check', filled: false } },
  bug: { name: 'Bug', color: 'type-bug', mark: { drawn: 'bug' } },
  subtask: { name: 'Subtask', color: 'type-subtask', mark: { icon: 'subtask', filled: false } },
  incident: { name: 'Incident', color: 'type-incident', mark: { drawn: 'alert' } },
};

export const isBuiltInType = (key: string): key is IssueType => key in ISSUE_TYPES;

/** The icons a custom type may pick, in the order a picker offers them. */
export const TYPE_ICON_CHOICES: readonly IconName[] = [
  'zap',
  'bookmark',
  'check',
  'bug',
  'subtask',
  'warning',
  'flag',
  'dot',
  'target',
  'rocket',
  'idea',
  'wrench',
  'shield',
  'megaphone',
  'shapes',
  'box',
  'globe',
  'heart',
  'flame',
  'puzzle',
  'doc',
  'people',
];

/** The colours a custom type may pick: the type family itself. */
export const TYPE_COLOR_CHOICES = Object.keys(TYPE_COLORS) as TypeColorToken[];

/** The type colour nearest a stored hex, so an old or arbitrary colour still joins the family. */
export function nearestTypeColor(hex: string | null | undefined): TypeColorToken | null {
  const rgb = hex ? parseHex(hex) : null;
  if (!rgb) return null;
  let best: TypeColorToken = 'type-task';
  let bestDistance = Infinity;
  for (const [token, value] of Object.entries(TYPE_COLORS) as [TypeColorToken, string][]) {
    const [r, g, b] = parseHex(value) ?? [0, 0, 0];
    const distance = (rgb[0] - r) ** 2 + (rgb[1] - g) ** 2 + (rgb[2] - b) ** 2;
    if (distance < bestDistance) [best, bestDistance] = [token, distance];
  }
  return best;
}

export interface TypeLook {
  name: string;
  color: TypeColorToken;
  mark: TypeMark;
}

const LEVEL_DEFAULT: Record<string, IssueType> = { epic: 'epic', subtask: 'subtask' };

/**
 * What a type looks like. Built-in keys keep their fixed colour and mark whatever was stored,
 * since the first release stored characters and old colours for them. A custom type draws
 * its stored icon in its stored colour, each falling back to its level's built-in look.
 */
export function typeLook(ref: IssueTypeRef | null | undefined): TypeLook {
  if (!ref) return ISSUE_TYPES.task;
  if (typeof ref === 'string') return ISSUE_TYPES[ref];
  if (isBuiltInType(ref.key)) {
    return { ...ISSUE_TYPES[ref.key], name: ref.name || ISSUE_TYPES[ref.key].name };
  }
  const base = ISSUE_TYPES[LEVEL_DEFAULT[ref.level ?? ''] ?? 'task'];
  const icon =
    ref.icon && isIconName(ref.icon) && (ICON_NAMES as readonly string[]).includes(ref.icon)
      ? (ref.icon as IconName)
      : null;
  return {
    name: ref.name || ref.key,
    color: nearestTypeColor(ref.color) ?? base.color,
    mark: icon ? { icon, filled: false } : base.mark,
  };
}
