/**
 * Moves the savings calculator (components/alternatives/Savings.astro) with its inputs. The
 * figures follow every keystroke; the live region is polite, so a screen reader hears the
 * answer once typing pauses. Loaded only on the page that renders the calculator.
 */
import type { JiraPlan } from '../../data/jira-pricing.ts';
import { peopleFrom, savings, usd } from '../savings.ts';

export function mountSavings(): void {
  const root = document.querySelector<HTMLElement>('[data-savings]');
  const people = root?.querySelector<HTMLInputElement>('#savings-people');
  if (!root || !people) return;

  const update = () => {
    const checked = root.querySelector<HTMLInputElement>('input[name="savings-plan"]:checked');
    const plan: JiraPlan = checked?.value === 'premium' ? 'premium' : 'standard';
    const result = savings(peopleFrom(people.value), plan);
    const monthly = root.querySelector('[data-savings-monthly]');
    const yearly = root.querySelector('[data-savings-yearly]');
    if (monthly) monthly.textContent = usd(result.monthly);
    if (yearly) yearly.textContent = usd(result.yearly);
  };

  root.addEventListener('input', update);
  people.addEventListener('blur', () => {
    people.value = String(peopleFrom(people.value));
    update();
  });
  root.hidden = false;
  update();
}
