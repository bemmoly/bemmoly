import { useUiStore } from '../../store/ui.ts';

/** The 300px search field and the "Ask Bemmoly ⌘K" pill; both open the palette. */
export function SearchTriggers() {
  const openPalette = useUiStore((state) => state.openPalette);
  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        aria-label="Search issues, docs, people"
        aria-keyshortcuts="/"
        className="flex h-control w-75 cursor-pointer items-center gap-2 rounded-control border border-br3 bg-bg2 px-2.5 font-sans text-base text-tx5"
      >
        <span className="text-brand" aria-hidden="true">
          ⌕
        </span>
        <span>Search issues, docs, people</span>
        <span className="ml-auto font-mono text-mono font-medium text-tx6">/</span>
      </button>
      <button
        type="button"
        onClick={openPalette}
        aria-keyshortcuts="Meta+K Control+K"
        className="flex h-control cursor-pointer items-center gap-1.75 rounded-control border border-ac-br bg-ac-bg px-3 font-sans text-base font-medium text-ac"
      >
        <span className="size-2 rounded-full bg-ac" aria-hidden="true" />
        Ask Bemmoly
        <span className="font-mono text-mono font-medium text-ac-mute">⌘K</span>
      </button>
    </>
  );
}
