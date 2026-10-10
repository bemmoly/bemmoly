import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { Icon, type IconName } from '../icons/icon.tsx';
import { focusRing } from '../lib/focus.ts';
import type { TYPE_STEPS } from '../tokens/metrics.ts';
import { Logo } from './logo/logo.tsx';

/**
 * The front page of Storybook: what the design system is, where its rules live, and the few
 * facts everyone needs before opening a component story.
 */
const DOCS = 'https://github.com/bemmoly/bemmoly/blob/main/docs/design/system/';

const SECTIONS: readonly { file: string; title: string; about: string }[] = [
  {
    file: 'README.md',
    title: 'Start here',
    about: 'Where truth lives, and a new screen in eight steps',
  },
  {
    file: 'principles.md',
    title: 'Principles',
    about: 'Calm density, colour for meaning, one component per idea, drawn not typed',
  },
  {
    file: 'brand.md',
    title: 'Brand',
    about: 'Logo files, the brand block, logo colours as the system',
  },
  {
    file: 'tokens.md',
    title: 'Tokens',
    about: 'Every canonical colour, size, radius, elevation and motion token',
  },
  {
    file: 'layout.md',
    title: 'Layout',
    about: 'The one frame, full and contained pages, module sidebars',
  },
  {
    file: 'components.md',
    title: 'Components',
    about: 'Every shared component, when to use it and its states',
  },
  {
    file: 'components-work-docs.md',
    title: 'Work and Docs parts',
    about: 'The issue vocabulary and the Docs surfaces',
  },
  {
    file: 'iconography.md',
    title: 'Iconography',
    about: 'One icon set, the glyphs, the ban on typed characters',
  },
  {
    file: 'interaction.md',
    title: 'Interaction',
    about: 'Twelve rules, the shortcut map, notes for new screens',
  },
  {
    file: 'content.md',
    title: 'Content and voice',
    about: 'Sentence case, verbs on buttons, errors that help',
  },
  { file: 'ai.md', title: 'AI surfaces', about: 'Lilac, and only when AI is on' },
  {
    file: 'accessibility.md',
    title: 'Accessibility',
    about: 'Contrast, focus, names, motion, targets',
  },
  {
    file: 'marketing-site.md',
    title: 'Marketing site',
    about: 'Same tokens and lockup, three promises, honest claims',
  },
  {
    file: 'definition-of-done.md',
    title: 'Definition of done',
    about: 'The checklist a UI change passes',
  },
  {
    file: 'changing-the-system.md',
    title: 'Changing the system',
    about: 'An ADR, the doc, a story and a check',
  },
];

const PRINCIPLES: readonly { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'list',
    title: 'Calm density',
    body: 'Show a lot, quietly: three greys, three surfaces, one grid.',
  },
  {
    icon: 'palette',
    title: 'Colour only for meaning',
    body: 'Type, status, urgency, epic, AI. Never decoration.',
  },
  {
    icon: 'layers',
    title: 'One component per idea',
    body: 'Compose packages/ui; never redraw it in a page.',
  },
  {
    icon: 'edit',
    title: 'Drawn, not typed',
    body: 'Icon, glyphs and Kbd. No characters as icons.',
  },
];

const LOGO_COLOURS = [
  { swatch: 'bg-brand-1', name: 'brand-1', job: 'Accent and Work' },
  { swatch: 'bg-brand-2', name: 'brand-2', job: 'Docs and the dark accent' },
  { swatch: 'bg-brand-3', name: 'brand-3', job: 'AI, and only AI' },
];

const RADII = [
  { cls: 'rounded-chip', name: 'chip 4' },
  { cls: 'rounded-control', name: 'control 6' },
  { cls: 'rounded-card', name: 'card 8' },
  { cls: 'rounded-dialog', name: 'dialog 12' },
];

/** Spelled out so Tailwind sees every class. */
const TYPE_CLASS: Record<keyof typeof TYPE_STEPS, string> = {
  '11': 'text-11',
  '12': 'text-12',
  '13': 'text-13',
  '14': 'text-14',
  '16': 'text-16',
  '20': 'text-20',
  '24': 'text-24',
};

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="m-0 text-11 font-semibold text-tx-3">{title}</h2>
      {children}
    </section>
  );
}

function DesignSystemOverview() {
  return (
    <div className="flex max-w-260 flex-col gap-8 font-sans text-13 text-tx">
      <header className="flex flex-col gap-3">
        <Logo variant="lockup" size={22} />
        <h1 className="m-0 text-24 leading-display font-semibold tracking-display">
          Design system
        </h1>
        <p className="m-0 max-w-170 text-14 leading-body text-tx-2">
          The stories here show the parts. The rules for using them live in{' '}
          <a href={`${DOCS}README.md`} className={`rounded-chip text-acc ${focusRing}`}>
            docs/design/system
          </a>
          , the single source of truth every UI change follows: product, Docs, settings, setup and
          the marketing site.
        </p>
      </header>

      <Block title="Principles">
        <div className="grid grid-cols-2 gap-3">
          {PRINCIPLES.map((p) => (
            <div key={p.title} className="flex gap-3 rounded-card bg-card p-4 shadow-e1">
              <span className="grid size-8 shrink-0 place-items-center rounded-control bg-acc-50 text-acc">
                <Icon name={p.icon} />
              </span>
              <span className="flex flex-col gap-1">
                <strong className="text-14 font-semibold">{p.title}</strong>
                <span className="text-tx-2">{p.body}</span>
              </span>
            </div>
          ))}
        </div>
      </Block>

      <Block title="The rules, by topic">
        <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0">
          {SECTIONS.map((s) => (
            <li key={s.file}>
              <a
                href={`${DOCS}${s.file}`}
                className={`flex h-full flex-col gap-1 rounded-card border border-line bg-card p-3 no-underline hover:bg-hover ${focusRing}`}
              >
                <span className="flex items-center gap-1.5 font-medium text-tx">
                  {s.title}
                  <Icon name="external" size={14} className="text-tx-3" />
                </span>
                <span className="text-12 leading-body text-tx-3">{s.about}</span>
              </a>
            </li>
          ))}
        </ul>
      </Block>

      <div className="grid grid-cols-3 gap-6">
        <Block title="Logo colours are the system">
          {LOGO_COLOURS.map((c) => (
            <div key={c.name} className="flex items-center gap-2.5">
              <span className={`size-6 shrink-0 rounded-control ${c.swatch}`} />
              <span className="flex flex-col">
                <code className="font-mono text-12">{c.name}</code>
                <span className="text-12 text-tx-3">{c.job}</span>
              </span>
            </div>
          ))}
        </Block>
        <Block title="Type scale">
          {Object.keys(TYPE_CLASS).map((step) => (
            <span
              key={step}
              className={`${TYPE_CLASS[step as keyof typeof TYPE_STEPS]} leading-title`}
            >
              {step}px Calm density
            </span>
          ))}
        </Block>
        <Block title="Radii and elevation">
          <div className="grid grid-cols-2 gap-3">
            {RADII.map((r) => (
              <span
                key={r.cls}
                className={`grid h-14 place-items-center bg-card text-12 text-tx-2 shadow-e1 ${r.cls}`}
              >
                {r.name}
              </span>
            ))}
          </div>
        </Block>
      </div>

      <Block title="Fails review on sight">
        <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-tx-2">
          <li>A screen outside the frame, or a second scroll region</li>
          <li>A glyph character standing in for an icon (lint)</li>
          <li>A literal colour or font size in UI code (lint)</li>
          <li>A shared component redrawn in a page</li>
          <li>AI lilac on anything that is not AI, or AI shown while it is off</li>
          <li>Capitalised labels, a Submit button, an error that does not say what to do next</li>
        </ul>
      </Block>
    </div>
  );
}

const meta = {
  title: 'Design system/Overview',
  component: DesignSystemOverview,
} satisfies Meta<typeof DesignSystemOverview>;

export default meta;

export const Overview: StoryObj<typeof meta> = {};
