/**
 * A key from a name, as Pipelines' keys are written: lowercase letters, digits and single
 * dashes, starting with a letter or digit, at most 63 characters. "Prod · EU West" is
 * "prod-eu-west". Accents fold to their letter so a name in any Latin script keeps its words.
 */
export function slugOf(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, 63)
    .replace(/-+$/, '');
}
