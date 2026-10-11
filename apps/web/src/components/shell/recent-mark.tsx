import { knownIcon, type RecentLook } from '@bemmoly/core-web';
import { StatusGlyph, statusStage, TypeGlyph } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';

/** The leading mark of a recent item or a screen action: its type tile, or its icon. */
export function RecentMark({ look, size = 16 }: { look: RecentLook | undefined; size?: number }) {
  if (!look) return <Icon name="chevron" size={size} />;
  if (look.kind === 'issue') return <TypeGlyph type={look.type} size={size} />;
  if (look.kind === 'status') {
    return (
      <StatusGlyph
        stage={statusStage(look.category, look.name)}
        label={look.name}
        size={size - 2}
      />
    );
  }
  return <Icon name={knownIcon(look.icon) ?? 'doc'} size={size} />;
}

/** An issue's status glyph beside a recent row, when the recent item carries one. */
export function RecentStatus({ look }: { look: RecentLook | undefined }) {
  if (look?.kind !== 'issue' || !look.status) return null;
  return (
    <StatusGlyph
      stage={statusStage(look.status.category, look.status.name)}
      label={look.status.name}
      size={12}
    />
  );
}
