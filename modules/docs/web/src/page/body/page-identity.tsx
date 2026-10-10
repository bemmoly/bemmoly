import { PAGE_COVERS, type PageCover } from '@bemmoly/module-docs/shared';
import { Button, useToast } from '@bemmoly/ui';
import { Icon, PageIcon, parsePageIcon } from '@bemmoly/ui/icons';
import { cx } from '../cx.ts';
import { usePageScreen } from '../screen-context.ts';
import { useUpdatePage } from '../use-page-actions.ts';
import { CoverArt, COVER_NAMES } from './cover-art.tsx';
import { DocPopover } from './doc-popover.tsx';
import { PageIconPicker } from './page-icon-picker.tsx';

/** The page's cover and icon writes, each reversible from the toast that follows it. */
function useIdentityActions() {
  const { page } = usePageScreen();
  const update = useUpdatePage(page.id);
  const toast = useToast();
  return {
    setIcon: (icon: string | null) => update.mutate({ icon }),
    setCover: (cover: PageCover | null) => {
      const before = page.cover;
      if (before === cover) return;
      update.mutate(
        { cover },
        {
          onSuccess: () =>
            toast.undo({
              title: cover ? (before ? 'Cover changed' : 'Cover added') : 'Cover removed',
              onUndo: () => update.mutate({ cover: before }),
            }),
        },
      );
    },
  };
}

function CoverPicker({
  value,
  onPick,
}: {
  value: PageCover | null;
  onPick: (c: PageCover | null) => void;
}) {
  const { page } = usePageScreen();
  const tint = parsePageIcon(page.icon)?.tint ?? null;
  return (
    <div className="flex w-80 flex-col gap-2 p-1">
      <span className="px-1 pt-1 text-12 font-medium text-tx-3">Patterns</span>
      <div role="group" aria-label="Covers" className="grid grid-cols-3 gap-1.5">
        {PAGE_COVERS.map((cover) => (
          <button
            key={cover}
            type="button"
            aria-label={COVER_NAMES[cover]}
            aria-pressed={value === cover}
            onClick={() => onPick(cover)}
            className="relative h-14 cursor-pointer overflow-hidden rounded-control border-0 p-0 shadow-[inset_0_0_0_1px_var(--line)] focus-visible:shadow-ring focus-visible:outline-0 aria-pressed:shadow-[inset_0_0_0_2px_var(--acc)]"
          >
            <CoverArt cover={cover} tint={tint} />
          </button>
        ))}
      </div>
      {value && (
        <button
          type="button"
          onClick={() => onPick(null)}
          className="flex h-8 cursor-pointer items-center gap-2 rounded-control border-0 bg-transparent px-2 font-sans text-13 text-tx-2 hover:bg-hover focus-visible:shadow-ring focus-visible:outline-0"
        >
          <Icon name="trash" size={14} />
          Remove cover
        </button>
      )}
    </div>
  );
}

/**
 * The 148px band over the page with its drawn cover. Change cover appears on hover and on
 * keyboard focus; on touch it is always shown.
 */
export function PageCoverBand() {
  const { page, editable } = usePageScreen();
  const actions = useIdentityActions();
  if (!page.cover) return null;
  const tint = parsePageIcon(page.icon)?.tint ?? null;
  return (
    <div
      className="group/cover relative h-37 shrink-0 overflow-hidden"
      data-page-cover={page.cover}
    >
      <CoverArt cover={page.cover} tint={tint} />
      {editable && (
        <div className="absolute right-4 bottom-3 opacity-0 group-hover/cover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100 motion-safe:transition-opacity">
          <DocPopover
            label="Cover"
            align="end"
            trigger={(props) => (
              <Button {...props} size="sm" icon={<Icon name="image" size={14} />}>
                Change cover
              </Button>
            )}
          >
            {(close) => (
              <CoverPicker
                value={page.cover}
                onPick={(cover) => {
                  actions.setCover(cover);
                  close();
                }}
              />
            )}
          </DocPopover>
        </div>
      )}
    </div>
  );
}

/**
 * Over the title: the page icon in its 56px tile (a picker when the page can change), and,
 * while the page has no icon or no cover, quiet Add icon and Add cover buttons that show on
 * hover or focus of the heading.
 */
export function PageIdentity() {
  const { page, editable } = usePageScreen();
  const actions = useIdentityActions();
  const hasIcon = Boolean(page.icon);
  const tile = (
    <span className="grid size-14 place-items-center rounded-[13px] bg-card shadow-e1h">
      <PageIcon value={page.icon} size={30} />
    </span>
  );
  // Over a cover the icon tile rises 30px into it; without an icon the row keeps clear of it.
  const lift = page.cover ? (hasIcon ? '-mt-7.5' : 'pt-4') : undefined;
  if (!editable)
    return hasIcon ? (
      <div className={lift}>{tile}</div>
    ) : page.cover ? (
      <div className="pt-6" />
    ) : null;
  return (
    <div className={cx('flex flex-col gap-3', lift)}>
      {hasIcon && (
        <DocPopover
          label="Page icon"
          trigger={(props) => (
            <button
              {...props}
              type="button"
              aria-label="Change icon"
              className="w-fit cursor-pointer rounded-[13px] border-0 bg-transparent p-0 focus-visible:shadow-ring focus-visible:outline-0"
            >
              {tile}
            </button>
          )}
        >
          {(close) => (
            <PageIconPicker
              value={page.icon}
              onChange={(icon) => {
                actions.setIcon(icon);
                if (icon === null) close();
              }}
            />
          )}
        </DocPopover>
      )}
      {(!hasIcon || !page.cover) && (
        <div className="-ml-2 flex h-7 gap-1 opacity-0 group-hover/heading:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100 motion-safe:transition-opacity">
          {!hasIcon && (
            <DocPopover
              label="Page icon"
              trigger={(props) => (
                <Button {...props} size="sm" variant="ghost" icon={<Icon name="smile" size={14} />}>
                  Add icon
                </Button>
              )}
            >
              {() => <PageIconPicker value={null} onChange={actions.setIcon} />}
            </DocPopover>
          )}
          {!page.cover && (
            <DocPopover
              label="Cover"
              trigger={(props) => (
                <Button {...props} size="sm" variant="ghost" icon={<Icon name="image" size={14} />}>
                  Add cover
                </Button>
              )}
            >
              {(close) => (
                <CoverPicker
                  value={null}
                  onPick={(cover) => {
                    actions.setCover(cover);
                    close();
                  }}
                />
              )}
            </DocPopover>
          )}
        </div>
      )}
    </div>
  );
}
