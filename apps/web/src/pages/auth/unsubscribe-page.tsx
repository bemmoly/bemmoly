import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useSearch } from '@tanstack/react-router';
import { AuthLayout } from '../../components/auth/auth-layout.tsx';
import { FormError, Loading, Notice } from '../../components/form.tsx';
import { api } from '../../lib/api.ts';
import { describeError } from '../../lib/errors.ts';
import { Button } from '@bemmoly/ui';

/** The one-click unsubscribe from a notification email; no sign-in needed. */
export function UnsubscribePage() {
  const { token } = useSearch({ from: '/unsubscribe' });
  const preview = useQuery({
    queryKey: ['unsubscribe', token],
    queryFn: () => api.unsubscriptions.preview(token ?? ''),
    enabled: Boolean(token),
    retry: false,
  });
  const confirm = useMutation({ mutationFn: () => api.unsubscriptions.confirm(token ?? '') });
  if (!token) {
    return (
      <AuthLayout title="This link is incomplete">
        <Notice tone="caution">Open the unsubscribe link from the email again.</Notice>
      </AuthLayout>
    );
  }
  if (preview.isPending)
    return (
      <AuthLayout title="Email preferences">
        <Loading lines={2} />
      </AuthLayout>
    );
  if (!preview.data) {
    return (
      <AuthLayout title="This link cannot be used">
        <Notice tone="caution">{describeError(preview.error).message}</Notice>
      </AuthLayout>
    );
  }
  const { label, emailEnabled } = preview.data;
  return (
    <AuthLayout title="Email preferences" subtitle={`Emails for: ${label}`}>
      {confirm.isSuccess || !emailEnabled ? (
        <Notice>
          You won't get emails for “{label}” any more. They still reach your inbox in Bemmoly, and
          you can turn email back on in your notification settings.
        </Notice>
      ) : (
        <>
          <p className="m-0 text-12h leading-body text-tx3">
            Stop sending email for “{label}”? Other notifications are not affected.
          </p>
          <FormError error={confirm.error} />
          <Button
            variant="primary"
            size="lg"
            block
            disabled={confirm.isPending}
            onClick={() => confirm.mutate()}
          >
            Unsubscribe
          </Button>
        </>
      )}
      <Link to="/settings/notifications" className="self-center text-12h font-medium">
        Open notification settings
      </Link>
    </AuthLayout>
  );
}
