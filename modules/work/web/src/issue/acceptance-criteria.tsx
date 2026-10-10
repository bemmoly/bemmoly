import type { RichText } from '@bemmoly/module-work/shared';
import { Button, ChecklistBlock, CriteriaRow, IconButton, Input, Tooltip, useToast } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useRef, useState } from 'react';
import { criteriaDoc, criteriaOf, type Criterion } from './criteria-doc.ts';

export interface AcceptanceCriteriaProps {
  title: string;
  doc: RichText | null | undefined;
  /** Stores the criteria; the page shows the change before the server answers. */
  onSave: (doc: RichText | null) => void;
  readOnly?: boolean;
}

/** An inline text box that adds or renames a criterion: Enter keeps it, Escape leaves it. */
function CriterionInput({
  initial = '',
  label,
  onDone,
  keepOpen = false,
}: {
  initial?: string;
  label: string;
  onDone: (text: string | null) => void;
  keepOpen?: boolean;
}) {
  const [text, setText] = useState(initial);
  // Escape closes the box; the blur that follows must not save what it dropped.
  const cancelled = useRef(false);
  return (
    <Input
      aria-label={label}
      autoFocus
      value={text}
      placeholder="What must be true to call this done?"
      onChange={(event) => setText(event.target.value)}
      onBlur={() => {
        if (!cancelled.current) onDone(text.trim() || null);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          if (!keepOpen) cancelled.current = true;
          onDone(text.trim() || null);
          if (keepOpen) setText('');
        }
        if (event.key === 'Escape') {
          event.stopPropagation();
          cancelled.current = true;
          onDone(null);
        }
      }}
      wrapperClassName="h-8 w-full"
    />
  );
}

/**
 * Acceptance criteria as a checklist block with a met counter: tick, add, rename and remove in
 * place. Removing one happens at once with Undo.
 */
export function AcceptanceCriteria({ title, doc, onSave, readOnly }: AcceptanceCriteriaProps) {
  const items = criteriaOf(doc);
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState<number | null>(null);
  const toast = useToast();
  const done = items.filter((item) => item.checked).length;

  const save = (next: Criterion[]) => onSave(criteriaDoc(next));
  const replace = (index: number, item: Criterion | null) =>
    save(items.flatMap((current, i) => (i === index ? (item ? [item] : []) : [current])));
  const remove = (index: number) => {
    const before = items;
    replace(index, null);
    toast.undo({ title: 'Criterion removed', onUndo: () => save(before) });
  };

  return (
    <ChecklistBlock
      title={title}
      done={done}
      total={items.length}
      hint="Checks the reviewer ticks before this can move to Done."
      action={
        !readOnly && (
          <Button
            size="xs"
            variant="ghost"
            icon={<Icon name="plus" size={13} />}
            onClick={() => setAdding(true)}
          >
            Add
          </Button>
        )
      }
    >
      {(items.length > 0 || adding) && (
        <>
          {items.map((item, index) =>
            renaming === index ? (
              <div key={`${index}-edit`} className="px-1.5 py-0.5">
                <CriterionInput
                  initial={item.text}
                  label="Rename the criterion"
                  onDone={(text) => {
                    setRenaming(null);
                    if (text && text !== item.text) replace(index, { text, checked: item.checked });
                  }}
                />
              </div>
            ) : (
              <CriteriaRow
                key={`${index}-${item.text}`}
                checked={item.checked}
                disabled={readOnly}
                onCheckedChange={(checked) => replace(index, { ...item, checked })}
                actions={
                  !readOnly && (
                    <>
                      <Tooltip label="Rename">
                        <IconButton
                          label={`Rename “${item.text}”`}
                          icon={<Icon name="edit" size={13} />}
                          size="xs"
                          onClick={() => setRenaming(index)}
                        />
                      </Tooltip>
                      <Tooltip label="Remove">
                        <IconButton
                          label={`Remove “${item.text}”`}
                          icon={<Icon name="close" size={13} />}
                          size="xs"
                          onClick={() => remove(index)}
                        />
                      </Tooltip>
                    </>
                  )
                }
              >
                {item.text}
              </CriteriaRow>
            ),
          )}
          {adding && (
            <div className="px-1.5 py-0.5">
              <CriterionInput
                label="New criterion"
                keepOpen
                onDone={(text) => {
                  if (text) save([...items, { text, checked: false }]);
                  else setAdding(false);
                }}
              />
            </div>
          )}
        </>
      )}
    </ChecklistBlock>
  );
}
