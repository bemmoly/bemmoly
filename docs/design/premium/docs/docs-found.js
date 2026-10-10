/* ───────── Docs components: today vs proposed ───────── */
const DF_CSS = `
.dfd{width:1440px;padding:48px 64px 64px;background:var(--canvas);color:var(--tx)}
.dfd h2{font-size:22px;font-weight:600;letter-spacing:-.015em;margin:0 0 4px}
.dfd .lead{color:var(--tx-2);font-size:14px;max-width:860px;margin-bottom:28px;line-height:1.55}
.dfd .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.dfd .bx{border:1px solid var(--line);border-radius:12px;padding:20px;background:var(--card);min-width:0}
.dfd .bx h3{font-size:13px;font-weight:600;margin:0 0 4px;display:flex;align-items:center;gap:8px}
.dfd .why{font-size:12.5px;color:var(--tx-2);margin:0 0 14px;line-height:1.5}
.dfd .r{display:flex;align-items:center;gap:10px;min-height:32px;flex-wrap:wrap}
.dfd .l{color:var(--tx-2);font-size:12.5px}
.dfd .bad{color:#c42d2d;font-size:11.5px;font-weight:600}
.dfd .wide{grid-column:span 2}
.dfd .full{grid-column:1/-1}
.dfd .aitag{font-size:10.5px;font-weight:600;padding:1px 7px;border-radius:9px;background:var(--ai-50);color:var(--ai-600)}
`;
/* today's atoms, drawn the way the code draws them */
const cPill = (t, bg, fg, mono) => `<span style="background:${bg};color:${fg};font-size:${mono ? 10 : 11}px;font-weight:600;padding:2px 6px;border-radius:4px;letter-spacing:.04em;${mono ? "font-family:'IBM Plex Mono',monospace" : ''}">${t}</span>`;
const cEmbed = (sq, k, t, bg, fg) => `<span style="display:inline-flex;align-items:center;gap:6px;border:1px solid #dfe3ea;border-radius:4px;padding:1px 4px;font:500 12px 'IBM Plex Mono',monospace;color:#1d2433"><i style="width:8px;height:8px;border-radius:1.5px;background:${sq}"></i>${k}${cPill(t, bg, fg, true)}</span>`;
const cTile = (t, bg) => `<span style="width:30px;height:30px;border-radius:7px;background:${bg};color:#fff;display:inline-grid;place-items:center;font-size:12px;font-weight:600">${t}</span>`;
const cBtn = (t) => `<span style="border:1px solid #dfe3ea;border-radius:5px;padding:2px 7px;font-size:12px;color:#1d2433;background:#fff">${t}</span>`;

function docsFoundCurrent() {
  return `<div class="px dfd"><style>${DF_CSS}</style>
  <h2>Docs components today</h2><div class="lead">Each atom below is drawn the way the Docs code on <code>main</code> draws it. The editor engine underneath is strong; what the reader sees is a mix of typed characters, shouting pills and colours borrowed from status and danger.</div>
  <div class="grid">
    <div class="bx"><h3>Issue embeds</h3><p class="why">A coloured square, the key in mono and an upper-case status badge whose colour is guessed from the status name. No title, so a reader can’t tell what PLT-204 is.</p>
      <div class="r">${cEmbed('#2b9b5a', 'PLT-204', 'CODE REVIEW', '#efe9fd', '#5a3cae')}</div><div class="r">${cEmbed('#2b9b5a', 'PLT-218', 'IN PROGRESS', '#eef3fe', '#2456c9')}</div><div class="r">${cEmbed('#2456c9', 'PLT-222', 'SELECTED', '#eef0f4', '#4b5565')}</div></div>
    <div class="bx"><h3>Page status</h3><p class="why">Upper-case pills, with no caret to say the pill is a menu. The in-review amber is the warning colour.</p>
      <div class="r">${cPill('DRAFT', '#eef0f4', '#4b5565')}${cPill('IN REVIEW', '#fdf3dc', '#8a6210')}${cPill('PUBLISHED', '#e3f4ea', '#1f7a44')}${cPill('ARCHIVED', '#eef0f4', '#6b7483')}</div>
      <div class="r"><span class="bad">Amber also marks comment highlights and stale pages.</span></div></div>
    <div class="bx"><h3>Space tiles</h3><p class="why">Initials on colours from the status and danger palette, picked by hashing the key. Product is the danger red.</p>
      <div class="r">${cTile('EN', '#2b9b5a')}${cTile('PR', '#d93838')}${cTile('HB', '#2b9b5a')}${cTile('DE', '#6b7483')}<span class="l">two spaces share a green</span></div></div>
    <div class="bx"><h3>Slash menu</h3><p class="why">Seventeen rows of text in one group, led by “Issue table from filter”. No icons, descriptions or shortcuts; no plain “Text”.</p>
      <div style="border:1px solid #dfe3ea;border-radius:8px;padding:6px;width:220px;font-size:12.5px;color:#1d2433"><div style="font-size:10.5px;font-weight:600;color:#6b7383;letter-spacing:.05em;padding:2px 8px">BLOCKS</div>${['Issue table from filter', 'Decision', 'Code block', 'Callout', 'Table'].map((t, i) => `<div style="padding:6px 8px;border-radius:5px;${i === 0 ? 'background:#eef3fe;color:#2456c9;font-weight:600' : ''}">${t}</div>`).join('')}</div></div>
    <div class="bx"><h3>Table and block tools</h3><p class="why">Text buttons with typed plus and minus signs; menus mark the chosen option with a ✓ character while every other menu draws a check icon.</p>
      <div class="r">${['+ Row', '+ Column', 'Header', '− Row', '− Column'].map(cBtn).join('')}</div><div class="r">${cBtn('Delete table')}<span style="font-size:12.5px">Info ✓</span><span style="font-size:12.5px">Proposed ✓</span></div></div>
    <div class="bx"><h3>Typed symbols</h3><p class="why">Characters stand in for icons across Docs: compare, folds, moved blocks, shortcuts and every “add” link.</p>
      <div class="r" style="font-size:13px;gap:14px"><span>v1 → v2</span><span>⋯ 5 unchanged</span><span>↑ moved</span><span style="font-family:'IBM Plex Mono',monospace;font-size:11px;border:1px solid #dfe3ea;border-radius:3px;padding:0 4px">⌘⌥M</span></div><div class="r" style="font-size:13px;gap:14px;color:#2456c9"><span>+ New page</span><span>+ Comment</span><span>+ Add label</span></div></div>
    <div class="bx"><h3>Search results</h3><p class="why">Every palette row, page or issue, is a ▮ on a grey tile; pages show the space key where issues show their key.</p>
      <div class="r"><span style="width:16px;height:16px;border-radius:3px;background:#6b7483;color:#fff;display:inline-grid;place-items:center;font-size:9px">▮</span><span style="font:500 11.5px 'IBM Plex Mono',monospace;color:#6b7383">ENG</span><span style="font-size:13px">RFC: Move sessions to Postgres</span></div></div>
    <div class="bx"><h3>AI, when AI is off</h3><p class="why">A suggested fix with “Apply fix” renders on any comment that has one, and a TL;DR card promises it “updates with the doc”, without checking the AI setting. The AI token equals the accent.</p>
      <div style="border:1px solid #dfe3ea;border-radius:8px;padding:8px 10px;font-size:12.5px;background:#f6f8fd"><span style="color:#2456c9">●</span> Code says 30. Replace with “stay valid for 30 minutes”?<div style="color:#2456c9;font-weight:600;margin-top:6px">Apply fix</div></div></div>
    <div class="bx"><h3>Page icons and covers</h3><p class="why">The API stores an icon per page but nothing lets you pick one, and the tree hides icon names that lists show. No covers.</p>
      <div class="r"><span class="l">Every page:</span><span style="color:#6b7383">${ic('doc', 16)}</span><span style="font-size:13px">Platform</span><span style="color:#6b7383">${ic('doc', 16)}</span><span style="font-size:13px">Postmortems</span></div></div>
  </div></div>`;
}

function docsFoundProposed() {
  const callout = (i, c, bg, t) => `<div class="d-callout" style="background:${bg};margin:0 0 8px;font-size:13px"><span style="color:${c}">${ic(i, 16)}</span><span>${t}</span></div>`;
  return `<div class="px dfd"><style>${DF_CSS}</style>
  <h2>Docs components, proposed</h2><div class="lead">The same drawn icon set and glyph families as Work. Docs adds page icons, a cover, inline and card issue embeds, presence and comment marks, and one rule for AI: lilac, and only when AI is on.</div>
  <div class="grid">
    <div class="bx"><h3>Issue embeds</h3><p class="why">Inline: type tile, key, title, status glyph. As a block: the issue card with status, priority, assignee, sprint and epic. Live, and editable from the embed’s menu.</p>
      <div class="r">${ich('PLT-204', { w: 200 })}</div><div class="r">${ich('PLT-218', { w: 200 })}</div><div class="r">${ich('PLT-198', { w: 200 })}</div></div>
    <div class="bx"><h3>Page status</h3><p class="why">The status glyph family, sentence case, a caret. Draft is to-do grey, in review is in-progress blue, published is done green.</p>
      <div class="r">${['draft', 'review', 'published', 'archived'].map((k) => `<span class="btn sm ghost" style="box-shadow:inset 0 0 0 1px var(--line)">${pst(k, 13)}${ic('down', 11)}</span>`).join('')}</div></div>
    <div class="bx"><h3>Spaces and pages</h3><p class="why">Space tiles use the entity palette and the logo’s corner ratio. Page icons are drawn icons in one of eight tints; the default is the doc icon in ink.</p>
      <div class="r">${Object.keys(SPACES).map((k) => stile(k, 30)).join('')}</div><div class="r">${['platform', 'rfc', 'runbook', 'pms', 'q4', 'welcome', 'principles', 'adr'].map((k) => pg(k, 18)).join('')}${pgi('doc', 18)}</div></div>
    <div class="bx wide"><h3>Slash menu</h3><p class="why">Grouped, with an icon tile, a one-line description and the markdown shortcut that does the same thing. Basic blocks first.</p>
      <div style="position:relative;height:186px"><div class="d-pop" style="position:relative;width:372px;padding:6px;display:inline-block;vertical-align:top">
        <div class="d-sl on"><span class="ti">${ic('text', 17)}</span><span><div class="l">Text</div><div class="d">Just start writing</div></span><span></span></div>
        <div class="d-sl"><span class="ti">${ic('h2', 17)}</span><span><div class="l">Heading</div><div class="d">A section title, in the outline</div></span><span class="kbd">##</span></div>
        <div class="d-sl"><span class="ti">${ic('link', 17)}</span><span><div class="l">Issue</div><div class="d">Embed a live issue</div></span><span class="kbd">#</span></div></div>
        <div class="d-pop" style="position:relative;width:340px;padding:6px;display:inline-block;vertical-align:top;margin-left:16px"><div class="d-grp">AI <span class="aitag" style="margin-left:4px">Only when AI is on</span></div>
        <div class="d-sl ai"><span class="ti">${ic('spark', 17)}</span><span><div class="l">Continue writing</div><div class="d">From where the cursor is</div></span><span></span></div>
        <div class="d-sl ai"><span class="ti">${ic('spark', 17)}</span><span><div class="l">Summarise this page</div><div class="d">Adds a summary block at the top</div></span><span></span></div></div></div></div>
    <div class="bx"><h3>Callouts</h3><p class="why">Info, note, decided, warning and danger; each tone has its icon, never colour alone.</p>
      ${callout('callout', 'var(--acc)', 'var(--acc-50)', 'Info: the flag is on in staging.')}${callout('check', 'var(--done)', 'rgba(31,157,85,.1)', 'Decided: 30 minute TTL.')}${callout('alert', 'var(--amber)', 'var(--amber-50)', 'Warning: no rollback after day 7.')}</div>
    <div class="bx"><h3>Presence and comments</h3><p class="why">Faces in the header; a caret with a name that fades after 3s idle; amber anchors with a margin marker showing who and how many.</p>
      <div class="r" style="font-size:14px">The new service${caret('Jonas M.', JM_C)} keeps <span class="d-chl">sessions valid</span></div><div class="r" style="gap:16px;margin-top:6px"><span style="position:relative;display:inline-block;width:52px;height:24px">${cmk('JM', 2, 0, 0)}</span><span class="l">margin marker</span>${dpresence(['AK', 'JM', 'PN'])}<span class="l">header faces</span></div></div>
    <div class="bx"><h3>Changes</h3><p class="why">The existing in-place diff, drawn with the signal colours and a gutter bar per changed block.</p>
      <div class="r" style="font-size:14px;position:relative;padding-left:12px"><span class="d-chg" style="left:0;top:6px;bottom:6px;background:var(--amber)"></span>Warm for <span class="d-del">a week</span><span class="d-ins">7 days</span></div><div class="r">${'<span class="chip ok">1 added</span><span class="chip warn">1 edited</span><span class="chip red">1 removed</span>'}</div></div>
    <div class="bx"><h3>AI, lilac and only when on <span class="aitag">AI on</span></h3><p class="why">A summary block, the bubble’s Ask AI and a comment’s suggested fix. With AI off none of these render, not even greyed.</p>
      <div class="d-ai"><div class="lab">${ic('spark', 13)}Summary · from the page, 2h ago</div><div style="font-size:13px;margin-top:4px;line-height:1.5">Sessions move from Redis to Postgres in four flagged steps; rollback is a flag flip.</div></div>
      <div class="r" style="margin-top:8px"><span class="btn sm" style="color:var(--ai-600)">${ic('spark', 13)}Apply suggested fix</span><span class="btn sm" style="color:var(--ai-600)">${ic('spark', 13)}Ask AI</span></div></div>
  </div></div>`;
}
