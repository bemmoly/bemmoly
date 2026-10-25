import type { SettingsService } from '../../contracts/settings.ts';
import type { EntityDefinition } from '../../modules/registries.ts';
import type { FromModule } from '../../modules/registry.ts';

/** What a chat app shows for a shared link: the record's name, under the workspace's. */
export interface LinkPreview {
  title: string;
  description: string;
  siteName: string;
}

export interface LinkPreviewDeps {
  /** Every module's entities; read per request so it sees the modules as they are now. */
  entities: () => readonly FromModule<EntityDefinition>[];
  isEnabled: (moduleId: string) => boolean;
  settings: Pick<SettingsService, 'get'>;
}

export interface LinkPreviews {
  /** The preview for a web path, or null when previews are off or the path names no record. */
  forPath(path: string): Promise<LinkPreview | null>;
}

const capitalised = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/*
 * Chat apps fetch a shared link signed out, so the preview is the one place a record's title
 * leaves the workspace without a session. It names the record and nothing else (no body, no
 * people), and an admin can turn it off with workspace.linkPreviews.
 */
export function createLinkPreviews(deps: LinkPreviewDeps): LinkPreviews {
  return {
    async forPath(path) {
      if (!(await deps.settings.get('workspace.linkPreviews'))) return null;
      for (const entity of deps.entities()) {
        if (!entity.fromPath || !deps.isEnabled(entity.moduleId)) continue;
        const ref = entity.fromPath(path);
        if (!ref) continue;
        const summary = await entity.resolve(ref);
        if (!summary) return null;
        const siteName = await deps.settings.get('workspace.name');
        const title = summary.title.trim() || 'Untitled';
        return {
          title: summary.key ? `${summary.key} ${title}` : title,
          description: `${capitalised(summary.kind)} in ${siteName}`,
          siteName,
        };
      }
      return null;
    },
  };
}
