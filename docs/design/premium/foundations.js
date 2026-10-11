/* ───────── Foundations: the visual language, current vs proposed ───────── */
const F_CSS = `
.fd{width:1440px;padding:48px 64px 64px;background:var(--canvas);color:var(--tx)}
.fd h2{font-size:22px;font-weight:600;letter-spacing:-.015em;margin:0 0 4px}
.fd .lead{color:var(--tx-2);font-size:14px;max-width:820px;margin-bottom:28px}
.fd .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.fd .box{border:1px solid var(--line);border-radius:12px;padding:20px;background:var(--card)}
.fd .box h3{font-size:13px;font-weight:600;margin:0 0 4px}
.fd .box .why{font-size:12.5px;color:var(--tx-2);margin:0 0 16px;line-height:1.5}
.fd .r{display:flex;align-items:center;gap:10px;min-height:30px}
.fd .r .l{color:var(--tx-2);font-size:12.5px}
.fd .bad{color:#c42d2d;font-size:11.5px;font-weight:600}
.fd .good{color:#1f7a44;font-size:11.5px;font-weight:600}
.fd .sw{width:34px;height:34px;border-radius:8px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.06)}
.fd .wide{grid-column:span 2}
.fd .full{grid-column:1/-1}
`;
/* current Unicode glyph icons, reproduced exactly as glyphs.tsx draws them */
const curType = (bg, g, round, s = 16) =>
  `<span style="display:inline-flex;align-items:center;justify-content:center;width:${s}px;height:${s}px;background:${bg};color:#fff;border-radius:${round ? '50%' : '3px'};font-size:${s >= 16 ? 9 : 9}px;font-weight:600;line-height:1;font-family:'IBM Plex Sans',sans-serif">${g}</span>`;
const curPri = (g, c) => `<span style="font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:600;color:${c}">${g}</span>`;
const curPill = (t, bg, fg) => `<span style="background:${bg};color:${fg};font-size:11px;font-weight:600;padding:2px 7px;border-radius:4px;letter-spacing:.04em">${t}</span>`;
const curAv = (bg, fg, t, s = 22) => `<span style="width:${s}px;height:${s}px;border-radius:50%;background:${bg};color:${fg};display:inline-grid;place-items:center;font-size:${s === 24 ? 9.5 : 10}px;font-weight:600">${t}</span>`;
const curTile = (t, s, r, bg) => `<span style="width:${s}px;height:${s}px;border-radius:${r}px;background:${bg};color:#fff;display:inline-grid;place-items:center;font-size:12px;font-weight:600">${t}</span>`;

function foundCurrent() {
  const types = [
    ['#2b9b5a', '▮', 0, 'Story', 'a bar on the “Done” green'],
    ['#2456c9', '✓', 0, 'Task', 'a tick on the accent: reads as “checked”'],
    ['#d93838', '●', 1, 'Bug', 'a dot in a red circle: reads as “recording”'],
    ['#8b5cf6', '◆', 0, 'Epic', 'the “In review” violet'],
    ['#e0632a', '!', 1, 'Incident', 'the “High priority” orange'],
    ['#6b7483', '–', 0, 'Sub-task', 'a dash on grey'],
  ];
  return `<div class="px fd"><style>${F_CSS}</style>
  <h2>Foundations today</h2><div class="lead">Every glyph below is drawn the way the code draws it today. The type and priority “icons” are Unicode characters that none of the bundled fonts contain, so <b>what you see here depends on your operating system's fallback font</b>. That is the root of “task types don't feel like icons”.</div>
  <div class="grid">
    <div class="box"><h3>Issue types</h3><p class="why">A white Unicode character on a 14–16px tile. Four of six colours are borrowed from status or priority.</p>
      ${types.map(([c, g, r, n, d]) => `<div class="r">${curType(c, g, r)}${curType(c, g, r, 14)}<b style="width:64px;font-weight:550">${n}</b><span class="l">${d}</span></div>`).join('')}</div>
    <div class="box"><h3>Priority</h3><p class="why">Arrow characters set as text in mono at a faked 600 weight. “=” is just text. ⇈ and ⇊ fall back to another font, so one set has two typefaces.</p>
      ${[['⇈', '#c42d2d', 'Highest'], ['↑', '#e0632a', 'High'], ['=', '#d49a1a', 'Medium · 2.49:1 contrast'], ['↓', '#2b9b5a', 'Low'], ['⇊', '#8a93a3', 'Lowest']].map(([g, c, n]) => `<div class="r"><span style="width:18px;text-align:center">${curPri(g, c)}</span><span class="l">${n}</span></div>`).join('')}
      <div class="r" style="margin-top:10px"><span class="bad">Green means “low priority” here, and “done” on statuses, and “story” on types.</span></div></div>
    <div class="box"><h3>Status</h3><p class="why">Upper-case pills in five colours. Letter-spacing changes by size; the tone is guessed from the status name with a regex.</p>
      <div class="r" style="flex-wrap:wrap;gap:8px">${curPill('TO DO', '#eef0f4', '#4b5565')}${curPill('SELECTED', '#eef0f4', '#4b5565')}${curPill('IN PROGRESS', '#eef3fe', '#2456c9')}${curPill('IN REVIEW', '#efe9fd', '#5a3cae')}${curPill('QA', '#fdf3dc', '#8a6210')}${curPill('DONE', '#e3f4ea', '#1f7a44')}</div>
      <div class="r" style="margin-top:12px"><span class="bad">Home's “My work” maps only three tones, so review and QA lose their colours there.</span></div></div>

    <div class="box"><h3>Theme presets break the types</h3><p class="why">Presets change the accent; type colours are tied to it.</p>
      ${[['Rose', '#be123c', '✓', '#d93838', '●', 'Task and Bug are both red'], ['Midnight', '#a78bfa', '✓', '#8b5cf6', '◆', 'Task and Epic are both violet'], ['Forest', '#1f7a44', '✓', '#2b9b5a', '▮', 'Task and Story are both green'], ['Ocean', '#38bdf8', '✓', null, null, 'white on sky is 2.1:1']].map(([p, a, g, b, g2, d]) => `<div class="r"><b style="width:66px;font-weight:550">${p}</b>${curType(a, g, 0)}${b ? curType(b, g2, g2 === '●') : ''}<span class="l">${d}</span></div>`).join('')}</div>
    <div class="box"><h3>Epic colours: three palettes</h3><p class="why">Assigned by position, not stored on the epic, so one epic changes colour between screens.</p>
      <div class="r"><span style="width:130px"></span><span class="l" style="width:58px">Backlog</span><span class="l" style="width:52px">Board</span><span class="l">Issue</span></div>
      ${[['Auth service', '#2456c9', '#2456c9'], ['Billing v2', '#8b5cf6', '#8b5cf6'], ['Observability', '#075985', '#2b9b5a'], ['Self-serve onb.', '#9a4a16', '#d49a1a']].map(([n, b, c]) => `<div class="r"><span style="width:130px;font-weight:500">${n}</span><span style="width:58px"><i style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${b}"></i></span><span style="width:52px"><i style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${c}"></i></span><i style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#2456c9"></i>${b !== c ? '<span class="bad">differs</span>' : ''}</div>`).join('')}
      <div class="r"><span class="bad">The board palette includes the danger red, so an epic can look like an error.</span></div></div>
    <div class="box"><h3>Four tile recipes</h3><p class="why">Workspace, project and module tiles are built separately in each place.</p>
      <div class="r" style="gap:16px;align-items:flex-end">${[['BO', 30, 7, '#2456c9', 'Home module<br>(“Board”, not Work)'], ['PC', 32, 7, 'linear-gradient(135deg,#2456c9,#6a8fe8)', 'Project<br>settings'], ['PC', 32, 5, '#2456c9', 'Backlog<br>sidebar']].map(([t, s, r, bg, l]) => `<div style="display:grid;justify-items:center;gap:6px">${curTile(t, s, r, bg)}<span class="l" style="text-align:center;font-size:11.5px">${l}</span></div>`).join('')}</div>
      <div class="r" style="margin-top:10px"><span class="bad">The module tile ignores the Board icon that already exists.</span></div></div>

    <div class="box wide"><h3>Logo against the product</h3><p class="why">The mark is soft, tilted and four-coloured. Nothing else in the UI uses its shapes or its lilac and mid-blue; the wordmark is small next to the mark; the colours never follow the theme.</p>
      <div style="display:flex;gap:28px;align-items:center">
        <div style="border:1px solid var(--line);border-radius:8px;padding:12px 16px;display:flex;align-items:center;gap:22px;font-size:13.5px;color:#3b4454"><span style="display:flex;align-items:center;gap:9px;padding-right:14px;border-right:1px solid #e2e5ea">${mark(24)}<b style="font-weight:600;color:#1b2430;font-size:13px">Bemmoly</b></span>Your work<span>Board</span><span>Backlog</span><span style="background:#2456c9;color:#fff;padding:5px 12px;border-radius:6px;font-weight:600">Create</span></div>
        <div style="background:#13171d;border-radius:8px;padding:12px 16px;display:flex;align-items:center;gap:10px;color:#dfe3ea">${mark(24)}<b style="font-weight:600">Bemmoly</b><span class="bad" style="color:#ff8f8f">mark 2.55:1 on dark</span></div>
      </div>
      <div class="r" style="margin-top:14px;gap:14px"><span class="sw" style="background:#9a85ea"></span><span class="l">Logo lilac <b>#9A85EA</b>: used nowhere in the UI</span><span class="sw" style="background:#8b5cf6"></span><span class="l">Epic and review violet <b>#8B5CF6</b>: a second, louder purple</span><span class="sw" style="background:#5b7be5"></span><span class="l">Logo mid blue: unused</span></div></div>
    <div class="box"><h3>Avatars</h3><p class="why">Six pastel pairs. Initials get smaller as the avatar gets bigger (24px uses 9.5px, 22px uses 10px).</p>
      <div class="r">${[['#d7e3fb', '#2456c9', 'RS'], ['#fde2cf', '#9a4a16', 'PN'], ['#e0f2fe', '#075985', 'AK'], ['#d7f0e0', '#1f7a44', 'JM'], ['#fbe3ee', '#a0245f', 'LT']].map(([b, f, t]) => curAv(b, f, t)).join('')}</div>
      <div class="r" style="margin-top:8px"><span class="bad">Pastel initials disappear on dark mode and on the grey page background.</span></div></div>

    <div class="box full"><h3>Tokens</h3><p class="why">The scale is wider than any one screen needs, so every screen picks slightly different steps.</p>
      <div style="display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:28px">
        <div><div class="l" style="margin-bottom:8px">7 text greys (contrast on white)</div><div class="r" style="gap:6px">${[['#1b2430', '15.6'], ['#2c3545', '12.9'], ['#3b4454', '10.2'], ['#4b5565', '7.6'], ['#6b7483', '4.8'], ['#8a93a3', '3.1'], ['#a2aab8', '2.3']].map(([c, r]) => `<div style="display:grid;justify-items:center;gap:4px"><span class="sw" style="background:${c}"></span><span style="font-size:10.5px;color:${parseFloat(r) < 4.5 ? '#c42d2d' : 'var(--tx-2)'}">${r}</span></div>`).join('')}</div><div class="l" style="margin-top:8px">The most used grey (tx5, 153 uses) fails body-text contrast.</div></div>
        <div><div class="l" style="margin-bottom:8px">19 font sizes, 8 of them between 9 and 12.5px</div><div style="display:flex;flex-wrap:wrap;gap:6px;align-items:baseline">${[9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 15, 16, 18, 20, 22, 24, 26, 30].map((s) => `<span style="font-size:${s}px;line-height:1">Aa</span>`).join('')}</div></div>
        <div><div class="l" style="margin-bottom:8px">11 corner radii, all in use</div><div class="r" style="gap:6px;flex-wrap:wrap">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 99].map((r) => `<span style="width:26px;height:26px;border:1.5px solid #8a93a3;border-radius:${r}px"></span>`).join('')}</div><div class="l" style="margin-top:8px">5 shadows that don't form a scale (card .05, pop .06, menu .12, modal .35).</div></div>
      </div></div>
  </div></div>`;
}

function foundProposed() {
  return `<div class="px fd"><style>${F_CSS}</style>
  <h2>Proposed foundations</h2><div class="lead">One icon system drawn as SVG, colour families that never borrow from each other, and a shape language taken from the logo: every tile in the product (types, projects, modules, the workspace) uses the logo tile's corner ratio of about 24%.</div>
  <div class="grid">
    <div class="box"><h3>Issue types</h3><p class="why">SVG glyphs on a rounded tile. Type colours are their own family, fixed across themes, and each glyph is recognisable without colour.</p>
      ${Object.keys(TYPES).map((t) => `<div class="r">${ty(t, 20)}${ty(t, 16)}${ty(t, 14)}<b style="width:70px;font-weight:550">${TYPES[t].label}</b><span class="l">${{ epic: 'lightning on violet', story: 'bookmark on green', task: 'tick on blue', bug: 'bug on red', subtask: 'branch on teal' }[t]}</span></div>`).join('')}
      <div class="r" style="margin-top:8px"><span class="good">Custom types pick a colour from this family and an icon from the icon set.</span></div></div>
    <div class="box"><h3>Priority</h3><p class="why">A signal-bar glyph in the neutral ink. Only Urgent gets colour, so a board isn't a rainbow of arrows and the red means something.</p>
      ${['urgent', 'high', 'medium', 'low', 'none'].map((p) => `<div class="r">${pr(p, 16)}<span style="text-transform:capitalize;font-weight:500;width:70px">${p === 'none' ? 'No priority' : p}</span><span class="l">${{ urgent: 'the only red on a card', high: 'three bars', medium: 'two bars', low: 'one bar', none: 'three dashes' }[p]}</span></div>`).join('')}</div>
    <div class="box"><h3>Status</h3><p class="why">The circle fills as work moves right. Colour follows the category only (grey, blue, green), so any custom workflow still reads correctly.</p>
      ${Object.keys(STATUS).map((s) => `<div class="r">${stc(s, 16)}<span style="font-weight:500">${STATUS[s].label}</span></div>`).join('')}</div>

    <div class="box"><h3>Labels and epics</h3><p class="why">Labels are outlined pills with a colour dot, so they never compete with type or status. Epics keep the colour stored on the epic, the same on every screen.</p>
      <div class="r" style="flex-wrap:wrap;gap:6px">${['api', 'auth', 'security', 'infra', 'ops', 'billing', 'bug-bash'].map(lb).join('')}</div>
      <div style="margin-top:12px;display:grid;gap:6px">${Object.keys(EPICS).map((e) => ep(e)).join('')}</div></div>
    <div class="box"><h3>One tile component</h3><p class="why">Workspace, project, module and team tiles share one component with the logo's corner ratio.</p>
      <div class="r" style="gap:18px;align-items:flex-end">
        <div style="display:grid;justify-items:center;gap:6px"><span class="ws-tile" style="width:32px;height:32px;border-radius:8px;font-size:15px">A</span><span class="l" style="font-size:11.5px">Workspace</span></div>
        <div style="display:grid;justify-items:center;gap:6px">${pt('PLT', 32)}<span class="l" style="font-size:11.5px">Project</span></div>
        <div style="display:grid;justify-items:center;gap:6px">${mt('work', 32)}<span class="l" style="font-size:11.5px">Work</span></div>
        <div style="display:grid;justify-items:center;gap:6px">${mt('docs', 32)}<span class="l" style="font-size:11.5px">Docs</span></div>
        <div style="display:grid;justify-items:center;gap:6px">${mt('ai', 32)}<span class="l" style="font-size:11.5px">AI</span></div></div></div>
    <div class="box"><h3>Avatars</h3><p class="why">Solid, mid-tone colours with white initials at 42% of the size. Readable at 16px, and on light or dark.</p>
      <div class="r">${Object.keys(PEOPLE).map((p) => av(p, 24)).join('')}</div>
      <div class="r">${Object.keys(PEOPLE).map((p) => av(p, 18)).join('')}${av(null, 18)}<span class="l">unassigned is a dashed ring</span></div></div>

    <div class="box wide"><h3>The logo becomes the system</h3><p class="why">The four tiles already describe the product. Give each one a job, and the brand runs through the whole UI instead of sitting in the corner.</p>
      <div style="display:flex;gap:36px;align-items:center">
        <div style="position:relative;width:200px;height:200px">${mark(200)}</div>
        <div style="display:grid;gap:14px;font-size:13px">
          <div class="r"><span class="sw" style="background:#2356C9"></span><div><b>#2356C9 · the two foundation tiles</b><div class="l">The accent: primary buttons, focus, selection. Also the Work module colour.</div></div></div>
          <div class="r"><span class="sw" style="background:#5B7BE5"></span><div><b>#5B7BE5 · the mid tile</b><div class="l">The Docs module colour, and the accent in dark mode (it holds 4.6:1 on #111418).</div></div></div>
          <div class="r"><span class="sw" style="background:#9A85EA"></span><div><b>#9A85EA · the tilted tile</b><div class="l">AI, and only AI. Epics move to their own violet (#6E56CF) so there is one purple meaning “AI”.</div></div></div>
        </div></div></div>
    <div class="box"><h3>Lockup and placement</h3><p class="why">Bemmoly holds the top-left of the sidebar on every screen, re-cut so the word carries next to the mark. The workspace name sits under it. See the Logo placement tab for custom logos.</p>
      <div style="display:grid;gap:14px">
        <div class="r" style="gap:8px">${mark(22)}<b style="font-size:17px;font-weight:600;letter-spacing:-.02em">Bemmoly</b><span class="l" style="margin-left:8px">sign-in, setup, loading</span></div>
        <div class="r" style="gap:8px;background:#111418;border-radius:8px;padding:10px 12px;color:#e8ebf1">${mark(20)}<b style="font-size:15px;font-weight:600;letter-spacing:-.02em">Bemmoly</b><span style="margin-left:auto;font-size:11.5px;color:#8a93a3">dark: tiles lift 8%</span></div>
        <div style="width:240px;background:var(--side);border-radius:8px;padding:8px 4px 0">${brandBlock()}</div>
        <div class="r" style="gap:8px;color:var(--tx-3);font-size:12px">${mark(14, 'style="filter:grayscale(1);opacity:.7"')}Bemmoly 0.2.2 · sidebar footer, links to What's new</div></div></div>

    <div class="box full"><h3>Tokens, reduced</h3><p class="why">Fewer steps, chosen once. Every screen in the proposal uses only these.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:28px">
        <div><div class="l" style="margin-bottom:8px">3 text greys, all ≥ 4.5:1</div><div class="r" style="gap:8px">${[['#161B26', 'Primary', '16.9'], ['#4B5264', 'Secondary', '8.0'], ['#6B7383', 'Muted', '4.8']].map(([c, n, r]) => `<div style="display:grid;justify-items:center;gap:4px"><span class="sw" style="background:${c}"></span><span style="font-size:10.5px">${n}</span><span class="good">${r}</span></div>`).join('')}</div></div>
        <div><div class="l" style="margin-bottom:8px">7 sizes · 400 / 500 / 600</div>${[[24, 'Page greeting'], [20, 'Page title'], [16, 'Section'], [14, 'Reading'], [13, 'UI default'], [12, 'Secondary'], [11, 'Meta']].map(([s, n]) => `<div class="r" style="min-height:0;gap:10px"><span style="font-size:${s}px;font-weight:${s >= 16 ? 600 : 450};width:56px">Aa</span><span class="l">${s}px · ${n}</span></div>`).join('')}</div>
        <div><div class="l" style="margin-bottom:8px">4 radii + full</div><div class="r" style="gap:10px">${[4, 6, 8, 12, 99].map((r) => `<div style="display:grid;justify-items:center;gap:4px"><span style="width:32px;height:32px;border:1.5px solid var(--acc);border-radius:${r}px"></span><span class="l" style="font-size:11px">${r === 99 ? 'full' : r}</span></div>`).join('')}</div><div class="l" style="margin-top:10px">4 chips · 6 controls · 8 cards · 12 dialogs</div></div>
        <div><div class="l" style="margin-bottom:8px">3 elevations</div><div style="display:grid;gap:12px;background:var(--sunken);padding:14px;border-radius:10px">${[['--e1', 'Cards, controls'], ['--e2', 'Menus, popovers'], ['--e3', 'Dialogs, palette']].map(([v, n]) => `<div style="background:var(--card);box-shadow:var(${v});border-radius:8px;padding:8px 10px;font-size:12px">${n}</div>`).join('')}</div></div>
      </div></div>
  </div></div>`;
}
