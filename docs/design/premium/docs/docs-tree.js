/* ───────── Where the space tree lives: the decision, drawn ───────── */
const TP_CSS = `
.tpd{width:1440px;padding:48px 64px 64px;background:var(--canvas);color:var(--tx)}
.tpd h2{font-size:22px;font-weight:600;letter-spacing:-.015em;margin:0 0 4px}
.tpd .lead{color:var(--tx-2);font-size:14px;max-width:900px;margin-bottom:26px;line-height:1.55}
.tpd .g3{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.tpd .op{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--card);display:flex;flex-direction:column}
.tpd .op.rec{box-shadow:0 0 0 2px var(--acc)}
.tpd .op .shot{background:var(--sunken);border-bottom:1px solid var(--line);height:300px;position:relative;overflow:hidden}
.tpd .op .cp{padding:14px 16px 16px}
.tpd .op .cp b{display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:600;margin-bottom:4px}
.tpd .op .cp p{margin:0 0 8px;color:var(--tx-2);font-size:12.5px;line-height:1.5}
.tpd .pc{display:grid;grid-template-columns:16px 1fr;gap:6px;font-size:12.5px;line-height:1.45;color:var(--tx-2);margin-top:4px}
.tpd .tag{font-size:10.5px;font-weight:600;padding:1px 7px;border-radius:9px;background:var(--acc-50);color:var(--acc)}
.tpd .tag.n{background:var(--sunken);color:var(--tx-2);box-shadow:inset 0 0 0 1px var(--line)}
.tpd h3{font-size:15px;font-weight:600;margin:34px 0 4px}
.tpd .sub2{color:var(--tx-2);font-size:13px;margin-bottom:14px}
.tpd .rules{display:grid;grid-template-columns:1fr 1fr;gap:12px 28px;margin-top:6px}
.tpd .rule{display:grid;grid-template-columns:22px 1fr;gap:10px;font-size:13px;line-height:1.5;color:var(--tx-2)}
.tpd .rule b{color:var(--tx);font-weight:600}
.tpd .rule i{width:22px;height:22px;border-radius:50%;background:var(--acc-50);color:var(--acc);display:grid;place-items:center;font-style:normal;font-weight:700;font-size:11px}
`;
function miniFrame(sideW, colW, colInner, sideInner, pageInner) {
  return `<div style="position:absolute;inset:14px 14px 0 14px;border-radius:10px 10px 0 0;background:var(--canvas);box-shadow:var(--e1);display:flex;overflow:hidden">
    <div style="width:${sideW}px;background:var(--side);border-right:1px solid var(--line);padding:8px 6px;flex:none">${sideInner}</div>
    ${colW ? `<div style="width:${colW}px;border-right:1px solid var(--line);padding:8px 6px;flex:none;background:var(--canvas)">${colInner}</div>` : ''}
    <div style="flex:1;padding:16px 14px;min-width:0">${pageInner}</div></div>`;
}
const bar = (w, o = 1, c = 'var(--line)', h = 6) => `<div style="height:${h}px;width:${w}%;border-radius:3px;background:${c};opacity:${o};margin:0 0 7px"></div>`;
const miniPage = (w = 100) => `<div style="max-width:${w}%">${bar(70, 1, 'var(--tx-3)', 9)}${bar(40, 0.6, 'var(--line)', 5)}<div style="height:10px"></div>${[92, 88, 95, 60, 0, 90, 85, 70].map((x) => (x ? bar(x) : '<div style="height:8px"></div>')).join('')}</div>`;
const sRow = (t, o = {}) => `<div style="display:flex;align-items:center;gap:5px;height:19px;padding-left:${4 + (o.d || 0) * 9}px;border-radius:5px;font-size:10px;color:${o.on ? 'var(--tx)' : 'var(--tx-2)'};${o.on ? 'background:var(--card);box-shadow:var(--e1);font-weight:600' : ''};white-space:nowrap;overflow:hidden">${o.icon || ''}<span style="overflow:hidden;text-overflow:ellipsis">${t}</span></div>`;
const sSec = (t, k) => `<div style="display:flex;align-items:center;gap:5px;font-size:9px;font-weight:600;color:var(--tx-3);margin:8px 4px 3px">${mt(k, 10)}${t}</div>`;
function sideA() {
  return `<div style="display:flex;align-items:center;gap:6px;padding:2px 4px 8px">${mark(14)}<b style="font-size:11px">Bemmoly</b></div>
    ${sRow('Home', { icon: ic('home', 10) })}${sRow('Inbox', { icon: ic('inbox', 10) })}
    ${sSec('Work', 'work')}${sRow('Platform Core', { icon: pt('PLT', 10) })}
    ${sSec('Docs', 'docs')}${sRow('Engineering', { icon: stile('ENG', 10) })}
    ${sRow('Platform', { d: 1, icon: pg('platform', 9) })}${sRow('RFC: Sessions', { d: 2, on: true, icon: pg('rfc', 9) })}${sRow('Auth runbook', { d: 2, icon: pg('runbook', 9) })}${sRow('Postmortems', { d: 1, icon: pg('pms', 9) })}
    ${sRow('Product', { icon: stile('PROD', 10) })}${sRow('Handbook', { icon: stile('HB', 10) })}`;
}
function sideB() {
  return `<div style="display:flex;align-items:center;gap:6px;padding:2px 4px 8px">${mark(14)}<b style="font-size:11px">Bemmoly</b></div>
    ${sRow('Home', { icon: ic('home', 10) })}${sRow('Inbox', { icon: ic('inbox', 10) })}
    ${sSec('Work', 'work')}${sRow('Platform Core', { icon: pt('PLT', 10) })}
    ${sSec('Docs', 'docs')}${sRow('Engineering', { icon: stile('ENG', 10), on: true })}${sRow('Product', { icon: stile('PROD', 10) })}${sRow('Handbook', { icon: stile('HB', 10) })}`;
}
const colB = () => `<div style="font-size:10px;font-weight:600;padding:2px 4px 6px">Engineering</div>${sRow('Platform', { icon: pg('platform', 9) })}${sRow('RFC: Sessions', { d: 1, on: true, icon: pg('rfc', 9) })}${sRow('Auth runbook', { d: 1, icon: pg('runbook', 9) })}${sRow('Postmortems', { icon: pg('pms', 9) })}`;

function treePlacement() {
  const A = miniFrame(150, 0, '', sideA(), miniPage(86));
  const B = miniFrame(110, 120, colB(), sideB(), miniPage(100));
  const C = miniFrame(110, 0, '', sideB(), `<div style="font-size:10px;color:var(--tx-3);margin-bottom:8px">Engineering / Platform / RFC</div>${miniPage(92)}`);
  const pc = (good, t) => `<div class="pc"><span style="color:${good ? 'var(--done)' : 'var(--red)'}">${ic(good ? 'check' : 'x', 14, 2)}</span><span>${t}</span></div>`;
  const ctx = dframe({
    page: 'rfc',
    header: pageHeader({}),
    body: pageBody({ peer: true }),
    tree: [
      tn(1, pg('platform'), 'Platform', { kids: true, open: true }),
      tn(2, pg('rfc'), PAGES.rfc.t, { on: true }),
      `<div class="d-drop" style="margin:0 6px 0 48px"></div>`,
      tn(2, pg('runbook'), PAGES.runbook.t),
      `<div style="height:28px"></div>`,
      tn(2, pg('oncall'), PAGES.oncall.t, { drag: true, style: 'position:absolute;left:58px;top:66px;width:172px;opacity:.97' }),
      tn(1, pg('adr'), PAGES.adr.t, { kids: true }),
      tn(1, pg('pms'), 'Postmortems', { kids: true }),
    ],
  });
  const focus = `<div class="px" style="width:240px;height:420px;background:var(--side);border-radius:10px;box-shadow:var(--e1);padding:10px 8px;overflow:hidden">
    ${brandBlock()}
    <div class="nav" style="color:var(--tx-2)">${ic('left', 15)}<span>All of Docs</span><span class="kbd" style="margin-left:auto">Esc</span></div>
    <div class="row" style="gap:8px;padding:8px 8px 6px">${stile('ENG', 20)}<b style="font-weight:600" class="grow">Engineering</b><span class="muted">${ic('more', 15)}</span></div>
    <div class="search-btn" style="margin:2px 0 8px;height:28px">${ic('filter', 14)}<span class="grow">Filter 214 pages</span><span class="kbd">F</span></div>
    ${[
      tn(0, pg('platform'), 'Platform', { kids: true, open: true }),
      tn(1, pg('rfc'), PAGES.rfc.t, { on: true }),
      tn(1, pg('runbook'), PAGES.runbook.t),
      tn(1, pg('oncall'), PAGES.oncall.t),
      tn(1, pgi('doc'), 'Deploy pipeline', { kids: true }),
      tn(0, pg('adr'), PAGES.adr.t, { kids: true, cnt: 38 }),
      tn(0, pg('pms'), 'Postmortems', { kids: true, cnt: 41 }),
      tn(0, pgi('doc'), 'Onboarding', { kids: true, cnt: 12 }),
      tn(0, pgi('doc'), 'Team rituals', { kids: true }),
    ].join('')}</div>`;
  return `<div class="px tpd"><style>${TP_CSS}</style>
    <h2>Where the space tree lives</h2>
    <div class="lead">Today a 260px space tree sits inside the page, beside an app with no sidebar of its own. With the one frame, the app already has a 240px sidebar. Keeping the space tree as a second column would spend 480px on navigation before the first word of a document. Three ways to resolve it:</div>
    <div class="g3">
      <div class="op rec"><div class="shot">${A}</div><div class="cp"><b>A. Inside the sidebar’s Docs section <span class="tag">Recommended</span></b><p>Spaces are rows like projects; the current space expands in place to show its pages. Drag to reorder and nest, + and ··· on hover, right-click for the rest.</p>
        ${pc(true, 'One navigation model for Work and Docs; nothing moves when you switch modules.')}${pc(true, 'The page keeps 1200px: room for a 700px column, the outline and the comment rail.')}${pc(true, 'Pages, projects and spaces are all one keyboard path: ↑↓ through the sidebar.')}${pc(false, 'A deep space makes the sidebar long. Answered by focus mode, below.')}</div></div>
      <div class="op"><div class="shot">${B}</div><div class="cp"><b>B. A second column beside the sidebar <span class="tag n">Today’s model, reframed</span></b><p>The sidebar lists spaces; the space’s tree is its own 240px column that only Docs has.</p>
        ${pc(true, 'A big tree gets its own scroll and room.')}${pc(false, '480px of chrome; the reading column is squeezed below 1280px.')}${pc(false, 'Docs looks like a different product from Work again.')}${pc(false, 'Two places to look for “where am I”.')}</div></div>
      <div class="op"><div class="shot">${C}</div><div class="cp"><b>C. No persistent tree <span class="tag n">Minimal</span></b><p>The sidebar lists spaces only. You move through pages with breadcrumbs, the space overview and search.</p>
        ${pc(true, 'The calmest page; fine for small wikis.')}${pc(false, 'Loses the sense of place that makes a wiki usable.')}${pc(false, 'Reordering and nesting pages needs a separate screen.')}</div></div>
    </div>
    <h3>In context: dragging a page in the sidebar</h3><div class="sub2">“On-call handbook” is being dragged above “Auth service runbook”: a lifted row under the pointer, its old place closed up, and an accent drop line whose left edge shows the depth.</div>
    <div style="display:flex;gap:28px;align-items:flex-start">
      <div style="width:1008px;height:630px;border-radius:12px;overflow:hidden;box-shadow:var(--e2);flex:none;position:relative"><div style="transform:scale(.7);transform-origin:0 0;position:absolute;left:0;top:0">${ctx}</div></div>
      <div style="display:grid;gap:16px;font-size:13px;color:var(--tx-2);line-height:1.5">
        <div><b style="color:var(--tx)">Drop where you mean</b><br>The drop line’s left edge shows the depth: before, after, or (with a pause over a row) inside it. Esc cancels; a refused drop explains why (“You can’t edit Product”).</div>
        <div><b style="color:var(--tx)">Hover reveals, never hides</b><br>+ adds a page inside, ··· opens the same menu as right-click: Rename, Duplicate, Move to…, Copy link, Star, Move to trash.</div>
        <div><b style="color:var(--tx)">Keyboard</b><br>↑↓ move, → / ← open and close, Enter opens, F2 renames, ⌥↑↓ reorders, ⌥→ nests.</div>
        <div><b style="color:var(--tx)">It follows you</b><br>Opening a page from search or a link reveals and scrolls to its row. Open and closed state is remembered per person.</div>
      </div></div>
    <h3>Big spaces: focus mode</h3><div class="sub2">A space with hundreds of pages takes the whole sidebar. Double-click the space (or press F on it) and the sidebar becomes that space’s tree, with a filter. Esc goes back.</div>
    <div style="display:flex;gap:28px;align-items:flex-start">${focus}
      <div class="rules" style="flex:1">
        <div class="rule"><i>1</i><div><b>One sidebar, every module.</b> Docs draws into the Docs section through the module manifest, as Work does. No page-level tree.</div></div>
        <div class="rule"><i>2</i><div><b>Only the current space expands.</b> Other spaces stay one row each, so Work stays visible below the fold at most once.</div></div>
        <div class="rule"><i>3</i><div><b>Sections collapse and remember.</b> A writer who lives in Docs folds Work to one line; the choice is per person.</div></div>
        <div class="rule"><i>4</i><div><b>Focus mode for big spaces.</b> Over about 40 visible rows, the space header offers “Focus”, with a filter box (F).</div></div>
        <div class="rule"><i>5</i><div><b>The width is adjustable.</b> Drag the edge from 240 to 360px; double-click resets. The 56px rail shows spaces as tiles.</div></div>
        <div class="rule"><i>6</i><div><b>On phones it is the same tree</b> in the sidebar sheet, with long-press for the row menu.</div></div>
      </div></div>
  </div>`;
}
