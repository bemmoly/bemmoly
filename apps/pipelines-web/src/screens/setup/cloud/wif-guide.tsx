import { useT } from '@bemmoly/core-web';
import { Field, Input, SegmentedControl, Tabs } from '@bemmoly/ui';
import { useState } from 'react';
import { setupText } from '../../../i18n/catalog.ts';
import { CommandBlock } from './command-block.tsx';
import { EMPTY_WIF, wifCommands, type WifInput } from './wif-commands.ts';

const STEPS = [
  'pipelinesSetup.wif.step1',
  'pipelinesSetup.wif.step2',
  'pipelinesSetup.wif.step3',
  'pipelinesSetup.wif.step4',
  'pipelinesSetup.wif.step5',
] as const;

/**
 * How to make this file: for people who have never made a workload identity file, the console
 * steps and the same steps as gcloud commands filled in from their project.
 */
export function WifGuide() {
  const t = useT(setupText);
  const [tab, setTab] = useState<'console' | 'gcloud'>('console');
  const [input, setInput] = useState<WifInput>(EMPTY_WIF);
  const set = (patch: Partial<WifInput>) => setInput((now) => ({ ...now, ...patch }));
  return (
    <section
      aria-label={t('pipelinesSetup.wif.guideTitle')}
      className="flex flex-col gap-3 rounded-control border border-line bg-side p-3"
    >
      <h3 className="font-semibold text-tx">{t('pipelinesSetup.wif.guideTitle')}</h3>
      <p className="text-12 text-tx-2">{t('pipelinesSetup.wif.onVm')}</p>
      <Tabs
        size="sm"
        aria-label={t('pipelinesSetup.wif.guideTitle')}
        value={tab}
        onChange={setTab}
        items={[
          { value: 'console', label: t('pipelinesSetup.wif.tabConsole') },
          { value: 'gcloud', label: t('pipelinesSetup.wif.tabGcloud') },
        ]}
      />
      {tab === 'console' ? (
        <ol className="flex list-decimal flex-col gap-2 ps-5 text-13 text-tx">
          {STEPS.map((step) => (
            <li key={step}>{t(step)}</li>
          ))}
        </ol>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t('pipelinesSetup.wif.projectId')}>
              <Input
                mono
                value={input.projectId}
                onChange={(e) => set({ projectId: e.target.value })}
              />
            </Field>
            <Field label={t('pipelinesSetup.wif.projectNumber')}>
              <Input
                mono
                value={input.projectNumber}
                onChange={(e) => set({ projectNumber: e.target.value })}
              />
            </Field>
          </div>
          <Field label={t('pipelinesSetup.wif.runsOn')}>
            <SegmentedControl
              aria-label={t('pipelinesSetup.wif.runsOn')}
              value={input.runsOn}
              onChange={(runsOn) => set({ runsOn })}
              options={[
                { value: 'oidc', label: t('pipelinesSetup.wif.oidc') },
                { value: 'aws', label: t('pipelinesSetup.wif.aws') },
              ]}
            />
          </Field>
          {input.runsOn === 'oidc' ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t('pipelinesSetup.wif.issuer')}>
                <Input
                  mono
                  value={input.issuer}
                  onChange={(e) => set({ issuer: e.target.value })}
                />
              </Field>
              <Field label={t('pipelinesSetup.wif.tokenPath')}>
                <Input
                  mono
                  value={input.tokenPath}
                  onChange={(e) => set({ tokenPath: e.target.value })}
                />
              </Field>
            </div>
          ) : (
            <Field label={t('pipelinesSetup.wif.awsAccount')}>
              <Input
                mono
                value={input.awsAccount}
                onChange={(e) => set({ awsAccount: e.target.value })}
              />
            </Field>
          )}
          {!input.projectId || !input.projectNumber ? (
            <span className="text-12 text-tx-3">{t('pipelinesSetup.wif.fillIn')}</span>
          ) : null}
          <CommandBlock
            label={t('pipelinesSetup.wif.commandsLabel')}
            command={wifCommands(input)}
          />
        </div>
      )}
    </section>
  );
}
