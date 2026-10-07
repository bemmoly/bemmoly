import { useRouter, type ErrorComponentProps } from '@tanstack/react-router';
import { PageFailure } from '../components/page-failure.tsx';

/** Router-level failures (a loader or guard threw): same copy as an in-page failure. */
export function ErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <PageFailure
      error={error}
      onRetry={() => {
        reset();
        void router.invalidate();
      }}
    />
  );
}
