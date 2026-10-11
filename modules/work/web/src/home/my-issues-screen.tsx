import type { WorkScreenProps } from '../routes.tsx';
import { MyIssuesCard } from './my-issues-card.tsx';

/** /work/my-issues, where the sidebar's My issues leads: every tab at the server's page size. */
export default function MyIssuesScreen(_props: WorkScreenProps) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="m-0 text-20 font-semibold tracking-title">My issues</h1>
      <MyIssuesCard limit={20} full />
    </div>
  );
}
