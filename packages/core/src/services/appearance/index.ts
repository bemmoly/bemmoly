/** Themes and modes (ADR 0021): custom themes and each person's own appearance. */
export { getAppearancePreference, setAppearancePreference } from './preferences.ts';
export { listPersonalThemes, listWorkspaceThemes, readPreference } from './store.ts';
export {
  createCustomTheme,
  deleteCustomTheme,
  listCustomThemes,
  MANAGE_APPEARANCE,
  personOf,
  updateCustomTheme,
  type AppearanceDeps,
} from './themes.ts';
