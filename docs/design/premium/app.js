/* ───────── Review app: tabs, Current / Proposed / Side by side, markers ───────── */
const SEV = { 3: 'Breaks trust', 2: 'Feels cheap', 1: 'Polish' };
const state = { i: 0, m: 'cur', pins: true };
try {
  const s = JSON.parse(localStorage.getItem('bemmoly-review') || '{}');
  Object.assign(state, s);
} catch (e) {}
const ALL = [...SCREENS, { id: 'plan', label: 'Plan', plan: true }];
if (state.i >= ALL.length) state.i = 0;
const save = () => {
  try {
    localStorage.setItem('bemmoly-review', JSON.stringify(state));
  } catch (e) {}
};
const $ = (id) => document.getElementById(id);

function frameSize(s) {
  if (s.mobile) return [390, 844];
  return [1440, 900];
}
function sheet(mode) {
  const rows = [
    ['board', 'Board', [['No sidebar', 'bad'], ['Full bleed', 'neu']], screenBoard],
    ['backlog', 'Backlog', [['Project sidebar', 'bad'], ['Full bleed', 'neu']], screenBacklog],
    ['issue', 'Issue', [['No sidebar', 'bad'], ['1240 centred', 'neu']], screenIssue],
    ['home', 'Home', [['No sidebar', 'bad'], ['1280 centred', 'neu']], screenHome],
    ['projects', 'Projects', [['No sidebar', 'bad'], ['1240 centred', 'neu']], screenProjects],
    ['psettings', 'Project settings', [['Settings sidebar #2', 'bad'], ['960 left', 'neu']], screenProjectSettings],
    ['teams', 'Workspace settings', [['Settings sidebar #3', 'bad'], ['1120 left', 'neu']], screenTeams],
    ['inbox', 'Inbox', [['No sidebar', 'bad'], ['800 centred', 'neu']], screenInbox],
  ];
  const cur = mode === 'cur';
  return `<div class="sheet"><h3>${cur ? 'Eight screens today: four navigation models, seven widths' : 'The same eight screens: one frame'}</h3>
    <div class="s">${cur ? 'Look at the left edge of each thumbnail. The sidebar appears, disappears and changes design; the content starts somewhere new each time.' : 'Sidebar, header, tabs and toolbar sit in the same place on every screen. Only the content changes.'}</div>
    <div class="g">${rows
      .map(
        ([img, t, tags, fn]) =>
          `<div class="th"><div class="box">${cur ? `<img src="${IMGS[img]}" alt="">` : fn()}</div><div class="t">${t}</div><div class="k">${(cur ? tags : [['App sidebar', 'ok'], [['board', 'backlog', 'inbox'].includes(img) ? 'Full bleed' : 'Reading column', 'neu']]).map(([x, c]) => `<span class="${c}">${x}</span>`).join('')}</div></div>`,
      )
      .join('')}</div></div>`;
}
function inner(s, mode) {
  const side = s[mode];
  if (side.kind === 'sheet') return { html: sheet(mode), w: 1440, h: null };
  if (side.img) {
    const [w, h] = frameSize(s);
    return { html: `<img src="${IMGS[side.img]}" width="${w}" height="${h}" alt="${s.label}, current">`, w, h };
  }
  const [w, h] = frameSize(s);
  return { html: side.render(), w, h: s.tall ? null : h };
}
function pinsHtml(s, mode) {
  const list = s[mode].pins || [];
  return list
    .map((p, n) => {
      const cls = mode === 'cur' ? 's' + p[2] : 'p';
      return `<span class="pin ${cls}" data-n="${n}" style="left:${p[0]}px;top:${p[1]}px">${n + 1}</span>`;
    })
    .join('');
}
function frameEl(s, mode, avail) {
  const { html, w, h } = inner(s, mode);
  const wrap = document.createElement('div');
  wrap.className = 'fw';
  wrap.dataset.mode = mode;
  const fi = document.createElement('div');
  fi.className = 'fi';
  fi.style.width = w + 'px';
  fi.innerHTML = html + `<div class="pins">${pinsHtml(s, mode)}</div>`;
  wrap.appendChild(fi);
  const maxScale = s.mobile ? 1 : 1;
  const sc = Math.min(maxScale, avail / w);
  wrap.style.width = w * sc + 'px';
  fi.style.transform = `scale(${sc})`;
  requestAnimationFrame(() => {
    const hh = h || fi.scrollHeight;
    fi.style.height = hh + 'px';
    wrap.style.height = hh * sc + 'px';
  });
  if (h) {
    fi.style.height = h + 'px';
    wrap.style.height = h * sc + 'px';
  }
  return wrap;
}
function caption(mode, s) {
  if (mode === 'cur')
    return `<span class="badge cur">● CURRENT</span><span>${s.cur.img ? `Real screenshot of the app on main, ${s.mobile ? '390 × 844' : '1440 × 900'}` : s.cur.kind === 'sheet' ? 'Real screenshots' : 'Drawn exactly as the code draws it today'}</span>`;
  return `<span class="badge pro">● PROPOSED</span><span>Live HTML, same data, same ${s.mobile ? '390 × 844' : '1440 × 900'} frame</span>`;
}
function renderStage() {
  const s = ALL[state.i];
  const st = $('stage');
  st.innerHTML = '';
  if (s.plan) {
    st.innerHTML = planDoc();
    return;
  }
  const avail = st.clientWidth - 48;
  if (state.m === 'split') {
    const g = document.createElement('div');
    g.className = 'split';
    ['cur', 'pro'].forEach((m) => {
      const col = document.createElement('div');
      col.innerHTML = `<div class="cap">${caption(m, s)}</div>`;
      col.appendChild(frameEl(s, m, (avail - 20) / 2));
      g.appendChild(col);
    });
    st.appendChild(g);
  } else {
    const cap = document.createElement('div');
    cap.className = 'cap';
    cap.innerHTML = caption(state.m, s);
    st.appendChild(cap);
    st.appendChild(frameEl(s, state.m, s.mobile ? Math.min(avail, 420) : avail));
  }
  st.querySelectorAll('.pin').forEach((p) => {
    const mode = p.closest('.fw').dataset.mode;
    p.addEventListener('mouseenter', () => hl(mode, +p.dataset.n, true));
    p.addEventListener('mouseleave', () => hl(mode, +p.dataset.n, false));
    p.addEventListener('click', () => {
      const el = document.querySelector(`.note[data-m="${mode}"][data-n="${p.dataset.n}"]`);
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  });
}
function hl(mode, n, on) {
  document.querySelectorAll(`.fw[data-mode="${mode}"] .pin[data-n="${n}"]`).forEach((x) => x.classList.toggle('hl', on));
  document.querySelectorAll(`.note[data-m="${mode}"][data-n="${n}"]`).forEach((x) => x.classList.toggle('hl', on));
}
function noteList(s, mode) {
  const curList = s.curNotes || (s.cur.pins || []).map((p) => [p[2], p[3], p[4]]);
  const proList = s.proNotes ? s.proNotes.map(([t, b]) => [null, t, b]) : (s.pro.pins || []).map((p) => [null, p[2], p[3]]);
  const pinned = mode === 'cur' ? !s.curNotes : !s.proNotes;
  const list = mode === 'cur' ? curList : proList;
  return list
    .map(([sev, t, b], n) => {
      const cls = mode === 'cur' ? 's' + sev : 'p';
      return `<div class="note" data-m="${pinned ? mode : ''}" data-n="${n}"><span class="num ${cls}">${n + 1}</span><div><b>${t}${mode === 'cur' ? `<span class="sevtag s${sev}">${SEV[sev]}</span>` : ''}</b><p>${b}</p></div></div>`;
    })
    .join('');
}
function renderNotes() {
  const s = ALL[state.i];
  const n = $('notes');
  if (s.plan) {
    n.innerHTML = `<h2>How to read the plan</h2><p class="verdict">Each phase is shippable on its own. Phase 1 fixes the “eight teams built it” feeling and is mostly deleting code: three sidebars, two filter bars and three header variants become one of each. Phase 2 is the visual language. Phase 3 is the depth that makes people stay.</p><div class="foot">Changing the theme tokens or the logo colours is an ADR under AGENTS.md (“the theme is settled; proposals go through an ADR”). This review is that ADR’s evidence.</div>`;
    return;
  }
  const cur = noteList(s, 'cur');
  const pro = noteList(s, 'pro');
  const counts = [3, 2, 1].map((k) => (s.curNotes || (s.cur.pins || []).map((p) => [p[2]])).filter((x) => x[0] === k).length);
  const legend = `<div class="legend"><span><i style="background:var(--r-s3)"></i>Breaks trust · ${counts[0]}</span><span><i style="background:var(--r-s2)"></i>Feels cheap · ${counts[1]}</span><span><i style="background:#64748b"></i>Polish · ${counts[2]}</span></div>`;
  const verdict = s.verdict ? `<p class="verdict">${s.verdict}</p>` : '';
  let body;
  if (state.m === 'cur') body = `${legend}${cur}`;
  else if (state.m === 'pro') body = `<div class="legend"><span><i style="background:#1f7a44"></i>What changes and why</span></div>${pro}`;
  else body = `<h3>What’s wrong</h3>${legend}${cur}<h3>What changes</h3>${pro}`;
  n.innerHTML = `<h2>${s.label}</h2>${verdict}${body}<div class="foot">Markers on the frame match the numbers here; hover either one. Findings come from reading the code on <code>main</code> and the running app on its in-browser mock backend.</div>`;
  n.querySelectorAll('.note[data-m]').forEach((el) => {
    if (!el.dataset.m) return;
    el.addEventListener('mouseenter', () => hl(el.dataset.m, +el.dataset.n, true));
    el.addEventListener('mouseleave', () => hl(el.dataset.m, +el.dataset.n, false));
  });
}
function renderTabs() {
  $('tabs').innerHTML = ALL.map((s, i) => {
    const n = s.plan ? '' : (s.curNotes || s.cur.pins || []).length;
    return `${s.plan ? '<span class="sep"></span>' : ''}<button class="${i === state.i ? 'on' : ''}" data-i="${i}">${s.label}${n ? `<span class="n">${n}</span>` : ''}</button>`;
  }).join('');
  $('tabs').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => go(+b.dataset.i)));
  const on = $('tabs').querySelector('.on');
  if (on) on.scrollIntoView({ inline: 'nearest', block: 'nearest' });
}
function renderToggle() {
  document.querySelectorAll('.rtoggle button').forEach((b) => b.classList.toggle('on', b.dataset.m === state.m));
  document.body.classList.toggle('nopins', !state.pins);
  $('pinsBtn').setAttribute('aria-pressed', state.pins);
  $('pinsBtn').textContent = (state.pins ? '◉' : '○') + ' Markers';
}
function render() {
  renderTabs();
  renderToggle();
  renderStage();
  renderNotes();
  save();
}
function go(i) {
  state.i = (i + ALL.length) % ALL.length;
  $('stage').scrollTop = 0;
  $('notes').scrollTop = 0;
  render();
}
document.querySelectorAll('.rtoggle button').forEach((b) =>
  b.addEventListener('click', () => {
    state.m = b.dataset.m;
    render();
  }),
);
$('pinsBtn').addEventListener('click', () => {
  state.pins = !state.pins;
  renderToggle();
  save();
});
document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'ArrowRight') go(state.i + 1);
  else if (e.key === 'ArrowLeft') go(state.i - 1);
  else if (e.key === ' ') {
    e.preventDefault();
    state.m = state.m === 'cur' ? 'pro' : 'cur';
    render();
  } else if (e.key === 'c') {
    state.m = 'cur';
    render();
  } else if (e.key === 'p') {
    state.m = 'pro';
    render();
  } else if (e.key === 's') {
    state.m = 'split';
    render();
  } else if (e.key === 'm') {
    state.pins = !state.pins;
    renderToggle();
  }
});
let rt;
window.addEventListener('resize', () => {
  clearTimeout(rt);
  rt = setTimeout(renderStage, 120);
});

function planDoc() {
  const sc = (n, c) => `<span class="score ${c}">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? 'f' : ''}"></i>`).join('')}</span>`;
  const rows = [
    ['Navigation consistency', 1, 5, 'One AppFrame with a sidebar slot; modules declare sidebar sections'],
    ['Layout grid', 2, 5, 'PageLayout contained (1040) or full; one gutter, one top offset'],
    ['Iconography', 1, 5, 'SVG type, priority and status glyphs; lint bans glyph characters'],
    ['Colour semantics', 2, 5, 'Separate families; epics keep stored colours; AI = lilac only'],
    ['Typography', 3, 5, '7 sizes, 3 greys; mono only for keys'],
    ['Brand coherence', 2, 4, 'Brand tokens drive the accent; tile ratio; lockup moves to sign-in and setup'],
    ['Interaction depth', 2, 4, 'Peek with URL, j/k, context menus, bulk bar, inline create'],
    ['Responsive', 1, 4, 'Rail sidebar, overflow menu, single-column board on phones'],
    ['Dark mode', 3, 5, 'Three surfaces, mid-blue accent, solid avatars'],
  ];
  return `<div class="doc"><h1>From “it works” to “it’s premium”</h1><p>A scorecard of where Bemmoly stands today, what the proposal targets, and the order to do it in. Every item traces back to a finding on the other tabs.</p>
  <h2>Scorecard</h2><table><thead><tr><th>Dimension</th><th>Today</th><th>Target</th><th>What moves it</th></tr></thead><tbody>${rows.map(([d, c, p, w]) => `<tr><td><b>${d}</b></td><td>${sc(c, 'c')}</td><td>${sc(p, 'p')}</td><td>${w}</td></tr>`).join('')}</tbody></table>
  <h2>Phase 1 · Make it one product <span class="chipp">mostly deletion</span></h2>
  <div class="phase"><h3>One frame</h3><ul>
    <li>Add <code>AppFrame</code> to <code>packages/core-web</code> with <code>sidebar | header | content</code> slots. Today <code>app-shell.tsx</code> renders only a top bar and an outlet.</li>
    <li>Extend the module manifest (<code>packages/shared/src/schemas/modules/manifest.ts</code>) with <code>icon</code>, <code>color</code> and <code>sidebar: [{ section, items, scope }]</code>, so Work and later Docs draw into the same sidebar.</li>
    <li>Replace <code>backlog/project-nav.tsx</code>, <code>settings/project-nav.tsx</code> and <code>settings-layout.tsx</code> with one <code>Sidebar</code> whose contents swap between app and settings.</li>
    <li>Move Teams out of the top nav. Make project settings and Members tabs of the project.</li>
  </ul></div>
  <div class="phase"><h3>One page anatomy</h3><ul>
    <li><code>PageLayout variant="contained|full"</code>: 1040px column or full bleed, 24px gutter, 24px top. This replaces seven max-widths and five top offsets.</li>
    <li><code>PageHeader</code> everywhere, with breadcrumbs built from the route (every crumb links), the project switcher in the crumb, and view tabs.</li>
    <li>One scroll region per page; the header sticks on every page.</li>
    <li>Persist the last project. Create opens over the current page, not <code>/work/create</code> over Projects.</li>
  </ul></div>
  <div class="phase"><h3>One dialect per component</h3><ul>
    <li>One <code>IssueRow</code> (Backlog, Home, Inbox, search) and one <code>IssueCard</code>, both showing the same fields in the same order.</li>
    <li>One <code>FilterBar</code> shared by Board and Backlog, with the same filtering semantics.</li>
    <li>One button size per context (30px header and toolbar, 26px in rows), and a retry on every error state.</li>
  </ul></div>
  <h2>Phase 2 · Make it look designed <span class="chipp">needs an ADR</span></h2>
  <div class="phase"><ul>
    <li>Redraw <code>glyphs.tsx</code> as SVG: type tiles, priority bars, status circles. Add an ESLint rule that bans <code>▮ ● ✓ ◆ ⇈ ⇊ → ✕ ▾</code> in JSX.</li>
    <li>Token diet: 3 text greys, 2 lines, 3 surfaces, 7 font sizes, 4 radii, 3 elevations. Fix <code>tx5</code> contrast (153 uses).</li>
    <li>Colour families: <code>--type-*</code> fixed across presets, <code>--status-{todo,progress,done}</code>, epics from their stored <code>color</code>, <code>--ai</code> = lilac. Remove <code>--violet</code>.</li>
    <li>Brand tokens <code>--brand-1/2/3</code> from the logo; <code>--ac</code> = <code>--brand-1</code>; dark accent = <code>--brand-2</code>. Decide whether presets recolour the mark or are limited to neutrals.</li>
    <li>One <code>EntityTile</code> (workspace, project, module, team) with the logo's corner ratio, and modules showing their icon. Solid avatars.</li>
  </ul></div>
  <h2>Phase 3 · Make it feel fast and deep</h2>
  <div class="phase"><ul>
    <li>Peek panel with <code>?issue=KEY</code> in the URL, single click everywhere, ↑↓ / j k to step.</li>
    <li>Inline create on columns (the <code>onAdd</code> prop already exists), C for new issue, a bulk-action bar for Backlog multi-select, right-click menus on cards and rows.</li>
    <li>Saved views and a List view; command palette with recents and context actions; Inbox triage (snooze, done, two panes).</li>
    <li>Presence avatars, absolute-time tooltips on every relative time, a phone layout.</li>
  </ul></div>
  <h2>Guardrails so it stays premium</h2>
  <div class="phase"><ul>
    <li>Lint rules: no glyph characters, no hex in components, sizes only from the scale.</li>
    <li>A Storybook “Screen anatomy” story and visual snapshots of the frame on every route, so a page without a sidebar fails CI.</li>
    <li>A short design checklist in <code>AGENTS.md</code>: frame, header, one component per idea, icons from Icon, colour from a family.</li>
  </ul></div></div>`;
}
render();
