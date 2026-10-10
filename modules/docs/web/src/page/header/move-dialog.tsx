import { Button, Input, Modal, Select, useToast } from '@bemmoly/ui';
import { Icon, PageIcon } from '@bemmoly/ui/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import type { PageDetail } from '../../../../shared/pages.ts';
import { useMovePage } from '../../hooks/mutations.ts';
import { useSpaces } from '../../hooks/queries.ts';
import { api } from '../../shared/api.ts';
import { docsKeys } from '../../shared/keys.ts';

interface Destination {
  id: string | null;
  title: string;
  icon: string | null;
}

export interface MoveDialogProps {
  page: PageDetail;
  open: boolean;
  onClose: () => void;
}

/** Pages a moved page may go under: the space's top level, or a search across it. */
function useDestinations(spaceId: string, spaceKey: string, query: string, pageId: string) {
  return useQuery({
    queryKey: [...docsKeys.all(), 'move-targets', spaceId, query],
    queryFn: async (): Promise<Destination[]> => {
      const rows = query
        ? await api.docs.search.pages({ q: query, spaceId, limit: 12 })
        : (await api.docs.spaces.tree(spaceKey, { limit: 50 })).items;
      return rows
        .filter((row) => row.id !== pageId)
        .map((row) => ({ id: row.id, title: row.title || 'Untitled', icon: row.icon }));
    },
    enabled: Boolean(spaceKey),
    staleTime: 30_000,
  });
}

/**
 * Move to…: another parent in this space, the top of a space, or another space altogether.
 * The page keeps everything under it; the server refuses a move into its own subtree and the
 * toast says so.
 */
export function MoveDialog(props: MoveDialogProps) {
  return props.open ? <MoveForm {...props} /> : null;
}

function MoveForm({ page, open, onClose }: MoveDialogProps) {
  const spaces = useSpaces();
  const [spaceId, setSpaceId] = useState(page.spaceId);
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query.trim());
  const [target, setTarget] = useState<Destination>({ id: null, title: '', icon: null });
  const space = spaces.data?.find((row) => row.id === spaceId);
  const destinations = useDestinations(spaceId, space?.key ?? '', deferred, page.id);
  const move = useMovePage();
  const queryClient = useQueryClient();
  const { show } = useToast();

  const submit = () =>
    move.mutate(
      {
        pageId: page.id,
        body: { parentId: target.id, ...(spaceId === page.spaceId ? {} : { spaceId }) },
      },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: docsKeys.page(page.id) });
          show({
            tone: 'ok',
            title: `Moved to ${target.id ? target.title : (space?.name ?? 'the space')}`,
          });
          onClose();
        },
        onError: (error) => show({ tone: 'danger', title: 'Not moved', body: error.message }),
      },
    );

  const row = (destination: Destination, label: string) => {
    const on = destination.id === target.id;
    return (
      <li key={destination.id ?? 'top'}>
        <button
          type="button"
          aria-pressed={on}
          onClick={() => setTarget(destination)}
          className="flex w-full cursor-pointer items-center gap-2 rounded-sm border-0 bg-transparent px-2.5 py-2 text-left font-sans text-13 text-tx hover:bg-bg2 aria-pressed:bg-ac-bg aria-pressed:font-medium aria-pressed:text-ac"
        >
          {destination.id ? (
            <PageIcon value={destination.icon} size={14} />
          ) : (
            <Icon name="doc" size={14} />
          )}
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {on && <Icon name="check" size={14} />}
        </button>
      </li>
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="sm"
      title={`Move “${page.title || 'Untitled'}”`}
      description="Pages under it move too."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={move.isPending} onClick={submit}>
            Move
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2.5">
        <Select
          aria-label="Space"
          value={spaceId}
          options={(spaces.data ?? []).map((row) => ({ value: row.id, label: row.name }))}
          onChange={(event) => {
            setSpaceId(event.value);
            setTarget({ id: null, title: '', icon: null });
          }}
        />
        <Input
          aria-label="Find a page"
          placeholder="Find a page to move it under"
          prefix={<Icon name="search" size={14} />}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <ul aria-label="Destinations" className="m-0 flex max-h-64 list-none flex-col gap-px overflow-auto p-0">
          {row({ id: null, title: '', icon: null }, `Top level of ${space?.name ?? 'the space'}`)}
          {(destinations.data ?? []).map((destination) => row(destination, destination.title))}
        </ul>
      </div>
    </Modal>
  );
}
