import type { CodeHostKind } from '@bemmoly/shared';
import github from 'simple-icons/icons/github.svg?no-inline';
import gitlab from 'simple-icons/icons/gitlab.svg?no-inline';
import { BrandTile, LogoMask } from '../setup/choice-card.tsx';

/** Each host's mark from simple-icons (CC0), one file each, painted in the text colour. */
const MARKS: Record<CodeHostKind, string> = { github, gitlab };

export function HostMark({ kind }: { kind: CodeHostKind }) {
  return <LogoMask url={MARKS[kind]} />;
}

/** The 32px tile the host cards and the kind choice share. */
export function HostTile({ kind }: { kind: CodeHostKind }) {
  return <BrandTile initials={kind === 'github' ? 'GH' : 'GL'} icon={<HostMark kind={kind} />} />;
}
