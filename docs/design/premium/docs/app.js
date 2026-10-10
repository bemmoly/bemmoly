/* ───────── Review app: tabs, Current / Proposed / Side by side, markers ───────── */
const SEV = { 3: 'Breaks trust', 2: 'Feels cheap', 1: 'Polish' };
const state = { i: 0, m: 'cur', pins: true };
try {
  const s = JSON.parse(localStorage.getItem('bemmoly-docs-review') || '{}');
  Object.assign(state, s);
} catch (e) {}
const ALL = [...SCREENS, { id: 'plan', label: 'Plan', plan: true }];
if (state.i >= ALL.length) state.i = 0;
const save = () => {
  try {
    localStorage.setItem('bemmoly-docs-review', JSON.stringify(state));
  } catch (e) {}
};
const $ = (id) => document.getElementById(id);

function frameSize(s) {
  if (s.mobile) return [390, 844];
  return [1440, 900];
}
function sheet(mode) {
  const rows = [
    ['d-home', 'Docs home', [['No sidebar', 'bad'], ['1120 centred', 'neu']], screenDocsHome, 'Reading column'],
    ['d-space', 'Space', [['Space sidebar', 'bad'], ['900 centred', 'neu']], screenSpace, 'Reading column'],
    ['d-page', 'Page', [['Tree + page bar', 'bad'], ['720 + 340 panel', 'neu']], () => screenDocPage(), '700 column + margin'],
    ['d-comments', 'Comments', [['A panel tab', 'bad'], ['Quoted, not aligned', 'neu']], screenComments, 'Aligned rail'],
    ['d-compare', 'History', [['Modal', 'bad'], ['Behind ···', 'neu']], screenHistory, 'Page mode'],
    ['d-create-page', 'New page', [['Modal', 'bad'], ['Two titles', 'neu']], screenNewPage, 'In place'],
    ['d-trash', 'Trash', [['Restore only', 'bad'], ['900 centred', 'neu']], screenTrash, 'Table + peek'],
    ['d-palette', 'Search', [['Same icon on every row', 'bad'], ['No place or match', 'neu']], screenSearch, 'Icon, place, match'],
  ];
  const cur = mode === 'cur';
  return `<div class="sheet"><h3>${cur ? 'Eight Docs screens today: three navigation layers, four widths' : 'The same eight screens: one frame, shared with Work'}</h3>
    <div class="s">${cur ? 'Look at the left edge and the top. The space tree comes and goes, a page bar sits under the app bar, and dialogs do the work pages should.' : 'The sidebar is the one Work uses, with Docs as a section. The header, the reading column and the right margin are the same on every page.'}</div>
    <div class="g">${rows
      .map(
        ([img, t, tags, fn, lay]) =>
          `<div class="th"><div class="box">${cur ? `<img src="${IMGS[img]}" alt="">` : fn()}</div><div class="t">${t}</div><div class="k">${(cur ? tags : [['App sidebar', 'ok'], [lay, 'neu']]).map(([x, c]) => `<span class="${c}">${x}</span>`).join('')}</div></div>`,
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
    n.innerHTML = `<h2>How to read the plan</h2><p class="verdict">The visual system and the shell are already being built on <code>feat/premium-ui</code> (ADR 0015). This plan starts where that stops. Phase 1 moves Docs into the one frame and is mostly deletion. Phase 2 gives the editor the tools a writer expects. Phase 3 adds page identity and puts collaboration in the margin. Phase 4 redraws the screens around the page.</p><div class="foot">Items marked “decide” need Keerthi’s call before they’re built; they’re collected near the end of the plan. Server work is called out where the UI alone can’t deliver it.</div>`;
    return;
  }
  const cur = noteList(s, 'cur');
  const pro = noteList(s, 'pro');
  const counts = [3, 2, 1].map((k) => (s.curNotes || (s.cur.pins || []).map((p) => [p[2]])).filter((x) => x[0] === k).length);
  const legend = `<div class="legend"><span><i style="background:var(--r-s3)"></i>Breaks trust · ${counts[0]}</span><span><i style="background:var(--r-s2)"></i>Feels cheap · ${counts[1]}</span><span><i style="background:#64748b"></i>Polish · ${counts[2]}</span></div>`;
  const verdict = s.verdict ? `<p class="verdict">${s.verdict}</p>` : '';
  const ix = s.ix
    ? `<h3>Interaction</h3><div class="ix"><p><b>Primary job.</b> ${s.ix.job}</p><p><b>Top actions</b></p><ol>${s.ix.actions.map((a) => `<li>${a}</li>`).join('')}</ol><p><b>Keyboard</b></p><table>${s.ix.keys.map(([k, d]) => `<tr><td><span class="kbd">${k}</span></td><td>${d}</td></tr>`).join('')}</table><p><b>States</b></p><table>${s.ix.states.map(([k, d]) => `<tr><td><b>${k}</b></td><td>${d}</td></tr>`).join('')}</table></div>`
    : '';
  let body;
  if (state.m === 'cur') body = `${legend}${cur}`;
  else if (state.m === 'pro') body = `<div class="legend"><span><i style="background:#1f7a44"></i>What changes and why</span></div>${pro}${ix}`;
  else body = `<h3>What’s wrong</h3>${legend}${cur}<h3>What changes</h3>${pro}${ix}`;
  n.innerHTML = `<h2>${s.label}</h2>${verdict}${body}<div class="foot">Markers on the frame match the numbers here; hover either one. Findings come from reading the Docs code on <code>main</code> (ef15018) and the running app on its in-browser mock backend.</div>`;
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
    ['Navigation consistency', 1, 5, 'Space tree in the shell sidebar’s Docs section; one header; no page bar'],
    ['Layout grid', 2, 5, 'Contained 1040 for home, space and trash; page = 700 column + one right margin'],
    ['Editor affordances', 2, 5, 'Selection bubble, ⌘K links, block handles, grouped slash menu, code language'],
    ['Iconography', 2, 5, 'Glyph characters already gone on feat/premium-ui; page icons, slash and tool icons added'],
    ['Colour semantics', 2, 5, 'Spaces on the entity palette; page status on the status family; AI lilac only'],
    ['Typography and measure', 4, 5, 'Keep 15px / 1.7 and the 36px title; 700px column; one properties row'],
    ['Collaboration', 3, 5, 'Faces in the header, named carets that fade, threads aligned with anchors'],
    ['History and recovery', 3, 5, 'History as a page mode; Restore and Resolve with Undo; Delete forever in Trash'],
    ['States', 4, 5, 'Errors stay in the frame with Retry everywhere; one empty state per screen'],
    ['AI honesty', 1, 5, 'Every AI surface checks the setting; nothing AI renders when AI is off'],
    ['Responsive', 1, 4, 'Tree in the sidebar sheet, one-bar header, bottom bar, comments as a sheet'],
    ['Dark mode', 3, 5, 'Inherits the three surfaces; tuned highlight, diff and caret colours'],
  ];
  const D = 'modules/docs/web/src';
  return `<div class="doc"><h1>Docs: from “a second app” to “the same product”</h1><p>A scorecard of where Docs stands on <code>main</code>, what the proposal targets, and the order to build it in. It builds on the shell and visual system already on <code>feat/premium-ui</code> (the one frame, tokens, Icon, glyphs, EntityTile, Kbd, toasts with Undo, RelativeTime, skeletons).</p>
  <h2>Scorecard</h2><table><thead><tr><th>Dimension</th><th>Today</th><th>Target</th><th>What moves it</th></tr></thead><tbody>${rows.map(([d, c, p, w]) => `<tr><td><b>${d}</b></td><td>${sc(c, 'c')}</td><td>${sc(p, 'p')}</td><td>${w}</td></tr>`).join('')}</tbody></table>
  <h2>Already done on feat/premium-ui <span class="chipp">phase 0</span></h2>
  <div class="phase"><ul>
    <li>Glyph characters replaced in Docs: <code>${D}/comments/comment-bubble.tsx</code>, <code>${D}/history/compare-dialog.tsx</code>, <code>diff-blocks.tsx</code>, <code>diff-view.tsx</code>, <code>packages/editor/src/doc/views/callout-view.tsx</code>, <code>decision-view.tsx</code>, <code>doc/table-tools.tsx</code>; the lint rule covers both packages.</li>
    <li>Tokens, the drawn icon set (<code>packages/ui/src/icons/kit.tsx</code>), EntityTile, solid avatars, outlined labels, toasts with Undo. Docs inherits them through the aliases; nothing below re-does them.</li>
  </ul></div>
  <h2>Phase 1 · Into the one frame <span class="chipp">mostly moving and deleting</span></h2>
  <div class="phase"><h3>The tree goes to the sidebar</h3><ul>
    <li>Declare Docs’ sidebar section in <code>modules/docs/module.ts</code> through the manifest field the shell stream adds (<code>packages/shared/src/schemas/modules/manifest.ts</code>): spaces as rows, the current space expanded.</li>
    <li>Move <code>${D}/space/sidebar-tree.tsx</code>, <code>tree-store.ts</code>, <code>use-space-tree.ts</code> and <code>use-tree-actions.ts</code> into that section unchanged in behaviour (drag, ⌥ arrows, F2, optimistic moves). Restyle <code>packages/ui/src/components/page-tree/page-tree-row.tsx</code>: 28px rows, an 18px chevron target, page icons for icon names.</li>
    <li>Delete the in-page column in <code>${D}/space/space-layout.tsx</code> and the phone “pages” bar; the space switcher in <code>space-sidebar.tsx</code> goes (spaces are rows). Add focus mode and the remembered open state.</li>
  </ul></div>
  <div class="phase"><h3>One header, one layout</h3><ul>
    <li><code>${D}/page/header/page-header-bar.tsx</code> becomes the shell PageHeader’s crumbs, status and actions; the 44px bar is removed.</li>
    <li>Home, space overview and trash use <code>PageLayout variant="contained"</code> (<code>home/docs-home-screen.tsx</code>, <code>space/space-overview.tsx</code>, <code>space/trash-view.tsx</code>); the page uses <code>full</code> with its own 700px column (<code>page/page-frame.tsx</code>).</li>
    <li>Errors stay in the frame: <code>page/page-screen.tsx</code> keeps the sidebar on not-found; add Retry to <code>home/page-lists.tsx:89</code>, <code>space/sidebar-search.tsx:47</code>, <code>space/trash-view.tsx:64</code>.</li>
  </ul></div>
  <div class="phase"><h3>AI honesty <span class="chipp">ship first</span></h3><ul>
    <li>Gate the TL;DR card (<code>page/body/page-heading.tsx:81</code>) and suggested fixes (<code>comments/comment-thread.tsx:72</code>, <code>:126</code>) on the workspace AI setting; draw them in <code>--ai</code> lilac. Add a test that nothing AI renders with AI off.</li>
  </ul></div>
  <h2>Phase 2 · A writing surface</h2>
  <div class="phase"><ul>
    <li>Selection bubble: a new <code>packages/editor/src/doc/bubble-menu.tsx</code> built from the tool list in <code>editor/tools.ts</code>; ⌘K links in <code>doc/create-doc-editor.ts</code> (ported from <code>editor/create.ts:89</code>), searching pages and issues; strike and highlight marks in <code>schema/base.ts</code>.</li>
    <li>Block handles and drag: <code>doc/block-handle.tsx</code> with + and grip, a block menu (Turn into, Duplicate, Copy link to block, Delete), ⌥⇧↑↓ to move.</li>
    <li>Slash menu: <code>doc/slash-items.ts</code> gains icon, description and shortcut, groups Basic / Insert / From Work / AI, and a Text item; rows in <code>editor/suggestion-list.tsx</code>; open below the caret, flip only when there is no room.</li>
    <li>Code language picker from the list in <code>schema/nodes/code-block.ts:10</code>; table tools as icon buttons in <code>doc/table-tools.tsx</code>.</li>
    <li>The header fades while typing (a typing flag in <code>page/screen-context.ts</code>); returns on pointer move or Esc.</li>
    <li>Issue embeds: <code>modules/work/web/src/entities/issue-chip.tsx</code> draws type tile, key, title and status glyph; add the card embed. <code>${D}/links/backlinks-section.tsx</code> reuses Work’s row and de-duplicates.</li>
  </ul></div>
  <h2>Phase 3 · Identity and the margin</h2>
  <div class="phase"><ul>
    <li>Page icon picker (drawn icons in eight tints) in <code>page/body/page-title.tsx</code>; the icon field already exists (<code>modules/docs/shared/pages.ts:84</code>). Covers need an upload path <span class="chipp">decide</span> and a <code>cover</code> column (server migration).</li>
    <li>One properties row replaces the chips above the title and the About grid: <code>page/body/page-heading.tsx</code>, <code>page/panel/about-facts.tsx</code>, <code>labels-field.tsx</code>.</li>
    <li>One right margin: outline (<code>page/toc/toc-list.tsx</code>), comment markers and aligned threads (<code>comments/comments-rail.tsx</code>, <code>comment-layer.tsx</code>, <code>highlights.ts</code>) and Linked work, toggled from header buttons with counts (<code>page/slots.ts</code> gains header toggles; <code>page-slots/index.tsx</code>). Below 1280px the rail overlays.</li>
    <li>History becomes a page mode (<code>history/history-mode.tsx</code> reusing <code>diff-view.tsx</code>); Restore happens at once with Undo, so <code>restore-dialog.tsx</code> goes. Resolve gets Undo too.</li>
    <li>Caret names fade after 3s idle (<code>collab/extensions.ts</code>).</li>
  </ul></div>
  <h2>Phase 4 · Around the page</h2>
  <div class="phase"><ul>
    <li>Create in place: <code>create/use-create-page.ts</code> makes “Untitled” where you are and opens it; templates render inside the empty page; <code>create/create-page-dialog.tsx</code> stays only for the global Create menu.</li>
    <li>Docs home and space overview as drawn (<code>home/*</code>, <code>space/space-overview.tsx</code>): Jump back in, one list with four lenses, Needs you, Start here.</li>
    <li>Trash: preview peek, Delete forever and Empty trash with typed confirmation, a retention period <span class="chipp">decide</span> (server: routes and a purge job in <code>modules/docs/server</code>).</li>
    <li>Search: page icon, breadcrumb and matching line from <code>modules/docs/server/src/services/palette/index.ts</code>; real icons in <code>apps/web/src/hooks/command-items.ts</code>; scope chip.</li>
    <li>Import: a parent picker and source tiles in <code>transfer/import-dialog.tsx</code>; progress in Inbox. Export… with Markdown, HTML and PDF (<code>packages/editor/src/convert/to-html.ts</code> plus print CSS).</li>
    <li>Phone: the tree in the sidebar sheet, one-bar header, comments as a sheet.</li>
  </ul></div>
  <h2>Needs Keerthi’s decision</h2>
  <div class="phase"><ul>
    <li><b>Tree placement:</b> A (sidebar section, recommended) vs B (second column). Everything above assumes A.</li>
    <li><b>Covers:</b> ship covers now with drawn patterns only, or wait for uploads and storage.</li>
    <li><b>Share:</b> keep “Share” as an honest who-can-see popover plus Copy link, or rename it Copy link until per-page permissions exist.</li>
    <li><b>Commenting permission:</b> today commenting needs edit rights; the proposal lets readers comment (a space permission).</li>
    <li><b>Trash retention:</b> 30 days, and whether non-admins may delete forever.</li>
  </ul></div>
  <h2>Guardrails</h2>
  <div class="phase"><ul>
    <li>Visual snapshots of every Docs route inside the frame, so a page without the sidebar fails CI.</li>
    <li>A test per AI surface that it is absent with AI off.</li>
    <li>Docs uses Work’s IssueRow and glyphs; no copies of Work components in Docs.</li>
  </ul></div></div>`;
}

render();
