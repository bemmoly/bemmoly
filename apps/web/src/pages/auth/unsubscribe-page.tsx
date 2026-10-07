import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useSearch } from '@tanstack/react-router';
import { AuthLayout } from '../../components/auth/auth-layout.tsx';
import { BUTTON } from '../../components/button-sizes.ts';
import { FormError, Notice } from '../../components/form.tsx';
import { api } from '../../lib/api.ts';
import { describeError } from '../../lib/errors.ts';
import { Button, Skeleton } from '../../ui.ts';

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
        <Notice tone="warn">Open the unsubscribe link from the email again.</Notice>
      </AuthLayout>
    );
  }
  if (preview.isPending)
    return (
      <AuthLayout title="Email preferences">
        <Skeleton rows={2} />
      </AuthLayout>
    );
  if (!preview.data) {
    return (
      <AuthLayout title="This link cannot be used">
        <Notice tone="warn">{describeError(preview.error).message}</Notice>
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
          <p className="m-0 text-small leading-normal text-tx3">
            Stop sending email for “{label}”? Other notifications are not affected.
          </p>
          <FormError error={confirm.error} />
          <Button
            variant="primary"
            className={BUTTON.block}
            disabled={confirm.isPending}
            onClick={() => confirm.mutate()}
          >
            Unsubscribe
          </Button>
        </>
      )}
      <Link to="/settings/notifications" className="self-center text-small font-medium">
        Open notification settings
      </Link>
    </AuthLayout>
  );
}
