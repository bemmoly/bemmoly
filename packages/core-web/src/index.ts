/**
 * Kernel UI shared by the shell and module web chunks: the module chunk loader,
 * in-app navigation and the leave guard for unsaved work,
 * the Home section extension point, the settings navigation model, realtime,
 * ⌘K ranking and inbox wording. Visual primitives come from @bemmoly/ui; data
 * comes from @bemmoly/api-client.
 */
export {
  groupItems,
  rankItems,
  scoreItem,
  type CommandGroup,
  type CommandItem,
} from './command/rank.ts';
export { formatBytes, formatDateTime, formatRelative, initials } from './format.ts';
export { actorLabel } from './inbox/group.ts';
export {
  createChunkRegistry,
  type ChunkRegistry,
  type ModuleChunk,
  type ModuleChunkLoader,
  type ModuleChunkProps,
} from './modules/chunks.ts';
export {
  preloadable,
  useLoaded,
  type ComponentLoader,
  type Preloadable,
} from './modules/preloadable.ts';
export {
  createEntityRendererRegistry,
  EntityRenderersProvider,
  useEntityRenderer,
  type EntityRenderer,
  type EntityRendererRegistry,
  type EntityRenderersLoader,
  type EntitySearch,
  type EntitySearchItem,
} from './modules/entity-renderers.tsx';
export { ErrorBoundary } from './modules/error-boundary.tsx';
export {
  LeaveGuardProvider,
  useLeaveGuard,
  type LeaveGuard,
  type LeaveGuardHook,
  type LeaveGuardOptions,
} from './modules/leave-guard.tsx';
export { navigateInApp, setShellNavigator, type ShellNavigator } from './modules/navigation.ts';
export {
  createHomeSectionRegistry,
  HomeSections,
  type HomeSection,
  type HomeSectionLoader,
  type HomeSectionProps,
  type HomeSectionRegistry,
  type HomeSlot,
} from './modules/home-sections.tsx';
export { ModuleOutlet } from './modules/module-outlet.tsx';
export {
  backoffDelay,
  RealtimeClient,
  type BackoffOptions,
  type RealtimeClientOptions,
  type RealtimeEvent,
  type RealtimeStatus,
} from './realtime/realtime-client.ts';
export { useRealtime, type UseRealtimeOptions } from './realtime/use-realtime.ts';
export {
  buildSettingsNav,
  canOpen,
  flattenSettings,
  KERNEL_SETTINGS,
  settingsTrail,
  type SettingsDecorations,
  type SettingsGroup,
  type SettingsItem,
  type SettingsRequirement,
  type SettingsViewer,
} from './settings/sections.ts';
export { AppFrame, NARROW, PHONE, type AppFrameProps } from './shell/app-frame.tsx';
export { BottomBar, type BottomBarItem } from './shell/bottom-bar.tsx';
export {
  CREATE_PARAM,
  createDialogRegistry,
  openCreate,
  withCreate,
  type CreateDialogRegistry,
  type CreateOverlayProps,
  type ModuleCreateDialogs,
  type ModuleCreateLoader,
} from './shell/create.tsx';
export {
  FrameContext,
  isActivePath,
  useFrame,
  useFrameLink,
  type FrameState,
  type SidebarMode,
} from './shell/frame-context.ts';
export { typingInField, useGlobalKeys, type KeyBindings } from './shell/keys.ts';
export {
  createSidebarRegistry,
  inSidebarOrder,
  type ModuleSidebarLoader,
  type ModuleSidebarProps,
  type SidebarRegistry,
} from './shell/module-sidebars.ts';
export { knownIcon, moduleName, ModuleTile } from './shell/module-tile.tsx';
export {
  HeaderActions,
  PageHeader,
  useHeaderTrail,
  type PageCrumb,
  type PageHeaderProps,
  type PageTab,
} from './shell/page-header.tsx';
export { PageLayout, useDocumentTitle, type PageLayoutProps } from './shell/page-layout.tsx';
export {
  readPreference,
  setPreferenceOwner,
  usePreference,
  writePreference,
} from './shell/person-store.ts';
export {
  forgetRecent,
  recordRecent,
  useRecents,
  useRecordRecent,
  type RecentItem,
  type RecentLook,
} from './shell/recents.ts';
export {
  useCurrentScreenActions,
  useScreenActions,
  useShortcutGroups,
  useShortcutHelp,
  type ScreenAction,
  type ShortcutGroup,
} from './shell/screen-actions.ts';
export {
  RAIL_BUTTON,
  ROW,
  SidebarHeading,
  SidebarRow,
  type SidebarHeadingProps,
  type SidebarRowProps,
} from './shell/sidebar/sidebar-row.tsx';
export { SwitcherMenu, type SwitcherItem, type SwitcherMenuProps } from './shell/switcher-menu.tsx';
