/* ───────── Proposed kit: icons, atoms, sample data, the one app frame ───────── */
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  inbox:
    '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  board: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 7v7M12 7v4M16 7v9"/>',
  backlog: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  list: '<path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  timeline: '<path d="M3 4v16h18"/><path d="M7 8h7M10 12h8M7 16h5"/>',
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  me: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.2 18.4a7 7 0 0 1 11.6 0"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>',
  filter: '<path d="M3 6h18M7 12h10M10 18h4"/>',
  sliders:
    '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  clip: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  flow: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><path d="M6.5 10v4a2 2 0 0 0 2 2H14"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 3v4M17 5h4"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  palette:
    '<circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/><circle cx="8.5" cy="7.5" r="1"/><circle cx="6.5" cy="12.5" r="1"/><path d="M12 2a10 10 0 0 0 0 20c.9 0 1.6-.7 1.6-1.6 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.6 1.6-1.6H16a6 6 0 0 0 6-6c0-4.9-4.5-8.6-10-8.6z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  db: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  pulse: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  blocks:
    '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  sidebar: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
  building:
    '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  sub: '<path d="M15 10l5 5-5 5"/><path d="M4 4v7a4 4 0 0 0 4 4h12"/>',
  arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  expand: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
  bold: '<path d="M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z"/>',
  ital: '<path d="M19 4h-9M14 20H5M15 4 9 20"/>',
  code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
  bullets: '<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  checklist: '<path d="m3 7 2 2 4-4M3 17l2 2 4-4M13 7h8M13 17h8"/>',
  img: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  at: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>',
  archive: '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>',
  snooze: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M5 3 2 6M22 6l-3-3"/>',
};
function ic(name, size = 16, sw = 1.75, extra = '') {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" ${extra}>${P[name] || ''}</svg>`;
}

/* Issue types: one tile family, the same corner ratio as the logo's tiles (≈22%) */
const TYPES = {
  epic: { c: '#6E56CF', g: 'zap', fill: true, label: 'Epic' },
  story: { c: '#1F9D55', g: 'bookmark', fill: true, label: 'Story' },
  task: { c: '#2356C9', g: 'check', fill: false, label: 'Task' },
  bug: { c: '#E5484D', g: 'bugdot', fill: true, label: 'Bug' },
  subtask: { c: '#0E9BB0', g: 'sub', fill: false, label: 'Sub-task' },
};
function ty(t, s = 16) {
  const d = TYPES[t];
  const r = (s * 0.24).toFixed(1);
  let glyph;
  if (d.g === 'bugdot')
    glyph = `<g transform="translate(${s / 2} ${s / 2})"><ellipse rx="${s * 0.19}" ry="${s * 0.23}" cy="${s * 0.03}" fill="#fff"/><path d="M${-s * 0.3} ${-s * 0.05}h${s * 0.6}M${-s * 0.28} ${s * 0.18}l${s * 0.1} ${-s * 0.04}M${s * 0.28} ${s * 0.18}l${-s * 0.1} ${-s * 0.04}" stroke="#fff" stroke-width="${s * 0.075}" stroke-linecap="round"/><circle r="${s * 0.1}" cy="${-s * 0.22}" fill="#fff"/></g>`;
  else {
    const k = (s * 0.62) / 24;
    const o = s * 0.19;
    glyph = `<g transform="translate(${o} ${o}) scale(${k})" ${d.fill ? 'fill="#fff" stroke="#fff" stroke-width="1.5"' : 'fill="none" stroke="#fff" stroke-width="3.4"'} stroke-linecap="round" stroke-linejoin="round">${P[d.g]}</g>`;
  }
  return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" aria-label="${d.label}"><rect width="${s}" height="${s}" rx="${r}" fill="${d.c}"/>${glyph}</svg>`;
}

/* Priority: one neutral signal glyph, colour only when it is urgent */
function pr(level, s = 16) {
  if (level === 'urgent')
    return `<svg width="${s}" height="${s}" viewBox="0 0 16 16" aria-label="Urgent"><rect x="1.5" y="1.5" width="13" height="13" rx="3.2" fill="var(--red)"/><path d="M8 4.6v4.2" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><circle cx="8" cy="11.2" r="1.05" fill="#fff"/></svg>`;
  if (level === 'none')
    return `<svg width="${s}" height="${s}" viewBox="0 0 16 16" aria-label="No priority"><path d="M3 8h2M7 8h2M11 8h2" stroke="var(--tx-3)" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  const n = { low: 1, medium: 2, high: 3 }[level];
  const bars = [
    [2, 9, 4],
    [6.5, 6, 7],
    [11, 3, 10],
  ]
    .map(
      ([x, y, h], i) =>
        `<rect x="${x}" y="${y + 1}" width="3" height="${h}" rx="1" fill="${i < n ? 'var(--tx-2)' : 'var(--line)'}"/>`,
    )
    .join('');
  return `<svg width="${s}" height="${s}" viewBox="0 0 16 16" aria-label="${level} priority">${bars}</svg>`;
}

/* Status: the glyph fills as work progresses; colour is the category (to do, in progress, done) */
const STATUS = {
  backlog: { f: 0, c: 'var(--todo)', dash: true, label: 'Backlog' },
  todo: { f: 0, c: 'var(--todo)', label: 'To do' },
  progress: { f: 0.25, c: 'var(--prog)', label: 'In progress' },
  review: { f: 0.5, c: 'var(--prog)', label: 'In review' },
  qa: { f: 0.75, c: 'var(--prog)', label: 'QA' },
  done: { f: 1, c: 'var(--done)', label: 'Done' },
  wont: { f: -1, c: 'var(--todo)', label: "Won't do" },
};
function stc(k, s = 14) {
  const d = STATUS[k];
  const c = 7;
  if (d.f === 1)
    return `<svg width="${s}" height="${s}" viewBox="0 0 14 14" aria-label="${d.label}"><circle cx="7" cy="7" r="6.25" fill="${d.c}"/><path d="m4.3 7.2 1.8 1.8 3.6-3.8" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  if (d.f === -1)
    return `<svg width="${s}" height="${s}" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6.25" fill="${d.c}"/><path d="m4.8 4.8 4.4 4.4M9.2 4.8 4.8 9.2" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  let pie = '';
  if (d.f > 0) {
    const a = d.f * 2 * Math.PI;
    const r = 3.4;
    const x = c + r * Math.sin(a);
    const y = c - r * Math.cos(a);
    pie = `<path d="M7 7V${c - r}A${r} ${r} 0 ${d.f > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}Z" fill="${d.c}"/>`;
  }
  return `<svg width="${s}" height="${s}" viewBox="0 0 14 14" aria-label="${d.label}"><circle cx="7" cy="7" r="5.75" fill="none" stroke="${d.c}" stroke-width="1.5" ${d.dash ? 'stroke-dasharray="2.2 1.8"' : ''}/>${pie}</svg>`;
}
const stl = (k) => `<span class="st">${stc(k)}<span>${STATUS[k].label}</span></span>`;

const PEOPLE = {
  RS: { n: 'Rohan S.', c: '#5B6CD9' },
  PN: { n: 'Priya N.', c: '#D46A2E' },
  AK: { n: 'Aisha K.', c: '#2B8FC9' },
  JM: { n: 'Jonas M.', c: '#2F9E6E' },
  LT: { n: 'Lena T.', c: '#C2536A' },
  MK: { n: 'Maya K.', c: '#8B62D0' },
  DP: { n: 'Dev P.', c: '#23988A' },
};
function av(i, s = 20) {
  if (!i) return `<span class="av none" style="width:${s}px;height:${s}px"></span>`;
  return `<span class="av" title="${PEOPLE[i].n}" style="width:${s}px;height:${s}px;background:${PEOPLE[i].c};font-size:${Math.round(s * 0.42)}px">${i}</span>`;
}
const PROJECTS = {
  PLT: { n: 'Platform Core', c: '#2356C9', l: 'P', d: 'The platform team', m: 'Scrum', lead: 'PN', open: 23, team: 'Platform' },
  MOB: { n: 'Mobile App', c: '#0E9BB0', l: 'M', d: 'iOS and Android clients', m: 'Kanban', lead: 'JM', open: 14, team: 'Mobile' },
  SUP: { n: 'Support Desk', c: '#D46A2E', l: 'S', d: 'Customer-facing fixes, pulled continuously', m: 'Kanban', lead: 'LT', open: 9, team: null },
};
function pt(k, s = 18) {
  const p = PROJECTS[k];
  return `<span class="tile" style="width:${s}px;height:${s}px;border-radius:${(s * 0.26).toFixed(1)}px;background:${p.c};font-size:${Math.round(s * 0.52)}px">${p.l}</span>`;
}
const EPICS = {
  auth: { n: 'Auth service', k: 'PLT-190', c: '#2356C9', p: 0.63 },
  billing: { n: 'Billing v2', k: 'PLT-150', c: '#6E56CF', p: 0.35 },
  obs: { n: 'Observability', k: 'PLT-240', c: '#0E9BB0', p: 0 },
  onb: { n: 'Self-serve onboarding', k: 'PLT-160', c: '#D46A2E', p: 0.85 },
};
const ep = (k) =>
  `<span class="row" style="gap:6px;min-width:0"><i style="width:8px;height:8px;border-radius:2.5px;background:${EPICS[k].c};flex:none"></i><span class="trunc sub">${EPICS[k].n}</span></span>`;
const LABELC = { api: '#2B8FC9', auth: '#5B6CD9', security: '#C2536A', infra: '#23988A', ops: '#D08A1A', billing: '#8B62D0', 'bug-bash': '#E5484D' };
const lb = (t) => `<span class="lbl"><i style="background:${LABELC[t] || '#9aa1ae'}"></i>${t}</span>`;

const ISSUES = [
  { k: 'PLT-222', t: 'Rate-limit token refresh endpoint', ty: 'task', s: 'todo', p: 'medium', pts: 3, a: 'AK', e: 'auth', l: ['api'] },
  { k: 'PLT-219', t: 'Remove legacy cookie path from monolith', ty: 'task', s: 'todo', p: 'low', pts: 2, a: 'JM', e: 'auth', blocked: 'PLT-204' },
  { k: 'PLT-211', t: 'Session cleanup background job', ty: 'story', s: 'todo', p: 'medium', pts: 3, a: 'JM', e: 'auth', l: ['infra'], blocked: 'PLT-204' },
  { k: 'PLT-218', t: 'Rotate service tokens on every deploy', ty: 'story', s: 'progress', p: 'urgent', pts: 5, a: 'PN', e: 'auth', l: ['auth', 'security'] },
  { k: 'PLT-226', t: 'Refresh token reused after logout on Safari', ty: 'bug', s: 'progress', p: 'high', pts: 2, a: 'LT', e: 'auth', l: ['security'] },
  { k: 'PLT-204', t: 'Session store migration to Postgres', ty: 'story', s: 'review', p: 'urgent', pts: 5, a: 'AK', e: 'auth', l: ['auth', 'infra'] },
  { k: 'PLT-209', t: 'Health checks and alerting for auth service', ty: 'task', s: 'qa', p: 'medium', pts: 1, a: 'RS', e: 'auth', l: ['ops'] },
  { k: 'PLT-198', t: 'SSO with Google Workspace and Okta', ty: 'story', s: 'done', p: 'high', pts: 3, a: 'PN', e: 'auth', l: ['auth'] },
  { k: 'PLT-197', t: 'Auth service CI pipeline', ty: 'task', s: 'done', p: 'low', pts: 2, a: 'RS', e: 'auth' },
  { k: 'PLT-230', t: 'Usage-based invoice line items', ty: 'story', s: 'todo', p: 'high', pts: 5, a: 'LT', e: 'billing', l: ['billing'] },
  { k: 'PLT-231', t: 'Proration when switching plans mid-cycle', ty: 'task', s: 'todo', p: 'medium', pts: 3, a: 'LT', e: 'billing', l: ['billing'] },
  { k: 'PLT-228', t: 'Stripe webhook idempotency', ty: 'story', s: 'progress', p: 'high', pts: 3, a: 'RS', e: 'billing', l: ['billing', 'api'] },
  { k: 'PLT-224', t: 'Invoice PDF shows wrong tax for EU customers', ty: 'bug', s: 'review', p: 'urgent', pts: 2, a: 'JM', e: 'billing', l: ['billing', 'bug-bash'] },
  { k: 'PLT-215', t: 'Dunning email sequence', ty: 'task', s: 'qa', p: 'medium', pts: 2, a: 'LT', e: 'billing' },
  { k: 'PLT-201', t: 'Billing settings copy cleanup', ty: 'task', s: 'done', p: 'low', pts: 1, a: 'JM', e: 'billing' },
  { k: 'PLT-233', t: 'Board filter state lost on refresh', ty: 'bug', s: 'todo', p: 'medium', pts: 2, a: null, e: 'onb' },
];
const issue = (k) => ISSUES.find((i) => i.k === k);

/* The Bemmoly mark, inlined from packages/ui/assets/brand/mark-color.svg */
const MARK_PATHS = `<g transform="translate(-3.3468 -3.3599) scale(0.06)"><path fill="#2356C9" d="M100.850,252.884 C99.937,252.731 96.849,251.842 93.988,250.909 C83.521,247.494 74.358,239.397 69.391,229.173 C64.880,219.889 64.970,221.175 64.970,165.865 C64.970,118.454 65.034,115.763 66.278,110.899 C70.229,95.453 82.126,82.880 97.860,77.523 C103.001,75.773 103.866,75.693 124.106,75.108 C153.824,74.249 209.378,74.942 215.468,76.248 C230.155,79.397 240.904,90.645 243.478,105.556 C244.272,110.163 244.398,120.617 244.217,167.107 C244.013,219.273 243.915,223.360 242.782,226.764 C238.369,240.016 229.331,248.808 216.835,252.004 C211.782,253.296 209.716,253.339 157.057,253.252 C127.057,253.202 101.764,253.036 100.850,252.884 Z"/><path fill="#2356C9" d="M99.854,454.909 C97.296,454.369 92.661,452.708 89.555,451.218 C84.943,449.007 82.865,447.460 78.226,442.786 C71.722,436.233 68.353,430.476 66.280,422.372 C65.026,417.468 64.970,414.803 64.970,359.987 C64.970,305.572 65.034,302.475 66.254,297.705 C70.074,282.770 79.940,272.007 94.545,266.846 L99.854,264.970 154.775,264.782 C215.517,264.574 215.042,264.547 223.629,268.757 C229.651,271.710 236.732,278.753 239.563,284.607 C243.803,293.373 243.687,291.273 243.698,359.699 C243.704,400.955 243.469,423.195 242.997,425.812 C241.093,436.386 233.160,446.953 223.593,451.661 C214.746,456.014 215.257,455.982 156.997,455.934 C113.335,455.899 103.723,455.726 99.854,454.909 Z"/><path fill="#9A85EA" d="M344.581,244.650 C330.698,243.710 295.296,237.973 288.186,235.511 C268.278,228.616 256.332,213.228 256.332,194.477 C256.332,189.465 270.523,90.474 272.616,80.888 C275.977,65.490 287.355,56.000 302.453,56.000 C309.329,56.000 349.807,63.883 372.279,69.598 C394.814,75.329 408.807,82.412 421.205,94.364 C428.596,101.489 432.673,106.855 436.967,115.111 C444.178,128.977 446.699,139.360 446.650,155.003 C446.621,164.534 446.389,166.882 444.876,172.973 C438.508,198.599 423.826,218.471 401.224,232.055 C391.026,238.184 374.541,243.551 363.381,244.375 C360.600,244.580 356.980,244.844 355.336,244.962 C353.691,245.079 348.851,244.939 344.581,244.650 Z"/><path fill="#5B7BE5" d="M283.094,455.019 C270.966,452.315 261.158,442.916 257.955,430.928 C256.790,426.567 256.704,400.704 257.629,332.744 C258.063,300.907 258.317,294.261 259.225,291.045 C262.982,277.735 272.950,268.338 286.233,265.583 C293.514,264.073 360.494,264.563 367.855,266.180 C387.225,270.437 400.033,277.210 412.511,289.795 C427.175,304.584 436.351,323.468 439.362,345.051 C442.341,366.413 438.262,387.529 427.426,406.836 C413.714,431.266 391.226,447.881 363.441,454.109 C357.345,455.475 355.114,455.564 322.113,455.747 C294.229,455.903 286.399,455.756 283.094,455.019 Z"/></g>`;
const mark = (s = 20, extra = '') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" ${extra}>${MARK_PATHS}</svg>`;

/* Module tiles: the three logo colours become the three module colours */
const MODULES = {
  work: { n: 'Work', c: '#2356C9', g: 'board' },
  docs: { n: 'Docs', c: '#5B7BE5', g: 'doc' },
  ai: { n: 'AI', c: '#9A85EA', g: 'spark' },
};
function mt(k, s = 18) {
  const m = MODULES[k];
  return `<span class="tile" style="width:${s}px;height:${s}px;border-radius:${(s * 0.26).toFixed(1)}px;background:${m.c}">${ic(m.g, Math.round(s * 0.62), 2.2, 'style="color:#fff"')}</span>`;
}

/* ───────── The one app frame ───────── */
function sidebar(o = {}) {
  const a = o.active || '';
  const proj = o.project || 'PLT';
  const projItems = [
    ['board', 'board', 'Board'],
    ['backlog', 'backlog', 'Backlog'],
    ['list', 'list', 'All issues'],
    ['settings', 'gear', 'Settings'],
  ];
  if (o.settingsNav) return settingsSidebar(o);
  const n = (key, icon, label, extra = '') =>
    `<div class="nav ${a === key ? 'on' : ''}">${ic(icon)}<span>${label}</span>${extra}</div>`;
  const projBlock = (k, open) => `
    <div class="nav ${!open && a === 'proj-' + k ? 'on' : ''}">${pt(k, 18)}<span class="grow trunc">${PROJECTS[k].n}</span>${open ? ic('down', 14, 1.75, 'style="color:var(--tx-3)"') : ''}</div>
    ${open ? projItems.map(([key, icon, label]) => `<div class="nav child ${a === key ? 'on' : ''}">${ic(icon, 15)}<span>${label}</span></div>`).join('') : ''}`;
  return `<aside class="side">
    ${brandBlock({ custom: o.customLogo })}
    <div class="side-actions"><div class="search-btn">${ic('search', 15)}<span class="grow">Search</span><span class="kbd">⌘K</span></div><div class="new-btn" title="New issue (C)">${ic('plus', 16, 2.2)}</div></div>
    ${n('home', 'home', 'Home')}
    ${n('inbox', 'inbox', 'Inbox', '<span class="pill">4</span>')}
    ${n('mine', 'me', 'My issues', '<span class="count">6</span>')}
    <div class="sec">${mt('work', 14)}<span>Work</span><span class="add">${ic('plus', 14)}</span></div>
    ${projBlock(proj, true)}
    ${Object.keys(PROJECTS)
      .filter((k) => k !== proj)
      .map((k) => projBlock(k, false))
      .join('')}
    ${n('projects', 'layers', 'All projects')}
    <div class="sec">${mt('docs', 14)}<span>Docs</span><span class="soon">0.3</span></div>
    <div class="side-foot">
      ${n('settings-ws', 'gear', 'Settings')}
      ${n('help', 'help', 'Help and shortcuts')}
      <div class="me">${av('RS', 22)}<span class="grow"><b style="font-weight:550">Rohan S.</b></span>${ic('moon', 15, 1.75, 'style="color:var(--tx-3)"')}</div>
    </div>
  </aside>`;
}
function settingsSidebar(o) {
  const a = o.active;
  const grp = (t, items) =>
    `<div class="sec" style="margin-top:12px">${t}</div>` +
    items
      .map(
        ([k, i, l, extra = '']) =>
          `<div class="nav ${a === k ? 'on' : ''}">${ic(i, 15)}<span>${l}</span>${extra}</div>`,
      )
      .join('');
  return `<aside class="side">
    ${brandBlock()}
    <div class="nav" style="color:var(--tx-2);margin:2px 0 4px">${ic('left', 15)}<span>Back to app</span><span class="kbd" style="margin-left:auto">Esc</span></div>
    ${grp('Account', [
      ['profile', 'me', 'Profile'],
      ['notif', 'bell', 'Notifications'],
    ])}
    ${grp('Workspace', [
      ['general', 'building', 'General'],
      ['appearance', 'palette', 'Appearance'],
      ['email', 'mail', 'Email delivery'],
      ['ai', 'spark', 'AI and models'],
    ])}
    ${grp('People', [
      ['users', 'users', 'Members', '<span class="count">7</span>'],
      ['teams', 'users', 'Teams'],
      ['roles', 'shield', 'Roles'],
      ['sso', 'key', 'Sign-in and SSO'],
    ])}
    ${grp('Modules', [
      ['m-work', 'board', 'Work'],
      ['modules', 'blocks', 'Manage modules'],
    ])}
    ${grp('System', [
      ['backups', 'db', 'Storage and backups'],
      ['updates', 'download', 'Updates', '<span class="chip acc" style="margin-left:auto;height:17px;font-size:10.5px">0.2.3</span>'],
      ['status', 'pulse', 'System status'],
      ['audit', 'clock', 'Audit log'],
    ])}
  </aside>`;
}
function header(o) {
  const crumbs = (o.crumbs || [])
    .map((c, i, arr) => {
      const last = i === arr.length - 1;
      return `<span class="c ${last ? 'here' : ''}">${c.icon || ''}${c.t}${c.sw ? ic('down', 13, 1.75, 'style="color:var(--tx-3)"') : ''}</span>${last ? '' : `<span class="sep">/</span>`}`;
    })
    .join('');
  const tabs = o.tabs
    ? `<div class="tabs">${o.tabs.map(([k, i, l]) => `<span class="tab ${o.tab === k ? 'on' : ''} ${k === 'timeline' ? 'dim' : ''}">${ic(i, 15)}${l}</span>`).join('')}</div>`
    : '';
  return `<header class="hdr"><div class="crumbs">${crumbs}</div>${tabs}<div class="right">${o.right || ''}</div></header>`;
}
const PROJECT_TABS = [
  ['board', 'board', 'Board'],
  ['backlog', 'backlog', 'Backlog'],
  ['list', 'list', 'List'],
  ['timeline', 'timeline', 'Timeline'],
];
/* Collapsed sidebar: a 56px rail. With a customer logo, their logo leads and the Bemmoly mark sits at the foot. */
function railSide(o = {}) {
  const b = (inner, on, title) =>
    `<span title="${title || ''}" style="width:36px;height:32px;border-radius:8px;display:grid;place-items:center;color:${on ? 'var(--acc)' : 'var(--tx-3)'};${on ? 'background:var(--card);box-shadow:var(--e1)' : ''}">${inner}</span>`;
  return `<aside class="side" style="padding:12px 0 10px;align-items:center;gap:4px;position:relative;z-index:2">
    <span style="margin-bottom:10px">${o.customLogo ? acmeLogo(28) : mark(26)}</span>
    ${b(ic('search', 17), false, 'Search')}<span class="new-btn" style="margin:2px 0 8px">${ic('plus', 16, 2.2)}</span>
    ${b(ic('home', 17))}${b(ic('inbox', 17) + '<i style="position:absolute"></i>')}${b(ic('me', 17))}
    <span style="width:24px;border-top:1px solid var(--line);margin:8px 0"></span>
    ${b(pt('PLT', 22), true)}${b(pt('MOB', 22))}${b(pt('SUP', 22))}
    <div style="margin-top:auto;display:flex;flex-direction:column;align-items:center;gap:6px">
      ${b(ic('gear', 17))}
      ${o.customLogo ? `<span style="position:relative;display:grid;place-items:center;width:36px;height:30px">${mark(18)}${o.tip ? `<span style="position:absolute;left:44px;top:50%;transform:translateY(-50%);white-space:nowrap;background:#161b26;color:#fff;font-size:12px;padding:6px 9px;border-radius:7px;box-shadow:var(--e2)"><b style="font-weight:600">Bemmoly</b> 0.2.2 · What’s new</span>` : ''}</span>` : ''}
      ${av('RS', 26)}
    </div></aside>`;
}
function frame(o) {
  if (o.collapsed)
    return `<div class="px app ${o.dark ? 'dark' : ''}" style="position:relative;grid-template-columns:56px 1fr">${railSide(o)}<main class="main">${o.header || ''}${o.body || ''}</main>${o.overlay || ''}</div>`;
  return `<div class="px app ${o.dark ? 'dark' : ''}" style="position:relative">${sidebar(o)}<main class="main">${o.header || ''}${o.body || ''}</main>${o.overlay || ''}</div>`;
}
