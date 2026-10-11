import { Icon } from '@bemmoly/ui/icons';
import { AuthHeading } from './auth-layout.tsx';

/** The short beat between a successful sign-in and the app: a tick, the name, a moving bar. */
export function SignedInPane({ name, workspace }: { name: string; workspace: string }) {
  return (
    <div role="status" className="flex flex-col gap-5">
      <span className="grid size-11 place-items-center rounded-full bg-green-50 text-done">
        <Icon name="check" size={22} />
      </span>
      <AuthHeading
        title="Signed in"
        lede={`Welcome back, ${name.split(' ')[0]}. Opening ${workspace}…`}
      />
      <span className="h-0.75 overflow-hidden rounded-full bg-line">
        <span className="block h-full w-2/5 rounded-full bg-acc motion-safe:animate-slide-in" />
      </span>
    </div>
  );
}
