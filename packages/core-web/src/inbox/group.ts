/**
 * The server groups notifications ("Aisha and 2 others commented on PLT-204")
 * and sends the actors it shows plus the total; this renders that sentence.
 */
export function actorLabel(names: readonly string[], total: number = names.length): string {
  const [first, second] = names;
  if (!first) return 'Bemmoly';
  if (total <= 1) return first;
  if (total === 2 && second) return `${first} and ${second}`;
  return `${first} and ${total - 1} others`;
}
