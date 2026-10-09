import {
  bullets,
  callout,
  decision,
  doc,
  field,
  h,
  numbered,
  p,
  rule,
  table,
  tasks,
  toc,
} from './builders.ts';

/** Meeting notes: agenda before, decisions and actions after. */
export const MEETING_NOTES = doc(
  field('Date'),
  field('Attendees'),
  field('Facilitator'),
  rule(),
  h(2, 'Agenda'),
  numbered('Updates', 'Discussion', 'Next steps'),
  h(2, 'Notes'),
  p(),
  h(2, 'Decisions'),
  decision(p('What we decided, and why.')),
  h(2, 'Action items'),
  tasks('Owner: what, by when'),
);

/** Product spec: the problem, who has it, and what we will ship. */
export const PRODUCT_SPEC = doc(
  field('Status', 'Draft'),
  field('Product owner'),
  field('Engineering lead'),
  field('Target release'),
  rule(),
  toc(),
  callout('info', p('TL;DR: the problem, who has it, and what we will ship, in two sentences.')),
  h(2, 'Problem'),
  p('Who has this problem, how often, and what it costs them today.'),
  h(2, 'Goals and success metrics'),
  table(['Outcome', 'Metric', 'Today', 'Target'], ['', '', '', '']),
  h(2, 'Users and scenarios'),
  bullets('As a …, I want …, so that …'),
  h(2, 'Requirements'),
  h(3, 'Must have'),
  tasks(''),
  h(3, 'Nice to have'),
  tasks(''),
  h(2, 'Design'),
  p('Link the mocks and describe every state: empty, loading, error, long content.'),
  h(2, 'Out of scope'),
  bullets(''),
  h(2, 'Launch plan'),
  numbered('Internal dogfood', 'Beta with a few teams', 'General availability'),
  h(2, 'Open questions'),
  bullets(''),
);

/** Decision log: one decision per entry, newest first, never edited after. */
export const DECISION_LOG = doc(
  field('Area'),
  field('Owner'),
  rule(),
  callout(
    'note',
    p('Add a new entry at the top for each decision. Supersede old entries; do not edit them.'),
  ),
  h(2, 'Decision title'),
  field('Date'),
  field('Deciders'),
  decision(
    h(3, 'Context'),
    p('What forced a decision, and the constraints at the time.'),
    h(3, 'Decision'),
    p('What we chose, stated plainly.'),
    h(3, 'Consequences'),
    bullets('What gets easier', 'What gets harder', 'What we will revisit, and when'),
  ),
);
