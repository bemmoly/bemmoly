/* ───────── Docs kit: icons, data, the Docs section of the one sidebar, page atoms ───────── */
Object.assign(P, {
  history: '<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5"/><path d="M12 7.5V12l3 2"/>',
  trash: '<path d="M3 6h18M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6M18.5 6l-.9 13.1a2 2 0 0 1-2 1.9H8.4a2 2 0 0 1-2-1.9L5.5 6M10 11v6M14 11v6"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  share: '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13"/>',
  panelR: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M15 3v18"/>',
  text: '<path d="M5 7V5h14v2M12 5v14M9 19h6"/>',
  h1: '<path d="M4 6v12M12 6v12M4 12h8M17 10.5l3-2V18"/>',
  h2: '<path d="M4 6v12M12 6v12M4 12h8M16.5 10.5a2 2 0 1 1 3.5 1.4L16.5 18H21"/>',
  h3: '<path d="M4 6v12M12 6v12M4 12h8M16.5 9h4l-2.5 3a2.5 2.5 0 1 1-2 4"/>',
  quote: '<path d="M7 17c-2 0-3-1.4-3-3.5C4 10 6 7.5 9 7M17 17c-2 0-3-1.4-3-3.5 0-3.5 2-6 5-6.5"/>',
  divider: '<path d="M3 12h18"/><path d="M8 7h8M8 17h8" opacity=".35"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M10 4v16"/>',
  callout: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M12 9h.01M11 12.5h1V16h1"/>',
  numbered: '<path d="M10 6h11M10 12h11M10 18h11M4 5h1.5v4.5M3.5 9.5h3.5M3.5 15.5a1.5 1.5 0 0 1 3 .2c0 1-3 2-3 3.3h3"/>',
  strike: '<path d="M16 5H9.5a3 3 0 0 0-1.3 5.7M14 13a3.3 3.3 0 0 1-1.6 6H7M4 12h16"/>',
  hl: '<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  filePlus: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15h6"/>',
  template: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-2"/>',
  focus: '<path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  folder: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  scale: '<path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3.5 3.5 0 0 0 6 0zM19 7l-3 7a3.5 3.5 0 0 0 6 0z"/>',
  toc: '<path d="M4 6h16M8 12h12M8 18h12"/>',
  smilePlus: '<path d="M21 12a9 9 0 1 1-9-9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01M18 2v6M15 5h6"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.9A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22.4 22.4 0 0 1-4 2z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  wifiOff: '<path d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.8M19 13a10 10 0 0 0-2.3-1.7M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8A15 15 0 0 0 10.7 5M12 20h.01"/>',
  pdf: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h1.5a1.5 1.5 0 0 1 0 3H8v-3zm0 3v2M13 13v5h1a2 2 0 0 0 2-2v-1a2 2 0 0 0-2-2z"/>',
});

/* Spaces take colours from the entity palette, never from status or signal colours */
const SPACES = {
  ENG: { n: 'Engineering', c: '#5B7BE5', l: 'E', d: 'RFCs, runbooks and postmortems.', pages: 5, m: ['PN', 'AK', 'JM', 'RS'] },
  PROD: { n: 'Product', c: '#0E9BB0', l: 'P', d: 'Specs, roadmaps and research.', pages: 2, m: ['MK', 'LT'] },
  HB: { n: 'Company handbook', c: '#D46A2E', l: 'H', d: 'How we work at Acme Labs.', pages: 2, m: ['RS'] },
  DES: { n: 'Design', c: '#C2536A', l: 'D', d: 'Principles, critiques and the system.', pages: 1, m: ['MK'] },
};
function stile(k, s = 18) {
  const p = SPACES[k];
  return `<span class="tile" style="width:${s}px;height:${s}px;border-radius:${(s * 0.26).toFixed(1)}px;background:${p.c};font-size:${Math.round(s * 0.52)}px">${p.l}</span>`;
}
/* Page icons: drawn icons from the same set, tinted from the entity palette; the default is the doc icon in ink */
function pgi(name = 'doc', s = 15, c = null) {
  return `<span class="d-pgi" style="color:${c || 'var(--tx-3)'}">${ic(name, s)}</span>`;
}
const PAGES = {
  platform: { t: 'Platform', i: 'layers', c: '#5B7BE5' },
  rfc: { t: 'RFC: Move sessions to Postgres', i: 'flag', c: '#6E56CF' },
  runbook: { t: 'Auth service runbook', i: 'book', c: '#23988A' },
  pms: { t: 'Postmortems', i: 'alert', c: '#D46A2E' },
  pm1: { t: 'Postmortem: checkout outage', i: 'doc' },
  oncall: { t: 'On-call handbook', i: 'doc' },
  adr: { t: 'Architecture decisions', i: 'scale', c: '#2B8FC9' },
  q4: { t: 'Q4 roadmap', i: 'map', c: '#0E9BB0' },
  spec: { t: 'Spec: Docs home', i: 'doc' },
  welcome: { t: 'Welcome to Acme Labs', i: 'smile', c: '#D46A2E' },
  timeoff: { t: 'Time off', i: 'cal' },
  principles: { t: 'Design principles', i: 'compass', c: '#C2536A' },
};
const pg = (k, s = 15) => pgi(PAGES[k].i, s, PAGES[k].c);

/* Page status reuses the status glyph family: draft is to-do grey, in review is in-progress blue, published is done green */
const PSTATUS = { draft: ['todo', 'Draft'], review: ['review', 'In review'], published: ['done', 'Published'], archived: ['wont', 'Archived'] };
const pst = (k, s = 14) => `<span class="st">${stc(PSTATUS[k][0], s)}<span>${PSTATUS[k][1]}</span></span>`;

/* Inline issue embed: type tile, key, title, status glyph. No caps, no colour guessed from a name. */
function ich(k, o = {}) {
  const x = issue(k) || o.x;
  return `<span class="d-ich" title="${x.t}">${ty(x.ty, 14)}<span class="mono">${x.k}</span><span class="trunc" style="max-width:${o.w || 210}px">${x.t}</span>${stc(x.s, 13)}</span>`;
}

/* ── Docs section of the one sidebar ── */
function tn(depth, icon, title, o = {}) {
  const pad = 6 + depth * 14;
  const chev = o.kids ? ic(o.open ? 'down' : 'right', 13, 2) : '';
  const tools = o.hover ? `<span class="tools"><span title="Add a page inside">${ic('plus', 14)}</span><span title="More (right-click)">${ic('more', 14)}</span></span>` : o.cnt ? `<span class="cnt">${o.cnt}</span>` : '';
  return `<div class="d-tn ${o.on ? 'on' : ''} ${o.hover ? 'hover' : ''} ${o.drag ? 'drag' : ''}" style="padding-left:${pad}px;${o.style || ''}"><span class="chev">${chev}</span>${icon}<span class="grow trunc">${title}</span>${tools}</div>`;
}
const DEFAULT_TREE = (a = 'rfc', o = {}) => [
  tn(1, pg('platform'), 'Platform', { kids: true, open: true }),
  tn(2, pg('rfc'), PAGES.rfc.t, { on: a === 'rfc' }),
  tn(2, pg('runbook'), PAGES.runbook.t, { on: a === 'runbook', hover: o.hover === 'runbook' }),
  tn(2, pg('oncall'), PAGES.oncall.t, {}),
  tn(1, pg('adr'), PAGES.adr.t, { kids: true }),
  tn(1, pg('pms'), 'Postmortems', { kids: true, open: o.pmsOpen }),
  ...(o.pmsOpen ? [tn(2, pg('pm1'), PAGES.pm1.t, {})] : []),
];
function docsSidebar(o = {}) {
  const a = o.active || '';
  const n = (key, icon, label, extra = '') => `<div class="nav ${a === key ? 'on' : ''}">${ic(icon)}<span>${label}</span>${extra}</div>`;
  const space = (k, open, extra = '') =>
    `<div class="nav ${a === 'space-' + k ? 'on' : ''} ${o.spaceHover === k ? 'hover' : ''}" style="${o.spaceHover === k ? 'background:var(--hover)' : ''}">${stile(k, 18)}<span class="grow trunc">${SPACES[k].n}</span>${o.spaceHover === k ? `<span class="row" style="gap:2px;color:var(--tx-2)">${ic('plus', 14)}${ic('more', 14)}</span>` : open ? ic('down', 14, 1.75, 'style="color:var(--tx-3)"') : ''}${extra}</div>`;
  const tree = o.tree || DEFAULT_TREE(o.page, o);
  const workOpen = o.workOpen === true;
  return `<aside class="side" style="position:relative">
    ${brandBlock()}
    <div class="side-actions"><div class="search-btn">${ic('search', 15)}<span class="grow">Search</span><span class="kbd">⌘K</span></div><div class="new-btn" title="New page (N)">${ic('plus', 16, 2.2)}</div></div>
    ${n('home', 'home', 'Home')}
    ${n('inbox', 'inbox', 'Inbox', '<span class="pill">4</span>')}
    ${n('mine', 'me', 'My issues', '<span class="count">6</span>')}
    <div class="sec">${mt('work', 14)}<span>Work</span><span class="add">${ic(workOpen ? 'down' : 'right', 13, 2)}</span></div>
    ${workOpen ? Object.keys(PROJECTS).map((k) => `<div class="nav">${pt(k, 18)}<span class="grow trunc">${PROJECTS[k].n}</span></div>`).join('') : `<div class="nav">${pt('PLT', 18)}<span class="grow trunc">Platform Core</span><span class="count">+2</span></div>`}
    <div class="sec">${mt('docs', 14)}<span>Docs</span><span class="add" title="New space">${ic('plus', 14)}</span></div>
    ${o.focus ? '' : space('ENG', o.spaceOpen !== false)}
    ${o.spaceOpen === false ? '' : `<div style="display:flex;flex-direction:column;gap:1px;position:relative">${tree.join('')}</div>`}
    ${o.focus ? '' : ['PROD', 'HB', 'DES'].map((k) => space(k, false)).join('')}
    ${o.extraSpaces || ''}
    ${o.focus ? '' : n('docs-home', 'book', 'Docs home')}
    <div class="side-foot">
      ${n('trash', 'trash', 'Trash')}
      ${n('settings-ws', 'gear', 'Settings')}
      <div class="me">${av('RS', 22)}<span class="grow"><b style="font-weight:550">Rohan S.</b></span>${ic('moon', 15, 1.75, 'style="color:var(--tx-3)"')}</div>
    </div>
  </aside>`;
}
function dframe(o) {
  return `<div class="px app ${o.dark ? 'dark' : ''}" style="position:relative">${docsSidebar(o)}<main class="main" style="position:relative">${o.header || ''}${o.body || ''}</main>${o.overlay || ''}</div>`;
}
const spaceCrumb = (k = 'ENG') => ({ icon: stile(k, 16), t: SPACES[k].n });
const docsCrumb = () => ({ icon: mt('docs', 16), t: 'Docs' });
const dpresence = (list = ['AK', 'JM']) => `<div class="facepile">${list.map((i) => av(i, 22)).join('')}</div>`;
function pageHeader(o = {}) {
  const crumbs = [spaceCrumb(), { icon: pg('platform', 14), t: 'Platform' }, { icon: pg(o.page || 'rfc', 14), t: o.title || PAGES[o.page || 'rfc'].t }];
  const statusBtn = o.status === false ? '' : `<span class="btn sm ghost" style="box-shadow:inset 0 0 0 1px var(--line);margin-left:4px;color:var(--tx-2)">${pst(o.status || 'review', 13)}${ic('down', 12)}</span>`;
  const right =
    o.right ||
    `<span class="muted row" style="gap:5px;font-size:12px">${ic('check', 13, 2)}Saved</span>${dpresence(o.peers)}<span class="vdiv"></span>
    <span class="btn ghost ${o.comments ? '' : ''}" style="${o.comments ? 'background:var(--acc-50);color:var(--acc)' : ''}" title="Comments (⌘⌥C)">${ic('msg', 15)}<span style="font-variant-numeric:tabular-nums">3</span></span>
    <span class="btn ghost" title="Linked work (⌘⌥L)" style="${o.linked ? 'background:var(--acc-50);color:var(--acc)' : ''}">${ic('link', 15)}<span style="font-variant-numeric:tabular-nums">3</span></span>
    <span class="btn ghost icon" title="Version history (⌘⌥H)" style="${o.history ? 'background:var(--acc-50);color:var(--acc)' : ''}">${ic('history', 16)}</span>
    <span class="btn ghost icon" title="Star (S)">${ic('star', 16)}</span>
    <span class="btn">${ic('share', 14)}Share</span>
    <span class="btn ghost icon">${ic('more', 16)}</span>`;
  return `<div style="${o.quiet ? 'opacity:.18' : ''}">${header({ crumbs, right: `${right}` }).replace('</div><div class="right">', `</div>${statusBtn}<div class="right">`)}</div>`;
}
/* A cover drawn from the logo's shapes: rounded tiles in the space's colour family */
function cover(c = '#5B7BE5', dark = false) {
  const bg = dark ? '#151a26' : '#eef2fd';
  return `<div class="d-cover" style="background:${bg}"><svg width="1200" height="148" viewBox="0 0 1200 148" preserveAspectRatio="none" style="position:absolute;inset:0">
    <defs><linearGradient id="cg${dark ? 'd' : 'l'}" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity="${dark ? 0.55 : 0.32}"/><stop offset="1" stop-color="#9A85EA" stop-opacity="${dark ? 0.35 : 0.22}"/></linearGradient></defs>
    <rect x="720" y="-40" width="150" height="150" rx="36" fill="url(#cg${dark ? 'd' : 'l'})"/><rect x="885" y="-40" width="150" height="150" rx="36" fill="${c}" opacity="${dark ? 0.32 : 0.16}"/>
    <rect x="720" y="125" width="150" height="150" rx="36" fill="${c}" opacity="${dark ? 0.22 : 0.12}"/><rect x="885" y="125" width="150" height="150" rx="75" fill="#9A85EA" opacity="${dark ? 0.28 : 0.16}"/>
    <rect x="1050" y="-40" width="150" height="150" rx="36" fill="${c}" opacity="${dark ? 0.16 : 0.08}"/><rect x="555" y="44" width="150" height="150" rx="36" fill="${c}" opacity="${dark ? 0.12 : 0.06}"/></svg></div>`;
}
const toc = (on = 0, top = 0, left = 0) =>
  `<div class="d-toc" style="top:${top}px;left:${left}px"><div class="h">On this page</div>${[
    ['Context', ''],
    ['Migration order', ''],
    ['Rollback', ''],
    ['Backfill', 'sub'],
    ['Open questions', ''],
  ]
    .map(([t, c], i) => `<span class="a ${c} ${i === on ? 'on' : ''}">${t}</span>`)
    .join('')}</div>`;
const caret = (who, c) => `<span class="d-caret" style="background:${c}"><i style="background:${c}">${who}</i></span>`;
const cmk = (p, n, top, left) => `<span class="d-cmk" style="top:${top}px;left:${left}px">${av(p, 18)}${n}</span>`;
function toastEl(text, action = 'Undo', pos = 'left:50%;bottom:24px;transform:translateX(-50%)') {
  return `<div class="d-toast" style="${pos}">${text}<span class="u">${action}</span><span class="kbd" style="background:transparent;color:#aab3c2;border-color:rgba(255,255,255,.2)">⌘Z</span></div>`;
}
