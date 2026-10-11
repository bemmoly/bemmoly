import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { loadLaterIcons } from '../icons/later.tsx';

afterEach(() => cleanup());

// jsdom implements <dialog> without the modal methods; the components only need the open state.
const proto = globalThis.HTMLDialogElement?.prototype;
if (proto && typeof proto.showModal !== 'function') {
  proto.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  proto.show = proto.showModal;
  proto.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}

// Draw every icon from the first render: the app loads the later ones once it is idle.
await loadLaterIcons();
