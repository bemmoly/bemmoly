/* ───────── Proposed screens, all inside the same frame ───────── */
const presence = `<div class="facepile">${['PN', 'AK', 'JM'].map((i) => av(i, 22)).join('')}</div>`;
const projCrumb = (k = 'PLT') => ({ icon: pt(k, 16), t: PROJECTS[k].n, sw: true });

function toolbar(o = {}) {
  return `<div class="tool">
    <div class="tsearch">${ic('search', 14)}<span>Filter issues…</span></div>
    <span class="vdiv"></span>
    <span class="fchip set">${av('RS', 16)}Only mine<span class="x">${ic('x', 12)}</span></span>
    <span class="fchip">${ic('filter', 14)}Filter</span>
    <span class="fchip">${ic('star', 14)}Saved views</span>
    <div class="right" style="margin-left:auto;display:flex;gap:8px;align-items:center">
      ${o.extra || ''}
      <span class="muted">Group</span><span class="seg">${(o.groups || ['Epic', 'Assignee', 'None']).map((g, i) => `<span class="${i === 0 ? 'on' : ''}">${g}</span>`).join('')}</span>
      <span class="btn sm">${ic('sliders', 14)}Display</span>
    </div>
  </div>`;
}
function sprintStrip() {
  return `<div class="row" style="height:56px;padding:0 24px;gap:12px;border-bottom:1px solid var(--line);flex:none">
    <span style="color:var(--acc)">${ic('target', 18)}</span>
    <div><div class="row" style="gap:8px"><b style="font-size:15px;font-weight:600;letter-spacing:-.01em">Sprint 14</b><span class="chip warn">${ic('clock', 12, 2)}Ends today</span></div>
    <div class="muted" style="font-size:12px">Sep 23 – Oct 7 · Goal: ship the auth service to GA</div></div>
    <div style="margin-left:auto;display:flex;align-items:center;gap:14px">
      <div style="text-align:right"><div style="font-size:12px"><b style="font-weight:600">9</b> <span class="muted">of 48 points done</span></div>
      <div class="bar" style="width:160px;margin-top:4px;display:flex"><i style="width:19%;background:var(--done)"></i><i style="width:23%;background:var(--prog);border-radius:0"></i></div></div>
      <span class="btn">Complete sprint</span>
    </div></div>`;
}
function card(i, o = {}) {
  const x = issue(i);
  return `<div class="card ${x.blocked ? 'blocked' : ''} ${o.hover ? 'hover' : ''}">
    ${o.hover ? `<div class="hovertools"><span>${av(x.a, 16)}</span><span>${ic('expand', 13)}</span><span>${ic('more', 14)}</span></div>` : ''}
    ${x.blocked ? `<span class="chip red" style="align-self:flex-start;height:18px;font-size:11px">${ic('lock', 11, 2.2)}Blocked by ${x.blocked}</span>` : ''}
    <div class="t">${x.t}</div>
    ${x.l ? `<div class="row" style="gap:4px;flex-wrap:wrap">${x.l.map(lb).join('')}</div>` : ''}
    <div class="meta">${ty(x.ty)}<span class="mono">${x.k}</span><span class="right">${pr(x.p)}<span class="pts">${x.pts}</span>${av(x.a)}</span></div>
  </div>`;
}
const COLS = [
  ['todo', 'To do'],
  ['progress', 'In progress'],
  ['review', 'In review'],
  ['qa', 'QA'],
  ['done', 'Done'],
];
function boardBody(o = {}) {
  const lane = (e, open = true) => {
    const items = ISSUES.filter((i) => i.e === e);
    const E = EPICS[e];
    return `<div class="lane"><div class="laneh">${ic(open ? 'down' : 'right', 14, 2, 'style="color:var(--tx-3)"')}<i style="width:10px;height:10px;border-radius:3px;background:${E.c}"></i><b>${E.n}</b><span class="mono muted">${E.k}</span><span class="muted">${items.length} issues · ${items.reduce((s, i) => s + i.pts, 0)} pts</span><div class="bar"><i style="width:${E.p * 100}%;background:${E.c}"></i></div><span class="muted" style="margin-left:auto">Due Oct ${e === 'auth' ? 12 : 26}</span></div>
      <div class="cols">${COLS.map(
        ([s]) =>
          `<div class="cell">${items
            .filter((i) => i.s === s)
            .map((i) => card(i.k, { hover: o.hover === i.k }))
            .join('')}${o.add === e + s ? `<div class="addcard show">${ic('plus', 14)}New issue<span class="kbd" style="margin-left:auto">C</span></div>` : ''}</div>`,
      ).join('')}</div></div>`;
  };
  return `<div class="board">
    <div class="cols" style="position:sticky;top:0">${COLS.map(([s, l]) => {
      const n = ISSUES.filter((i) => i.s === s && i.e !== 'onb').length;
      return `<div class="colh">${stc(s)}<span>${l}</span><span class="n">${n}</span>${s === 'progress' ? '<span class="wip">3 / 3 WIP</span>' : ''}<span class="tools">${ic('plus', 15)}${ic('more', 15)}</span></div>`;
    }).join('')}</div>
    ${lane('auth')}${lane('billing')}
  </div>`;
}
function screenBoard(dark = false, extra = {}) {
  return frame({
    ...extra,
    dark,
    active: 'board',
    header: header({ crumbs: [projCrumb()], tabs: PROJECT_TABS, tab: 'board', right: `${presence}<span class="btn ghost icon">${ic('link', 16)}</span><span class="btn ghost icon">${ic('more', 16)}</span>` }),
    body: sprintStrip() + toolbar() + boardBody({ hover: 'PLT-218', add: 'authtodo' }),
  });
}

/* Backlog with the issue peek open */
function lrow(i, o = {}) {
  const x = issue(i);
  return `<div class="lrow ${o.sel ? 'sel' : ''} ${o.hover ? 'hover' : ''}" style="grid-template-columns:12px 16px 62px minmax(0,1fr) auto 16px 22px 20px">
    <span style="color:var(--tx-3);opacity:${o.hover ? 1 : 0}">${ic('grip', 12)}</span>${ty(x.ty)}<span class="mono muted">${x.k}</span>
    <span class="row" style="gap:8px;min-width:0"><span class="trunc" style="font-weight:450">${x.t}</span>${x.blocked ? `<span style="color:var(--red)">${ic('lock', 12, 2.2)}</span>` : ''}</span>
    <span class="row" style="gap:10px">${o.epic !== false ? `<span style="width:116px">${ep(x.e)}</span>` : ''}${stc(x.s)}</span>${pr(x.p)}<span class="pts">${x.pts}</span>${av(x.a)}</div>`;
}
function peek(k) {
  const x = issue(k);
  const prop = (l, v) => `<div class="prop"><span>${l}</span><span class="v">${v}</span></div>`;
  return `<aside class="panel" style="width:390px;flex:none">
    <div class="row" style="height:46px;padding:0 12px 0 20px;gap:8px;border-bottom:1px solid var(--line)">${ty(x.ty)}<span class="mono muted">${x.k}</span><span class="grow"></span><span class="btn ghost icon sm">${ic('up', 15)}</span><span class="btn ghost icon sm">${ic('down', 15)}</span><span class="btn ghost icon sm">${ic('expand', 14)}</span><span class="btn ghost icon sm">${ic('x', 15)}</span></div>
    <div style="padding:18px 20px;overflow:hidden;display:flex;flex-direction:column;gap:14px">
      <h2 style="font-size:18px;font-weight:600;letter-spacing:-.01em;line-height:1.3">${x.t}</h2>
      <div class="row" style="gap:8px"><span class="btn sm" style="color:var(--prog)">${stc(x.s)}${STATUS[x.s].label}${ic('down', 13)}</span><span class="btn sm ghost">${ic('arrowR', 13)}Move to In review</span></div>
      <div style="display:flex;flex-direction:column">${prop('Assignee', av(x.a) + PEOPLE[x.a].n)}${prop('Priority', pr(x.p) + '<span style="text-transform:capitalize">' + x.p + '</span>')}${prop('Points', `<span class="pts">${x.pts}</span>`)}${prop('Sprint', ic('target', 14, 1.75, 'style="color:var(--tx-3)"') + 'Sprint 14')}${prop('Epic', ep(x.e))}${prop('Labels', (x.l || []).map(lb).join(''))}</div>
      <div style="border-top:1px solid var(--line);padding-top:14px"><div class="h-sec" style="margin-bottom:6px">Description</div><div class="muted">Add a description… <span class="kbd">/</span> for blocks</div></div>
      <div style="border-top:1px solid var(--line);padding-top:14px"><div class="h-sec" style="margin-bottom:10px">Activity</div>
        <div class="row" style="gap:8px;font-size:12.5px">${av('RS', 18)}<span><b style="font-weight:550">Rohan S.</b> <span class="muted">moved to</span> ${stc('progress', 12)} In progress <span class="muted">· 2h</span></span></div>
        <div class="row" style="gap:8px;font-size:12.5px;margin-top:8px">${av('RS', 18)}<span><b style="font-weight:550">Rohan S.</b> <span class="muted">created the issue · Sep 20</span></span></div></div>
    </div>
    <div style="margin-top:auto;padding:12px 20px;border-top:1px solid var(--line)"><div class="input">${av('RS', 18)}<span class="grow">Leave a comment…</span><span class="kbd">M</span></div></div>
  </aside>`;
}
function screenBacklog() {
  const sprint = ISSUES.filter((i) => i.e !== 'onb');
  const epics = Object.entries(EPICS)
    .map(
      ([k, e], idx) =>
        `<div style="padding:10px 12px;border-radius:8px;${idx === 1 ? 'background:var(--card);box-shadow:var(--e1)' : ''}"><div class="row" style="gap:8px"><i style="width:10px;height:10px;border-radius:3px;background:${e.c}"></i><b style="font-weight:550" class="grow trunc">${e.n}</b><span class="muted" style="font-size:11.5px">${Math.round(e.p * 100)}%</span></div><div class="bar" style="width:100%;margin-top:8px"><i style="width:${e.p * 100}%;background:${e.c}"></i></div></div>`,
    )
    .join('');
  return frame({
    active: 'backlog',
    header: header({ crumbs: [projCrumb()], tabs: PROJECT_TABS, tab: 'backlog', right: `${presence}<span class="btn">${ic('plus', 15)}Create sprint</span><span class="btn ghost icon">${ic('more', 16)}</span>` }),
    body: `${toolbar({ groups: ['Sprint', 'Epic', 'None'], extra: '' })}
      <div style="display:flex;flex:1;min-height:0">
        <div style="width:190px;flex:none;border-right:1px solid var(--line);padding:12px 10px;background:var(--sunken)"><div class="row" style="padding:0 4px 8px"><span class="h-sec grow">Epics</span><span class="muted">${ic('plus', 15)}</span></div><div style="display:flex;flex-direction:column;gap:4px">${epics}</div></div>
        <div style="flex:1;min-width:0;overflow:hidden">
          <div class="grp" style="border-top:0">${ic('down', 14, 2, 'style="color:var(--tx-3)"')}${ic('target', 15, 1.75, 'style="color:var(--acc)"')}<span>Sprint 14</span><span class="chip acc" style="height:18px">Active</span><span class="muted" style="font-weight:400">${sprint.length} issues</span>
            <span style="margin-left:auto;display:flex;gap:10px;align-items:center;font-weight:400"><span class="bar" style="width:90px;display:flex"><i style="width:19%;background:var(--done);border-radius:0"></i><i style="width:23%;background:var(--prog);border-radius:0"></i></span><span class="muted">9 / 48 pts</span><span class="btn sm">Complete</span></span></div>
          ${sprint.slice(0, 12).map((i) => lrow(i.k, { sel: i.k === 'PLT-228', hover: i.k === 'PLT-204', epic: false })).join('')}
          <div class="lrow" style="grid-template-columns:auto;color:var(--tx-3)"><span class="row" style="gap:8px">${ic('plus', 14)}Create issue</span></div>
          <div class="grp">${ic('right', 14, 2, 'style="color:var(--tx-3)"')}${ic('backlog', 15, 1.75, 'style="color:var(--tx-3)"')}<span>Backlog</span><span class="muted" style="font-weight:400">16 issues</span></div>
        </div>
        ${peek('PLT-228')}
      </div>`,
  });
}

/* Issue page */
function screenIssue() {
  const x = issue('PLT-228');
  const prop = (l, v) => `<div class="prop"><span>${l}</span><span class="v">${v}</span></div>`;
  const group = (t, rows) => `<div style="padding:14px 0;border-top:1px solid var(--line)"><div class="muted" style="font-size:11.5px;font-weight:600;margin-bottom:4px">${t}</div>${rows}</div>`;
  return frame({
    active: 'list',
    header: header({ crumbs: [projCrumb(), { icon: `<i style="width:9px;height:9px;border-radius:2.5px;background:${EPICS.billing.c}"></i>`, t: 'Billing v2' }, { icon: ty('story'), t: '<span class="mono" style="font-size:12.5px">PLT-228</span>' }], right: `<span class="muted" style="font-size:12px">4 of 23</span><span class="btn ghost icon sm">${ic('up', 15)}</span><span class="btn ghost icon sm">${ic('down', 15)}</span><span class="vdiv"></span>${presence}<span class="btn ghost">${ic('eye', 15)}Watch</span><span class="btn ghost icon">${ic('link', 15)}</span><span class="btn ghost icon">${ic('more', 16)}</span>` }),
    body: `<div style="display:grid;grid-template-columns:1fr 330px;flex:1;min-height:0">
      <div style="padding:36px 56px 0 64px;overflow:hidden"><div style="max-width:720px">
        <h1 style="font-size:26px;font-weight:600;letter-spacing:-.02em;line-height:1.25">${x.t}</h1>
        <div class="row" style="gap:4px;margin:12px 0 22px;margin-left:-8px"><span class="btn ghost sm">${ic('sub', 14)}Add sub-issue</span><span class="btn ghost sm">${ic('link', 14)}Link</span><span class="btn ghost sm">${ic('clip', 14)}Attach</span></div>
        <div style="color:var(--tx-3);font-size:14px;line-height:1.6;padding:2px 0 18px">Describe the problem, the context and what done looks like…<div style="margin-top:10px;display:flex;gap:6px;font-size:12px"><span class="kbd">/</span><span>for headings, checklists, code, tables and issue embeds</span></div></div>
        <div style="border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin-bottom:28px"><div class="row" style="gap:8px"><span style="color:var(--tx-3)">${ic('checklist', 15)}</span><b class="h-sec">Acceptance criteria</b><span class="chip neutral" style="height:18px">0 / 0</span><span class="grow"></span><span class="btn ghost sm">${ic('plus', 13)}Add</span></div><div class="muted" style="margin:6px 0 0 23px">Checks the reviewer ticks before this can move to Done.</div></div>
        <div class="row" style="margin-bottom:12px"><b style="font-size:14px;font-weight:600" class="grow">Activity</b><span class="seg"><span class="on">All</span><span>Comments</span><span>History</span><span>Work log</span></span></div>
        <div style="display:flex;flex-direction:column;gap:14px;padding-left:2px">
          <div class="row" style="gap:10px">${av('RS', 22)}<span><b style="font-weight:550">Rohan S.</b> <span class="muted">moved from</span> ${stc('todo', 12)} To do <span class="muted">to</span> ${stc('progress', 12)} In progress</span><span class="muted" style="margin-left:auto">2h ago</span></div>
          <div class="row" style="gap:10px">${av('RS', 22)}<span><b style="font-weight:550">Rohan S.</b> <span class="muted">added to</span> ${ic('target', 13, 1.75, 'style="display:inline;color:var(--tx-3)"')} Sprint 14</span><span class="muted" style="margin-left:auto">Sep 23</span></div>
          <div class="row" style="gap:10px">${av('RS', 22)}<span><b style="font-weight:550">Rohan S.</b> <span class="muted">created the issue</span></span><span class="muted" style="margin-left:auto">Sep 20</span></div>
          <div class="input" style="height:auto;padding:10px 12px;align-items:flex-start;margin-top:4px">${av('RS', 22)}<div class="grow" style="padding-top:2px">Leave a comment… <span class="muted">@ to mention, / for blocks</span><div class="row" style="gap:10px;margin-top:22px;color:var(--tx-3)">${ic('bold', 14)}${ic('ital', 14)}${ic('code', 14)}${ic('bullets', 14)}${ic('at', 14)}${ic('img', 14)}<span class="grow"></span><span class="btn sm primary">Comment</span></div></div></div>
        </div></div></div>
      <aside class="panel" style="padding:18px 20px;overflow:hidden">
        <div class="row" style="gap:8px;margin-bottom:12px"><span class="btn" style="color:var(--prog);flex:1;justify-content:flex-start">${stc('progress')}In progress<span class="grow"></span>${ic('down', 14)}</span></div>
        <div class="row" style="gap:6px;margin-bottom:6px"><span class="btn sm ghost" style="box-shadow:inset 0 0 0 1px var(--line)">${stc('review', 12)}In review</span><span class="btn sm ghost" style="box-shadow:inset 0 0 0 1px var(--line)">${stc('qa', 12)}QA</span></div>
        ${group('Properties', prop('Assignee', av('RS') + 'Rohan S.') + prop('Priority', pr('high') + 'High') + prop('Points', '<span class="pts">3</span>') + prop('Labels', lb('billing') + lb('api')))}
        ${group('Planning', prop('Sprint', ic('target', 14, 1.75, 'style="color:var(--tx-3)"') + 'Sprint 14') + prop('Epic', ep('billing')) + prop('Fix version', '<span class="muted">Add version</span>') + prop('Due date', '<span class="muted">Add date</span>'))}
        ${group('People', prop('Reporter', av('RS') + 'Rohan S.') + prop('Watchers', `${av('RS', 18)}<span class="muted">Only you</span>`))}
        <div class="muted" style="font-size:12px;border-top:1px solid var(--line);padding-top:12px">Created Sep 20 · Updated 2h ago</div>
      </aside></div>`,
  });
}

/* Home */
function screenHome() {
  const recent = [
    [ic('board', 16), 'Sprint 14 board', 'Platform Core · viewed 5m ago'],
    [ty('story'), 'PLT-228 Stripe webhook idempotency', 'In progress · edited 2h ago'],
    [ty('story'), 'PLT-204 Session store migration', 'Aisha asked for your review'],
    [ic('backlog', 16), 'Platform Core backlog', 'viewed yesterday'],
  ];
  const mine = ['PLT-228', 'PLT-209', 'PLT-197'];
  const inbox = [
    ['AK', 'requested your review', 'PLT-204', '3h'],
    ['JM', 'commented on', 'Auth service RFC', '5h'],
    ['PN', 'mentioned you in', 'PLT-218', '1d'],
    ['LT', 'moved', 'PLT-226', '1d'],
  ];
  return frame({
    active: 'home',
    header: header({ crumbs: [{ icon: ic('home', 15), t: 'Home' }], right: `<span class="btn ghost">${ic('sliders', 14)}Customize</span>` }),
    body: `<div style="padding:32px 64px;overflow:hidden"><div style="max-width:1040px;margin:0 auto">
      <h1 style="font-size:24px;font-weight:600;letter-spacing:-.02em">Good morning, Rohan</h1>
      <div class="muted" style="margin-top:2px">Saturday, Oct 10 · 2 issues need you today</div>
      <div class="h-sec" style="margin:26px 0 10px">Jump back in</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">${recent
        .map(
          ([i, t, s], idx) =>
            `<div class="card-s" style="padding:14px;${idx === 1 ? 'box-shadow:var(--e1h)' : ''}"><div class="row" style="gap:8px;color:var(--tx-2)">${i}</div><div style="font-weight:550;margin-top:12px" class="trunc">${t}</div><div class="muted trunc" style="font-size:12px;margin-top:2px">${s}</div></div>`,
        )
        .join('')}</div>
      <div style="display:grid;grid-template-columns:1.55fr 1fr;gap:20px;margin-top:28px">
        <div class="card-s" style="overflow:hidden"><div class="row" style="padding:10px 14px;gap:10px;border-bottom:1px solid var(--line)"><b class="h-sec">My issues</b><span class="seg"><span class="on">Assigned · 12</span><span>Created</span><span>Watching</span><span>Mentions</span></span></div>
          <div class="grp" style="border-top:0;height:30px;font-size:12px">${stc('progress', 12)}In progress<span class="muted" style="font-weight:400">1</span></div>${lrowHome('PLT-228')}
          <div class="grp" style="height:30px;font-size:12px">${stc('qa', 12)}QA<span class="muted" style="font-weight:400">1</span></div>${lrowHome('PLT-209')}
          <div class="grp" style="height:30px;font-size:12px">${stc('todo', 12)}To do<span class="muted" style="font-weight:400">3</span></div>${lrowHome('PLT-222')}${lrowHome('PLT-233')}
          <div class="grp" style="height:30px;font-size:12px">${stc('done', 12)}Done this week<span class="muted" style="font-weight:400">2</span></div>${lrowHome('PLT-197')}
        </div>
        <div style="display:flex;flex-direction:column;gap:20px">
          <div class="card-s"><div class="row" style="padding:10px 14px;border-bottom:1px solid var(--line)"><b class="h-sec grow">Inbox</b><span class="pill" style="font-size:10.5px;font-weight:600;color:#fff;background:var(--acc);border-radius:9px;padding:0 6px">4</span></div>
          ${inbox.map(([p, a, o, t], i) => `<div class="row" style="gap:10px;padding:9px 14px;border-bottom:1px solid var(--line-2)">${av(p, 22)}<div class="grow trunc" style="font-size:12.5px"><b style="font-weight:550">${PEOPLE[p].n}</b> <span class="muted">${a}</span> ${o}</div><span class="muted" style="font-size:11.5px">${t}</span>${i < 2 ? '<i style="width:6px;height:6px;border-radius:50%;background:var(--acc)"></i>' : '<i style="width:6px"></i>'}</div>`).join('')}</div>
          <div class="card-s" style="padding:14px"><div class="row" style="gap:8px">${pt('PLT', 18)}<b style="font-weight:600">Sprint 14</b><span class="chip warn">Ends today</span></div>
            <div class="row" style="gap:16px;margin-top:14px"><svg width="56" height="56" viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" fill="none" stroke="var(--line)" stroke-width="4"/><circle cx="18" cy="18" r="15" fill="none" stroke="var(--done)" stroke-width="4" stroke-dasharray="17.7 94.2" transform="rotate(-90 18 18)" stroke-linecap="round"/></svg>
            <div style="font-size:12.5px;line-height:1.7"><div><b>9</b> <span class="muted">of 48 points done</span></div><div><b>3</b> <span class="muted">issues in review</span></div><div style="color:var(--red)"><b>2</b> blocked</div></div></div></div>
        </div></div></div></div>`,
  });
}
function lrowHome(k) {
  const x = issue(k);
  return `<div class="lrow" style="grid-template-columns:16px 62px minmax(0,1fr) 16px 20px;padding:0 14px">${ty(x.ty)}<span class="mono muted">${x.k}</span><span class="trunc">${x.t}</span>${pr(x.p)}${av(x.a)}</div>`;
}

/* Projects */
function screenProjects() {
  const rows = Object.entries(PROJECTS)
    .map(
      ([k, p], i) => `<tr class="${i === 0 ? 'hover' : ''}">
      <td style="width:36px;color:${i < 2 ? '#E8A317' : 'var(--tx-3)'}">${ic('star', 15, 1.75, i < 2 ? 'fill="#E8A317"' : '')}</td>
      <td><div class="row" style="gap:10px">${pt(k, 28)}<div><div style="font-weight:550">${p.n}</div><div class="muted" style="font-size:12px">${p.d}</div></div></div></td>
      <td><span class="mono muted">${k}</span></td>
      <td><div class="row" style="gap:8px">${av(p.lead)}${PEOPLE[p.lead].n}</div></td>
      <td>${p.team ? `<span class="chip neutral">${ic('users', 12)}${p.team}</span>` : '<span class="muted">No team</span>'}</td>
      <td><span class="row" style="gap:6px">${ic(p.m === 'Scrum' ? 'target' : 'board', 14, 1.75, 'style="color:var(--tx-3)"')}${p.m}</span></td>
      <td>${p.m === 'Scrum' ? '<div class="row" style="gap:8px"><div class="bar" style="width:70px"><i style="width:19%;background:var(--done)"></i></div><span class="muted" style="font-size:12px">Sprint 14 · 19%</span></div>' : `<span class="muted" style="font-size:12px">${p.open} open</span>`}</td>
      <td class="muted">${['Thu', 'Aug 11', 'Yesterday'][i]}</td>
      <td style="width:40px;color:var(--tx-3)">${i === 0 ? ic('more', 16) : ''}</td></tr>`,
    )
    .join('');
  return frame({
    active: 'projects',
    header: header({ crumbs: [{ icon: mt('work', 16), t: 'Work' }, { t: 'Projects' }], right: `<span class="btn primary">${ic('plus', 15, 2)}New project</span>` }),
    body: `<div class="tool"><div class="tsearch">${ic('search', 14)}<span>Search projects…</span></div><span class="seg"><span class="on">All · 3</span><span>Starred · 2</span><span>Archived</span></span><div style="margin-left:auto" class="seg"><span class="on">${ic('list', 14)}</span><span>${ic('blocks', 14)}</span></div></div>
      <div style="padding:8px 24px"><table class="tbl"><thead><tr><th></th><th>Project</th><th>Key</th><th>Lead</th><th>Team</th><th>Method</th><th>Progress</th><th>Updated</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`,
  });
}

/* Project settings (Board) — settings sections are tabs inside the project, not another sidebar */
const SETTINGS_TABS = [
  ['general', 'gear', 'General'],
  ['members', 'users', 'Members'],
  ['types', 'layers', 'Issue types'],
  ['fields', 'list', 'Fields'],
  ['workflow', 'flow', 'Workflow'],
  ['board', 'board', 'Board'],
];
function screenProjectSettings() {
  const col = (s, l, statuses, wip) => `<div style="border:1px solid var(--line);border-radius:10px;background:var(--card);display:flex;flex-direction:column">
    <div class="row" style="gap:6px;padding:10px 10px 8px;white-space:nowrap">${stc(s)}<b style="font-weight:600">${l}</b><span class="grow"></span><span title="WIP limit" style="border:1px solid var(--line);border-radius:5px;padding:0 5px;font-size:11.5px;color:${wip ? 'var(--tx)' : 'var(--tx-3)'}">${wip ? '≤ ' + wip : 'No limit'}</span></div>
    <div style="padding:0 8px 8px;display:flex;flex-direction:column;gap:6px">${statuses.map(([k, n, c]) => `<div class="row" style="gap:7px;padding:6px 8px;border-radius:7px;background:var(--sunken);white-space:nowrap">${stc(k, 12)}<span class="grow trunc">${n}</span><span class="muted mono">${c}</span></div>`).join('')}
    <div style="border:1px dashed var(--line);border-radius:7px;padding:6px;text-align:center;color:var(--tx-3);font-size:12px">Drop a status</div></div></div>`;
  return frame({
    active: 'settings',
    header: header({ crumbs: [projCrumb(), { icon: ic('gear', 15), t: 'Settings' }], tabs: SETTINGS_TABS, tab: 'board' }),
    body: `<div style="display:grid;grid-template-columns:1fr 270px;flex:1;min-height:0"><div style="padding:28px 28px;overflow:hidden">
      <div class="row" style="gap:12px"><div class="grow"><h1 class="h-page">Board</h1><div class="sub" style="margin-top:4px">How the board looks for everyone on Platform Core. Filters and swimlanes people pick stay personal.</div></div><span class="btn ghost">Reset to default</span><span class="btn primary">Save changes</span></div>
      <div class="row" style="gap:8px;margin:16px 0 20px;padding:9px 12px;border-radius:8px;background:var(--acc-50);color:var(--tx-2);font-size:12.5px">${ic('layers', 15, 1.75, 'style="color:var(--acc)"')}<span>Based on <b style="color:var(--tx);font-weight:550">Software · Scrum</b>, with 5 changes for this project.</span><span style="color:var(--acc);font-weight:550;margin-left:auto">Compare</span></div>
      <div class="row" style="gap:10px;margin-bottom:14px"><span class="seg"><span class="on">Columns</span><span>Swimlanes</span><span>Quick filters</span><span>Card fields</span><span>Estimation</span></span></div>
      <div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px">
        ${col('todo', 'To do', [['backlog', 'Backlog', 0], ['todo', 'Selected', 16]])}
        ${col('progress', 'In progress', [['progress', 'In progress', 8]], 4)}
        ${col('review', 'In review', [['review', 'Code review', 3], ['review', 'Design review', 0]])}
        ${col('qa', 'QA', [['qa', 'Testing', 2]])}
        ${col('done', 'Done', [['done', 'Done', 7]])}
      </div>
      <div class="row" style="gap:8px;margin-top:14px;font-size:12.5px"><span class="muted">Not on the board:</span><span class="chip neutral">${stc('wont', 12)}Won't do</span><span class="chip neutral">${stc('wont', 12)}Duplicate</span><span class="muted" style="margin-left:auto">Statuses come from the <span style="color:var(--acc)">Workflow</span></span></div>
      <div style="margin-top:22px;border-top:1px solid var(--line)">${[
        ['Let members collapse columns', 'Personal to each member', true],
        ['Show issue count in column headers', '', true],
        ['Warn when a column is over its WIP limit', 'Shown in amber on the column header', true],
      ]
        .map(([t, d, on]) => `<div class="row" style="padding:12px 0;border-bottom:1px solid var(--line-2);gap:12px"><div class="grow"><div style="font-weight:500">${t}</div>${d ? `<div class="muted" style="font-size:12px">${d}</div>` : ''}</div><span class="toggle ${on ? '' : 'off'}"></span></div>`)
        .join('')}</div>
    </div>
    <aside class="panel" style="padding:20px;background:var(--sunken)"><div class="row"><b class="h-sec grow">Live preview</b><span style="color:var(--acc);font-weight:550">Open board</span></div>
      <div style="margin-top:12px;transform:scale(.32);transform-origin:top left;width:720px">${COLS.map(([s, l]) => `<div style="display:inline-block;width:136px;margin-right:8px;vertical-align:top"><div class="colh" style="font-size:14px">${stc(s)}${l}</div>${ISSUES.filter((i) => i.s === s && i.e === 'auth').slice(0, 2).map((i) => card(i.k)).join('<div style="height:8px"></div>')}</div>`).join('')}</div>
      <div class="muted" style="font-size:12px;margin-top:-215px">5 columns · swimlanes by epic · story points</div></aside></div>`,
  });
}
function screenMembers() {
  const rows = ['AK', 'JM', 'PN', 'RS']
    .map(
      (p, i) => `<tr><td><div class="row" style="gap:10px">${av(p, 28)}<div><div style="font-weight:550">${PEOPLE[p].n}${p === 'RS' ? ' <span class="chip neutral" style="height:17px;font-size:10.5px">You</span>' : ''}</div><div class="muted" style="font-size:12px">${PEOPLE[p].n.split(' ')[0].toLowerCase()}@acmelabs.dev</div></div></div></td>
      <td><span class="btn ghost sm" style="box-shadow:inset 0 0 0 1px var(--line)">${p === 'RS' ? 'Project admin' : 'Member'}${ic('down', 13)}</span></td><td class="muted">${['Platform', 'Mobile', 'Platform', 'Growth'][i]}</td><td class="muted">${p === 'RS' ? '14 days ago' : '12 days ago'}</td><td style="width:40px;color:var(--tx-3)">${ic('more', 16)}</td></tr>`,
    )
    .join('');
  return frame({
    active: 'settings',
    header: header({ crumbs: [projCrumb(), { icon: ic('gear', 15), t: 'Settings' }], tabs: SETTINGS_TABS, tab: 'members' }),
    body: `<div style="padding:28px 32px"><div class="row" style="gap:12px"><div class="grow"><h1 class="h-page">Members</h1><div class="sub" style="margin-top:4px">Everyone here can open Platform Core. Their project role decides what they can change.</div></div><span class="btn primary">${ic('plus', 15, 2)}Add people</span></div>
      <div class="row" style="gap:8px;margin:18px 0 6px"><div class="tsearch" style="box-shadow:var(--e1);background:var(--card);width:260px;height:30px">${ic('search', 14)}<span>Search members…</span></div><span class="seg"><span class="on">All · 4</span><span>Admins · 1</span><span>Invited</span></span></div>
      <table class="tbl"><thead><tr><th>Person</th><th>Project role</th><th>Team</th><th>Added</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`,
  });
}

/* Workspace settings — same sidebar component, its contents swap to settings */
function screenTeams() {
  const teams = [
    ['Platform', '#2356C9', 'PN', 14, ['RS', 'PN', 'AK', 'JM'], 'PLT', 'Member'],
    ['Mobile', '#0E9BB0', 'JM', 6, ['JM', 'DP'], 'MOB', 'Member'],
    ['Growth', '#D46A2E', 'RS', 5, ['RS', 'LT'], '—', 'Member'],
    ['Design', '#C2536A', 'LT', 4, ['LT'], '—', 'Member'],
    ['People ops', '#8B62D0', 'MK', 3, ['MK'], '—', 'Member'],
    ['Leadership', '#4B5264', 'RS', 4, ['RS', 'PN'], '—', 'Viewer'],
  ];
  return frame({
    settingsNav: true,
    active: 'teams',
    header: header({ crumbs: [{ icon: ic('gear', 15), t: 'Settings' }, { t: 'People' }, { t: 'Teams' }], right: `<span class="btn primary">${ic('plus', 15, 2)}New team</span>` }),
    body: `<div style="padding:28px 32px;overflow:hidden"><div style="max-width:960px"><h1 class="h-page">Teams</h1><div class="sub" style="margin-top:4px">Teams own projects and doc spaces. A person can be in several.</div>
      <table class="tbl" style="margin-top:18px"><thead><tr><th>Team</th><th>Lead</th><th>Members</th><th>Projects</th><th>Default role</th><th></th></tr></thead><tbody>${teams
        .map(
          ([n, c, lead, cnt, f, pj, role], i) =>
            `<tr class="${i === 0 ? 'hover' : ''}"><td><div class="row" style="gap:10px"><span class="tile" style="width:26px;height:26px;border-radius:7px;background:${c};font-size:12px">${n[0]}</span><b style="font-weight:550">${n}</b></div></td><td><div class="row" style="gap:8px">${av(lead)}${PEOPLE[lead].n}</div></td><td><div class="row" style="gap:8px"><div class="facepile">${f.map((x) => av(x, 20)).join('')}</div><span class="muted">${cnt}</span></div></td><td>${pj === '—' ? '<span class="muted">None</span>' : `<span class="row" style="gap:6px">${pt(pj, 16)}${PROJECTS[pj].n}</span>`}</td><td>${role}</td><td style="width:40px;color:var(--tx-3)">${i === 0 ? ic('more', 16) : ''}</td></tr>`,
        )
        .join('')}</tbody></table></div></div>`,
  });
}

/* Inbox: a two-pane triage view */
function screenInbox() {
  const items = [
    ['AK', 'requested your review', 'PLT-204', 'Session store migration to Postgres', 'Backfill finished on staging, 0 mismatches across 2.1M rows.', '3h', true, 'Today'],
    ['JM', 'commented on', 'RFC', 'Auth service RFC', 'Rollback section says 15 min but the flag TTL is 30. Which is it?', '5h', true, ''],
    ['PN', 'mentioned you in', 'PLT-218', 'Rotate service tokens on every deploy', '@Rohan can you confirm the deploy hook fires before the health check?', '1d', false, 'Yesterday'],
    ['LT', 'moved', 'PLT-226', 'Refresh token reused after logout on Safari', 'In progress → In review', '1d', false, ''],
  ];
  return frame({
    active: 'inbox',
    header: header({ crumbs: [{ icon: ic('inbox', 15), t: 'Inbox' }], right: `<span class="seg"><span class="on">All · 4</span><span>Mentions</span><span>Reviews</span><span>Assigned</span></span><span class="btn ghost">${ic('check', 14)}Mark all read</span><span class="btn ghost icon">${ic('sliders', 15)}</span>` }),
    body: `<div style="display:grid;grid-template-columns:440px 1fr;flex:1;min-height:0">
      <div style="border-right:1px solid var(--line);overflow:hidden">${items
        .map(
          ([p, a, k, t, b, time, unread, g], i) =>
            `${g ? `<div class="muted" style="font-size:11.5px;font-weight:600;padding:14px 18px 6px">${g}</div>` : ''}<div style="display:grid;grid-template-columns:28px 1fr auto;gap:10px;padding:10px 18px;${i === 0 ? 'background:var(--acc-50);box-shadow:inset 2px 0 0 var(--acc)' : ''}">${av(p, 26)}<div style="min-width:0"><div class="trunc" style="font-size:12.5px"><b style="font-weight:550">${PEOPLE[p].n}</b> <span class="muted">${a}</span></div><div class="row trunc" style="gap:6px;font-weight:550;margin-top:2px">${k === 'RFC' ? `<span style="color:${MODULES.docs.c}">${ic('doc', 14)}</span>` : ty(issue(k) ? issue(k).ty : 'task', 14)}<span class="trunc">${t}</span></div><div class="muted trunc" style="font-size:12.5px;margin-top:2px">${b}</div></div><div style="text-align:right"><div class="muted" style="font-size:11.5px">${time}</div>${unread ? '<i style="display:inline-block;margin-top:8px;width:7px;height:7px;border-radius:50%;background:var(--acc)"></i>' : ''}</div></div>`,
        )
        .join('')}</div>
      <div style="padding:24px 36px;overflow:hidden"><div class="row" style="gap:8px">${ty('story')}<span class="mono muted">PLT-204</span><span class="chip acc">Review requested</span><span class="grow"></span><span class="btn">${ic('snooze', 14)}Snooze</span><span class="btn">${ic('archive', 14)}Done</span><span class="btn primary">Open issue</span></div>
        <h2 style="font-size:20px;font-weight:600;letter-spacing:-.015em;margin-top:14px">Session store migration to Postgres</h2>
        <div class="row" style="gap:16px;margin-top:10px;color:var(--tx-2)"><span class="st">${stc('review')}In review</span><span class="row" style="gap:6px">${pr('urgent')}Urgent</span><span class="row" style="gap:6px">${av('AK')}Aisha K.</span><span class="row" style="gap:6px">${ep('auth')}</span></div>
        <div class="card-s" style="padding:14px 16px;margin-top:22px"><div class="row" style="gap:10px">${av('AK', 24)}<b style="font-weight:550">Aisha K.</b><span class="muted">requested your review · 3h ago</span></div><div style="margin:10px 0 0 34px;font-size:14px;line-height:1.55">Backfill finished on staging, 0 mismatches across 2.1M rows. Ready for your review before we flip the read path.</div>
          <div class="row" style="gap:8px;margin:14px 0 0 34px"><span class="btn sm primary">${ic('check', 13, 2)}Approve</span><span class="btn sm">Request changes</span><span class="btn sm ghost">Reply</span></div></div>
      </div></div>`,
  });
}

/* Create issue: opens in place over the page you are on */
function screenCreate() {
  const chip = (i, t, muted) => `<span class="btn sm" style="${muted ? 'color:var(--tx-3)' : ''}">${i}${t}</span>`;
  const modal = `<div class="scrim"></div><div class="px" style="position:absolute;left:50%;top:96px;transform:translateX(-50%);width:720px;background:var(--card);border-radius:14px;box-shadow:var(--e3);overflow:hidden">
    <div class="row" style="gap:6px;padding:14px 16px 0"><span class="btn sm ghost" style="box-shadow:inset 0 0 0 1px var(--line)">${pt('PLT', 16)}Platform Core${ic('down', 12)}</span><span class="muted">›</span><span class="btn sm ghost" style="box-shadow:inset 0 0 0 1px var(--line)">${ty('story')}Story${ic('down', 12)}</span><span class="muted" style="margin-left:6px">New issue</span><span class="grow"></span><span class="btn ghost icon sm">${ic('expand', 14)}</span><span class="btn ghost icon sm">${ic('x', 15)}</span></div>
    <div style="padding:16px 20px 4px"><div style="font-size:20px;font-weight:600;letter-spacing:-.015em;color:var(--tx-3)">Issue title</div>
      <div style="font-size:14px;color:var(--tx-3);margin-top:10px;line-height:1.6;min-height:84px">Add a description, or press <span class="kbd">/</span> for blocks…</div>
      <div style="border:1px solid var(--line);border-radius:9px;padding:10px 12px;margin:8px 0 12px"><div class="row" style="gap:8px"><span style="color:var(--tx-3)">${ic('checklist', 14)}</span><b style="font-weight:550">Acceptance criteria</b><span class="chip warn" style="height:17px;font-size:10.5px">Required for stories</span><span class="grow"></span><span class="muted">${ic('plus', 14)}</span></div><div class="muted" style="margin:6px 0 0 22px">Add the first check…</div></div>
    </div>
    <div class="row" style="gap:6px;padding:0 20px 16px;flex-wrap:wrap">${chip(stc('todo'), 'To do')}${chip(pr('medium'), 'Medium')}${chip(av(null, 16), 'Assignee', true)}${chip(ic('tag', 14), 'Labels', true)}${chip(ic('target', 14), 'Sprint 14')}${chip(`<span class="pts" style="height:16px">–</span>`, 'Points', true)}${chip('<i style="width:9px;height:9px;border-radius:2.5px;background:#2356C9"></i>', 'Auth service')}${chip(ic('more', 14), '', true)}</div>
    <div class="row" style="gap:10px;padding:12px 16px;border-top:1px solid var(--line);background:var(--sunken)"><span style="color:var(--tx-3)">${ic('clip', 15)}</span><span class="grow"></span><span class="row" style="gap:8px;color:var(--tx-2)"><span class="toggle off"></span>Create another</span><span class="btn ghost">Cancel</span><span class="btn primary">Create issue <span class="kbd" style="background:transparent;color:#fff;border-color:rgba(255,255,255,.35)">⌘↵</span></span></div>
  </div>`;
  return frame({
    active: 'board',
    header: header({ crumbs: [projCrumb()], tabs: PROJECT_TABS, tab: 'board', right: `${presence}<span class="btn ghost icon">${ic('more', 16)}</span>` }),
    body: sprintStrip() + toolbar() + boardBody(),
    overlay: modal,
  });
}

/* Command palette with recents, context actions and real icons */
function screenPalette() {
  const row = (i, t, meta, on, kb) => `<div class="row" style="gap:10px;height:38px;padding:0 14px;border-radius:8px;${on ? 'background:var(--hover)' : ''}"><span style="color:var(--tx-2);width:18px;display:grid;place-items:center">${i}</span><span class="grow trunc">${t}</span>${meta ? `<span class="muted" style="font-size:12px">${meta}</span>` : ''}${kb ? `<span class="kbar">${kb.map((k) => `<span class="kbd">${k}</span>`).join('')}</span>` : ''}</div>`;
  const sec = (t) => `<div class="muted" style="font-size:11.5px;font-weight:600;padding:10px 14px 4px">${t}</div>`;
  const pal = `<div class="scrim"></div><div class="px" style="position:absolute;left:50%;top:110px;transform:translateX(-50%);width:660px;background:var(--card);border-radius:14px;box-shadow:var(--e3);overflow:hidden">
    <div class="row" style="gap:10px;height:54px;padding:0 18px;border-bottom:1px solid var(--line)"><span class="muted">${ic('search', 18)}</span><span style="font-size:15px;color:var(--tx-3)" class="grow">Search or run a command…</span><span class="kbd">Esc</span></div>
    <div style="padding:6px">${sec('Recent')}${row(ty('story'), '<span class="mono muted">PLT-228</span>&nbsp; Stripe webhook idempotency', stc('progress', 12), true)}${row(ty('story'), '<span class="mono muted">PLT-204</span>&nbsp; Session store migration to Postgres', stc('review', 12))}${row(ic('board', 16), 'Platform Core · Board', 'Work')}
    ${sec('Actions')}${row(ic('plus', 16), 'New issue', '', false, ['C'])}${row(ic('me', 16), 'Assign PLT-228 to me', '', false, ['I'])}${row(stc('progress'), 'Change status of PLT-228…', '', false, ['S'])}${row(ic('backlog', 16), 'Go to backlog', '', false, ['G', 'B'])}
    ${sec('Settings')}${row(ic('users', 16), 'Teams', 'People')}${row(ic('palette', 16), 'Appearance', 'Workspace')}</div>
    <div class="row" style="gap:14px;height:38px;padding:0 16px;border-top:1px solid var(--line);background:var(--sunken);font-size:12px;color:var(--tx-3)"><span class="row" style="gap:5px"><span class="kbd">↑↓</span>move</span><span class="row" style="gap:5px"><span class="kbd">↵</span>open</span><span class="row" style="gap:5px"><span class="kbd">Tab</span>filter by type</span><span class="grow"></span><span class="row" style="gap:5px"><span class="kbd">?</span>all shortcuts</span></div></div>`;
  return frame({
    active: 'board',
    header: header({ crumbs: [projCrumb()], tabs: PROJECT_TABS, tab: 'board', right: presence }),
    body: sprintStrip() + toolbar() + boardBody(),
    overlay: pal,
  });
}

/* Phone: one column at a time, a bottom bar, nothing overflows */
function screenMobile() {
  const items = ISSUES.filter((i) => i.s === 'progress' || i.s === 'review').slice(0, 4);
  return `<div class="px" style="width:390px;height:844px;display:flex;flex-direction:column;overflow:hidden;position:relative">
    <div class="row" style="height:52px;padding:0 14px;gap:10px;border-bottom:1px solid var(--line)"><span>${ic('menu', 20)}</span>${pt('PLT', 22)}<b style="font-size:15px;font-weight:600" class="grow">Platform Core</b><span style="color:var(--tx-2)">${ic('search', 19)}</span>${av('RS', 26)}</div>
    <div style="padding:12px 16px 10px;border-bottom:1px solid var(--line)"><div class="row" style="gap:8px"><b style="font-size:17px;font-weight:600">Sprint 14</b><span class="chip warn">Ends today</span></div><div class="row" style="gap:10px;margin-top:8px"><div class="bar" style="flex:1;display:flex"><i style="width:19%;background:var(--done);border-radius:0"></i><i style="width:23%;background:var(--prog);border-radius:0"></i></div><span class="muted" style="font-size:12px">9 / 48 pts</span></div></div>
    <div class="row" style="gap:6px;padding:10px 16px;overflow:hidden;border-bottom:1px solid var(--line)">${COLS.map(([s, l], i) => `<span class="btn sm ${i === 1 ? '' : 'ghost'}" style="${i === 1 ? 'background:var(--acc-50);color:var(--acc);box-shadow:none' : ''}">${stc(s, 12)}${l}</span>`).join('')}</div>
    <div style="flex:1;background:var(--sunken);padding:12px 14px;display:flex;flex-direction:column;gap:10px;overflow:hidden">${items.map((i) => card(i.k)).join('')}</div>
    <div class="row" style="height:64px;border-top:1px solid var(--line);justify-content:space-around;padding-bottom:10px;background:var(--canvas)">${[
      ['home', 'Home'],
      ['inbox', 'Inbox'],
      ['plus', ''],
      ['me', 'My issues'],
      ['board', 'Board'],
    ]
      .map(([i, l], idx) => (idx === 2 ? `<span class="new-btn" style="width:42px;height:42px;border-radius:12px">${ic('plus', 20, 2.2)}</span>` : `<span style="display:grid;justify-items:center;gap:2px;font-size:10.5px;color:${idx === 4 ? 'var(--acc)' : 'var(--tx-3)'}">${ic(i, 20)}${l}</span>`))
      .join('')}</div></div>`;
}
