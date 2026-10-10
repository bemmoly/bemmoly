import { avatarHue, initialsOf, type AvatarHue } from '@bemmoly/ui';

/**
 * Who a cursor belongs to, as awareness carries it to everyone on the page: the name for
 * the caret label, the avatar's initials and a hue from the avatar palette, so a person's
 * caret matches their avatar everywhere. `color` is a theme variable, never a literal, so
 * it follows light and dark on every screen that draws it.
 */
export interface CollabUser {
  id: string;
  name: string;
  initials: string;
  hue: AvatarHue;
  color: string;
}

export function collabUser(person: { id: string; name: string | null; email: string }): CollabUser {
  const name = person.name?.trim() || person.email;
  const hue = avatarHue(person.id);
  return { id: person.id, name, initials: initialsOf(name), hue, color: `var(--${hue}-fg)` };
}
