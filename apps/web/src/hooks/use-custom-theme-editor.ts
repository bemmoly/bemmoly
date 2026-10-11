import { queryKeys } from '@bemmoly/api-client';
import type { CustomThemeScope, SurfaceStyle } from '@bemmoly/shared';
import { buildCustomTheme, customThemeSource } from '@bemmoly/ui/theme';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { api } from '../lib/api.ts';
import { describeError } from '../lib/errors.ts';
import { customRef } from '../lib/theme.ts';
import { toast } from '../lib/toast.ts';
import { HEX_ERROR, normalizeHex } from './use-appearance-draft.ts';
import { usePersonalAppearance } from './use-personal-appearance.ts';
import { useMe } from './use-session.ts';
import { useWorkspace } from './use-workspace.ts';

/** Where a new theme starts: a teal clear of every reserved hue. */
export const START_BRAND = '#0f766e';

/** One-click brand swatches: values a person picks, not page styling, so data, not tokens. */
export const BRAND_SWATCHES = ['#e8590c', '#0f766e', '#2356c9', '#111827', '#7c3aed'] as const;

/**
 * The custom theme editor: one brand colour, a surface style and a name in; the generator's
 * checked light and dark sets out, previewed as they will look. Admins save workspace themes
 * (which they can then make the default); anyone may save their own while personal themes
 * are on. `themeId` edits an existing theme.
 */
export function useCustomThemeEditor(themeId: string | null) {
  const me = useMe();
  const workspace = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const personal = usePersonalAppearance();
  const canManage = me.can('workspace.appearance.manage');
  const allowPersonal = workspace.appearance.personalThemes;
  const existing = [...workspace.appearance.customThemes, ...me.customThemes].find(
    (theme) => theme.id === themeId,
  );
  const [name, setName] = useState(existing?.name ?? '');
  const [hexText, setHexText] = useState(existing?.brandColor ?? START_BRAND);
  const [brand, setBrand] = useState(existing?.brandColor ?? START_BRAND);
  const [surface, setSurface] = useState<SurfaceStyle>(existing?.surface ?? 'neutral');
  const [scope, setScope] = useState<CustomThemeScope>(
    existing?.scope ?? (canManage ? 'workspace' : 'personal'),
  );
  const built = useMemo(() => buildCustomTheme({ brand, surface }), [brand, surface]);
  const source = useMemo(
    () => customThemeSource(themeId ?? 'draft', name || 'Custom', { brand, surface }),
    [themeId, name, brand, surface],
  );
  const mayEdit = existing
    ? existing.scope === 'workspace'
      ? canManage
      : allowPersonal
    : canManage || allowPersonal;

  const done = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.me() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all() }),
    ]);
    await navigate({ to: canManage ? '/settings/appearance' : '/' });
  };
  const save = useMutation({
    mutationFn: async () => {
      const body = { name: name.trim(), brandColor: brand, surface };
      if (existing) return api.appearance.themes.update(existing.id, body);
      return api.appearance.themes.create({ ...body, scope });
    },
    onSuccess: async (theme) => {
      if (theme.scope === 'personal' && !existing) personal.setTheme(customRef(theme.id));
      toast(
        theme.scope === 'workspace' && !existing
          ? `${theme.name} saved. Pick it under Theme to make it the workspace default.`
          : `${theme.name} saved`,
      );
      await done();
    },
    onError: (error) => toast(describeError(error).message, 'danger'),
  });
  const remove = useMutation({
    mutationFn: async () => (existing ? api.appearance.themes.remove(existing.id) : undefined),
    onSuccess: async () => {
      toast(`${existing?.name ?? 'Theme'} deleted`);
      await done();
    },
    onError: (error) => toast(describeError(error).message, 'danger'),
  });

  return {
    isNew: !existing,
    missing: themeId !== null && !existing,
    mayEdit,
    canManage,
    allowPersonal,
    name,
    setName,
    nameError: name.trim() === '' ? 'Give the theme a name' : null,
    brand,
    hex: {
      text: hexText,
      error: normalizeHex(hexText) ? null : HEX_ERROR,
      onChange: (text: string) => {
        setHexText(text);
        const hex = normalizeHex(text);
        if (hex) setBrand(hex);
      },
    },
    pick: (hex: string) => {
      setHexText(hex);
      setBrand(hex);
    },
    surface,
    setSurface,
    scope,
    setScope,
    built,
    source,
    save,
    remove,
    canSave: mayEdit && name.trim() !== '' && built.pass && !save.isPending,
  };
}

export type CustomThemeEditor = ReturnType<typeof useCustomThemeEditor>;
