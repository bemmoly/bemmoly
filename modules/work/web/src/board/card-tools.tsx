import { IconButton } from '@bemmoly/ui';
import type { ViewCard } from '../hooks/board-model.ts';
import { IssueActionsMenu } from '../shared/issue-actions-menu.tsx';
import { cardPriority } from './card-view.ts';
import { useBoardShared } from './board-context.ts';

export interface CardToolsProps {
  card: ViewCard;
  /** The selection, when this card is part of it, so the menu acts on all of it. */
  targets?: readonly string[];
}

/** A card's hover tools: assign to me, open in the peek, and the issue's ··· menu. */
export function CardTools({ card, targets }: CardToolsProps) {
  const { actions, vocab, quick, sprints } = useBoardShared();
  return (
    <>
      {vocab.meId && card.assigneeId !== vocab.meId && (
        <IconButton
          tip="Assign to me"
          keys="I"
          size="tool"
          icon="user"
          label={`Assign ${card.key} to me`}
          onClick={(event) => {
            event.stopPropagation();
            void quick.update([card.key], { assigneeId: vocab.meId ?? null });
          }}
        />
      )}
      <IconButton
        tip="Open in peek"
        keys="Enter"
        size="tool"
        icon="expand"
        label={`Open ${card.key}`}
        onClick={(event) => {
          event.stopPropagation();
          actions.open(card.key);
        }}
      />
      <IssueActionsMenu
        issueKey={card.key}
        assigneeId={card.assigneeId}
        priority={cardPriority(card)}
        meId={vocab.meId}
        actions={quick}
        onOpen={() => actions.open(card.key)}
        {...(sprints ? { sprints } : {})}
        {...(targets ? { targets } : {})}
      />
    </>
  );
}
