/**
 * Moves the sizing estimator (components/sizing/Estimator.astro) with its sliders. The visible
 * values follow every step; the live region's words change only once input has settled, so a
 * screen reader hears one answer, not every stop dragged past. Loaded only on pages that
 * render the estimator.
 */
import { CAPACITY, fmt, sizeKey, sizeName } from '../../data/capacity.ts';
import { cardOffers, offerMoney } from '../../data/prices.ts';
import { ISSUE_STOPS, PAGE_STOPS, estimate, explain, issuesText, pagesText } from '../estimate.ts';

const SETTLE_MS = 350;

export function mountEstimator(): void {
  const root = document.querySelector<HTMLElement>('[data-estimator]');
  if (!root) return;
  const issuesInput = root.querySelector<HTMLInputElement>('#estimate-issues');
  const pagesInput = root.querySelector<HTMLInputElement>('#estimate-pages');
  const live = root.querySelector<HTMLElement>('[data-estimate-live]');
  if (!issuesInput || !pagesInput || !live) return;
  const find = (selector: string) => root.querySelector<HTMLElement>(selector);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const read = () => ({
    issues: ISSUE_STOPS[Number(issuesInput.value)] ?? ISSUE_STOPS[0],
    pages: PAGE_STOPS[Number(pagesInput.value)] ?? PAGE_STOPS[0],
  });

  const showValues = () => {
    const { issues, pages } = read();
    issuesInput.setAttribute('aria-valuetext', issuesText(issues));
    pagesInput.setAttribute('aria-valuetext', pagesText(pages));
    const issuesOut = find('[data-out="issues"]');
    const pagesOut = find('[data-out="pages"]');
    if (issuesOut) issuesOut.textContent = fmt(issues);
    if (pagesOut) pagesOut.textContent = fmt(pages);
  };

  const showAnswer = () => {
    const { issues, pages } = read();
    const result = estimate(CAPACITY.sizes, issues, pages);
    const size = find('[data-estimate-size]');
    const why = find('[data-estimate-why]');
    const title = find('[data-estimate-prices-title]');
    const list = find('[data-estimate-prices]');
    if (size) size.textContent = result.size ? sizeName(result.size) : 'A larger setup';
    if (why) why.textContent = explain(result);
    const status = result.measured ? 'measured' : 'not-measured';
    for (const badge of root.querySelectorAll<HTMLElement>('[data-when]')) {
      badge.hidden = badge.dataset['when'] !== status;
    }
    const key = result.size ? sizeKey(result.size) : '';
    for (const rung of root.querySelectorAll<HTMLElement>('[data-rung]')) {
      rung.toggleAttribute('data-on', rung.dataset['rung'] === key);
    }
    if (title) title.textContent = result.size ? `${sizeName(result.size)}, cheapest first` : '';
    if (list) {
      list.replaceChildren(
        ...cardOffers(key)
          .slice(0, 5)
          .map((offer) => {
            const row = document.createElement('li');
            row.className =
              'flex justify-between gap-3 border-line-2 px-3 py-2 text-14 not-first:border-t';
            const name = document.createElement('span');
            name.className = 'text-tx';
            const plan = document.createElement('span');
            plan.className = 'text-13 text-tx-3';
            plan.textContent = offer.plan;
            name.append(`${offer.provider.provider} `, plan);
            const price = document.createElement('span');
            price.className = 'font-semibold tabular-nums text-tx';
            price.textContent = offerMoney(offer);
            row.append(name, price);
            return row;
          }),
      );
    }
  };

  const onInput = () => {
    showValues();
    clearTimeout(timer);
    timer = setTimeout(showAnswer, SETTLE_MS);
  };
  issuesInput.addEventListener('input', onInput);
  pagesInput.addEventListener('input', onInput);
  root.hidden = false;
}
