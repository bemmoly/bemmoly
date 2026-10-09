/** Joins the class names that are set; the design system keeps its own helper private. */
export const cx = (...names: Array<string | false | null | undefined>): string =>
  names.filter(Boolean).join(' ');
