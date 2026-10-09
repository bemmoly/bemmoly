import { cx } from './cx.ts';
import type { ProseSize } from './types.ts';

/*
 * One stylesheet for a document, whether the read-only view printed it or the editor is
 * editing it: both put the same elements under this class list, so a description looks the
 * same before and after Edit. Spacing follows the Issue mock's description: 10px between
 * blocks, lists indented 20px with 4px between items, inline code on the chip tint in mono.
 */
const BLOCKS = [
  'flex min-w-0 flex-col break-words',
  '[&_p]:m-0',
  '[&_h1]:m-0 [&_h1]:text-18 [&_h1]:font-semibold [&_h1]:text-tx',
  '[&_h2]:m-0 [&_h2]:text-16 [&_h2]:font-semibold [&_h2]:text-tx',
  '[&_h3]:m-0 [&_h3]:font-semibold [&_h3]:text-tx',
  '[&_ul]:m-0 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1 [&_ul]:pl-5',
  '[&_ol]:m-0 [&_ol]:flex [&_ol]:list-decimal [&_ol]:flex-col [&_ol]:gap-1 [&_ol]:pl-5',
  '[&_li_ul]:mt-1 [&_li_ol]:mt-1',
  '[&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:pl-0',
  '[&_ul[data-type=taskList]>li]:flex [&_ul[data-type=taskList]>li]:items-start [&_ul[data-type=taskList]>li]:gap-2',
  '[&_ul[data-type=taskList]>li>label]:flex [&_ul[data-type=taskList]>li>label]:h-lh [&_ul[data-type=taskList]>li>label]:shrink-0 [&_ul[data-type=taskList]>li>label]:items-center',
  '[&_ul[data-type=taskList]>li>div]:min-w-0 [&_ul[data-type=taskList]>li>div]:flex-1',
  '[&_li[data-checked=true]>div]:text-tx5 [&_li[data-checked=true]>div]:line-through',
  '[&_input[type=checkbox]]:m-0 [&_input[type=checkbox]]:accent-ac',
  '[&_blockquote]:m-0 [&_blockquote]:border-l-3 [&_blockquote]:border-br3 [&_blockquote]:pl-3 [&_blockquote]:text-tx3',
  '[&_pre]:m-0 [&_pre]:overflow-auto [&_pre]:rounded-sm [&_pre]:bg-chip [&_pre]:px-3 [&_pre]:py-2 [&_pre]:font-mono [&_pre]:text-12h [&_pre]:whitespace-pre-wrap',
  '[&_code]:rounded-chip [&_code]:bg-chip [&_code]:px-1.25 [&_code]:py-px [&_code]:font-mono [&_code]:text-12h [&_code]:font-medium',
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:font-normal',
  '[&_hr]:m-0 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-br2',
  '[&_[data-type=mention]]:font-medium [&_[data-type=mention]]:text-ac',
].join(' ');

const SIZES: Record<ProseSize, string> = {
  page: 'gap-2.5 text-14 leading-doc text-tx-body',
  panel: 'gap-2.5 text-13 leading-desc text-tx2',
  comment: 'gap-1.5',
};

/** The class list a document's container carries, in the view and in the editor alike. */
export function proseClass(size: ProseSize, className?: string): string {
  return cx(BLOCKS, SIZES[size], className);
}
