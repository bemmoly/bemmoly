/**
 * Kernel UI shared by the shell and module web chunks: the module chunk loader,
 * the settings frame, realtime, ⌘K ranking and inbox grouping. Visual
 * primitives come from @bemmoly/ui; data comes from @bemmoly/api-client.
 */
export {
  groupItems,
  rankItems,
  scoreItem,
  type CommandGroup,
  type CommandItem,
} from './command/rank.ts';
export { useListNavigation, type ListNavigation } from './command/use-list-navigation.ts';
export { formatBytes, formatDateTime, formatRelative, initials } from './format.ts';
export { actorLabel, groupNotifications, type NotificationGroup } from './inbox/group.ts';
export {
  createChunkRegistry,
  type ChunkRegistry,
  type ModuleChunk,
  type ModuleChunkLoader,
  type ModuleChunkProps,
} from './modules/chunks.ts';
export { ErrorBoundary } from './modules/error-boundary.tsx';
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
  flattenSettings,
  KERNEL_SETTINGS,
  type SettingsGroup,
  type SettingsItem,
  type SettingsViewer,
} from './settings/sections.ts';
export { SettingsFrame, type SettingsLinkProps } from './settings/settings-frame.tsx';
