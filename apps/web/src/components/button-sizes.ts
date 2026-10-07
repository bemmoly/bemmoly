/**
 * Size modifiers for @bemmoly/ui Button, measured from the mocks. Button
 * ships one size per variant today; these classes extend it, never redraw it.
 */
export const BUTTON = {
  /** 32px primary: "Invite people", "Save for workspace". */
  primary: 'h-control py-0',
  /** 32px secondary in settings headers: "Import CSV", "Discard". */
  secondary: 'text-tx2',
  /** 38px, 14px text: the wizard's "Continue" and "Open Bemmoly". */
  large: 'h-9.5 px-4.5 py-0 text-brand',
  /** 30px, 5px radius: card actions such as "Connect Google" and "Set up". */
  small: 'h-7.5 rounded-small px-2.5 py-0',
  /** Full-width 38px submit on the sign-in card. */
  block: 'h-9.5 w-full py-0 text-brand',
  /** Destructive confirmation. */
  danger: 'border-0 bg-danger text-on-status hover:opacity-90',
} as const;

/** Text-only action: "Skip for now", "Mark all read", "Choose". */
export const TEXT_ACTION =
  'cursor-pointer border-0 bg-transparent p-0 font-sans font-medium text-tx4 hover:text-tx disabled:cursor-default disabled:opacity-50';

/** Accent text action: "Configure", "Edit", "Manage". */
export const LINK_ACTION =
  'cursor-pointer border-0 bg-transparent p-0 font-sans font-medium text-ac hover:text-ac-d disabled:cursor-not-allowed disabled:text-tx5';
