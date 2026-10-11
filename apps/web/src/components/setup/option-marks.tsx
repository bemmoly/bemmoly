import { Icon } from '@bemmoly/ui/icons';
import type { ReactNode } from 'react';
import type { ImportSourceId } from '../../store/setup.ts';

/**
 * The tile content of each import card: a design-system glyph. Jira and Confluence take the
 * neutral import glyph, never Atlassian's logos (their guidelines need written approval); the
 * card's name says which product it is.
 */
export const IMPORT_MARKS: Record<ImportSourceId, ReactNode> = {
  jira: <Icon name="import" size={16} />,
  confluence: <Icon name="import" size={16} />,
  csv: <Icon name="table" size={16} />,
  clean: <Icon name="plus" size={18} />,
};
