import { cx } from './cx.ts';
import { CODE_TOKENS } from './doc/styles.ts';
import type { ProseSize } from './types.ts';

/*
 * A property is set in BLOCKS or in a size, never both, so no two rules compete.
 *
 * One stylesheet for a document, whether the read-only view printed it or the editor is
 * editing it: both put the same elements under this class list, so a description looks the
 * same before and after Edit. Spacing follows the Issue mock's description: 10px between
 * blocks, lists indented 20px with 4px between items, inline code on the chip tint in mono.
 * A Docs page (size "doc") follows the Doc Editor mock instead: 15.5px at 1.7, 18px between
 * blocks, 22px section headings and lists indented 22px with 6px between items.
 */
const BLOCKS = [
  'flex min-w-0 flex-col break-words',
  '[&_p]:m-0',
  '[&_h1]:m-0 [&_h1]:font-semibold [&_h1]:text-tx',
  '[&_h2]:m-0 [&_h2]:font-semibold [&_h2]:text-tx',
  '[&_h3]:m-0 [&_h3]:font-semibold [&_h3]:text-tx',
  '[&_ul]:m-0 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col',
  '[&_ol]:m-0 [&_ol]:flex [&_ol]:list-decimal [&_ol]:flex-col',
  '[&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:pl-0',
  '[&_ul[data-type=taskList]>li]:flex [&_ul[data-type=taskList]>li]:items-start [&_ul[data-type=taskList]>li]:gap-2',
  '[&_ul[data-type=taskList]>li>label]:flex [&_ul[data-type=taskList]>li>label]:h-lh [&_ul[data-type=taskList]>li>label]:shrink-0 [&_ul[data-type=taskList]>li>label]:items-center',
  '[&_ul[data-type=taskList]>li>div]:min-w-0 [&_ul[data-type=taskList]>li>div]:flex-1',
  '[&_li[data-checked=true]>div]:text-tx5 [&_li[data-checked=true]>div]:line-through',
  '[&_input[type=checkbox]]:m-0 [&_input[type=checkbox]]:accent-ac',
  '[&_blockquote]:m-0 [&_blockquote]:border-l-3 [&_blockquote]:border-br3 [&_blockquote]:pl-3 [&_blockquote]:text-tx3',
  '[&_pre]:m-0 [&_pre]:overflow-auto [&_pre]:font-mono [&_pre]:whitespace-pre-wrap',
  '[&_code]:rounded-chip [&_code]:bg-chip [&_code]:px-1.25 [&_code]:py-px [&_code]:font-mono [&_code]:font-medium',
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:font-normal',
  '[&_hr]:m-0 [&_hr]:border-0 [&_hr]:border-t',
  '[&_[data-type=mention]]:font-medium [&_[data-type=mention]]:text-ac',
].join(' ');

/** The measures of a description, a comment and a drawer: the Issue mock's. */
const ISSUE = [
  '[&_h1]:text-18 [&_h2]:text-16',
  '[&_ul]:gap-1 [&_ul]:pl-5 [&_ol]:gap-1 [&_ol]:pl-5 [&_li_ul]:mt-1 [&_li_ol]:mt-1',
  '[&_pre]:rounded-sm [&_pre]:bg-chip [&_pre]:px-3 [&_pre]:py-2 [&_pre]:text-12h [&_code]:text-12h',
  '[&_hr]:border-br2',
].join(' ');

/** The measures of a Docs page: the Doc Editor mock's. */
const DOC = [
  'gap-4.5 text-15h leading-prose text-tx-body',
  '[&_h1]:mt-2.5 [&_h1]:text-26 [&_h1]:leading-title [&_h1]:tracking-title',
  '[&_h2]:mt-2.5 [&_h2]:text-22 [&_h2]:leading-title [&_h2]:tracking-brand',
  '[&_h3]:mt-1.5 [&_h3]:text-18 [&_h3]:leading-title',
  '[&_ul]:gap-1.5 [&_ul]:pl-5.5 [&_ol]:gap-1.5 [&_ol]:pl-5.5 [&_li_ul]:mt-1.5 [&_li_ol]:mt-1.5',
  '[&_code]:text-13h',
  // Link marks only (they carry rel=nofollow); chips that are links keep their own ink. The
  // faint underline tells a link from body text without colour, as WCAG 1.4.1 asks; the
  // accent alone is 1.9:1 against the body ink.
  '[&_a[rel~=nofollow]]:text-ac [&_a[rel~=nofollow]]:underline [&_a[rel~=nofollow]]:decoration-ac/35 [&_a[rel~=nofollow]]:decoration-1 [&_a[rel~=nofollow]]:underline-offset-3',
  '[&_a[rel~=nofollow]:hover]:text-ac-d [&_a[rel~=nofollow]:hover]:decoration-current',
  '[&_pre]:rounded-card [&_pre]:border [&_pre]:border-br [&_pre]:bg-bg2 [&_pre]:px-4 [&_pre]:py-3 [&_pre]:text-13 [&_pre]:leading-body',
  '[&_hr]:border-br-row',
  CODE_TOKENS,
].join(' ');

const SIZES: Record<ProseSize, string> = {
  page: cx(ISSUE, 'gap-2.5 text-14 leading-doc text-tx-body'),
  panel: cx(ISSUE, 'gap-2.5 text-13 leading-desc text-tx2'),
  comment: cx(ISSUE, 'gap-1.5'),
  doc: DOC,
};

/** The class list a document's container carries, in the view and in the editor alike. */
export function proseClass(size: ProseSize, className?: string): string {
  return cx(BLOCKS, SIZES[size], className);
}
