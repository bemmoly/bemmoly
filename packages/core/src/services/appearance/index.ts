/** Themes and modes (ADR 0021): custom themes and each person's own appearance. */
export { getAppearancePreference, setAppearancePreference } from './preferences.ts';
export { listWorkspaceThemes, readPreference } from './store.ts';
export {
  createCustomTheme,
  deleteCustomTheme,
  listCustomThemes,
  MANAGE_APPEARANCE,
  personOf,
  updateCustomTheme,
  type AppearanceDeps,
} from './themes.ts';
export { checkLogo, logoError, type CheckedLogo } from './logo-image.ts';
export {
  LOGO_PREFIX,
  readWorkspaceLogo,
  removeWorkspaceLogo,
  uploadWorkspaceLogo,
  type ServedLogo,
  type WorkspaceLogoDeps,
} from './logo.ts';
