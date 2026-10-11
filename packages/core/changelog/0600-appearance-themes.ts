import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

/*
 * Themes and modes (ADR 0021). Adds custom themes and each person's own appearance, then moves
 * the stored preset to its theme: the old preset's mode becomes the workspace default mode and
 * its typeface stays, so no workspace changes look on upgrade. A stored custom brand becomes a
 * workspace custom theme. The retired keys (mode, surfaces, memberModeSwitch) are left in place
 * for the previous minor and removed in a later release.
 */
const THEME_OF = sql`case value #>> '{}'
  when 'classic' then 'bemmoly' when 'light' then 'bemmoly' when 'dark' then 'bemmoly'
  when 'midnight' then 'bemmoly' when 'ocean' then 'bemmoly' when 'rose' then 'bemmoly'
  when 'slate' then 'graphite' when 'warm' then 'sand' when 'forest' then 'pine'
  else value #>> '{}' end`;

const MODE_OF = sql`case value #>> '{}'
  when 'dark' then 'dark' when 'midnight' then 'dark' when 'ocean' then 'dark'
  when 'custom' then coalesce(
    (select s.value #>> '{}' from settings s where s.key = 'appearance.mode'), 'light')
  else 'light' end`;

const FONT_OF = sql`case value #>> '{}'
  when 'slate' then 'inter' when 'ocean' then 'inter' when 'warm' then 'source'
  when 'rose' then 'source' when 'midnight' then 'geist' else 'plex' end`;

export default changeset({
  id: '0600-appearance-themes',
  author: 'keerthi',
  description: 'Add custom themes and personal appearance; move stored presets to themes',
  preconditions: [
    {
      tableExists: { table: 'users' },
      onFail: 'halt',
      reason: 'custom themes and preferences belong to people; the identity changesets run first',
    },
  ],
  up: async (ctx) => {
    await ctx.exec(sql`
      create table custom_themes (
        id uuid primary key default uuidv7(),
        name text not null constraint custom_themes_name_check
          check (char_length(name) between 1 and 40),
        brand_color text not null constraint custom_themes_brand_color_check
          check (brand_color ~ '^#[0-9a-f]{6}$'),
        surface text not null default 'neutral' constraint custom_themes_surface_check
          check (surface in ('neutral', 'warm')),
        owner_id uuid references users (id) on delete cascade,
        created_by uuid references users (id) on delete set null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )`);
    await ctx.exec(sql`create index custom_themes_owner_idx on custom_themes (owner_id, id)`);
    await ctx.exec(sql`
      create table user_appearance_preferences (
        user_id uuid primary key references users (id) on delete cascade,
        mode text constraint user_appearance_preferences_mode_check
          check (mode is null or mode in ('light', 'dark', 'system')),
        theme text,
        updated_at timestamptz not null default now()
      )`);

    // The default mode and typeface the stored preset implied, unless already set.
    await ctx.exec(sql`
      insert into settings (key, value, updated_by)
      select 'appearance.defaultMode', to_jsonb(${MODE_OF}), 'changelog'
      from settings where key = 'appearance.theme'
      on conflict (key) do nothing`);
    await ctx.exec(sql`
      insert into settings (key, value, updated_by)
      select 'appearance.font', to_jsonb(${FONT_OF}), 'changelog'
      from settings where key = 'appearance.theme'
      on conflict (key) do nothing`);
    // A workspace already in use with no stored theme was on Classic light; keep it light.
    // A fresh install has nobody yet and takes the new default, Match system.
    await ctx.exec(sql`
      insert into settings (key, value, updated_by)
      select 'appearance.defaultMode', to_jsonb('light'::text), 'changelog'
      where exists (select 1 from users)
      on conflict (key) do nothing`);

    // A stored custom brand becomes the workspace's custom theme.
    await ctx.exec(sql`
      with brand as (
        select lower(b.value #>> '{}') as color from settings b
        where b.key = 'appearance.brandColor'
          and exists (select 1 from settings t
            where t.key = 'appearance.theme' and t.value #>> '{}' = 'custom')
          and (b.value #>> '{}') ~* '^#[0-9a-f]{6}$'
      ), created as (
        insert into custom_themes (name, brand_color, surface)
        select 'Custom', color, 'neutral' from brand
        returning id
      )
      insert into settings (key, value, updated_by)
      select 'appearance.customThemeId', to_jsonb(id::text), 'changelog' from created
      on conflict (key) do nothing`);

    await ctx.exec(sql`
      update settings set value = to_jsonb(${THEME_OF}), updated_at = now()
      where key = 'appearance.theme'
        and value #>> '{}' in
          ('classic', 'light', 'dark', 'slate', 'warm', 'midnight', 'forest', 'ocean', 'rose')`);
  },
  down: async (ctx) => {
    // Back to the nearest preset; a custom theme keeps "custom" and its mirrored brand colour.
    await ctx.exec(sql`
      update settings set value = to_jsonb(case value #>> '{}'
        when 'bemmoly' then case
          when (select d.value #>> '{}' from settings d where d.key = 'appearance.defaultMode')
            = 'dark' then 'dark' else 'classic' end
        when 'graphite' then 'slate' when 'sand' then 'warm' when 'pine' then 'forest'
        when 'contrast' then 'classic'
        else value #>> '{}' end), updated_at = now()
      where key = 'appearance.theme'`);
    await ctx.exec(sql`
      delete from settings where key in ('appearance.defaultMode', 'appearance.customThemeId')`);
    await ctx.exec(sql`drop table user_appearance_preferences`);
    await ctx.exec(sql`drop table custom_themes`);
  },
});
