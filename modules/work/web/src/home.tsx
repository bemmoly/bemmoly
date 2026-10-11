import type { HomeSectionProps } from '@bemmoly/core-web';
import { MyIssuesCard } from './home/my-issues-card.tsx';
import { SprintCard } from './home/sprint-card.tsx';

/** Work's card in Home's main column: My issues, a few per tab. */
export default function MyWorkSection(_props: HomeSectionProps) {
  return <MyIssuesCard limit={6} />;
}

/** Work's card in Home's narrow column: the current project's sprint at a glance. */
export function HomeAside(_props: HomeSectionProps) {
  return <SprintCard />;
}
