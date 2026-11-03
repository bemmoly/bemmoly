import { Skeleton } from '@bemmoly/ui';
import { useChecklist } from '../../hooks/use-setup.ts';
import { SetupHome } from '../setup/checklist/setup-home.tsx';
import ForYouScreen from './for-you-screen.tsx';

/** For you: the setup checklist until setup is done, then the person's own screen. */
export default function ForYou() {
  const checklist = useChecklist();
  if (checklist.isPending) return <Skeleton className="m-6 h-96" />;
  // A checklist that cannot be read never hides the screen people use every day.
  return checklist.data && !checklist.data.complete ? <SetupHome /> : <ForYouScreen />;
}
