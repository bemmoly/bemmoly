import { PageLayout } from '@bemmoly/core-web';
import { Button, Kbd } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { PageNotice } from '../components/page-failure.tsx';
import { useUiStore } from '../store/ui.ts';

/** An address nothing lives at, inside the frame so the sidebar is still the way on. */
export function NotFoundPage() {
  const openPalette = useUiStore((state) => state.openPalette);
  return (
    <PageLayout
      layout="contained"
      header={{ crumbs: [{ label: 'Home', path: '/', icon: <Icon name="home" size={15} /> }] }}
      title={['Not found']}
    >
      <PageNotice
        icon="search"
        eyebrow="404"
        title="There is nothing at this address"
        actions={
          <Button
            variant="primary"
            onClick={() => openPalette()}
            iconEnd={<Kbd keys="Mod+K" className="border-on-acc/30 bg-transparent text-on-acc" />}
          >
            Search for it
          </Button>
        }
      >
        <p className="m-0">
          The page may have moved, or the module that owns it is switched off or not shared with
          you.
        </p>
      </PageNotice>
    </PageLayout>
  );
}
