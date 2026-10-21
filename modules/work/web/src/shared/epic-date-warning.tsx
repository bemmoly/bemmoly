import {
  daysPastEpic,
  extendedEpicEnd,
  pulledInside,
  type EpicTargetField,
  type StoryDates,
} from '@bemmoly/module-work/shared';
import { queryKeys } from '@bemmoly/api-client';
import { DateWarningChip, Menu, MenuItem, shortDate, useToast } from '@bemmoly/ui';
import { useQueryClient } from '@tanstack/react-query';
import { api } from './api.ts';

/*
 * The warning a story shows when its dates run past its epic's target, on the roadmap and on
 * the board card alike, and its two fixes: move the epic's target out to the story's last day,
 * or pull the story's dates back to the epic's target. Both go through the issue PATCH; every
 * Work read refreshes after.
 */

export interface EpicTarget {
  key: string;
  /** The epic's target day. */
  endAt: string | null;
  targetField: EpicTargetField;
}

export interface EpicDateWarningProps {
  story: StoryDates & { key: string };
  epic: EpicTarget;
  /** Whether the person may change dates; without it the chip only says what is wrong. */
  canEdit?: boolean;
}

const dayLabel = (day: string) => shortDate(Math.floor(Date.parse(day) / 86_400_000));

export function useEpicDateFixes() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const run = async (title: string, change: () => Promise<unknown>) => {
    try {
      await change();
      toast.show({ tone: 'ok', title });
    } catch (error) {
      toast.show({
        tone: 'danger',
        title: 'The dates were not changed',
        body: error instanceof Error ? error.message : 'Try again.',
      });
    } finally {
      void queryClient.invalidateQueries({ queryKey: queryKeys.work() });
    }
  };
  return {
    extendEpic: (story: StoryDates, epic: EpicTarget) => {
      const end = extendedEpicEnd(story);
      if (!end) return Promise.resolve();
      return run(`${epic.key} now ends ${dayLabel(end)}`, () =>
        api.work.issues.update(
          epic.key,
          epic.targetField === 'dueAt' ? { dueAt: end } : { customFields: { target_date: end } },
        ),
      );
    },
    pullStory: (story: StoryDates & { key: string }, epic: EpicTarget) => {
      if (!epic.endAt) return Promise.resolve();
      const dates = pulledInside(story, epic.endAt);
      return run(`${story.key} now ends with ${epic.key}`, () =>
        api.work.issues.update(story.key, dates),
      );
    },
  };
}

/** The amber chip and its menu, or nothing while the story fits its epic. */
export function EpicDateWarning({ story, epic, canEdit = true }: EpicDateWarningProps) {
  const fixes = useEpicDateFixes();
  const days = daysPastEpic(story, epic.endAt);
  if (days === null || !epic.endAt) return null;
  const words = `Ends ${days} ${days === 1 ? 'day' : 'days'} after ${epic.key}`;
  const end = extendedEpicEnd(story);
  if (!canEdit) return <DateWarningChip title={words}>After {epic.key}</DateWarningChip>;
  return (
    <Menu
      trigger={(props) => (
        <DateWarningChip {...props} aria-label={`${words}. Fix the dates`} title={words}>
          After {epic.key}
        </DateWarningChip>
      )}
    >
      <MenuItem onSelect={() => void fixes.extendEpic(story, epic)}>
        Extend {epic.key} to {end ? dayLabel(end) : 'this date'}
      </MenuItem>
      <MenuItem onSelect={() => void fixes.pullStory(story, epic)}>
        Move {story.key} to end {dayLabel(epic.endAt)}
      </MenuItem>
    </Menu>
  );
}
