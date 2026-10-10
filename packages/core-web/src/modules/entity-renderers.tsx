import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';

/*
 * How one module draws another module's records without importing it, the
 * web half of ctx.entities: a module that ships `web/src/entities.tsx`
 * exports the renderers for the kinds it owns (Work: "issue"), the shell
 * discovers that file by folder and lends the registry to module screens,
 * and a screen asks for a kind with useEntityRenderer. Only modules the
 * person can open take part, so with Work off the hook answers null and the
 * caller keeps its placeholder. Each module's file loads once, on first ask.
 */

/** One result of an entity search, shaped like an editor suggestion. */
export interface EntitySearchItem {
  /** What the record is named by in a document: its key ("PLT-204"). */
  id: string;
  label: string;
  /** A second line, such as the title and status. */
  description?: string;
  /** Where the record lives: what a document links selected words to. */
  href?: string;
}

export type EntitySearch = (
  query: string,
  signal: AbortSignal,
) => Promise<readonly EntitySearchItem[]>;

/** What a module lends for one kind it owns; every part is optional. */
export interface EntityRenderer {
  kind: string;
  /** Inline chip for one record, by key: the issue chip inside a paragraph. */
  Chip?: ComponentType<{ entityKey: string }>;
  /** Block card for one record, by key: a row in a "Linked" panel. */
  Card?: ComponentType<{ entityKey: string }>;
  /** One record as a block inside a document: the issue card embed. */
  Embed?: ComponentType<{ entityKey: string }>;
  /** A saved query drawn live as a table. */
  Table?: ComponentType<{ query: string; title: string }>;
  /** Records to pick from while writing. */
  search?: EntitySearch;
  /**
   * Tells the module which list a record is about to be opened from (the Inbox's issues, in
   * the order shown), so the record's page can step through that list with j and k.
   */
  rememberList?: (list: { label: string; keys: readonly string[] }) => void;
}

export type EntityRenderersLoader = () => Promise<{ default: readonly EntityRenderer[] }>;

/**
 * Loaders by module id, each module's renderers cached after their first
 * load. A file that fails to load counts as lending nothing, so placeholders stay.
 */
export function createEntityRendererRegistry(
  loaders: Readonly<Record<string, EntityRenderersLoader>>,
) {
  const loaded = new Map<string, readonly EntityRenderer[]>();
  const pending = new Map<string, Promise<readonly EntityRenderer[]>>();
  const load = (moduleId: string): Promise<readonly EntityRenderer[]> => {
    const done = loaded.get(moduleId);
    if (done) return Promise.resolve(done);
    let promise = pending.get(moduleId);
    if (!promise) {
      const loader = loaders[moduleId];
      promise = loader
        ? loader().then(
            (entry) => {
              loaded.set(moduleId, entry.default);
              return entry.default;
            },
            () => {
              loaded.set(moduleId, []);
              return [];
            },
          )
        : Promise.resolve([]);
      pending.set(moduleId, promise);
    }
    return promise;
  };
  return {
    has: (moduleId: string) => moduleId in loaders,
    load,
    /** The kind's renderer among modules already loaded; undefined until they are. */
    peek(kind: string, moduleIds: readonly string[]): EntityRenderer | null | undefined {
      const owners = moduleIds.filter((id) => id in loaders);
      if (owners.some((id) => !loaded.has(id))) return undefined;
      for (const id of owners) {
        const found = loaded.get(id)?.find((renderer) => renderer.kind === kind);
        if (found) return found;
      }
      return null;
    },
  };
}

export type EntityRendererRegistry = ReturnType<typeof createEntityRendererRegistry>;

interface EntityRenderersValue {
  registry: EntityRendererRegistry;
  moduleIds: readonly string[];
}

const EntityRenderersContext = createContext<EntityRenderersValue | null>(null);

/** Lends the registry to everything below, limited to the modules the person can open. */
export function EntityRenderersProvider({
  registry,
  moduleIds,
  children,
}: EntityRenderersValue & { children: ReactNode }) {
  const key = moduleIds.join(',');
  const value = useMemo(
    () => ({ registry, moduleIds: key ? key.split(',') : [] }),
    [registry, key],
  );
  return (
    <EntityRenderersContext.Provider value={value}>{children}</EntityRenderersContext.Provider>
  );
}

/**
 * The renderer an enabled module lends for the kind, or null when none does
 * (or none has loaded yet, or there is no provider, as in tests and stories).
 */
export function useEntityRenderer(kind: string): EntityRenderer | null {
  const value = useContext(EntityRenderersContext);
  const known = value ? value.registry.peek(kind, value.moduleIds) : null;
  const [, setLoaded] = useState(0);
  useEffect(() => {
    if (!value || known !== undefined) return;
    let live = true;
    void Promise.all(value.moduleIds.filter(value.registry.has).map(value.registry.load)).then(
      () => {
        if (live) setLoaded((count) => count + 1);
      },
    );
    return () => {
      live = false;
    };
  }, [value, known]);
  return known ?? null;
}
