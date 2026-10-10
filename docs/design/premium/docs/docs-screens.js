/* ───────── Proposed Docs screens, all inside the same 1440 × 900 frame and the same sidebar ───────── */
const JM_C = '#2F9E6E';
const PN_C = '#D46A2E';

function propsRow(o = {}) {
  const c = (inner, hover) => `<span class="d-prop ${hover ? 'hover' : ''}">${inner}</span>`;
  return `<div class="d-props">
    ${c(pst(o.status || 'review', 14), o.hoverProp === 'status')}
    ${c(`${av('AK', 18)}<span>Aisha K.</span>`)}
    ${c(`<span class="k">Reviewers</span><span class="facepile">${av('JM', 18)}${av('PN', 18)}</span>`)}
    ${c(`${lb('auth')}${lb('infra')}`)}
    ${c(`<span class="k">Edited</span><span>45m ago</span>`)}
    ${c(`<span class="k">6 min read</span>`)}
    ${o.addProp ? c(`<span class="k row" style="gap:4px">${ic('plus', 13)}Add property</span>`, true) : ''}
  </div>`;
}
function rfcProse(o = {}) {
  const chlA = `<span class="d-chl ${o.activeThread === 'a' ? 'on' : ''}">Remove the legacy cookie path</span>`;
  const chlB = `<span class="d-chl ${o.activeThread === 'b' ? 'on' : ''}">stay valid for 15 minutes</span>`;
  return `<div class="d-prose">
    <h2 style="margin-top:0">Context</h2>
    <p>We’re moving session handling out of the monolith into a standalone auth service. Sessions live in a Redis cluster with no durability guarantee; evictions under memory pressure have logged users out twice this quarter (see <span class="d-a">${pg('pm1', 14)} Postmortem: checkout outage</span>).</p>
    <h2>Migration order</h2>
    <ol>
      <li>Dual-write sessions to Redis and Postgres ${ich('PLT-204', { w: o.chipW || 190 })}</li>
      <li>Switch reads behind <span class="d-code">auth_pg_sessions</span> ${ich('PLT-218', { w: o.chipW2 || 150 })}</li>
      <li>Rate-limit the refresh endpoint before GA ${ich('PLT-222', { w: 130 })}</li>
      <li>${chlA}</li>
    </ol>
    <h2>Rollback</h2>
    <p>If error rates exceed 0.5% after cutover,${o.peer ? caret('Jonas M.', JM_C) : ''} flip <span class="d-code">auth_pg_sessions</span> off. Sessions issued by the new service ${chlB}, so users aren’t logged out.</p>
    <p>Redis stays warm for 7 days after cutover. On-call follows the <span class="d-a">${pg('runbook', 14)} Auth service runbook</span>.</p>
  </div>`;
}
/* The editor page, reading */
function pageBody(o = {}) {
  const colLeft = o.rail ? 90 : 250;
  return `<div class="d-scroll" style="${o.rail ? 'margin-right:0' : ''}">
    ${o.noCover ? '<div style="height:40px"></div>' : cover('#5B7BE5', o.dark)}
    <div class="d-col" style="margin:${o.noCover ? 0 : -30}px 0 0 ${colLeft}px">
      <div class="d-icon">${ic('flag', 30, 1.75, 'style="color:#6E56CF"')}</div>
      <div class="d-title" style="margin-top:16px">RFC: Move sessions to Postgres</div>
      ${propsRow(o)}
      <div class="d-rule"></div>
      ${o.prose || rfcProse(o)}
      ${o.inCol || ''}
    </div>
    ${o.rail ? '' : toc(o.tocOn ?? 1, 190, 1036)}
    ${o.markers === false ? '' : o.rail ? '' : cmk('JM', 1, o.mkA ?? 570, 962) + cmk('PN', 2, o.mkB ?? 681, 962)}
    ${o.extra || ''}
  </div>`;
}
function screenDocPage(dark = false) {
  return dframe({
    dark,
    page: 'rfc',
    header: pageHeader({}),
    body: pageBody({ dark, peer: true }),
  });
}

/* Writing: the slash menu, the header fades while typing */
function slashMenu(top, left) {
  const row = (i, l, d, k, on, ai) => `<div class="d-sl ${on ? 'on' : ''} ${ai ? 'ai' : ''}"><span class="ti">${ic(i, 17)}</span><span style="min-width:0"><div class="l">${l}</div><div class="d trunc">${d}</div></span>${k ? `<span class="kbd">${k}</span>` : '<span></span>'}</div>`;
  return `<div class="d-pop" style="top:${top}px;left:${left}px;width:372px;padding:6px">
    <div class="d-grp">Basic blocks</div>
    ${row('text', 'Text', 'Just start writing', '', true)}
    ${row('h2', 'Heading', 'A section title, in the outline', '##')}
    ${row('bullets', 'Bulleted list', 'A simple list', '-')}
    ${row('checklist', 'To-do list', 'Checkboxes people can tick', '[]')}
    <div class="d-grp">Insert</div>
    ${row('table', 'Table', 'Rows and columns', '')}
    ${row('callout', 'Callout', 'Make a note stand out', '')}
    ${row('code', 'Code block', 'With a language and copy', '```')}
    <div class="d-grp">From Work</div>
    ${row('link', 'Issue', 'Embed a live issue', '#')}
    <div class="row" style="gap:12px;height:34px;padding:0 10px;margin:4px -6px -6px;border-top:1px solid var(--line);font-size:11.5px;color:var(--tx-3);border-radius:0 0 11px 11px;background:var(--sunken)"><span class="d-kh"><span class="kbd">↑↓</span>move</span><span class="d-kh"><span class="kbd">↵</span>insert</span><span class="d-kh"><span class="kbd">Esc</span>close</span><span class="grow"></span><span>17 blocks</span></div>
  </div>`;
}
function screenSlash() {
  const prose = `<div class="d-prose">
    <h2 style="margin-top:0">Rollback</h2>
    <p>If error rates exceed 0.5% after cutover, flip <span class="d-code">auth_pg_sessions</span> off. Sessions issued by the new service <span class="d-chl">stay valid for 15 minutes</span>, so users aren’t logged out.</p>
    <p>Redis stays warm for 7 days after cutover. On-call follows the <span class="d-a">${pg('runbook', 14)} Auth service runbook</span>.${caret('Jonas M.', JM_C)}</p>
    <h2>Decision</h2>
    <p style="margin-bottom:4px">We keep the 30 minute TTL and update the rollback section to match.</p>
    <p><span class="d-handle" style="top:1px"><span>${ic('plus', 15)}</span><span class="on">${ic('grip', 14)}</span></span>/<span class="d-mycaret"></span></p>
  </div>`;
  return dframe({
    page: 'rfc',
    header: pageHeader({ quiet: true }),
    body: `<div class="d-scroll"><div class="d-col" style="margin:34px 0 0 250px">${prose}${slashMenu(252, -6)}</div><div style="opacity:.35">${toc(2, 34, 1036)}</div></div>`,
  });
}

/* Formatting: the selection bubble, block handles, a code block with its language */
function bubble(top, left, o = {}) {
  return `<div class="d-pop" style="top:${top}px;left:${left}px"><div class="d-bub">
    <span style="color:var(--tx);font-weight:500">${ic('text', 15)}Text${ic('down', 12)}</span><span class="dv"></span>
    <span class="on" title="Bold (⌘B)">${ic('bold', 15, 2)}</span><span title="Italic (⌘I)">${ic('ital', 15)}</span><span title="Strikethrough (⌘⇧X)">${ic('strike', 15)}</span><span title="Code (⌘E)">${ic('code', 15)}</span><span title="Link (⌘K)">${ic('link', 15)}</span><span title="Highlight (⌘⇧H)">${ic('hl', 15)}</span><span class="dv"></span>
    <span title="Comment (⌘⌥M)">${ic('msg', 15)}Comment</span>
    ${o.ai ? `<span class="dv"></span><span class="ai">${ic('spark', 15)}Ask AI</span>` : ''}
  </div></div>`;
}
function screenFormat() {
  const prose = `<div class="d-prose">
    <h2 style="margin-top:0">Rollback</h2>
    <p>If error rates exceed 0.5% after cutover, flip <span class="d-code">auth_pg_sessions</span> off. Sessions issued by the new service <span class="d-chl">stay valid for 15 minutes</span>, so users aren’t logged out.</p>
    <p><span class="d-handle"><span>${ic('plus', 15)}</span><span class="on">${ic('grip', 14)}</span></span><b><span class="d-sel">Redis stays warm for 7 days</span></b><span class="d-sel"> after cutover</span>. On-call follows the <span class="d-a">${pg('runbook', 14)} Auth service runbook</span>.</p>
    <h3>Backfill</h3>
    <p>Re-run the backfill once the flag has been off for 24 hours with error rates back under 0.1%:</p>
    <div style="border-radius:10px;box-shadow:inset 0 0 0 1px var(--line);background:var(--sunken);margin:0 0 14px;overflow:hidden">
      <div class="row" style="gap:8px;height:36px;padding:0 8px 0 12px;border-bottom:1px solid var(--line);font-size:12px;color:var(--tx-2)"><span class="btn sm ghost" style="height:24px;box-shadow:inset 0 0 0 1px var(--line);background:var(--card)">${ic('code', 13)}Shell${ic('down', 11)}</span><span class="grow"></span><span class="btn sm ghost" style="height:24px">${ic('copy', 13)}Copy</span></div>
      <pre style="margin:0;padding:12px 14px;font:12.5px/1.7 var(--mono);color:var(--tx)"><span style="color:var(--tx-3)"># reconcile sessions written only to Postgres</span>
bemmoly-auth backfill --since 24h --dry-run=false</pre></div>
    <p>Then flip the flag back on and watch the session error panel for an hour.</p>
  </div>`;
  return dframe({
    page: 'rfc',
    header: pageHeader({}),
    body: `<div class="d-scroll"><div class="d-col" style="margin:34px 0 0 250px">${prose}${bubble(52, -60, { ai: true })}</div>${toc(2, 34, 1036)}
      <div style="position:absolute;left:250px;top:100px;font-size:11px;color:var(--ai-600);display:none"></div></div>`,
  });
}

/* Comments: a margin rail aligned to the anchors */
function screenComments() {
  const thread = (top, on, items, o = {}) =>
    `<div class="d-thread ${on ? 'on' : ''}" style="top:${top}px">${items
      .map(
        ([p, t, m], i) =>
          `${i ? '<div style="height:10px"></div>' : ''}<div class="who">${av(p, 20)}<b style="font-weight:600">${PEOPLE[p].n}</b><span class="muted">${t}</span>${i === 0 ? `<span class="grow"></span><span class="muted row" style="gap:6px">${ic('smilePlus', 14)}${ic('check', 15)}${ic('more', 15)}</span>` : ''}</div><div class="msg">${m}</div>`,
      )
      .join('')}${o.foot || ''}</div>`;
  const rail = `<aside class="panel" style="width:340px;flex:none;position:relative;background:var(--sunken)">
    <div class="row" style="height:46px;padding:0 10px 0 16px;gap:8px;border-bottom:1px solid var(--line);background:var(--canvas);white-space:nowrap"><b class="h-sec">Comments</b><span class="seg"><span class="on">Open 3</span><span>Resolved 4</span></span><span class="grow"></span><span class="btn ghost icon sm">${ic('filter', 14)}</span><span class="btn ghost icon sm">${ic('x', 15)}</span></div>
    <div style="position:relative;flex:1">
      ${thread(440, false, [['JM', 'yesterday', 'This needs an issue; nobody owns it.']], { foot: `<div class="row" style="gap:6px;margin:10px 0 0 27px"><span class="btn sm">${ty('task', 14)}Create issue</span><span class="btn sm ghost">Reply</span></div>` })}
      ${thread(554, true, [
        ['JM', 'yesterday', 'Rollback says 15 min but the flag TTL in code is 30. Which is it?'],
        ['PN', '2h ago', 'Code wins: 30. <span style="color:var(--acc);font-weight:550">@Aisha</span> can you update the line?'],
      ], { foot: `<div class="input" style="margin:12px 0 0 27px;height:34px;font-size:12.5px">Reply… <span class="grow"></span><span class="kbd">⌘↵</span></div>` })}
      <div class="muted" style="position:absolute;left:16px;right:16px;top:20px;font-size:11.5px;font-weight:600">On the whole page</div>
      ${thread(42, false, [['LT', '3h ago', 'Looks good overall. Can we add a testing plan before review?']])}
    </div></aside>`;
  return dframe({
    page: 'rfc',
    header: pageHeader({ comments: true }),
    body: `<div style="display:flex;flex:1;min-height:0">${pageBody({ rail: true, activeThread: 'b', markers: false, noCover: true })}${rail}</div>`,
  });
}

/* Version history: a mode of the page, not a modal */
function screenHistory() {
  const vr = (dot, t, s, on, extra = '') => `<div class="d-vr ${on ? 'on' : ''}"><span class="dot ${dot ? 'named' : ''}"></span><div style="min-width:0"><div style="font-weight:${dot ? 600 : 500}">${t}</div><div class="muted row" style="gap:6px;font-size:12px;margin-top:2px">${s}</div></div>${extra}</div>`;
  const day = (t) => `<div class="muted" style="font-size:11.5px;font-weight:600;padding:12px 10px 4px">${t}</div>`;
  const rail = `<aside class="panel" style="width:320px;flex:none">
    <div class="row" style="height:46px;padding:0 12px 0 16px;gap:8px;border-bottom:1px solid var(--line)"><b class="h-sec grow">Versions</b><span class="btn sm">${ic('bookmark', 13)}Name this version</span></div>
    <div style="padding:6px 8px;display:flex;flex-direction:column">
      ${day('Today')}
      ${vr(false, 'Current version', `${av('AK', 16)}Aisha K. · 45m ago`, false, '<span class="chip neutral" style="height:18px">Live</span>')}
      ${vr(true, 'Published', `${av('JM', 16)}Jonas M. · 5h ago · 144 words`, false)}
      ${day('Thursday, Oct 8')}
      ${vr(true, 'Before review', `${av('PN', 16)}Priya N. · 3:20 PM · 144 words`, true)}
      <div class="row" style="gap:8px;padding:6px 10px 6px 34px;color:var(--tx-3);font-size:12.5px">${ic('right', 12, 2)}6 autosaves · Priya N., Aisha K.</div>
      ${day('Sunday, Oct 4')}
      ${vr(true, 'First draft', `${av('AK', 16)}Aisha K. · 111 words`, false)}
      <div class="muted" style="font-size:12px;padding:16px 10px;line-height:1.5">Autosaves are kept for 30 days. Named versions are kept for good.</div>
    </div></aside>`;
  const prose = `<div class="d-prose">
    <h2 style="margin-top:0">Migration order</h2>
    <ol>
      <li>Dual-write sessions to Redis and Postgres ${ich('PLT-204', { w: 190 })}</li>
      <li>Switch reads behind <span class="d-code">auth_pg_sessions</span> ${ich('PLT-218', { w: 150 })}</li>
      <li style="position:relative"><span class="d-chg" style="top:4px;bottom:4px;background:var(--done);left:-46px"></span><span class="d-ins">Rate-limit the refresh endpoint before GA</span> ${ich('PLT-222', { w: 130 })}</li>
    </ol>
    <h2>Rollback</h2>
    <p>If error rates exceed 0.5% after cutover, flip <span class="d-code">auth_pg_sessions</span> off. Sessions issued by the new service stay valid for 15 minutes, so users aren’t logged out.</p>
    <p><span class="d-chg" style="top:4px;bottom:4px;background:var(--amber)"></span>Redis stays warm for <span class="d-del">a week</span><span class="d-ins">7 days</span> after cutover. On-call follows the <span class="d-a">${pg('runbook', 14)} Auth service runbook</span>.</p>
    <div class="row" style="gap:8px;height:30px;padding:0 10px;border-radius:7px;background:var(--sunken);color:var(--tx-3);font-size:12.5px;margin:0 0 14px">${ic('down', 13, 2)}3 unchanged blocks</div>
    <h2>Open questions</h2>
    <p><span class="d-chg" style="top:4px;bottom:4px;background:var(--red)"></span><span class="d-del">Do we need a session cache flush on deploy?</span></p>
  </div>`;
  const strip = `<div class="row" style="height:48px;padding:0 24px;gap:10px;border-bottom:1px solid var(--line);background:var(--sunken);flex:none">
    <span class="btn sm" style="background:var(--card)">${ic('history', 13)}Before review · Oct 8${ic('down', 12)}</span><span class="muted">${ic('arrowR', 14)}</span><span class="btn sm" style="background:var(--card)">Current version${ic('down', 12)}</span>
    <span class="chip ok" style="margin-left:6px">1 added</span><span class="chip warn">1 edited</span><span class="chip red">1 removed</span>
    <span class="grow"></span><span class="row" style="gap:8px;color:var(--tx-2)"><span class="toggle"></span>Show changes</span><span class="vdiv"></span><span class="d-kh"><span class="kbd">J</span><span class="kbd">K</span>next change</span></div>`;
  return dframe({
    page: 'rfc',
    header: header({
      crumbs: [spaceCrumb(), { icon: pg('rfc', 14), t: 'RFC: Move sessions to Postgres' }, { icon: ic('history', 14), t: 'Version history' }],
      right: `<span class="btn ghost">Exit<span class="kbd">Esc</span></span><span class="btn">${ic('copy', 14)}Copy as new page</span><span class="btn primary">${ic('undo', 14, 2)}Restore this version</span>`,
    }),
    body: `<div style="display:flex;flex:1;min-height:0"><div style="flex:1;min-width:0;display:flex;flex-direction:column">${strip}<div class="d-scroll"><div class="d-col" style="margin:32px 0 0 120px">${prose}</div></div></div>${rail}</div>`,
  });
}

/* Linked work: issues in the page, issues that link here, pages that link here */
function screenLinked() {
  const irow = (k, extra = '') => {
    const x = issue(k);
    return `<div class="row" style="gap:8px;height:36px;padding:0 8px;border-radius:7px;${extra}">${ty(x.ty, 15)}<span class="mono muted">${x.k}</span><span class="grow trunc">${x.t}</span>${stc(x.s, 13)}${av(x.a, 18)}</div>`;
  };
  const prow = (k, sp, extra = '') => `<div class="row" style="gap:8px;height:36px;padding:0 8px;border-radius:7px;${extra}">${pg(k, 15)}<span class="grow trunc">${PAGES[k].t}</span><span class="muted" style="font-size:12px">${sp}</span></div>`;
  const sec = (t, n, act = '') => `<div class="row" style="gap:6px;margin:16px 8px 4px;font-size:11.5px;font-weight:600;color:var(--tx-3)">${t}<span style="font-weight:500">${n}</span><span class="grow"></span>${act}</div>`;
  const rail = `<aside class="panel" style="width:340px;flex:none">
    <div class="row" style="height:46px;padding:0 10px 0 16px;gap:8px;border-bottom:1px solid var(--line)"><b class="h-sec grow">Linked work</b><span class="btn sm">${ic('plus', 13)}Link issue</span><span class="btn ghost icon sm">${ic('x', 15)}</span></div>
    <div style="padding:0 8px">
      ${sec('In this page', 3)}${irow('PLT-204', 'background:var(--hover)')}${irow('PLT-218')}${irow('PLT-222')}
      <div class="row" style="gap:8px;margin:6px 8px 0;font-size:12px;color:var(--tx-3)"><span class="bar" style="width:120px;display:flex"><i style="width:0%;background:var(--done);border-radius:0"></i><i style="width:66%;background:var(--prog);border-radius:0"></i></span>2 of 3 in progress, none done</div>
      ${sec('Issues that link here', 1)}${irow('PLT-211')}
      ${sec('Pages that link here', 2)}${prow('platform', 'Engineering')}${prow('runbook', 'Engineering')}
    </div></aside>`;
  const embed = `<div style="border-radius:10px;box-shadow:var(--e1);background:var(--card);padding:12px 14px;margin:0 0 14px;display:flex;flex-direction:column;gap:8px">
      <div class="row" style="gap:8px">${ty('story', 16)}<span class="mono muted">PLT-204</span><b style="font-weight:600" class="grow trunc">Session store migration to Postgres</b><span class="muted">${ic('expand', 14)}</span></div>
      <div class="row" style="gap:14px;color:var(--tx-2);font-size:12.5px">${stl('review')}<span class="row" style="gap:6px">${pr('urgent')}Urgent</span><span class="row" style="gap:6px">${av('AK', 18)}Aisha K.</span><span class="row" style="gap:6px">${ic('target', 13, 1.75, 'style="color:var(--tx-3)"')}Sprint 14</span>${ep('auth')}</div></div>`;
  const prose = `<div class="d-prose">
    <h2 style="margin-top:0">Migration order</h2>
    <p style="margin-bottom:10px">The migration is tracked as one story; its sub-tasks follow the order below.</p>
    ${embed}
    <ol>
      <li>Dual-write sessions to Redis and Postgres ${ich('PLT-204', { w: 170 })}</li>
      <li>Switch reads behind <span class="d-code">auth_pg_sessions</span> ${ich('PLT-218', { w: 120 })}</li>
      <li>Rate-limit the refresh endpoint ${ich('PLT-222', { w: 130 })}</li>
    </ol>
    <p>Each step ships behind its own flag. <span style="color:var(--tx-3)">Type</span> <span class="kbd">#</span> <span style="color:var(--tx-3)">to embed another issue.</span></p>
    <h2>Rollback</h2>
    <p>If error rates exceed 0.5% after cutover, flip <span class="d-code">auth_pg_sessions</span> off. Sessions issued by the new service stay valid for 15 minutes, so users aren’t logged out. Session cleanup is tracked in ${ich('PLT-211', { w: 170 })}.</p>
  </div>`;
  return dframe({
    page: 'rfc',
    header: pageHeader({ linked: true }),
    body: `<div style="display:flex;flex:1;min-height:0"><div class="d-scroll"><div class="d-col" style="margin:34px 0 0 90px">${prose}</div></div>${rail}</div>`,
  });
}

/* New page: created in place, templates offered inside the empty page */
function screenNewPage() {
  const tree = [
    tn(1, pg('platform'), 'Platform', { kids: true, open: true }),
    tn(2, pg('rfc'), PAGES.rfc.t),
    tn(2, pg('runbook'), PAGES.runbook.t),
    tn(2, pg('oncall'), PAGES.oncall.t),
    tn(2, pgi('doc'), '<span style="color:var(--tx-3)">Untitled</span>', { on: true }),
    tn(1, pg('adr'), PAGES.adr.t, { kids: true }),
    tn(1, pg('pms'), 'Postmortems', { kids: true }),
  ];
  const tpl = (i, c, t, d, on) => `<div class="d-tpl ${on ? 'on' : ''}"><div class="d-mini"><i class="h"></i><i style="width:90%"></i><i style="width:75%"></i><i style="width:82%"></i></div><div class="row" style="gap:8px">${pgi(i, 15, c)}<b style="font-weight:600">${t}</b></div><div class="muted" style="font-size:12px;line-height:1.4;margin-top:-4px">${d}</div></div>`;
  const body = `<div class="d-scroll"><div class="d-col" style="margin:56px 0 0 250px">
    <div class="row" style="gap:4px;margin-left:-8px;color:var(--tx-3)"><span class="btn ghost sm">${ic('smile', 14)}Add icon</span><span class="btn ghost sm">${ic('img', 14)}Add cover</span></div>
    <div class="d-title" style="margin-top:10px;color:var(--tx-3)"><span class="d-mycaret" style="height:38px;vertical-align:-6px;margin-right:2px"></span>Untitled</div>
    <div class="d-props">${'<span class="d-prop">' + pst('draft', 14) + '</span>'}<span class="d-prop">${av('RS', 18)}Rohan S.</span><span class="d-prop"><span class="k">In</span>${pg('platform', 13)}Platform</span></div>
    <div class="d-rule"></div>
    <div class="muted" style="font-size:15px">Start writing, or press <span class="kbd">/</span> for blocks.</div>
    <div class="row" style="margin:34px 0 10px"><b class="h-sec grow">Start from a template</b><span class="d-kh"><span class="kbd">↑↓←→</span>choose<span class="kbd">↵</span>use</span></div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
      ${tpl('flag', '#6E56CF', 'RFC', 'Propose a change and record the decision.', true)}
      ${tpl('alert', '#D46A2E', 'Postmortem', 'A blameless account of an incident.')}
      ${tpl('book', '#23988A', 'Runbook', 'Step-by-step response to an alert.')}
      ${tpl('users', '#2B8FC9', 'Meeting notes', 'Agenda, decisions, action items.')}
      ${tpl('scale', '#5B6CD9', 'Decision log', 'One entry per decision, newest first.')}
      ${tpl('map', '#0E9BB0', 'Product spec', 'Problem, users, requirements, launch.')}
      ${tpl('template', null, 'Space templates', 'Two more made by your team.')}
      <div class="d-tpl" style="box-shadow:none;border:1px dashed var(--line);align-items:center;justify-content:center;color:var(--tx-2);gap:6px">${ic('upload', 18)}<b style="font-weight:550">Import a file</b><span class="muted" style="font-size:12px">Markdown or Confluence</span></div>
    </div>
  </div></div>`;
  return dframe({
    page: 'new',
    tree,
    header: header({ crumbs: [spaceCrumb(), { icon: pg('platform', 14), t: 'Platform' }, { icon: pgi('doc', 14), t: 'Untitled' }], right: `<span class="muted row" style="gap:5px;font-size:12px">${ic('check', 13, 2)}Saved</span><span class="vdiv"></span><span class="btn ghost icon">${ic('star', 16)}</span><span class="btn">${ic('share', 14)}Share</span><span class="btn ghost icon">${ic('more', 16)}</span>` }).replace('</div><div class="right">', `</div><span class="btn sm ghost" style="box-shadow:inset 0 0 0 1px var(--line);margin-left:4px;color:var(--tx-2)">${pst('draft', 13)}${ic('down', 12)}</span><div class="right">`),
    body,
    overlay: toastEl('<span>Page created in <b style="font-weight:600">Platform</b></span>', 'Undo', 'left:calc(240px + 600px);bottom:24px;transform:translateX(-50%)'),
  });
}

/* Docs home: recent, starred, needs you, spaces, templates */
function screenDocsHome() {
  const recent = [
    ['rfc', 'Engineering', 'You edited 45m ago'],
    ['spec', 'Product', 'Maya K. edited 20m ago'],
    ['q4', 'Product', 'Lena T. edited 3h ago'],
    ['runbook', 'Engineering', 'Jonas M. edited 5h ago'],
  ];
  const rows = [
    ['spec', 'PROD', 'MK', '20m ago', 'draft'],
    ['rfc', 'ENG', 'AK', '45m ago', 'review'],
    ['q4', 'PROD', 'LT', '3h ago', 'published'],
    ['runbook', 'ENG', 'JM', '5h ago', 'published'],
    ['pm1', 'ENG', 'RS', 'Yesterday', 'published'],
    ['welcome', 'HB', 'RS', 'Oct 2', 'published'],
  ];
  const needs = [
    [ic('eye', 15), 'Aisha asked you to review', 'rfc', '45m'],
    [ic('at', 15), 'Jonas mentioned you in', 'runbook', '5h'],
    [ic('clock', 15), 'Not updated for 90 days', 'welcome', ''],
  ];
  const body = `<div style="padding:28px 80px;overflow:hidden"><div style="max-width:1040px;margin:0 auto">
    <div class="row" style="gap:12px"><div class="grow"><h1 style="font-size:24px;font-weight:600;letter-spacing:-.02em">Docs</h1><div class="muted" style="margin-top:2px">4 spaces · 10 pages · 1 page waiting for your review</div></div></div>
    <div class="h-sec" style="margin:22px 0 10px">Jump back in</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">${recent
      .map(([k, s, m], i) => `<div class="card-s" style="padding:14px;${i === 0 ? 'box-shadow:var(--e1h)' : ''}"><div class="row" style="gap:8px">${pg(k, 18)}<span class="grow"></span>${i === 0 ? `<span class="muted">${ic('star', 14, 1.75, 'fill="#E8A317" style="color:#E8A317"')}</span>` : ''}</div><div style="font-weight:550;margin-top:12px" class="trunc">${PAGES[k].t}</div><div class="muted trunc" style="font-size:12px;margin-top:2px">${s} · ${m}</div></div>`)
      .join('')}</div>
    <div style="display:grid;grid-template-columns:1.6fr 1fr;gap:20px;margin-top:24px;align-items:start">
      <div class="card-s" style="overflow:hidden"><div class="row" style="padding:10px 14px;gap:10px;border-bottom:1px solid var(--line)"><span class="seg"><span class="on">Recent</span><span>Starred · 3</span><span>My drafts · 1</span><span>Shared with me</span></span><span class="grow"></span><span class="muted">${ic('sliders', 15)}</span></div>
        ${rows
          .map(
            ([k, sp, p, t, s], i) =>
              `<div class="d-lrow ${i === 1 ? 'hover' : ''}" style="grid-template-columns:18px minmax(0,1fr) 16px 120px 22px 70px">${pg(k, 16)}<span class="trunc" style="font-weight:500">${PAGES[k].t}</span>${stc(PSTATUS[s][0], 13)}<span class="row trunc" style="gap:6px;color:var(--tx-2);font-size:12.5px">${stile(sp, 14)}${SPACES[sp].n}</span>${av(p, 20)}<span class="muted" style="font-size:12px;text-align:right">${t}</span></div>`,
          )
          .join('')}
      </div>
      <div style="display:flex;flex-direction:column;gap:20px">
        <div class="card-s"><div class="row" style="padding:10px 14px;border-bottom:1px solid var(--line)"><b class="h-sec grow">Needs you</b><span class="pill" style="font-size:10.5px;font-weight:600;color:#fff;background:var(--acc);border-radius:9px;padding:0 6px">2</span></div>
          ${needs.map(([i, a, k, t]) => `<div class="row" style="gap:10px;padding:9px 14px;border-bottom:1px solid var(--line-2)"><span class="muted">${i}</span><div class="grow" style="min-width:0;font-size:12.5px"><div class="muted trunc">${a}</div><div class="row trunc" style="gap:6px;font-weight:550">${pg(k, 14)}<span class="trunc">${PAGES[k].t}</span></div></div><span class="muted" style="font-size:11.5px">${t}</span></div>`).join('')}</div>
        <div class="card-s"><div class="row" style="padding:10px 14px;border-bottom:1px solid var(--line)"><b class="h-sec grow">Spaces</b><span class="btn ghost sm">${ic('plus', 13)}New space</span></div>
          ${Object.keys(SPACES).map((k) => `<div class="row" style="gap:10px;padding:8px 14px">${stile(k, 24)}<div class="grow" style="min-width:0"><div style="font-weight:550">${SPACES[k].n}</div><div class="muted trunc" style="font-size:12px">${SPACES[k].pages} ${SPACES[k].pages === 1 ? 'page' : 'pages'} · ${SPACES[k].d}</div></div><div class="facepile">${SPACES[k].m.slice(0, 3).map((x) => av(x, 18)).join('')}</div></div>`).join('')}</div>
      </div></div></div></div>`;
  return dframe({
    active: 'docs-home',
    page: 'none',
    spaceOpen: false,
    header: header({ crumbs: [docsCrumb()], right: `<span class="btn ghost">${ic('upload', 14)}Import</span><span class="btn">${ic('template', 14)}Templates</span><span class="btn primary">${ic('plus', 15, 2)}New page<span class="kbd" style="background:transparent;color:#fff;border-color:rgba(255,255,255,.35)">N</span></span>` }),
    body,
  });
}

/* Space overview */
function screenSpace() {
  const tree = [
    tn(1, pg('platform'), 'Platform', { kids: true }),
    tn(1, pg('adr'), PAGES.adr.t, { kids: true, hover: true }),
    tn(1, pg('pms'), 'Postmortems', { kids: true }),
  ];
  const top = [
    ['platform', 3, 'Everything the platform team owns.', 'PN', 'Yesterday'],
    ['adr', 6, 'Why the system looks the way it does.', 'RS', 'Oct 6'],
    ['pms', 4, 'Blameless reviews of every SEV-1 and SEV-2.', 'PN', 'Wednesday'],
  ];
  const upd = [
    ['rfc', 'AK', 'edited', '45m ago', 'review'],
    ['runbook', 'JM', 'edited', '5h ago', 'published'],
    ['pm1', 'RS', 'published', 'Yesterday', 'published'],
    ['oncall', 'PN', 'created', 'Oct 7', 'draft'],
  ];
  const body = `<div style="padding:30px 80px;overflow:hidden"><div style="max-width:1040px;margin:0 auto">
    <div class="row" style="gap:14px;align-items:flex-start">${stile('ENG', 44)}<div class="grow"><h1 style="font-size:24px;font-weight:600;letter-spacing:-.02em">Engineering</h1><div class="sub" style="margin-top:2px">RFCs, runbooks and postmortems. Owned by the <b style="font-weight:550">Platform</b> team.</div></div><div class="facepile" style="margin-top:6px">${['PN', 'AK', 'JM', 'RS'].map((x) => av(x, 24)).join('')}</div></div>
    <div style="display:grid;grid-template-columns:1.6fr 1fr;gap:20px;margin-top:26px">
      <div class="card-s" style="padding:18px 20px"><div class="row" style="gap:8px;font-size:11.5px;font-weight:600;color:var(--tx-3)">${ic('home', 13)}Start here<span class="grow"></span><span class="btn ghost sm" style="font-weight:500">Change</span></div>
        <div class="row" style="gap:10px;margin-top:8px">${pg('platform', 20)}<b style="font-size:17px;font-weight:600;letter-spacing:-.01em">Platform</b></div>
        <div class="sub" style="margin-top:8px;line-height:1.6">Everything the platform team owns: the auth service, sessions, the job runner and the deploy pipeline. New here? Read the on-call handbook first, then the open RFCs.</div>
        <div class="row" style="gap:6px;margin-top:12px">${['rfc', 'oncall', 'runbook'].map((k) => `<span class="btn sm ghost" style="box-shadow:inset 0 0 0 1px var(--line)">${pg(k, 13)}<span class="trunc" style="max-width:150px">${PAGES[k].t}</span></span>`).join('')}</div></div>
      <div class="card-s"><div class="row" style="padding:10px 14px;border-bottom:1px solid var(--line)"><b class="h-sec grow">In review</b><span class="muted">1</span></div>
        <div class="row" style="gap:10px;padding:12px 14px">${pg('rfc', 16)}<div class="grow" style="min-width:0"><div class="trunc" style="font-weight:550">RFC: Move sessions to Postgres</div><div class="muted row" style="gap:6px;font-size:12px;margin-top:2px">${av('AK', 14)}Aisha asked ${av('JM', 14)}${av('RS', 14)}</div></div>${stc('review')}</div>
        <div class="row" style="gap:8px;padding:10px 14px;border-top:1px solid var(--line-2);font-size:12.5px;color:var(--tx-2)">${ic('clock', 14, 1.75, 'style="color:var(--amber)"')}<span class="grow">2 pages not updated for 90 days</span><span style="color:var(--acc);font-weight:550">Review</span></div></div>
    </div>
    <div class="row" style="margin:26px 0 10px"><b class="h-sec grow">Pages</b><span class="seg"><span class="on">${ic('blocks', 14)}</span><span>${ic('list', 14)}</span></span></div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">${top
      .map(([k, n, d, p, t], i) => `<div class="card-s" style="padding:14px;${i === 1 ? 'box-shadow:var(--e1h)' : ''}"><div class="row" style="gap:8px">${pg(k, 18)}<b style="font-weight:600" class="grow trunc">${PAGES[k].t}</b><span class="muted" style="font-size:12px">${n} pages</span></div><div class="muted" style="font-size:12.5px;margin-top:8px">${d}</div><div class="row" style="gap:6px;margin-top:12px;font-size:12px" class="muted">${av(p, 16)}<span class="muted">Updated ${t}</span></div></div>`)
      .join('')}
      </div>
    <div class="h-sec" style="margin:26px 0 8px">Recently updated</div>
    <div class="card-s" style="overflow:hidden">${upd
      .map(([k, p, v, t, s]) => `<div class="d-lrow" style="grid-template-columns:18px minmax(0,1fr) 16px 200px 80px">${pg(k, 16)}<span class="trunc" style="font-weight:500">${PAGES[k].t}</span>${stc(PSTATUS[s][0], 13)}<span class="row" style="gap:6px;color:var(--tx-2);font-size:12.5px">${av(p, 18)}${PEOPLE[p].n} ${v}</span><span class="muted" style="font-size:12px;text-align:right">${t}</span></div>`)
      .join('')}</div>
  </div></div>`;
  return dframe({
    active: 'space-ENG',
    page: 'none',
    tree,
    header: header({ crumbs: [docsCrumb(), spaceCrumb()], right: `<span class="btn ghost">${ic('gear', 14)}Space settings</span><span class="btn">${ic('upload', 14)}Import</span><span class="btn primary">${ic('plus', 15, 2)}New page</span>` }),
    body,
  });
}

/* Trash: search, restore, delete forever, preview */
function screenTrash() {
  const rows = [
    ['runbook', `${pg('platform', 13)}Platform`, 'JM', '2m ago'],
    ['oncall', `${pg('platform', 13)}Platform`, 'PN', 'Yesterday'],
    ['pm1', `${pg('pms', 13)}Postmortems`, 'RS', 'Oct 2'],
    ['adr', `${stile('ENG', 13)}Top of the space`, 'RS', 'Sep 21'],
  ];
  const peek = `<aside class="panel" style="width:400px;flex:none">
    <div class="row" style="height:46px;padding:0 12px 0 18px;gap:8px;border-bottom:1px solid var(--line)">${pg('runbook', 15)}<b class="grow trunc" style="font-weight:600">Auth service runbook</b><span class="btn ghost icon sm">${ic('x', 15)}</span></div>
    <div class="row" style="gap:8px;padding:10px 18px;background:var(--sunken);border-bottom:1px solid var(--line);font-size:12.5px;color:var(--tx-2)">${ic('trash', 14)}<span class="grow">Deleted by Jonas M. 2m ago · read-only</span></div>
    <div style="padding:18px 22px;font-size:13.5px;line-height:1.65;color:var(--tx-2)"><div style="font-size:20px;font-weight:620;color:var(--tx);letter-spacing:-.015em">Auth service runbook</div>
      <p style="margin:10px 0">What on-call does when login latency climbs above 400ms for five minutes.</p><b style="color:var(--tx);font-weight:600">1. Check the session store</b><p style="margin:6px 0 10px">Open the auth dashboard and look at the Postgres pool…</p><b style="color:var(--tx);font-weight:600">2. Fail reads back to Redis</b><p style="margin:6px 0">Flip <span class="d-code">auth_pg_sessions</span> off…</p></div>
    <div class="row" style="gap:8px;margin-top:auto;padding:12px 18px;border-top:1px solid var(--line)"><span class="btn" style="color:var(--red)">${ic('trash', 14)}Delete forever</span><span class="grow"></span><span class="btn primary">${ic('undo', 14, 2)}Restore to Platform</span></div></aside>`;
  const body = `<div style="display:flex;flex:1;min-height:0"><div style="flex:1;min-width:0;padding:28px 32px;overflow:hidden">
    <h1 class="h-page">Trash</h1><div class="sub" style="margin-top:4px">Pages stay here for 30 days, then they’re deleted for good. Restoring a page brings back the pages under it.</div>
    <div class="row" style="gap:8px;margin:18px 0 8px"><div class="tsearch" style="box-shadow:var(--e1);background:var(--card);width:240px;height:30px">${ic('search', 14)}<span>Search the trash…</span></div><span class="fchip">${ic('me', 14)}Deleted by anyone</span><span class="grow"></span><span class="muted" style="font-size:12px">4 pages · 11 with sub-pages</span></div>
    <table class="tbl"><thead><tr><th>Page</th><th>Was in</th><th>Deleted by</th><th>When</th><th></th></tr></thead><tbody>${rows
      .map(
        ([k, w, p, t], i) =>
          `<tr class="${i === 0 ? 'hover' : ''}" style="white-space:nowrap;${i === 0 ? 'box-shadow:inset 2px 0 0 var(--acc)' : ''}"><td><div class="row" style="gap:10px">${pg(k, 16)}<span style="font-weight:550">${PAGES[k].t}</span></div></td><td class="muted"><span class="row" style="gap:6px">${w}</span></td><td><div class="row" style="gap:7px">${av(p, 18)}${PEOPLE[p].n}</div></td><td class="muted">${t}</td><td style="width:150px;text-align:right">${i === 0 ? `<span class="btn sm">${ic('undo', 13, 2)}Restore</span> <span class="btn sm ghost icon" style="color:var(--tx-3)">${ic('more', 15)}</span>` : ''}</td></tr>`,
      )
      .join('')}</tbody></table>
    <div class="muted" style="font-size:12px;margin-top:14px">Deleting forever can’t be undone. Only space admins can empty the trash.</div>
  </div>${peek}</div>`;
  return dframe({
    active: 'trash',
    page: 'none',
    header: header({ crumbs: [spaceCrumb(), { icon: ic('trash', 14), t: 'Trash' }], right: `<span class="btn ghost" style="color:var(--red)">${ic('trash', 14)}Empty trash</span>` }),
    body,
  });
}

/* Search: pages in the palette with icons, place and the matching line */
function screenSearch() {
  const prow = (k, path, snip, s, on) => `<div class="row" style="gap:12px;height:54px;padding:0 14px;border-radius:8px;${on ? 'background:var(--hover)' : ''}">${pg(k, 18)}<div class="grow" style="min-width:0"><div class="row" style="gap:8px"><span class="trunc" style="font-weight:550">${PAGES[k].t.replace('Postgres', '<span class="d-mark">Postgres</span>')}</span><span class="muted" style="font-size:12px;white-space:nowrap">${path}</span></div><div class="muted trunc" style="font-size:12.5px;margin-top:2px">${snip}</div></div>${stc(PSTATUS[s][0], 13)}${on ? '<span class="kbd">↵</span>' : ''}</div>`;
  const irow = (k) => {
    const x = issue(k);
    return `<div class="row" style="gap:12px;height:40px;padding:0 14px;border-radius:8px">${ty(x.ty, 16)}<span class="mono muted">${x.k}</span><span class="grow trunc">${x.t.replace('Postgres', '<span class="d-mark">Postgres</span>')}</span>${stc(x.s, 13)}${av(x.a, 18)}</div>`;
  };
  const sec = (t, n) => `<div class="muted" style="font-size:11.5px;font-weight:600;padding:10px 14px 4px">${t} <span style="font-weight:500">${n}</span></div>`;
  const pal = `<div class="scrim"></div><div class="px" style="position:absolute;left:calc(240px + 600px);top:96px;transform:translateX(-50%);width:700px;background:var(--card);border-radius:14px;box-shadow:var(--e3);overflow:hidden">
    <div class="row" style="gap:10px;height:54px;padding:0 18px;border-bottom:1px solid var(--line)"><span class="muted">${ic('search', 18)}</span><span style="font-size:15px" class="grow">postgres<span class="d-mycaret" style="height:18px;margin-left:1px"></span></span><span class="fchip set">${stile('ENG', 14)}In Engineering<span class="x">${ic('x', 12)}</span></span><span class="kbd">Esc</span></div>
    <div class="row" style="gap:6px;padding:8px 14px;border-bottom:1px solid var(--line)"><span class="seg"><span class="on">All</span><span>Pages · 3</span><span>Issues · 2</span><span>People</span></span><span class="grow"></span><span class="muted" style="font-size:12px">Sorted by relevance</span></div>
    <div style="padding:6px">${sec('Pages', 3)}
      ${prow('rfc', 'Engineering › Platform', 'Sessions move from Redis to <span class="d-mark">Postgres</span> with a dual-write…', 'review', true)}
      ${prow('runbook', 'Engineering › Platform', '…check the <span class="d-mark">Postgres</span> pool on the auth dashboard before failing reads back…', 'published')}
      ${prow('pm1', 'Engineering › Postmortems', '…the <span class="d-mark">Postgres</span> replica lagged 40s behind the primary during the push…', 'published')}
      ${sec('Issues', 2)}${irow('PLT-204')}
      <div class="row" style="gap:12px;height:40px;padding:0 14px;border-radius:8px">${ty('task', 16)}<span class="mono muted">PLT-227</span><span class="grow trunc">Upgrade <span class="d-mark">Postgres</span> client to 16.x</span>${stc('progress', 13)}${av('RS', 18)}</div>
      ${sec('Actions', '')}<div class="row" style="gap:12px;height:38px;padding:0 14px">${ic('filePlus', 16, 1.75, 'style="color:var(--tx-2)"')}<span class="grow">New page “postgres” in Engineering</span><span class="kbar"><span class="kbd">⌘</span><span class="kbd">↵</span></span></div></div>
    <div class="row" style="gap:14px;height:38px;padding:0 16px;border-top:1px solid var(--line);background:var(--sunken);font-size:12px;color:var(--tx-3)"><span class="d-kh"><span class="kbd">↑↓</span>move</span><span class="d-kh"><span class="kbd">↵</span>open</span><span class="d-kh"><span class="kbd">⇧↵</span>open beside</span><span class="d-kh"><span class="kbd">Tab</span>filter by type</span><span class="grow"></span><span class="d-kh"><span class="kbd">⌫</span>clear scope</span></div></div>`;
  return dframe({ page: 'rfc', header: pageHeader({}), body: pageBody({ peer: true }), overlay: pal });
}

/* Empty space, with the error state drawn in the same frame */
function screenEmpty() {
  const tree = [`<div class="d-tn" style="padding-left:20px;color:var(--tx-3)"><span class="chev"></span>${ic('plus', 14)}<span>New page</span><span class="kbd" style="margin-left:auto">N</span></div>`];
  const opt = (i, t, d, k, on) => `<div class="d-rc ${on ? 'hover' : ''}" style="display:flex;flex-direction:column;gap:8px;padding:16px"><span style="width:34px;height:34px;border-radius:9px;display:grid;place-items:center;background:${on ? 'var(--acc-50)' : 'var(--sunken)'};color:${on ? 'var(--acc)' : 'var(--tx-2)'};box-shadow:inset 0 0 0 1px var(--line)">${ic(i, 18)}</span><div class="row" style="gap:8px"><b style="font-weight:600" class="grow">${t}</b>${k ? `<span class="kbd">${k}</span>` : ''}</div><div class="muted" style="font-size:12.5px;line-height:1.45">${d}</div></div>`;
  const body = `<div style="padding:30px 80px;overflow:hidden"><div style="max-width:1040px;margin:0 auto">
    <div class="row" style="gap:14px;align-items:flex-start">${`<span class="tile" style="width:44px;height:44px;border-radius:11.4px;background:#2B8FC9;font-size:23px">R</span>`}<div class="grow"><h1 style="font-size:24px;font-weight:600;letter-spacing:-.02em">Research</h1><div class="muted" style="margin-top:2px">Add a description</div></div><div class="facepile" style="margin-top:6px">${av('RS', 24)}</div><span class="btn ghost" style="margin-top:4px">${ic('users', 14)}Invite</span></div>
    <div style="margin:64px auto 0;max-width:720px;text-align:center"><div style="font-size:18px;font-weight:600;letter-spacing:-.01em">Write the first page in Research</div><div class="sub" style="margin-top:6px">It becomes the space’s home page. You can change that later.</div></div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;max-width:760px;margin:22px auto 0;text-align:left">
      ${opt('filePlus', 'Blank page', 'Start writing. Press / for headings, tables, issues and more.', 'N', true)}
      ${opt('template', 'From a template', 'RFC, postmortem, runbook, meeting notes, product spec, decision log.', '')}
      ${opt('upload', 'Import', 'Markdown files or folders, or a Confluence export.', '')}
    </div>
    <div style="max-width:760px;margin:56px auto 0"><div class="muted" style="font-size:11.5px;font-weight:600;margin-bottom:8px">The error state, in the same frame</div>
      <div class="card-s row" style="gap:14px;padding:16px 18px;align-items:flex-start"><span style="width:34px;height:34px;border-radius:9px;display:grid;place-items:center;background:var(--red-50);color:var(--red);flex:none">${ic('wifiOff', 18)}</span><div class="grow"><b style="font-weight:600">This page didn’t load</b><div class="sub" style="font-size:12.5px;margin-top:2px">The server didn’t answer in time. Your place in the tree is kept; nothing you wrote was lost.</div><div class="row" style="gap:8px;margin-top:10px"><span class="btn sm primary">${ic('refresh', 13, 2)}Try again</span><span class="btn sm ghost">Back to Research</span></div></div><span class="muted" style="font-size:11.5px">Retrying in 8s</span></div></div>
  </div></div>`;
  return dframe({
    page: 'none',
    active: 'space-RES',
    tree,
    spaceOpen: false,
    extraSpaces: `<div class="nav on">${'<span class="tile" style="width:18px;height:18px;border-radius:4.7px;background:#2B8FC9;font-size:9px">R</span>'}<span class="grow trunc">Research</span>${ic('down', 14, 1.75, 'style="color:var(--tx-3)"')}</div><div style="display:flex;flex-direction:column;gap:1px">${tree.join('')}</div>`,
    header: header({ crumbs: [docsCrumb(), { icon: '<span class="tile" style="width:16px;height:16px;border-radius:4.2px;background:#2B8FC9;font-size:8px">R</span>', t: 'Research' }], right: `<span class="btn ghost">${ic('gear', 14)}Space settings</span><span class="btn primary">${ic('plus', 15, 2)}New page</span>` }),
    body,
  });
}

/* Import, in progress, over the space */
function screenImport() {
  const f = (name, state, extra = '') => `<div class="row" style="gap:10px;height:38px;padding:0 4px;border-bottom:1px solid var(--line-2)">${ic('file', 15, 1.75, 'style="color:var(--tx-3)"')}<span class="grow trunc">${name}</span>${extra}${state}</div>`;
  const ok = `<span style="color:var(--done)">${stc('done', 14)}</span>`;
  const dlg = `<div class="scrim"></div><div class="px" style="position:absolute;left:calc(240px + 600px);top:90px;transform:translateX(-50%);width:640px;background:var(--card);border-radius:14px;box-shadow:var(--e3);overflow:hidden">
    <div class="row" style="gap:10px;padding:16px 18px 0"><b style="font-size:15px;font-weight:600" class="grow">Import into Engineering</b><span class="btn ghost icon sm">${ic('x', 15)}</span></div>
    <div class="row" style="gap:8px;padding:12px 18px 14px;font-size:12.5px"><span class="muted">Put the pages under</span><span class="btn sm" style="box-shadow:inset 0 0 0 1px var(--line);background:var(--card)">${pg('platform', 13)}Platform${ic('down', 12)}</span></div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:0 18px">
      ${[['doc', 'Markdown', '.md files or a folder', true], ['globe', 'HTML', 'Exported pages', false], ['layers', 'Import from Confluence', 'A space export (.zip)', false]]
        .map(([i, t, d, on]) => `<div style="border-radius:10px;padding:10px 12px;${on ? 'box-shadow:0 0 0 1.5px var(--acc);background:var(--acc-50)' : 'box-shadow:inset 0 0 0 1px var(--line)'}"><div class="row" style="gap:8px;${on ? 'color:var(--acc)' : ''}">${ic(i, 15)}<b style="font-weight:600;color:var(--tx)" class="trunc">${t}</b></div><div class="muted" style="font-size:12px;margin-top:3px">${d}</div></div>`)
        .join('')}</div>
    <div style="padding:14px 18px 4px"><div class="row" style="gap:8px;margin-bottom:6px"><b class="h-sec grow">auth-service-docs</b><span class="muted" style="font-size:12px">9 of 12 pages · 2.4 MB</span></div>
      <div class="bar" style="width:100%;height:4px;margin-bottom:6px"><i style="width:75%;background:var(--acc)"></i></div>
      ${f('README.md', ok, '<span class="muted" style="font-size:12px">→ Auth service</span>')}
      ${f('runbooks/login-latency.md', ok, '<span class="muted" style="font-size:12px">→ Login latency</span>')}
      ${f('runbooks/token-rotation.md', `<span class="chip warn" style="height:18px">${ic('img', 11, 2)}2 images kept as links</span>`)}
      ${f('decisions/0004-sessions.md', `<span class="muted" style="font-size:12px">Converting…</span>`)}
      ${f('decisions/0005-rate-limits.md', `<span class="muted" style="font-size:12px">Waiting</span>`)}
    </div>
    <div class="row" style="gap:10px;padding:12px 18px;border-top:1px solid var(--line);background:var(--sunken);margin-top:10px"><span class="muted" style="font-size:12.5px">You can close this; the import keeps going and tells you when it’s done.</span><span class="grow"></span><span class="btn ghost">Run in background</span><span class="btn primary" style="opacity:.55">Open pages</span></div></div>`;
  return dframe({ active: 'space-ENG', page: 'none', tree: [tn(1, pg('platform'), 'Platform', { kids: true }), tn(1, pg('adr'), PAGES.adr.t, { kids: true }), tn(1, pg('pms'), 'Postmortems', { kids: true })], header: header({ crumbs: [docsCrumb(), spaceCrumb()], right: `<span class="btn ghost">${ic('gear', 14)}Space settings</span><span class="btn">${ic('upload', 14)}Import</span><span class="btn primary">${ic('plus', 15, 2)}New page</span>` }), body: screenSpace().split('<main class="main" style="position:relative">')[1].split('</main>')[0].replace(/^[\s\S]*?<\/header>/, ''), overlay: dlg });
}

/* Phone: the page reads first; navigation is a sheet and a bottom bar */
function screenPhone() {
  return `<div class="px" style="width:390px;height:844px;display:flex;flex-direction:column;overflow:hidden;position:relative">
    <div class="row" style="height:52px;padding:0 12px;gap:10px;border-bottom:1px solid var(--line);flex:none"><span>${ic('menu', 20)}</span><div class="grow" style="min-width:0"><div class="muted row trunc" style="gap:5px;font-size:11.5px">${stile('ENG', 12)}Engineering / Platform</div><div class="trunc" style="font-weight:600;font-size:14px">RFC: Move sessions to Postgres</div></div><div class="facepile">${av('AK', 22)}${av('JM', 22)}</div><span style="color:var(--tx-2)">${ic('more', 20)}</span></div>
    <div style="flex:1;overflow:hidden;position:relative">
      <div style="height:96px;overflow:hidden">${cover('#5B7BE5').replace('style="position:absolute;inset:0"', 'style="position:absolute;top:-30px;left:-560px"')}</div>
      <div style="padding:0 18px;margin-top:-26px;position:relative">
        <div class="d-icon" style="width:48px;height:48px;border-radius:11px">${ic('flag', 26, 1.75, 'style="color:#6E56CF"')}</div>
        <div class="d-title" style="font-size:27px;margin-top:12px">RFC: Move sessions to Postgres</div>
        <div class="d-props" style="flex-wrap:nowrap;overflow:hidden;margin-top:8px"><span class="d-prop">${pst('review', 13)}</span><span class="d-prop">${av('AK', 18)}Aisha K.</span><span class="d-prop"><span class="k">Edited</span>45m ago</span></div>
        <div class="d-rule" style="margin:10px 0 16px"></div>
        <div class="d-prose" style="font-size:16px"><h2 style="margin-top:0;font-size:20px">Context</h2><p>We’re moving session handling out of the monolith into a standalone auth service. Evictions under memory pressure have logged users out twice this quarter.</p><h2 style="font-size:20px">Migration order</h2><ol style="padding-left:20px"><li>Dual-write sessions to Redis and Postgres<br>${ich('PLT-204', { w: 170 })}</li><li>Switch reads behind the flag<br>${ich('PLT-218', { w: 170 })}</li></ol></div>
      </div>
      <span class="d-cmk" style="right:14px;bottom:16px;height:34px;padding:0 12px 0 5px;border-radius:17px;box-shadow:var(--e2);font-size:12.5px">${av('JM', 24)}3 comments</span>
    </div>
    <div class="row" style="height:64px;border-top:1px solid var(--line);justify-content:space-around;padding-bottom:10px;background:var(--canvas);flex:none">${[
      ['home', 'Home'],
      ['inbox', 'Inbox'],
      ['plus', ''],
      ['search', 'Search'],
      ['doc', 'Docs'],
    ]
      .map(([i, l], idx) => (idx === 2 ? `<span class="new-btn" style="width:42px;height:42px;border-radius:12px">${ic('plus', 20, 2.2)}</span>` : `<span style="display:grid;justify-items:center;gap:2px;font-size:10.5px;color:${idx === 4 ? 'var(--acc)' : 'var(--tx-3)'}">${ic(i, 20)}${l}</span>`))
      .join('')}</div></div>`;
}
