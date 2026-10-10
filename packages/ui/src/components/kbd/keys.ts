import type { IconName } from '../../icons/icon.tsx';

/**
 * Keyboard shortcuts as data. A shortcut is written in words ("Mod+K", "Mod+Shift+P", "Up Down",
 * "Esc"); the symbols the first release typed (⌘ ⇧ ⌥ ⏎ ↵ ↑ ↓ ← →) are read too. "Mod" is
 * Command on Apple platforms and Control elsewhere.
 */
export type KeyName =
  | 'mod'
  | 'shift'
  | 'alt'
  | 'enter'
  | 'esc'
  | 'tab'
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'space'
  | 'backspace';

export type KeyPart = { name: KeyName } | { text: string };

const WORDS: Record<string, KeyName> = {
  mod: 'mod',
  cmd: 'mod',
  command: 'mod',
  meta: 'mod',
  ctrl: 'mod',
  control: 'mod',
  shift: 'shift',
  alt: 'alt',
  option: 'alt',
  opt: 'alt',
  enter: 'enter',
  return: 'enter',
  esc: 'esc',
  escape: 'esc',
  tab: 'tab',
  up: 'up',
  down: 'down',
  left: 'left',
  right: 'right',
  space: 'space',
  backspace: 'backspace',
};

/** The symbols by code point, so they are read rather than typed. */
const SYMBOLS: Record<number, KeyName> = {
  0x2318: 'mod',
  0x21e7: 'shift',
  0x2325: 'alt',
  0x23ce: 'enter',
  0x21b5: 'enter',
  0x2191: 'up',
  0x2193: 'down',
  0x2190: 'left',
  0x2192: 'right',
};

export function parseKeys(keys: string): KeyPart[] {
  const parts: KeyPart[] = [];
  for (const chunk of keys.split(/[+\s]+/).filter(Boolean)) {
    const word = WORDS[chunk.toLowerCase()];
    if (word) {
      parts.push({ name: word });
      continue;
    }
    let text = '';
    for (const ch of chunk) {
      const symbol = SYMBOLS[ch.codePointAt(0) ?? 0];
      if (!symbol) {
        text += ch;
        continue;
      }
      if (text) parts.push({ text: text.length === 1 ? text.toUpperCase() : text });
      text = '';
      parts.push({ name: symbol });
    }
    if (text) parts.push({ text: text.length === 1 ? text.toUpperCase() : text });
  }
  return parts;
}

/** True on macOS, iOS and iPadOS, where Mod is Command and modifiers are drawn as symbols. */
export function isApple(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
}

/** How a key is drawn: an icon, or a word in the key font. */
export function keyFace(name: KeyName, apple: boolean): { icon: IconName } | { text: string } {
  switch (name) {
    case 'mod':
      return apple ? { icon: 'command' } : { text: 'Ctrl' };
    case 'shift':
      return apple ? { icon: 'shift' } : { text: 'Shift' };
    case 'alt':
      return apple ? { icon: 'option' } : { text: 'Alt' };
    case 'enter':
      return { icon: 'enter' };
    case 'up':
      return { icon: 'arrow-up' };
    case 'down':
      return { icon: 'arrow-down' };
    case 'left':
      return { icon: 'arrow-left' };
    case 'right':
      return { icon: 'arrow' };
    case 'esc':
      return { text: 'Esc' };
    case 'tab':
      return { text: 'Tab' };
    case 'space':
      return { text: 'Space' };
    case 'backspace':
      return { text: 'Backspace' };
  }
}

const SPOKEN: Record<KeyName, (apple: boolean) => string> = {
  mod: (apple) => (apple ? 'Command' : 'Control'),
  shift: () => 'Shift',
  alt: (apple) => (apple ? 'Option' : 'Alt'),
  enter: () => 'Enter',
  esc: () => 'Escape',
  tab: () => 'Tab',
  up: () => 'Up arrow',
  down: () => 'Down arrow',
  left: () => 'Left arrow',
  right: () => 'Right arrow',
  space: () => 'Space',
  backspace: () => 'Backspace',
};

const SYMBOL_OF: Partial<Record<KeyName, number>> = {
  mod: 0x2318,
  shift: 0x21e7,
  alt: 0x2325,
  enter: 0x23ce,
  up: 0x2191,
  down: 0x2193,
  left: 0x2190,
  right: 0x2192,
};

/**
 * The shortcut as plain text for a title attribute, which the operating system draws in its
 * own font: "⌘⇧B" on Apple platforms, "Ctrl+Shift+B" elsewhere. Never for page text: use Kbd.
 */
export function shortcutText(keys: string, apple = isApple()): string {
  const parts = parseKeys(keys).map((part) => {
    if (!('name' in part)) return part.text;
    const code = SYMBOL_OF[part.name];
    if (apple && code) return String.fromCodePoint(code);
    const face = keyFace(part.name, false);
    return 'text' in face ? face.text : SPOKEN[part.name](false);
  });
  return parts.join(apple ? '' : '+');
}

/** "Command K", for assistive tech and tooltips read aloud. */
export function spokenKeys(keys: string, apple = isApple()): string {
  return parseKeys(keys)
    .map((part) => ('name' in part ? SPOKEN[part.name](apple) : part.text))
    .join(' ');
}

const ARIA: Record<KeyName, (apple: boolean) => string> = {
  ...SPOKEN,
  mod: (apple) => (apple ? 'Meta' : 'Control'),
  up: () => 'ArrowUp',
  down: () => 'ArrowDown',
  left: () => 'ArrowLeft',
  right: () => 'ArrowRight',
  esc: () => 'Escape',
};

/** The aria-keyshortcuts value: "Meta+K" on Apple platforms, "Control+K" elsewhere. */
export function ariaKeyShortcuts(keys: string, apple = isApple()): string {
  return parseKeys(keys)
    .map((part) => ('name' in part ? ARIA[part.name](apple) : part.text))
    .join('+');
}
