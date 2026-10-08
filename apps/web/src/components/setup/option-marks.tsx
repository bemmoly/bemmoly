import { Icon } from '@bemmoly/ui/icons';
import type { ReactNode } from 'react';
import confluence from 'simple-icons/icons/confluence.svg?no-inline';
import jira from 'simple-icons/icons/jira.svg?no-inline';
import googleG from '../../assets/sso-logos/google-g.svg?no-inline';
import type { SsoOptionId } from '../../hooks/use-setup-invites.ts';
import { IMPORT_MARK_BRANDS } from '../../lib/logo-colors.ts';
import type { ImportSourceId } from '../../store/setup.ts';
import { LogoMask } from './choice-card.tsx';

/**
 * The tile content of each import card: the source's mark from simple-icons (CC0), one file
 * each, in its published brand colour; otherwise a neutral glyph.
 */
export const IMPORT_MARKS: Record<ImportSourceId, ReactNode> = {
  jira: <LogoMask url={jira} brand={IMPORT_MARK_BRANDS.jira} />,
  confluence: <LogoMask url={confluence} brand={IMPORT_MARK_BRANDS.confluence} />,
  csv: <Icon name="table" size={16} />,
  clean: <Icon name="plus" size={18} />,
};

/** The tile content of each single sign-on card. Google's "G" keeps its own colours. */
export const SSO_MARKS: Record<SsoOptionId, ReactNode> = {
  google: <img src={googleG} alt="" className="size-4.5" />,
  oidc: <Icon name="key" size={16} />,
};
