/* ───────── Where Bemmoly's name lives, with and without a customer logo ───────── */
/* A stand-in customer logo for the fictional "Acme Labs" */
const acmeLogo = (s = 22) =>
  `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-label="Acme Labs logo"><rect width="24" height="24" rx="6" fill="#E8590C"/><path d="M6.5 17.5 12 6l5.5 11.5M8.8 13h6.4" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/* The top of the sidebar. Line one is the brand, line two the other party. */
function brandBlock(o = {}) {
  if (o.custom)
    return `<div class="bb">${acmeLogo(26)}<div class="grow" style="min-width:0"><div class="wm" style="font-size:14.5px">Acme Labs</div><div class="ws-line">on ${mark(11)}<b style="font-weight:600;color:var(--tx-2)">Bemmoly</b></div></div><span class="bb-tool">${ic('sidebar', 16)}</span></div>`;
  return `<div class="bb">${mark(24)}<div class="grow" style="min-width:0"><div class="wm">Bemmoly</div><div class="ws-line">Acme Labs ${ic('down', 11, 2)}</div></div><span class="bb-tool">${ic('sidebar', 16)}</span></div>`;
}

function brandPlacement() {
  const BP_CSS = `
  .bpd{width:1440px;padding:48px 64px 64px;background:var(--canvas);color:var(--tx)}
  .bpd h2{font-size:22px;font-weight:600;letter-spacing:-.015em;margin:0 0 4px}
  .bpd .lead{color:var(--tx-2);font-size:14px;max-width:880px;margin-bottom:26px;line-height:1.55}
  .bpd .row4{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}
  .bpd .row3{display:grid;grid-template-columns:1.25fr 1fr 1fr;gap:20px;margin-top:20px}
  .bpd .opt{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--card);display:flex;flex-direction:column}
  .bpd .opt.rec{box-shadow:0 0 0 2px var(--acc)}
  .bpd .opt .shot{background:var(--side);border-bottom:1px solid var(--line);padding:14px 10px 10px;min-height:196px;position:relative}
  .bpd .opt .cap{padding:14px 16px 16px}
  .bpd .opt .cap b{display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:600;margin-bottom:4px}
  .bpd .opt .cap p{margin:0;color:var(--tx-2);font-size:12.5px;line-height:1.5}
  .bpd .tag{font-size:10.5px;font-weight:600;padding:1px 7px;border-radius:9px;background:var(--acc-50);color:var(--acc)}
  .bpd .tag.n{background:var(--sunken);color:var(--tx-2);box-shadow:inset 0 0 0 1px var(--line)}
  .bpd h3{font-size:15px;font-weight:600;margin:34px 0 4px}
  .bpd .sub2{color:var(--tx-2);font-size:13px;margin-bottom:14px}
  .bpd .mini{border:1px solid var(--line);border-radius:12px;background:var(--card);overflow:hidden}
  .bpd .mini .lbl2{padding:10px 14px;border-top:1px solid var(--line);font-size:12.5px;color:var(--tx-2)}
  .bpd .mini .lbl2 b{color:var(--tx);font-weight:600}
  .bpd .rules{display:grid;grid-template-columns:1fr 1fr;gap:12px 28px;margin-top:6px}
  .bpd .rule{display:grid;grid-template-columns:22px 1fr;gap:10px;font-size:13px;line-height:1.5;color:var(--tx-2)}
  .bpd .rule b{color:var(--tx);font-weight:600}
  .bpd .rule i{width:22px;height:22px;border-radius:50%;background:var(--acc-50);color:var(--acc);display:grid;place-items:center;font-style:normal;font-weight:700;font-size:11px}
  `;
  const navStub = (on = 'board') =>
    `<div style="margin-top:8px">${[
      ['home', 'Home'],
      ['inbox', 'Inbox'],
      ['me', 'My issues'],
    ]
      .map(([i, l]) => `<div class="nav">${ic(i)}<span>${l}</span></div>`)
      .join('')}<div class="sec">${mt('work', 14)}<span>Work</span></div><div class="nav">${pt('PLT', 18)}<span>Platform Core</span></div></div>`;
  const side = (inner, dark) =>
    `<div class="px ${dark ? 'dark' : ''}" style="width:240px;background:var(--side);border-radius:10px;box-shadow:var(--e1);padding:10px 8px 8px;margin:0 auto">${inner}</div>`;
  const rail = (custom) => `<div style="display:grid;justify-items:center;gap:8px"><div class="px" style="width:56px;height:420px;display:flex;border-radius:10px;overflow:hidden;box-shadow:var(--e1)">${railSide({ customLogo: custom })}</div><span style="font-size:11.5px;color:var(--tx-2);font-weight:550">${custom ? 'Custom logo' : 'No logo'}</span></div>`;

  const signIn = `<div class="px" style="background:var(--sunken);height:330px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px">
      <div style="width:300px;background:var(--card);border-radius:12px;box-shadow:var(--e2);padding:22px 22px 20px;display:flex;flex-direction:column;gap:10px">
        <div class="row" style="gap:10px">${acmeLogo(28)}<b style="font-size:16px;font-weight:600">Acme Labs</b></div>
        <div style="font-size:13px;color:var(--tx-2);margin-bottom:4px">Sign in to your workspace</div>
        <div class="input">you@acmelabs.dev</div><div class="input">Password</div>
        <span class="btn primary" style="justify-content:center;height:34px">Sign in</span>
      </div>
      <div class="row" style="gap:6px;font-size:12px;color:var(--tx-3)">Powered by ${mark(13)}<b style="font-weight:600;color:var(--tx-2)">Bemmoly</b></div></div>`;
  const tab = `<div style="background:#dfe3ea;height:330px;padding:14px 14px 0;display:flex;flex-direction:column;gap:14px">
      <div style="display:flex;gap:4px;align-items:flex-end">
        <div class="px" style="background:var(--canvas);border-radius:9px 9px 0 0;padding:8px 12px;display:flex;align-items:center;gap:8px;width:260px;font-size:12px">${mark(14)}<span class="trunc">Sprint 14 · Platform Core · Bemmoly</span>${ic('x', 12)}</div>
        <div style="padding:8px 12px;font-size:12px;color:#6b7383;display:flex;align-items:center;gap:8px">${mark(14, 'style="opacity:.75"')}Inbox · Bemmoly</div></div>
      <div class="px" style="background:var(--canvas);border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:10px;font-size:12.5px;flex:1">
        <div class="muted" style="font-weight:600;font-size:11.5px">Sidebar footer, every screen</div>
        <div class="row" style="gap:8px;color:var(--tx-3);border:1px solid var(--line);border-radius:8px;padding:8px 10px">${mark(14)}<span><b style="color:var(--tx-2);font-weight:600">Bemmoly</b> 0.2.2</span><span style="margin-left:auto;color:var(--acc);font-weight:550">What’s new</span></div>
        <div class="muted" style="font-weight:600;font-size:11.5px;margin-top:6px">Email footer</div>
        <div style="border:1px solid var(--line);border-radius:8px;padding:10px 12px;color:var(--tx-3);line-height:1.5">You’re getting this because you watch PLT-228.<br><span class="row" style="gap:6px;margin-top:6px">${mark(12)}Sent by <b style="color:var(--tx-2);font-weight:600">Bemmoly</b> for Acme Labs</span></div></div></div>`;
  const boot = `<div class="px" style="background:var(--canvas);height:330px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px">
      <div style="position:relative;width:64px;height:64px">${mark(64)}</div>
      <div class="bar" style="width:120px"><i style="width:45%;background:var(--acc)"></i></div>
      <div class="muted" style="font-size:12px">Opening Acme Labs…</div></div>`;

  return `<div class="px bpd"><style>${BP_CSS}</style>
    <h2>Where Bemmoly’s name lives</h2>
    <div class="lead">A Bemmoly install has exactly one workspace (the company name typed in the setup wizard), so there is nothing to switch between. The top-left goes back to Bemmoly, with the workspace name under it. A workspace can upload its own logo later; when it does, Bemmoly moves to the second line rather than disappearing, and keeps its place on sign-in, in the browser tab, the sidebar footer and every email.</div>
    <div class="row4">
      <div class="opt rec"><div class="shot">${side(brandBlock() + navStub())}</div><div class="cap"><b>Default <span class="tag">Recommended</span></b><p>Bemmoly lockup on line one, the workspace on line two. The chevron opens a workspace menu (settings, invite people, what’s new, about), not a switcher.</p></div></div>
      <div class="opt"><div class="shot">${side(brandBlock({ custom: true }) + navStub())}</div><div class="cap"><b>Custom logo uploaded <span class="tag n">Later</span></b><p>The customer’s logo and name take line one. “on Bemmoly” with the mark takes line two and can’t be switched off in settings.</p></div></div>
      <div class="opt"><div class="shot" style="display:flex;justify-content:center;gap:28px">${rail(false)}${rail(true)}</div><div class="cap"><b>Sidebar collapsed</b><p>No logo: the Bemmoly mark leads the rail. Custom logo: the customer’s logo leads, and the Bemmoly mark moves to the foot of the rail, above the avatar, where the expanded sidebar shows “Bemmoly 0.2.2”.</p></div></div>
      <div class="opt"><div class="shot" style="background:#0c0f13">${side(brandBlock() + navStub(), true)}</div><div class="cap"><b>Dark</b><p>The same block. The mark keeps its four colours; the wordmark switches to the light ink.</p></div></div>
    </div>
    <h3>In context: collapsed, with a customer logo</h3><div class="sub2">The Board with the sidebar folded to a rail. Acme’s logo leads; hovering the Bemmoly mark at the foot shows the version and What’s new.</div>
    <div style="display:flex;gap:28px;align-items:flex-start">
      <div style="width:1008px;height:630px;border-radius:12px;overflow:hidden;box-shadow:var(--e2);flex:none;position:relative"><div style="transform:scale(.7);transform-origin:0 0;position:absolute;left:0;top:0">${screenBoard(false, { collapsed: true, customLogo: true, tip: true })}</div></div>
      <div style="display:grid;gap:16px;font-size:13px;color:var(--tx-2);line-height:1.5">
        <div><b style="color:var(--tx)">Top of the rail</b><br>The customer’s logo. Clicking it expands the sidebar, where the full block reads “Acme Labs · on Bemmoly”.</div>
        <div><b style="color:var(--tx)">Foot of the rail</b><br>The Bemmoly mark in full colour, between Settings and the avatar. It never moves, whatever the theme.</div>
        <div><b style="color:var(--tx)">Board gets the room</b><br>The rail frees 184px, enough for a sixth column or wider cards.</div>
        <div><b style="color:var(--tx)">Remembered per person</b><br>Collapsed or expanded is a personal setting, with [ as the shortcut.</div>
      </div></div>
    <h3>Everywhere else it stays visible</h3><div class="sub2">These carry the name even when a customer has replaced the logo in the sidebar.</div>
    <div class="row3">
      <div class="mini">${signIn}<div class="lbl2"><b>Sign-in page.</b> The customer’s logo leads; “Powered by Bemmoly” sits under the card.</div></div>
      <div class="mini">${tab}<div class="lbl2"><b>Tab, footer, email.</b> The favicon and title end in Bemmoly; the version line opens What’s new.</div></div>
      <div class="mini">${boot}<div class="lbl2"><b>Loading.</b> The mark is the first thing anyone sees, on every visit.</div></div>
    </div>
    <h3>Rules</h3>
    <div class="rules">
      <div class="rule"><i>1</i><div><b>Bemmoly always holds the top-left.</b> Either the full lockup, or “on Bemmoly” under a customer logo, or the mark on the collapsed rail.</div></div>
      <div class="rule"><i>2</i><div><b>No workspace switcher.</b> One install is one workspace. The name under the logo opens a workspace menu instead.</div></div>
      <div class="rule"><i>3</i><div><b>Uploading a logo replaces line one only.</b> Settings › Appearance explains this next to the upload box, with a preview of the block.</div></div>
      <div class="rule"><i>4</i><div><b>The name survives off-screen too.</b> Sign-in, favicon and title, the sidebar footer, email footers, the loading screen.</div></div>
      <div class="rule"><i>5</i><div><b>Custom themes don’t recolour the mark.</b> Today a custom theme repaints the four tiles; the logo should keep its colours, as it does on every preset.</div></div>
      <div class="rule"><i>6</i><div><b>Be honest about the licence.</b> MIT lets a fork remove any of this. The aim is a default so good nobody wants to, and the Bemmoly name itself can be protected as a trademark.</div></div>
    </div></div>`;
}
