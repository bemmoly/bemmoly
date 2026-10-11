import { Logo } from '@bemmoly/ui';

/**
 * The wizard's quiet 56px header. There is no workspace yet, so the brand block is its first
 * line only (mark and the re-cut wordmark); on the right one muted chip names the install and
 * the version the server runs.
 */
export function SetupHeader({ versionLabel }: { versionLabel: string }) {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2.5 border-b border-line bg-canvas px-4 md:px-6">
      <Logo size={24} label="" />
      <Logo variant="wordmark" trim size={15} />
      <span className="ml-auto rounded-full border border-line px-2.5 py-0.5 text-12 text-tx-3 tabular-nums">
        {versionLabel}
      </span>
    </header>
  );
}
