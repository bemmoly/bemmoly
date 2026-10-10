import { Kbd } from '@bemmoly/ui';
import { Icon, type IconName } from '@bemmoly/ui/icons';

interface Choice {
  icon: IconName;
  title: string;
  description: string;
  keys?: string;
  onChoose: () => void;
}

function ChoiceCard({ choice, primary }: { choice: Choice; primary: boolean }) {
  return (
    <button
      type="button"
      onClick={choice.onChoose}
      autoFocus={primary}
      className="group flex cursor-pointer flex-col gap-2 rounded-card border border-line bg-card p-4 text-left font-sans outline-0 hover:border-line hover:shadow-e1 focus-visible:border-acc focus-visible:shadow-ring"
    >
      <span
        className={
          'grid size-8.5 place-items-center rounded-control border border-line ' +
          (primary ? 'bg-acc-50 text-acc' : 'bg-side text-tx-2')
        }
      >
        <Icon name={choice.icon} size={18} />
      </span>
      <span className="flex items-center gap-2">
        <span className="flex-1 text-13 font-semibold text-tx">{choice.title}</span>
        {choice.keys && <Kbd keys={choice.keys} />}
      </span>
      <span className="text-13 leading-body text-tx-3">{choice.description}</span>
    </button>
  );
}

/**
 * An empty space asks one question with three answers: a blank page (the default, N or
 * Enter), a template, or an import. Someone who can only read is told who can add pages.
 */
export function EmptySpace({
  spaceName,
  canWrite,
  onBlank,
  onTemplate,
  onImport,
}: {
  spaceName: string;
  canWrite: boolean;
  onBlank: () => void;
  onTemplate: () => void;
  onImport: () => void;
}) {
  if (!canWrite) {
    return (
      <div className="mx-auto mt-16 max-w-130 text-center">
        <h2 className="m-0 text-16 font-semibold text-tx">Nothing written in {spaceName} yet</h2>
        <p className="m-0 mt-1.5 text-13 text-tx-3">
          You can read {spaceName} but not add pages. A space admin can change that.
        </p>
      </div>
    );
  }
  const choices: Choice[] = [
    {
      icon: 'file-plus',
      title: 'Blank page',
      description: 'Start writing. Press / for headings, tables, issues and more.',
      keys: 'N',
      onChoose: onBlank,
    },
    {
      icon: 'layers',
      title: 'From a template',
      description: 'RFC, postmortem, runbook, meeting notes, product spec, decision log.',
      onChoose: onTemplate,
    },
    {
      icon: 'upload',
      title: 'Import',
      description: 'Markdown files or folders, or a Confluence export.',
      onChoose: onImport,
    },
  ];
  return (
    <section aria-label="Start the space" className="mx-auto mt-12 flex max-w-190 flex-col gap-5">
      <div className="text-center">
        <h2 className="m-0 text-16 font-semibold tracking-display text-tx">
          Write the first page in {spaceName}
        </h2>
        <p className="m-0 mt-1.5 text-13 text-tx-3">
          It becomes the space’s home page. You can change that later.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        {choices.map((choice, index) => (
          <ChoiceCard key={choice.title} choice={choice} primary={index === 0} />
        ))}
      </div>
    </section>
  );
}
