import { useT } from '@bemmoly/core-web';
import { Icon } from '@bemmoly/ui/icons';
import { Link } from '@tanstack/react-router';
import { useChecklist } from '../../hooks/use-setup.ts';
import { setupText } from '../../i18n/catalog.ts';

/**
 * "Back to the checklist" on setup pages while setup is under way (product rule 2). The shell
 * draws it above any screen whose address is a setup page; it goes once every step is done.
 */
export function BackToChecklist() {
  const t = useT(setupText);
  const checklist = useChecklist().data;
  if (!checklist || checklist.complete) return null;
  const done = checklist.steps.filter((step) => step.done).length;
  return (
    <div className="mx-auto w-full max-w-360 px-4 pt-4 md:px-6">
      <Link
        to="/"
        className="flex items-center gap-2.5 rounded-control bg-acc-50 px-3 py-2 text-13 text-tx"
      >
        <Icon name="checklist" size={16} className="shrink-0 text-acc" />
        <span className="flex-1">
          {t('pipelinesSetup.back.label', { done, total: checklist.steps.length })}
        </span>
        <span className="font-semibold text-acc">{t('pipelinesSetup.back.link')}</span>
      </Link>
    </div>
  );
}
