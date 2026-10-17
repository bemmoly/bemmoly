import { useT } from '@bemmoly/core-web';
import { Button, Kbd, SegmentedControl } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { ReactNode } from 'react';
import { useGo } from '../../hooks/use-go.ts';
import { useMe } from '../../hooks/use-me.ts';
import { useMode, type ModePreference } from '../../hooks/use-mode.ts';
import { MODE_CHOICES } from '../../shell/mode-choices.ts';
import { pipelinesText } from '../../i18n/catalog.ts';
import { Panel, Screen } from '../../parts/screen.tsx';
import { useUiStore } from '../../store/ui.ts';
import { useSetup } from '../start/use-setup.ts';

function Row({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-line-2 py-3 last:border-b-0 md:flex-row md:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-13 font-medium text-tx">{title}</span>
        <span className="text-12 text-tx-3">{hint}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

/**
 * Pipelines' own preferences: light or dark on this device, every key, notifications (which
 * are Bemmoly's), and how far the install's setup has got. The theme and typeface are the
 * workspace's, set in Bemmoly.
 */
export default function SettingsScreen() {
  const t = useT(pipelinesText);
  const go = useGo();
  const me = useMe().data;
  const { preference, setPreference } = useMode();
  const openKeys = useUiStore((state) => state.setKeysOpen);
  const setup = useSetup();
  const left = Object.values(setup.done).filter((done) => !done).length;
  const openBemmoly = (path: string) => window.location.assign(path);
  return (
    <Screen title={t('pipelines.settings.title')}>
      <div className="flex max-w-200 flex-col gap-4">
        <Panel title={t('pipelines.settings.appearance')}>
          <Row title={t('pipelines.settings.mode')} hint={t('pipelines.settings.modeHint')}>
            <SegmentedControl
              size="sm"
              aria-label={t('pipelines.settings.mode')}
              options={MODE_CHOICES.map((choice) => ({
                value: choice.value,
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name={choice.icon} size={14} />
                    {t(choice.word)}
                  </span>
                ),
              }))}
              value={preference}
              onChange={(next: ModePreference) => setPreference(next)}
            />
          </Row>
          <Row title={t('pipelines.settings.theme')} hint={t('pipelines.settings.themeHint')}>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => openBemmoly('/settings/workspace')}
            >
              <Icon name="external" size={14} />
              {t('pipelines.settings.openBemmolySettings')}
            </Button>
          </Row>
        </Panel>
        <Panel title={t('pipelines.settings.working')}>
          <Row title={t('pipelines.settings.keys')} hint={t('pipelines.settings.keysHint')}>
            <Button size="sm" variant="secondary" onClick={() => openKeys(true)}>
              {t('pipelines.settings.showKeys')}
              <Kbd keys="?" />
            </Button>
          </Row>
          <Row
            title={t('pipelines.settings.notifications')}
            hint={t('pipelines.settings.notificationsHint')}
          >
            <Button
              size="sm"
              variant="secondary"
              onClick={() => openBemmoly('/settings/notifications')}
            >
              <Icon name="external" size={14} />
              {t('pipelines.settings.openNotifications')}
            </Button>
          </Row>
          <Row
            title={t('pipelines.start.title')}
            hint={
              left === 0 ? t('pipelines.start.allDone') : t('pipelines.start.left', { count: left })
            }
          >
            <Button size="sm" variant="secondary" onClick={() => go({ to: '/start' })}>
              {t('pipelines.settings.openSetup')}
            </Button>
          </Row>
        </Panel>
        {me && (
          <Panel title={t('pipelines.settings.account')}>
            <Row title={me.user.name} hint={me.user.email}>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => openBemmoly('/settings/profile')}
              >
                <Icon name="external" size={14} />
                {t('pipelines.settings.openProfile')}
              </Button>
            </Row>
          </Panel>
        )}
      </div>
    </Screen>
  );
}
