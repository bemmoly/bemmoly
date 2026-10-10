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
  type SettingsGroup,
  type SettingsItem,
  type SettingsRequirement,
  type SettingsViewer,
} from './settings/sections.ts';
