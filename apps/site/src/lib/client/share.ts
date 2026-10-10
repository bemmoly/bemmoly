/**
 * "Share the command to your computer", on phones ([data-share]): nobody installs from a
 * phone, so the Web Share API sends the command to wherever the visitor will run it. Without
 * Web Share the link becomes "Copy the command" and copies instead. No server is involved.
 */
import { copy } from './copy.ts';

export function enhanceShare(): void {
  for (const button of document.querySelectorAll<HTMLElement>('[data-share]')) {
    const text = button.dataset['share'] ?? '';
    const label = button.querySelector('[data-copy-label]');
    const canShare = typeof navigator.share === 'function';
    if (!canShare && label) label.textContent = 'Copy the command';
    button.hidden = false;
    button.addEventListener('click', () => {
      if (!canShare) return void copy(button, text);
      navigator.share({ title: 'Install Bemmoly', text }).catch(() => {
        // Dismissing the share sheet is not an error worth showing.
      });
    });
  }
}
