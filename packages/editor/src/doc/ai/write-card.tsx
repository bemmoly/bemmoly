import { AiActionButton, AiNotUseful, AiSummary, SkeletonText } from '@bemmoly/ui';
import type { Editor } from '@tiptap/core';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useEditorState } from '../../editor/use-editor.ts';
import type { DocServices } from '../services.ts';
import { applyWrite, preloadMarkdown, type ApplyMode } from './apply-write.ts';
import { aiWriteKey, closeWrite } from './write-plugin.ts';
import type { AiWriteSession, AiWriteStore } from './write-store.ts';

/*
 * The suggestion card: what an /ai command or Ask AI wrote, streaming in lilac between the
 * page's blocks, with Replace (for a rewrite whose words are still there), Insert, Ask again,
 * Discard and Not useful. Nothing reaches the page until Replace or Insert, and then as one
 * change that one undo takes back. A failure says so inside the card; the page around it
 * keeps working.
 */

/** Where the words came from, as the card's source line says it. */
function sourceOf(session: AiWriteSession): string {
  const { command, scope } = session;
  if (command.id === 'summarize-comments') return 'from this page’s comments';
  if (command.id === 'continue') return 'from the text above';
  if (command.kind === 'transform') {
    return scope.target && scope.target.text !== scope.anchor.text
      ? 'from the selection'
      : 'from this line';
  }
  return scope.request.heading ? `from “${scope.request.heading}”` : 'from this section';
}

function Body({ session, failed }: { session: AiWriteSession; failed: string | null }) {
  if (session.status === 'error' || failed) {
    return <p className="m-0 text-tx-2">{failed ?? session.error}</p>;
  }
  if (!session.text) return <SkeletonText lines={3} className="py-1" />;
  return <div className="text-14 leading-body whitespace-pre-wrap">{session.text}</div>;
}

interface CardProps {
  editor: Editor;
  store: AiWriteStore;
  services: DocServices;
}

export function AiWriteCard({ editor, store, services }: CardProps) {
  const session = useSyncExternalStore(store.subscribe, store.get, store.get);
  useEditorState(editor);
  const [failure, setFailure] = useState<{ id: number; text: string } | null>(null);
  const [applying, setApplying] = useState(false);
  const id = session?.id;
  useEffect(() => {
    if (id !== undefined) preloadMarkdown();
  }, [id]);
  const placed = editor.isDestroyed ? null : aiWriteKey.getState(editor.state);
  if (!session || !placed || placed.id !== session.id) return null;
  // A failed Insert belongs to the card it happened in, not the next one.
  const failed = failure?.id === session.id ? failure.text : null;
  const setFailed = (text: string | null) => setFailure(text ? { id: session.id, text } : null);

  const ai = services.ai;
  const done = session.status === 'done' && !failed;
  const transform = session.command.kind === 'transform';
  const canReplace = transform && Boolean(placed.target);
  const close = () => closeWrite(editor, store);
  const apply = async (mode: ApplyMode) => {
    setApplying(true);
    const ok = await applyWrite(editor, session.text, mode).catch(() => false);
    setApplying(false);
    if (ok) close();
    else setFailed('That part of the page changed, so this can’t go there. Insert it instead.');
  };
  const again = () => {
    setFailed(null);
    if (ai) store.again(ai);
  };

  const actions = (
    <>
      {done && canReplace && (
        <AiActionButton disabled={applying} onClick={() => void apply('replace')}>
          Replace
        </AiActionButton>
      )}
      {(done || (failed && session.text)) && (
        <AiActionButton disabled={applying} onClick={() => void apply('insert')}>
          {transform ? 'Insert below' : 'Insert'}
        </AiActionButton>
      )}
      {session.status !== 'streaming' && (
        <AiActionButton disabled={applying} onClick={again}>
          {session.status === 'error' ? 'Try again' : 'Ask again'}
        </AiActionButton>
      )}
      <AiNotUseful onClick={close}>Discard</AiNotUseful>
      {done && (
        <AiNotUseful
          onClick={() => {
            if (session.runId) ai?.notUseful?.(session.runId);
            close();
          }}
        >
          Not useful
        </AiNotUseful>
      )}
    </>
  );

  const note =
    done && transform && !placed.target
      ? 'The words this was written for changed; Insert adds it below instead.'
      : null;

  return createPortal(
    <div
      className="my-3 font-sans"
      aria-busy={session.status === 'streaming'}
      data-ai-write-status={session.status}
    >
      <AiSummary
        variant="page"
        title={session.command.label}
        source={session.status === 'streaming' ? 'Writing…' : sourceOf(session)}
        actions={actions}
      >
        <Body session={session} failed={failed} />
        {note && <p className="m-0 mt-2 text-13 text-tx-2">{note}</p>}
      </AiSummary>
    </div>,
    session.container,
  );
}
