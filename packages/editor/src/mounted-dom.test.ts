import { describe, expect, it } from 'vitest';
import { mountedDom } from './mounted-dom.ts';

describe('mountedDom', () => {
  it('hands back the text box of a mounted editor', () => {
    const dom = document.createElement('div');
    expect(mountedDom({ isDestroyed: false, view: { dom } })).toBe(dom);
  });

  it('is null for no editor, a destroyed one, or one whose view is gone', () => {
    expect(mountedDom(null)).toBeNull();
    expect(
      mountedDom({ isDestroyed: true, view: { dom: document.createElement('div') } }),
    ).toBeNull();
    const unmounted = {
      isDestroyed: false,
      view: {
        get dom(): HTMLElement {
          throw new Error('The editor view is not available');
        },
      },
    };
    expect(mountedDom(unmounted)).toBeNull();
  });
});
