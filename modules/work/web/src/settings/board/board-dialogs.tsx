import { isApiError } from '@bemmoly/api-client';
import { ConfirmChange } from '@bemmoly/ui';
import type { BoardReview } from '../../hooks/settings-board-review.ts';
import type { BoardSettings } from '../../hooks/settings-board.ts';
import { DiffDialog } from '../diff-dialog.tsx';

const failure = (error: unknown) =>
  error ? (isApiError(error) ? error.message : 'The change was not saved.') : undefined;

/** Every dialog of Board settings: View diff, the review before a save or reset, and the asks. */
export function BoardDialogs({
  settings,
  review,
  schemeName,
}: {
  settings: BoardSettings;
  review: BoardReview;
  schemeName: string;
}) {
  return (
    <>
      <DiffDialog
        open={review.viewing}
        title="Board settings overridden on this project"
        description={`Compared with the org default, ${schemeName}.`}
        entries={settings.overrides}
        empty="This board matches the org default."
        onClose={() => review.setViewing(false)}
      />
      <DiffDialog
        {...review.saveReview}
        title="Review changes"
        description="These settings change for everyone on the project when you save."
        empty="Nothing changes."
        confirmLabel="Save changes"
        error={failure(settings.save.error)}
      />
      <ConfirmChange
        open={review.saveRisk !== null}
        title=""
        consequences={[]}
        confirmLabel=""
        {...review.saveRisk}
        busy={settings.save.isPending}
        error={
          settings.save.error ? (
            <p className="m-0 text-12h text-danger">{failure(settings.save.error)}</p>
          ) : undefined
        }
        onConfirm={review.confirmSaveRisk}
        onCancel={review.cancelSaveRisk}
      />
      <DiffDialog
        {...review.resetReview}
        title="Reset to the org default"
        description={`Every setting below goes back to ${schemeName}.`}
        empty="This board already matches the org default."
        confirmLabel="Continue"
      />
      <ConfirmChange
        open={review.resetRisk !== null}
        title=""
        consequences={[]}
        confirmLabel=""
        {...review.resetRisk}
        busy={settings.reset.isPending}
        error={
          settings.reset.error ? (
            <p className="m-0 text-12h text-danger">{failure(settings.reset.error)}</p>
          ) : undefined
        }
        onConfirm={review.confirmReset}
        onCancel={review.cancelReset}
      />
    </>
  );
}
