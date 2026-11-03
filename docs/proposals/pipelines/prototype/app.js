/* Bemmoly Pipelines prototype: a hash-routed set of screens drawn from data.js. Nothing here talks
   to a server; buttons change local state so the flow can be clicked through. */
(() => {
  const D = window.DATA;
  const $ = (sel, root = document) => root.querySelector(sel);
  const ic = (name, cls = '') => `<i data-lucide="${name}" class="${cls}"></i>`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const svc = (key) => D.services.find((s) => s.key === key);
  const dom = (key) => D.domains.find((d) => d.key === key);
  const envOf = (key) => D.envs.find((e) => e.key === key);
  const run = (id) => D.runs.find((r) => r.id === Number(id));
  const chg = (id) => D.changes.find((c) => c.id === Number(id));
  const allJobs = () => D.graph.flatMap((g) => g.cols.flat());
  const ver = (sha) => D.versions[sha] || sha;
  let FR;

  const ui = { fresh: false, role: 'developer', overlay: null, pipelineView: 'visual', selected: 'it-dev', settingsEnv: 'prod', deploySvc: 'buyer-agent', deployEnv: 'prod', deployVer: '1.8.0', runEnv: 'stage', risk: 'Medium', picked: {}, streamed: 0, toast: null };
  const me = () => D.roles[ui.fresh ? 'admin' : ui.role];
  const can = (place) => me().sees.includes(place);
  let streamTimer = null;

  const ST = { ok: 'circle-check', bad: 'circle-x', wait: 'circle-pause', queued: 'circle-dashed', skip: 'circle-slash' };
  const st = (s, lg = false) => s === 'run'
    ? `<span class="st run${lg ? ' lg' : ''}" aria-label="Running"></span>`
    : `<span class="st ${s}${lg ? ' lg' : ''}" aria-label="${s}">${ic(ST[s] || 'circle-dashed')}</span>`;
  const avatar = (name, color = '') => `<span class="avatar sm ${color}">${esc(name.slice(0, 1))}</span>`;
  const person = (name) => D.people.find((p) => p.name === name || p.name.startsWith(name)) || { color: '' };
  const rev = (e) => e
    ? `<span class="rev"><span class="hdot ${e.h}"></span>${ver(e.rev)}<span class="sha">${e.rev}</span></span>`
    : '<span class="rev empty">Not deployed</span>';
  const ruleChip = (env) => env.approval ? `<span class="chip">${ic('clipboard-check')}Change request</span>` : '';
  const risk = (r) => `<span class="risk ${r}"><i></i>${r} risk</span>`;
  const chgStatus = (c) => {
    if (c.status === 'waiting') return `<span class="chip wait">${ic('clock')}${stepOf(c).got.length} of ${stepOf(c).need} approvals</span>`;
    if (c.status === 'approved') return `<span class="chip run">${ic('rocket')}Approved, deploying</span>`;
    if (c.status === 'deployed') return `<span class="chip ok">${ic('circle-check')}Deployed</span>`;
    if (c.status === 'rejected') return `<span class="chip bad">${ic('circle-x')}Rejected</span>`;
    return `<span class="chip">${ic('pencil')}Draft</span>`;
  };
  const stepOf = (c) => c.approvals[c.step];
  const remaining = (c) => { const a = stepOf(c); return a.assigned.filter((n) => !a.got.some((g) => g.by === n)); };
  const isMine = (c) => c.status === 'waiting' && remaining(c).includes('Ananya Iyer');
  const items = (c) => `<div class="items">${c.items.map((i) => `<span class="item"><b class="mono" style="font-weight:600">${i.svc}</b><span class="arrow-ver"><span class="from">${i.from}</span>${ic('arrow-right', 'i14 faint')}${i.to}</span></span>`).join('')}</div>`;

  /* ---------------- Shell ---------------- */
  const PLACES = [
    { id: 'home', label: 'For you', icon: 'house', match: ['home', ''] },
    { id: 'services', label: 'Services', icon: 'layout-grid', match: ['services', 'service'] },
    { id: 'runs', label: 'Runs', icon: 'play', match: ['runs', 'run'] },
    { id: 'changes', label: 'Changes', icon: 'clipboard-check', match: ['changes', 'change'] },
    { id: 'environments', label: 'Environments', icon: 'layers', match: ['environments'] },
    { id: 'platform', label: 'Platform', icon: 'server', match: ['platform'] },
  ];

  function shell(route) {
    const head = route[0] || 'home';
    const running = D.runs.filter((r) => r.st === 'run').length;
    const waiting = D.changes.filter(isMine).length;
    return `
    <div class="app">
      <nav class="rail" aria-label="Main">
        <a class="mark" href="#home" aria-label="Bemmoly Pipelines">${MARK}</a>
        ${PLACES.filter((p) => can(p.id)).map((p) => `<a class="place ${p.match.includes(head) ? 'on' : ''}" href="#${p.id}">${ic(p.icon)}<span>${p.label}</span></a>`).join('')}
        <div class="foot">
          <span class="avatar ${me().color}" title="${me().person}, ${me().label}">${me().initials}</span>
        </div>
      </nav>
      <div class="main">
        <header class="topbar">
          <div class="scope"><span class="tile">${D.org.tile}</span>${D.org.name}<span class="sep">${ic('chevron-right', 'i14')}</span><button class="sw">All domains ${ic('chevron-down', 'i14')}</button></div>
          <div class="search">${ic('search')}<span>Search</span><kbd>⌘K</kbd></div>
          <div class="viewas"><span>Prototype</span><div class="seg"><button class="${ui.fresh ? 'on' : ''}" data-act="install" data-v="fresh">Fresh install</button><button class="${ui.fresh ? '' : 'on'}" data-act="install" data-v="set">Set up</button></div></div>
          ${ui.fresh ? '' : `<div class="viewas"><span>View as</span><div class="seg">${Object.entries(D.roles).map(([k, r]) => `<button class="${ui.role === k ? 'on' : ''}" data-act="role" data-role="${k}">${r.label}</button>`).join('')}</div></div>`}
          ${ui.fresh ? '<span class="live">Nothing running</span>' : ui.role === 'approver' ? `<a class="live" href="#changes"><span class="pulse" style="background:var(--wait)"></span><span>${waiting} waiting for you</span></a>` : `<a class="live" href="#runs"><span class="pulse"></span><span>${running} running</span></a>`}
          <button class="iconbtn" data-act="theme" title="Light or dark (T)">${ic('sun-moon')}</button>
          <button class="iconbtn" title="Notifications">${ic('bell')}<span class="badge">2</span></button>
        </header>
        <main class="content" id="content"></main>
      </div>
    </div>`;
  }

  function noAccess(place) {
    return `<div class="wrap"><div class="noaccess">${ic('eye-off')}<h1>Not part of your view</h1><p class="muted" style="margin:0">${me().person} is a ${me().label}. ${place} is for ${place === 'Environments' || place === 'Platform' ? 'Platform admins' : 'developers and admins'}. Approvers see changes sent to them and what is live.</p><a class="btn" href="#home">Back to For you</a></div></div>`;
  }

  /* ---------------- For you ---------------- */
  function home() {
    if (ui.role === 'approver') return approverHome();
    const running = D.runs.filter((r) => r.st === 'run');
    const mine = chg(1042);
    const first = me().person.split(' ')[0];
    return `<div class="wrap">
      <div class="hello">
        <div class="t"><span class="eyebrow">Tuesday, 3 November</span><h1>Good afternoon, ${first}</h1><span class="muted">${running.length} pipelines running, CHG-1042 ${mine.status === 'approved' ? 'is approved and deploying' : 'needs one more approval'}, and supplier is failing on Dev.</span></div>
        <button class="btn" data-act="runpipe">${ic('play')}Run a pipeline</button>
        <button class="btn primary" data-act="deploy" data-svc="buyer-agent" data-env="prod">${ic('arrow-up-right')}Promote a version</button>
      </div>

      <div class="stats">
        ${[['38', 'Deploys this week', 'rocket', '+12%'], ['6', 'Changes to Production', 'clipboard-check', '5 approved, 1 rejected'], ['3 h 10 min', 'Change approval, median', 'timer', 'request to deploy'], ['1', 'Service failing now', 'circle-x', 'supplier on Dev']]
          .map(([v, l, i, s]) => `<div class="card stat"><span>${ic(i, 'i14')}${l}</span><b>${v}</b><span class="faint">${s}</span></div>`).join('')}
      </div>

      <div class="cols">
        <div style="display:grid;gap:20px;min-width:0">
          <div class="card">
            <div class="ch"><h2>Needs you</h2><span class="chip">${ui.role === 'admin' ? 3 : 2}</span></div>
            <div class="needs">
              <div class="need">
                ${st('bad', true)}
                <div class="t"><b>supplier 2.3.1 failed on Dev</b><span>Integration tests: 2 failed in invoices › gst · Arun's commit 9e01f2c · Dev rolled back to 2.3.0</span></div>
                <a class="btn sm" href="#run/1281">Open run</a>
              </div>
              <div class="need">
                ${st(mine.status === 'approved' ? 'run' : 'wait', true)}
                <div class="t"><b>CHG-1042 ${mine.status === 'approved' ? 'is approved and deploying' : 'needs one more approval'}</b><span>buyer-agent 1.8.0 and storefront-web 4.1.0 to Production · Riya Menon approved, Ananya Iyer is next</span></div>
                <a class="btn sm" href="#change/1042">Open change</a>
              </div>
              ${ui.role === 'admin' ? `<div class="need">${ic('link', 'faint')}<div class="t"><b>robbie-tools isn't linked to an environment</b><span>Bemmoly can deploy to it, but no environment uses it.</span></div><a class="btn sm" href="#platform">Review</a></div>` : ''}
            </div>
          </div>
          <div class="card">
            <div class="ch"><h2>Running now</h2><a class="btn ghost sm" href="#runs">All runs ${ic('arrow-right', 'i14')}</a></div>
            ${running.map(runRow).join('')}
          </div>
        </div>
        <div class="card">
          <div class="ch"><h2>Your services</h2><span class="faint" style="font-size:12px">Dev · Stage · Production</span></div>
          ${D.services.filter((s) => ['Engineering', 'Web'].includes(s.team)).map((s) => `
            <a class="runrow" href="#service/${s.key}" style="grid-template-columns: 28px minmax(0,1fr) auto">
              <span class="svc-name"><span class="ico">${ic(s.icon, 'i14')}</span></span>
              <span class="t"><b class="mono">${s.key}</b><span>${dom(s.domain).name} · Production ${s.env.prod ? ver(s.env.prod.rev) : 'not yet'}</span></span>
              <span style="display:flex;gap:6px">${['dev', 'stage', 'prod'].map((e) => `<span class="hdot ${s.env[e] ? s.env[e].h : 'none'}" title="${envOf(e).name}"></span>`).join('')}</span>
            </a>`).join('')}
        </div>
      </div>
    </div>`;
  }

  function approverHome() {
    const waiting = D.changes.filter(isMine);
    const decided = D.changes.filter((c) => ['deployed', 'rejected', 'approved'].includes(c.status));
    return `<div class="wrap">
      <div class="hello"><div class="t"><span class="eyebrow">Tuesday, 3 November</span><h1>Good afternoon, Ananya</h1><span class="muted">${waiting.length ? `${waiting.length} change is waiting for your approval.` : 'Nothing is waiting for you.'} Approved changes deploy themselves.</span></div></div>
      <div class="cols">
        <div style="display:grid;gap:20px;min-width:0">
          <div class="card"><div class="ch"><h2>Waiting for you</h2><span class="chip wait">${waiting.length}</span></div>
            ${waiting.length ? waiting.map((c) => `<div class="chgcard" style="border-bottom:1px solid var(--line-2)">
              <div class="top2"><span class="chg-id">CHG-${c.id}</span><b>${esc(c.title)}</b>${risk(c.risk)}</div>
              ${items(c)}
              <p class="prose" style="font-size:13.5px;color:var(--tx-2)">${esc(c.why)}</p>
              <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span class="faint" style="font-size:12.5px;flex:1">${c.by} asked you ${c.at} · ${stepOf(c).got.map((g) => g.by).join(', ')} approved · you're ${stepOf(c).got.length + 1} of ${stepOf(c).need}</span><a class="btn sm" href="#change/${c.id}">Open</a><button class="btn sm ok" data-act="approvechg" data-id="${c.id}">${ic('check', 'i14')}Approve</button></div>
            </div>`).join('') : `<div class="cb muted">You're all caught up.</div>`}
          </div>
          <div class="card"><div class="ch"><h2>Decided recently</h2><a class="btn ghost sm" href="#changes">All changes ${ic('arrow-right', 'i14')}</a></div>
            ${decided.map((c) => `<a class="runrow" href="#change/${c.id}" style="grid-template-columns:minmax(0,1fr) auto"><span class="t"><b>CHG-${c.id} · ${esc(c.title)}</b><span>${c.items.map((i) => `${i.svc} ${i.to}`).join(', ')} · ${c.at}</span></span>${chgStatus(c)}</a>`).join('')}
          </div>
        </div>
        <div class="card"><div class="ch"><h2>Live in Production</h2></div>
          <table class="table">${D.services.filter((s) => s.env.prod).map((s) => `<tr><td class="mono" style="font-size:12.5px;white-space:nowrap">${s.key}</td><td>${rev(s.env.prod)}</td></tr>`).join('')}</table>
        </div>
      </div>
    </div>`;
  }

  function runRow(r) {
    return `<a class="runrow" href="#run/${r.id}">
      ${st(r.st)}
      <span class="t"><b>${esc(r.title)}</b><span><span class="mono">${r.svc}</span> · ${r.pipeline} #${r.id} · ${r.trigger} by ${r.by}</span></span>
      <span style="display:grid;gap:6px;justify-items:end"><span class="minibar">${r.bar.map((x) => `<i class="${x}"></i>`).join('')}</span><span class="faint num" style="font-size:12px">${r.dur}</span></span>
    </a>`;
  }

  /* ---------------- Services ---------------- */
  function services() {
    return `<div class="wrap">
      <div class="head"><div class="t"><h1>Services</h1><span class="muted">${D.services.length} services in 3 domains. The version running in each environment, and whether it's healthy.</span></div>
        <button class="btn">${ic('git-branch')}Add from GitHub</button><button class="btn primary" data-act="deploy" data-svc="buyer-agent" data-env="stage">${ic('rocket')}Deploy</button></div>
      <div class="toolbar">
        <div class="input" style="max-width:280px">${ic('search', 'i14 faint')}<span class="faint" style="flex:1">Filter services</span></div>
        <span class="filter">${ic('list-filter', 'i14')}Team <b>Any</b></span>
        <span class="filter">Health <b>Any</b></span>
        <span class="grow"></span>
        <div class="seg"><button class="on">${ic('rows-3', 'i14')}By domain</button><button>${ic('users', 'i14')}By team</button></div>
      </div>
      <div class="card scrollx">
        <table class="table" style="min-width:900px">
          <thead><tr><th style="width:32%">Service</th><th>Team</th>${D.envs.map((e) => `<th>${e.name}</th>`).join('')}<th>Last run</th></tr></thead>
          ${D.domains.map((d) => `
            <tbody>
              <tr><td colspan="6" style="padding:0"><div class="domain-h"><span class="tile" style="background:${d.hue}">${d.name[0]}</span><b>${d.name}</b><span class="faint">${D.services.filter((s) => s.domain === d.key).length} services</span></div></td></tr>
              ${D.services.filter((s) => s.domain === d.key).map((s) => `
                <tr class="click" data-href="#service/${s.key}">
                  <td><span class="svc-name"><span class="ico">${ic(s.icon, 'i14')}</span><span><b>${s.key}</b><small>${s.kind} · ${s.path}</small></span></span></td>
                  <td class="muted">${s.team}</td>
                  <td>${rev(s.env.dev)}</td>
                  <td>${rev(s.env.stage)}</td>
                  <td>${s.env.prod && s.env.prod.change ? `<span style="display:inline-flex;gap:6px;align-items:center">${rev(s.env.prod)}<span class="chip wait">${ic('clock')}CHG-${s.env.prod.change}</span></span>` : rev(s.env.prod)}</td>
                  <td>${st(s.last)}</td>
                </tr>`).join('')}
            </tbody>`).join('')}
        </table>
      </div>
    </div>`;
  }

  /* ---------------- One service ---------------- */
  function serviceHead(s, tab) {
    const runs = D.runs.filter((r) => r.svc === s.key);
    const tabs = [['overview', 'Overview'], ['versions', 'Versions', D.history.length], ['runs', 'Runs', runs.length], ['pipelines', 'Pipelines', D.pipelines.length], ['settings', 'Settings'], ['logs', 'Logs']];
    return `
      <div class="crumbs"><a href="#services">Services</a>${ic('chevron-right', 'i14')}<span>${dom(s.domain).name}</span></div>
      <div class="head">
        <div class="svc-name" style="gap:14px"><span class="ico" style="width:40px;height:40px;border-radius:8px">${ic(s.icon)}</span></div>
        <div class="t"><h1 class="mono" style="font-size:20px">${s.key}</h1>
          <div class="meta"><span>${ic('users', 'i14')}${s.team}</span><span>${ic('git-branch', 'i14')}robbie-flow/hello-robbie · ${s.path}</span><span>${ic('cloud', 'i14')}${s.kind}</span></div></div>
        <button class="btn" data-act="runpipe">${ic('play')}Run a pipeline</button>
        <button class="btn primary" data-act="deploy" data-svc="${s.key}" data-env="prod">${ic('arrow-up-right')}Deploy or promote</button>
      </div>
      <nav class="tabs">${tabs.map(([k, l, c]) => `<a class="${tab === k ? 'on' : ''}" href="#service/${s.key}${k === 'overview' ? '' : '/' + k}">${l}${c ? `<span class="count">${c}</span>` : ''}</a>`).join('')}</nav>`;
  }

  function spark(points, color = 'var(--acc)') {
    const w = 200, h = 36, max = Math.max(...points), min = Math.min(...points);
    const xy = points.map((p, i) => [i * (w / (points.length - 1)), h - 4 - ((p - min) / (max - min || 1)) * (h - 8)]);
    const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const [ex, ey] = xy[xy.length - 1];
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="${line} L${w},${h} L0,${h} Z" fill="${color}" opacity=".12"/><path d="${line}" fill="none" stroke="${color}" stroke-width="1.6" vector-effect="non-scaling-stroke"/><circle cx="${ex}" cy="${ey}" r="2.5" fill="${color}"/></svg>`;
  }

  function serviceOverview(s) {
    const card = (k) => {
      const e = s.env[k], env = envOf(k);
      if (!e) return `<div class="card envc"><div class="top"><b>${env.name}</b>${ruleChip(env)}</div><span class="faint">Not deployed yet</span><span class="msg">${env.project} · ${env.region}</span><div><button class="btn sm" data-act="deploy" data-svc="${s.key}" data-env="${k}">${ic('rocket', 'i14')}Deploy to ${env.name}</button></div></div>`;
      const c = e.change && chg(e.change);
      return `<div class="card envc">
        <div class="top"><b>${env.name}${ruleChip(env)}</b>${e.h === 'ok' ? '<span class="chip ok"><span class="hdot ok"></span>Healthy</span>' : e.h === 'bad' ? '<span class="chip bad"><span class="hdot bad"></span>Failing</span>' : '<span class="chip run"><span class="hdot run"></span>Deploying</span>'}</div>
        <div><div class="verbig">${ver(e.rev)}</div><div class="msg"><span class="mono">${e.rev}</span> · ${esc(e.msg)}</div></div>
        <dl class="kv"><dt>Deployed</dt><dd>${e.at} by ${e.by}</dd><dt>Instances</dt><dd>${e.inst} running</dd><dt>Project</dt><dd class="mono">${env.project}</dd></dl>
        <div style="display:grid;gap:6px"><div style="display:flex;justify-content:space-between;font-size:12px" class="faint"><span>Traffic</span><span>100% on ${ver(e.rev)}</span></div><div class="traffic"><i style="width:100%"></i></div></div>
        ${c ? `<a class="pending" href="#change/${c.id}">${ic('clipboard-check', 'i14')}<span style="flex:1">${c.items.find((i) => i.svc === s.key).to} is in CHG-${c.id}</span>${c.status === 'approved' ? 'deploying' : `${stepOf(c).got.length} of ${stepOf(c).need} approvals`}</a>` : ''}
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm">${ic('external-link', 'i14')}Open</button><button class="btn sm">${ic('rotate-ccw', 'i14')}Roll back</button></div>
      </div>`;
    };
    const arrow = (to) => `<div class="promote"><button title="Promote to ${envOf(to).name}" data-act="deploy" data-svc="${s.key}" data-env="${to}">${ic('arrow-right')}</button></div>`;
    const runs = D.runs.filter((r) => r.svc === s.key);
    return `
      <div class="lane">${card('dev')}${arrow('stage')}${card('stage')}${arrow('prod')}${card('prod')}</div>
      <div class="grid3" style="grid-template-columns:repeat(4,minmax(0,1fr))">
        ${[['Requests', '1,284/min', [12, 14, 13, 18, 22, 21, 26, 24, 29, 31, 28, 33], 'var(--acc)'], ['p95 latency', '212 ms', [260, 240, 251, 230, 228, 236, 219, 224, 215, 210, 214, 212], 'var(--ok)'], ['Errors', '0.08%', [0.2, 0.1, 0.12, 0.3, 0.1, 0.09, 0.07, 0.1, 0.06, 0.08, 0.07, 0.08], 'var(--bad)'], ['Cost this month', '₹4,180', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'var(--tx-3)']]
          .map(([l, v, p, c]) => `<div class="card metric"><span>${l} · Production</span><div class="row"><b>${v}</b></div>${spark(p, c)}</div>`).join('')}
      </div>
      <div class="cols">
        <div class="card"><div class="ch"><h2>Recent runs</h2><a class="btn ghost sm" href="#service/${s.key}/runs">All ${ic('arrow-right', 'i14')}</a></div>${(runs.length ? runs : D.runs.slice(0, 2)).map(runRow).join('')}</div>
        <div class="card"><div class="ch"><h2>Pipelines</h2><a class="btn ghost sm" href="#service/${s.key}/pipelines">Edit ${ic('pencil', 'i14')}</a></div>
          ${D.pipelines.map((p) => `<a class="runrow" href="#service/${s.key}/pipelines" style="grid-template-columns:20px minmax(0,1fr) auto">${ic(p.icon, 'faint')}<span class="t"><b>${p.name}</b><span>${p.on}</span></span>${st(p.last)}</a>`).join('')}
        </div>
      </div>`;
  }

  function serviceVersions(s) {
    return `<div class="info">${ic('info')}<span>Every build that passes its tests becomes a version. Versions move from environment to environment unchanged, so Production runs exactly the image Stage tested.</span></div>
      <div class="card scrollx"><table class="table" style="min-width:900px">
        <thead><tr><th>Version</th><th style="width:34%">What changed</th><th>Built</th><th>Tests</th><th>Running in</th><th>Change</th><th></th></tr></thead>
        ${D.history.map((v) => `<tr>
          <td><span class="ver" style="font-size:14px">${v.ver}</span></td>
          <td><div>${esc(v.msg)}</div><div class="faint mono" style="font-size:11.5px">${v.sha}</div></td>
          <td class="muted">${v.at}<div class="faint" style="font-size:12px">by ${v.by}</div></td>
          <td>${st(v.tests)}</td>
          <td><div class="envpills">${D.envs.map((e) => `<span class="${v.in.includes(e.key) ? 'in' : ''}">${e.name}</span>`).join('')}</div></td>
          <td>${v.change ? `<a class="chip ${chg(v.change) && chg(v.change).status === 'waiting' ? 'wait' : ''}" href="#change/${v.change}">CHG-${v.change}</a>` : '<span class="faint">None</span>'}</td>
          <td><button class="btn sm" data-act="deploy" data-svc="${s.key}" data-ver="${v.ver}" data-env="${v.in.includes('stage') ? 'prod' : 'stage'}">${v.in.includes('prod') ? 'Redeploy' : 'Promote'}</button></td>
        </tr>`).join('')}
      </table></div>`;
  }

  function serviceRuns(s) {
    return `<div class="card scrollx">${runsTable(D.runs.filter((r) => r.svc === s.key))}</div>`;
  }

  function serviceSettings(s) {
    const e = ui.settingsEnv;
    const cpu = e === 'prod' ? '2' : '1';
    const slider = (v, max) => `<div class="slider"><div class="track"><i style="width:${(v / max) * 100}%"></i><b style="left:${(v / max) * 100}%"></b></div></div>`;
    return `
      <div class="toolbar"><div class="seg">${D.envs.map((x) => `<button class="${x.key === e ? 'on' : ''}" data-act="setenv" data-env="${x.key}">${x.name}</button>`).join('')}</div>
        <span class="faint">Settings for ${envOf(e).name} in <span class="mono">${envOf(e).project}</span></span><span class="grow"></span><button class="btn sm">${ic('copy', 'i14')}Copy from Stage</button></div>
      <div class="cols">
        <div style="display:grid;gap:16px;min-width:0">
          <div class="card"><div class="ch"><h2>Size</h2><span class="faint" style="font-size:12px">Per instance</span></div><div class="cb form">
            <div class="field"><label>CPU</label><div class="seg">${['1', '2', '4', '8'].map((c) => `<button class="${c === cpu ? 'on' : ''}">${c} vCPU</button>`).join('')}</div></div>
            <div class="field"><label>Memory</label><div class="select">${e === 'prod' ? '1 GiB' : '512 MiB'}</div></div>
            <div class="field"><label>Requests at once</label><div class="input num">80</div><small>Cloud Run calls this concurrency</small></div>
          </div></div>
          <div class="card"><div class="ch"><h2>Scaling</h2><span class="faint" style="font-size:12px">Cloud Run's instances are your replicas</span></div><div class="cb form" style="grid-template-columns:repeat(2,minmax(0,1fr))">
            <div class="field"><label>Minimum instances <span class="mono faint">${e === 'prod' ? 1 : 0}</span></label>${slider(e === 'prod' ? 1 : 0, 10)}<small>${e === 'prod' ? 'One stays warm, so the first request is fast' : 'Scales to zero and costs nothing when idle'}</small></div>
            <div class="field"><label>Maximum instances <span class="mono faint">${e === 'prod' ? 20 : 3}</span></label>${slider(e === 'prod' ? 20 : 3, 50)}<small>The ceiling under load</small></div>
          </div></div>
          <div class="card"><div class="ch"><h2>Network</h2></div><div class="cb form">
            <div class="field"><label>Port</label><div class="input num">8080</div></div>
            <div class="field"><label>Who can call it</label><div class="select">Anyone on the internet</div></div>
            <div class="field"><label>Custom domain</label><div class="input">${e === 'prod' ? 'buyer.hellorobbie.com' : `buyer.${e}.hellorobbie.com`}</div></div>
          </div></div>
          <div class="card"><div class="ch"><h2>Variables and secrets</h2><button class="btn sm">${ic('plus', 'i14')}Add</button></div>
            <table class="table"><thead><tr><th>Name</th><th>Value</th><th>Kind</th></tr></thead>
            <tr><td class="mono">NODE_ENV</td><td class="mono">production</td><td><span class="chip">Variable</span></td></tr>
            <tr><td class="mono">SUPPLIER_API_URL</td><td class="mono">https://supplier-${e}-x7k2-el.a.run.app</td><td><span class="chip">Variable</span></td></tr>
            <tr><td class="mono">DATABASE_URL</td><td class="mono faint">buyer-agent-db-url · latest</td><td><span class="chip acc">${ic('lock')}Secret Manager</span></td></tr></table></div>
          <details class="card adv"><summary>${ic('chevron-right', 'chev i14')}Advanced, for Cloud Run experts<span class="grow" style="flex:1"></span><span class="chip">8 more settings</span></summary>
            <div class="cb form" style="border-top:1px solid var(--line)">
              <div class="field"><label>Execution environment</label><div class="select">Second generation</div></div>
              <div class="field"><label>CPU allocation</label><div class="select">Only during requests</div></div>
              <div class="field"><label>Request timeout</label><div class="input num">300 s</div></div>
              <div class="field"><label>Startup probe</label><div class="input mono">GET /healthz</div></div>
              <div class="field"><label>Runs as</label><div class="input mono">buyer-agent@${envOf(e).project}</div></div>
              <div class="field"><label>VPC connector</label><div class="select">robbie-vpc-asia-south1</div></div>
            </div>
            <div class="cb" style="padding-top:0"><button class="btn sm">${ic('file-code', 'i14')}Edit as Cloud Run YAML</button></div>
          </details>
        </div>
        <div class="card" style="position:sticky;top:0"><div class="ch"><h2>Unsaved changes</h2><span class="chip acc">2</span></div><div class="cb" style="display:grid;gap:12px">
          <div class="diff"><div class="m">- memory: 512Mi</div><div class="p">+ memory: 1Gi</div><div class="m">- maxInstances: 10</div><div class="p">+ maxInstances: 20</div></div>
          <span class="faint" style="font-size:12.5px">${envOf(e).approval ? `${envOf(e).name} has a change request rule, so these settings go through a change request too.` : `Saved settings apply on the next deploy to ${envOf(e).name}.`}</span>
          <div style="display:flex;gap:8px;justify-content:flex-end">${envOf(e).approval ? `<button class="btn primary" data-act="newchange">Write change request</button>` : `<button class="btn">Apply now</button><button class="btn primary" data-act="toast" data-msg="Saved. They apply on the next deploy.">Save</button>`}</div>
        </div></div>
      </div>`;
  }

  function serviceLogs() {
    const L = [['10:42:18', 'INFO', 'POST /offers 201 in 184 ms'], ['10:42:18', 'INFO', 'supplier.get_catalogue cache hit'], ['10:42:19', 'WARN', 'supplier 503, retry 1 of 3 in 200 ms'], ['10:42:19', 'INFO', 'supplier responded in 412 ms after retry'], ['10:42:20', 'INFO', 'POST /negotiations 200 in 96 ms'], ['10:42:21', 'INFO', 'GET /healthz 200 in 2 ms'], ['10:42:22', 'INFO', 'POST /offers 201 in 201 ms']];
    return `<div class="toolbar"><div class="seg">${D.envs.map((x) => `<button class="${x.key === 'prod' ? 'on' : ''}">${x.name}</button>`).join('')}</div><span class="filter">Level <b>All</b></span><span class="filter">Version <b>1.7.2</b></span><span class="grow"></span><span class="chip ok"><span class="hdot ok"></span>Live</span><button class="btn sm">${ic('external-link', 'i14')}Open in Cloud Logging</button></div>
      <div class="logs"><div class="lines" style="max-height:none;padding:10px 0">${L.map(([t, l, m], i) => `<div class="ln"><span class="n">${i + 1}</span><span class="ts">${t}</span><span><span class="${l === 'WARN' ? 'y' : 'b'}">${l}</span>  ${m}</span></div>`).join('')}<div class="ln"><span class="n"></span><span class="ts"></span><span><span class="cursor"></span></span></div></div></div>`;
  }

  /* ---------------- Pipelines editor ---------------- */
  function pipelineEditor(s) {
    const sel = allJobs().find((j) => j.id === ui.selected) || allJobs()[0];
    const canvas = ui.pipelineView === 'visual'
      ? `<div class="trig"><span class="chip acc">${ic('git-commit-horizontal')}On push to main</span><span class="chip acc">${ic('mouse-pointer-click')}Manually</span><button class="chip">${ic('plus')}Add trigger</button></div>${graphHtml({ edit: true, selected: sel.id })}
         <div style="padding:0 20px 24px"><div class="info" style="max-width:640px">${ic('info')}<span>Deliver stops at Stage. Production has a change request rule, so a version gets there through <b>Promote</b>: someone writes a change request, and the Promote pipeline runs when it is approved.</span></div></div>`
      : yamlHtml(sel.id);
    return `<div class="editor">
      <aside class="pl-list">
        <div style="display:flex;align-items:center;padding:4px 8px 10px"><h3 style="flex:1">Pipelines</h3><button class="iconbtn" title="New pipeline">${ic('plus')}</button></div>
        ${D.pipelines.map((p, i) => `<div class="pl ${i === 0 ? 'on' : ''}"><b>${ic(p.icon, 'i14')}${p.name}</b><small>${p.on}</small></div>`).join('')}
        <div style="padding:16px 8px 6px"><span class="eyebrow">Shared by Platform</span></div>
        <div class="pl"><b>${ic('lock', 'i14')}Scan image</b><small>Required in every pipeline</small></div>
      </aside>
      <section class="canvas">
        <div class="bar">
          <div class="t"><div class="crumbs"><a href="#service/${s.key}">${s.key}</a>${ic('chevron-right', 'i14')}<span>Pipelines</span></div>
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><h1 style="font-size:17px">Deliver</h1><span class="chip">From template: Cloud Run service v3</span><span class="chip acc">2 changes</span></div></div>
          <div class="seg"><button class="${ui.pipelineView === 'visual' ? 'on' : ''}" data-act="view" data-v="visual">${ic('workflow', 'i14')}Visual</button><button class="${ui.pipelineView === 'yaml' ? 'on' : ''}" data-act="view" data-v="yaml">${ic('code', 'i14')}YAML</button></div>
          <button class="btn" data-act="add">${ic('plus')}Add step</button>
          <button class="btn">${ic('play')}Test run</button>
          <div class="split-btn"><button class="btn primary" data-act="toast" data-msg="Opened pull request #418 with .bemmoly/deliver.yml">Save</button><button class="btn primary" title="Save options">${ic('chevron-down', 'i14')}</button></div>
        </div>
        <div class="area">${canvas}</div>
      </section>
      ${inspector(sel)}
    </div>`;
  }

  function inspector(j) {
    if (j.required) {
      return `<aside class="inspector"><div class="ih">${ic(j.icon)}<div class="t"><b>${j.name}</b><span class="faint" style="font-size:12px">${j.kind}</span></div><span class="chip">${ic('lock')}Required</span></div>
        <div class="ib"><p class="muted" style="margin:0">Hello Robbie's Platform team requires this step in every pipeline that builds an image. It fails the run on critical vulnerabilities.</p>
        <div class="field"><label>Fails on</label><div class="input">Critical</div></div><div class="field"><label>Owned by</label><div class="input">Platform admins</div></div>
        <span class="faint" style="font-size:12.5px">Only Platform admins can change it, in Platform, Templates.</span></div></aside>`;
    }
    const isDeploy = j.kind === 'Deploy service' || j.kind === 'Gradual rollout';
    const group = D.graph.find((g) => g.cols.flat().includes(j));
    return `<aside class="inspector">
      <div class="ih"><span class="svc-name"><span class="ico">${ic(j.icon, 'i14')}</span></span><div class="t"><b>${j.name}${group.env ? ` · ${envOf(group.env).name}` : ''}</b><span class="faint" style="font-size:12px">${j.kind}</span></div><button class="iconbtn" title="More">${ic('ellipsis')}</button></div>
      <div class="ib">
        <div class="field"><label>Name</label><div class="input">${j.name}</div></div>
        ${isDeploy ? `
          <div class="field"><label>Environment</label><div class="select">${group.env ? envOf(group.env).name : 'Dev'}</div></div>
          <div class="field"><label>Version</label><div class="input">The version this run built</div></div>
          <div class="field"><label>Size and scaling</label><div class="input">1 vCPU · 512 MiB · 0 to 3 instances</div><small>From the service's settings. <a style="color:var(--acc)" href="#service/buyer-agent/settings">Change</a></small></div>`
        : `
          <div class="field"><label>Runs on</label><div class="seg"><button class="on">${ic('cloud', 'i14')}Cloud Build</button><button>${ic('server', 'i14')}Your runner</button></div></div>
          <div class="field"><label>Image</label><div class="input mono">node:22-bookworm</div></div>
          <div class="field"><label>Script</label><textarea class="input" rows="5" spellcheck="false">pnpm install --frozen-lockfile
pnpm --filter buyer-agent test:integration</textarea></div>
          <div class="field"><label>Variables</label>
            <div class="plan"><div><span class="mono">BASE_URL</span><span class="mono faint nowrap">\${{ deploy.url }}</span></div><div><span class="mono">TEST_API_KEY</span><span class="chip acc nowrap">${ic('lock')}Secret</span></div></div>
            <small>The URL of what was just deployed is always there as <span class="mono">deploy.url</span></small></div>
          <div class="field"><label>If it fails</label><div class="select">Stop the run and roll back ${group.env ? envOf(group.env).name : ''}</div></div>
          <div class="form" style="grid-template-columns:1fr 1fr;gap:12px"><div class="field"><label>Timeout</label><div class="input num">15 min</div></div><div class="field"><label>Retries</label><div class="input num">1</div></div></div>`}
        <div class="field"><label>Runs after</label><div style="display:flex;gap:6px;flex-wrap:wrap">${prevJobs(j).map((p) => `<span class="chip">${p.name}</span>`).join('') || '<span class="faint">Starts the pipeline</span>'}</div></div>
        <div class="field"><label>Only when</label><div class="select">Always</div></div>
      </div>
    </aside>`;
  }

  function prevJobs(j) {
    const cols = D.graph.flatMap((g) => g.cols);
    const i = cols.findIndex((c) => c.includes(j));
    return i > 0 ? cols[i - 1] : [];
  }

  function yamlHtml(selId) {
    const Y = [
      ['c', '# .bemmoly/deliver.yml · made from the Cloud Run service template, v3'],
      ['', '<span class="k">name</span>: Deliver'],
      ['', '<span class="k">on</span>:'],
      ['', '  <span class="k">push</span>: { <span class="k">branches</span>: [main] }'],
      ['', '  <span class="k">manual</span>: true'],
      ['', ''],
      ['', '<span class="k">uses-template</span>: <span class="s">hello-robbie/cloud-run-service@v3</span>   <span class="c"># adds Scan image</span>'],
      ['', '<span class="k">version</span>: <span class="s">semver</span>   <span class="c"># 1.8.0 when tests pass; bumped from commit messages</span>'],
      ['', ''],
      ['', '<span class="k">jobs</span>:'],
      ['build', '  <span class="k">build</span>:'],
      ['build', '    <span class="k">uses</span>: <span class="s">build-image@v1</span>'],
      ['build', '    <span class="k">with</span>: { <span class="k">context</span>: services/buyer-agent }'],
      ['unit', '  <span class="k">unit</span>:'],
      ['unit', '    <span class="k">run</span>: pnpm --filter buyer-agent test'],
      ['deploy-dev', '  <span class="k">deploy-dev</span>:'],
      ['deploy-dev', '    <span class="k">needs</span>: [build, unit, scan]'],
      ['deploy-dev', '    <span class="k">uses</span>: <span class="s">deploy-service@v1</span>'],
      ['deploy-dev', '    <span class="k">environment</span>: dev'],
      ['it-dev', '  <span class="k">it-dev</span>:'],
      ['it-dev', '    <span class="k">needs</span>: deploy-dev'],
      ['it-dev', '    <span class="k">environment</span>: dev'],
      ['it-dev', '    <span class="k">image</span>: node:22-bookworm'],
      ['it-dev', '    <span class="k">env</span>:'],
      ['it-dev', '      <span class="k">BASE_URL</span>: <span class="v">${{ deploy-dev.url }}</span>'],
      ['it-dev', '      <span class="k">TEST_API_KEY</span>: <span class="v">${{ secrets.TEST_API_KEY }}</span>'],
      ['it-dev', '    <span class="k">run</span>: |'],
      ['it-dev', '      pnpm install --frozen-lockfile'],
      ['it-dev', '      pnpm --filter buyer-agent test:integration'],
      ['deploy-stage', '  <span class="k">deploy-stage</span>:'],
      ['deploy-stage', '    <span class="k">needs</span>: it-dev'],
      ['deploy-stage', '    <span class="k">uses</span>: <span class="s">deploy-service@v1</span>'],
      ['deploy-stage', '    <span class="k">environment</span>: stage'],
      ['smoke-stage', '  <span class="k">smoke-stage</span>:'],
      ['smoke-stage', '    <span class="k">needs</span>: deploy-stage'],
      ['smoke-stage', '    <span class="k">run</span>: ./scripts/smoke.sh <span class="v">${{ deploy-stage.url }}</span>'],
      ['', ''],
      ['c', '# Production has a change request rule, so it is reached through promote.yml.'],
    ];
    return `<pre class="yaml" style="background:var(--canvas);min-height:100%">${Y.map(([id, l]) => `<div class="${id && id === selId ? 'hl' : ''}">${l.startsWith('#') ? `<span class="c">${l}</span>` : l}</div>`).join('')}</pre>`;
  }

  /* ---------------- Graph (run view and editor) ---------------- */
  function graphHtml({ edit = false, selected = null } = {}) {
    return `<div class="graph-wrap"><div class="graph" id="graph">
      <svg class="wires" id="wires"></svg>
      <div class="stages">
        ${D.graph.map((g, gi) => {
          const env = g.env && envOf(g.env);
          return `<div class="gbox">
            <div class="sh">${env ? ic('cloud', 'i14') : ic('hammer', 'i14')}${g.name}</div>
            <div class="mono faint" style="font-size:11px;margin-top:-8px">${env ? env.project : 'Cloud Build'}</div>
            <div class="gcols ${g.env ? 'stack' : ''}">
              ${g.cols.map((c, ci) => `<div class="col" data-col="${gi}-${ci}">
                ${c.map((j) => `<a class="job ${edit ? '' : j.st} ${j.id === selected ? 'on' : ''}" data-job="${j.id}" ${edit ? `data-act="select" data-id="${j.id}" href="javascript:void 0"` : `href="#run/1284/${j.id}"`}>
                  ${edit ? `<span class="svc-name"><span class="ico" style="width:24px;height:24px">${ic(j.icon, 'i14')}</span></span>` : st(j.st)}
                  <span class="t"><b>${j.name}</b><small>${edit ? j.kind : (j.st === 'queued' ? 'Queued' : j.dur)}</small></span>
                  ${j.required ? `<span class="lockic" title="Required by Platform">${ic('lock', 'i14')}</span>` : ''}
                </a>`).join('')}
                ${edit && ci === g.cols.length - 1 ? `<button class="addnode" data-act="add">${ic('plus', 'i14')}Add step</button>` : ''}
              </div>`).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div></div>`;
  }

  function drawWires() {
    const graph = $('#graph'); const svg = $('#wires');
    if (!graph || !svg) return;
    const box = graph.getBoundingClientRect();
    svg.setAttribute('width', graph.scrollWidth); svg.setAttribute('height', graph.scrollHeight);
    const cols = D.graph.flatMap((g) => g.cols);
    let paths = '';
    for (let i = 1; i < cols.length; i++) {
      for (const a of cols[i - 1]) for (const b of cols[i]) {
        const ea = graph.querySelector(`[data-job="${a.id}"]`), eb = graph.querySelector(`[data-job="${b.id}"]`);
        if (!ea || !eb) continue;
        const ra = ea.getBoundingClientRect(), rb = eb.getBoundingClientRect();
        const done = a.st === 'ok' && !graph.closest('.area');
        if (rb.top > ra.bottom && Math.abs(ra.left - rb.left) < 4) {
          const x = ra.left + ra.width / 2 - box.left;
          paths += `<path class="${done ? 'done' : ''}" d="M${x},${ra.bottom - box.top} L${x},${rb.top - box.top}"/>`;
          continue;
        }
        const x1 = ra.right - box.left, y1 = ra.top + ra.height / 2 - box.top, x2 = rb.left - box.left, y2 = rb.top + rb.height / 2 - box.top;
        const mx = (x1 + x2) / 2;
        paths += `<path class="${done ? 'done' : ''}" d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}"/>`;
      }
    }
    svg.innerHTML = paths;
  }

  /* ---------------- Runs ---------------- */
  function runsTable(rows) {
    return `<table class="table" style="min-width:880px">
      <thead><tr><th style="width:44%">Run</th><th>Service</th><th>Branch or version</th><th>Jobs</th><th>Took</th><th>When</th></tr></thead>
      ${rows.map((r) => `<tr class="click" data-href="#run/${r.id}">
        <td><div style="display:flex;gap:12px;align-items:center">${st(r.st)}<div style="min-width:0"><b style="font-weight:600">${esc(r.title)}</b><div class="faint" style="font-size:12px">${r.pipeline} #${r.id} · ${r.trigger} by ${r.by}</div></div></div></td>
        <td class="mono" style="font-size:12.5px">${r.svc}</td>
        <td><span class="chip">${ic(r.pipeline === 'Promote' ? 'tag' : 'git-branch')}${r.branch}</span></td>
        <td><span class="minibar">${r.bar.map((x) => `<i class="${x}"></i>`).join('')}</span></td>
        <td class="num muted">${r.dur}</td>
        <td class="muted">${r.at}</td>
      </tr>`).join('')}
    </table>`;
  }

  function runs() {
    return `<div class="wrap">
      <div class="head"><div class="t"><h1>Runs</h1><span class="muted">Every pipeline run across Hello Robbie: deliveries, promotions, tests, scripts and schedules.</span></div><button class="btn primary" data-act="runpipe">${ic('play')}Run a pipeline</button></div>
      <div class="toolbar">
        <div class="seg"><button class="on">All <span class="faint">${D.runs.length}</span></button><button>Running <span class="faint">3</span></button><button>Failed <span class="faint">1</span></button></div>
        <span class="filter">${ic('list-filter', 'i14')}Service <b>Any</b></span><span class="filter">Pipeline <b>Any</b></span><span class="filter">Branch <b>Any</b></span><span class="filter">Started by <b>Anyone</b></span>
      </div>
      <div class="card scrollx">${runsTable(D.runs)}</div>
    </div>`;
  }

  function runView(id, jobId) {
    const r = run(id) || D.runs[0];
    if (r.id !== 1284) return otherRun(r);
    const job = jobId && allJobs().find((j) => j.id === jobId);
    const c = chg(1042);
    const side = `<aside class="run-side">
      <a class="jlink ${!job ? 'on' : ''}" href="#run/1284">${ic('house', 'i14')}<span>Summary</span></a>
      ${D.graph.map((g) => `<div class="grp">${g.name}</div>${g.cols.flat().map((j) => `<a class="jlink ${job && job.id === j.id ? 'on' : ''}" href="#run/1284/${j.id}">${st(j.st)}<span>${j.name}</span><small>${j.dur}</small></a>`).join('')}`).join('')}
      <div class="grp">Run</div>
      <a class="jlink" href="javascript:void 0">${ic('file-code', 'i14')}<span>Pipeline file</span></a>
      <a class="jlink" href="javascript:void 0">${ic('package', 'i14')}<span>Artifacts</span><small>2</small></a>
    </aside>`;
    const head = `<div class="crumbs"><a href="#runs">Runs</a>${ic('chevron-right', 'i14')}<a href="#service/buyer-agent">buyer-agent</a>${ic('chevron-right', 'i14')}<span>Deliver #1284</span></div>
      <div class="runhead">${st('run', true)}<div class="t"><h1>${esc(r.title)}</h1><div class="meta"><span>${avatar('Keerthi')}Keerthi pushed <span class="mono">a41c9e2</span> to <span class="chip">${ic('git-branch')}main</span></span><span>${ic('tag', 'i14')}Makes version 1.8.0</span><span>${ic('workflow', 'i14')}Deliver</span></div></div>
      <button class="btn">${ic('rotate-ccw')}Re-run failed</button><button class="btn">${ic('square')}Cancel run</button></div>`;
    let body;
    if (!job) {
      body = `${head}
        <div class="card facts"><div><dt>Status</dt><dd>${st('run')}Running</dd></div><div><dt>Took so far</dt><dd>${r.dur}</dd></div><div><dt>Version</dt><dd class="mono">1.8.0</dd></div><div><dt>Image</dt><dd class="mono" style="font-weight:500">buyer-agent:1.8.0</dd></div><div><dt>Tests</dt><dd>${st('ok')}31 passed</dd></div></div>
        <div class="card">${graphHtml()}</div>
        <div class="card"><div class="ch">${ic('tag', 'faint')}<h2>Where 1.8.0 goes next</h2><button class="btn primary sm" data-act="deploy" data-svc="buyer-agent" data-env="prod" data-ver="1.8.0">${ic('arrow-up-right', 'i14')}Promote to Production</button></div>
          <table class="table">
            <tr><td style="width:140px"><b>Dev</b></td><td style="width:30px">${st('ok')}</td><td>Deployed by this run · <span class="mono">buyer-agent-00042-kel</span></td><td></td></tr>
            <tr><td><b>Stage</b></td><td>${st('queued')}</td><td class="muted">This run deploys it after the Dev integration tests pass</td><td></td></tr>
            <tr><td><b>Production</b></td><td>${st(c.status === 'approved' ? 'run' : 'wait')}</td><td>Needs a change request. <a href="#change/1042" style="color:var(--acc)">CHG-1042</a> includes 1.8.0.</td><td>${chgStatus(c)}</td></tr>
          </table></div>
        <div class="grid2">
          <div class="card"><div class="ch"><h2>Deployed by this run</h2></div><table class="table"><tr><td><b>Dev</b></td><td class="mono">buyer-agent-00042-kel</td><td><span class="chip ok"><span class="hdot ok"></span>Healthy</span></td><td><a class="btn ghost sm">${ic('external-link', 'i14')}Open</a></td></tr><tr><td><b>Stage</b></td><td class="faint">After integration tests</td><td></td><td></td></tr></table></div>
          <div class="card"><div class="ch"><h2>Notes from jobs</h2></div><div class="needs">
            <div class="need">${ic('shield-check', 'faint')}<div class="t"><b>Scan image</b><span>No critical issues. 2 low: openssl 3.0.13, zlib 1.3</span></div></div>
            <div class="need">${ic('flask-conical', 'faint')}<div class="t"><b>Unit tests</b><span>31 passed in 52 s. Coverage 84%, up 0.6</span></div></div>
          </div></div>
        </div>`;
    } else {
      body = `${head}${jobLogs(job)}`;
    }
    return `<div class="runview">${side}<div class="run-main">${body}</div></div>`;
  }

  function jobLogs(job) {
    const group = D.graph.find((g) => g.cols.flat().includes(job));
    const steps = D.steps[job.id] || genericSteps(job);
    return `<div class="logs">
      <div class="lh">${st(job.st)}<b>${job.name}${group.env ? ` · ${envOf(group.env).name}` : ''}</b><span style="color:#6b7380;font-size:12px">${job.st === 'queued' ? 'Waiting for the jobs before it' : job.dur}</span><button class="btn sm">${ic('search', 'i14')}Search</button><button class="btn sm">${ic('download', 'i14')}Raw log</button></div>
      ${steps.map((s, si) => {
        const lines = s.lines.concat(s.stream ? s.stream.slice(0, ui.streamed) : []);
        return `<details class="step" ${s.open ? 'open' : ''}><summary>${ic('chevron-right', 'chev i14')}${st(s.st === 'run' && s.stream && ui.streamed >= s.stream.length ? 'ok' : s.st)}<span>${s.name}</span><small>${s.dur}</small></summary>
          ${lines.length ? `<div class="lines" ${s.stream ? 'id="stream"' : ''}>${lines.map((l, i) => logLine(l, i + 1, si)).join('')}${s.stream && ui.streamed < s.stream.length ? '<div class="ln"><span class="n"></span><span class="ts"></span><span><span class="cursor"></span></span></div>' : ''}</div>` : ''}
        </details>`;
      }).join('')}
    </div>`;
  }

  function logLine([c, t], n, si) {
    const ts = `10:${String(38 + si).padStart(2, '0')}:${String((n * 3) % 60).padStart(2, '0')}`;
    return `<div class="ln"><span class="n">${n}</span><span class="ts">${ts}</span><span class="${c}">${esc(t)}</span></div>`;
  }

  function genericSteps(job) {
    if (job.st === 'queued') return [{ name: 'Waiting', st: 'queued', dur: '', lines: [['d', 'This job starts when the jobs before it pass.']] }];
    const map = {
      build: [['', '$ docker build -f services/buyer-agent/Dockerfile .'], ['d', '#12 [build 4/7] RUN pnpm install --frozen-lockfile'], ['d', '#15 exporting layers 2.1s'], ['g', 'Version 1.8.0 (minor: a "feat" commit since 1.7.3)'], ['g', 'Pushed asia-south1-docker.pkg.dev/robbie-tools/apps/buyer-agent:1.8.0']],
      unit: [['', '$ pnpm --filter buyer-agent test'], ['g', ' Tests  31 passed (31)'], ['d', ' Coverage 84.2%']],
      scan: [['', 'Scanning buyer-agent:1.8.0'], ['y', 'LOW  openssl 3.0.13'], ['y', 'LOW  zlib 1.3'], ['g', 'No critical or high issues']],
      'deploy-dev': [['', 'Deploying buyer-agent 1.8.0 to Cloud Run in hello-robbie-dev (asia-south1)'], ['d', 'Revision buyer-agent-00042-kel created'], ['d', 'Health check GET /healthz: 200 in 3 ms'], ['g', 'Traffic: 100% to buyer-agent-00042-kel'], ['b', 'URL https://buyer-agent-dev-x7k2-el.a.run.app']],
    };
    return [{ name: 'Set up job', st: 'ok', dur: '2s', lines: [['d', 'Runner: Cloud Build in hello-robbie-dev']] }, { name: job.name, st: job.st, dur: job.dur, open: true, lines: map[job.id] || [['g', 'Done']] }];
  }

  function otherRun(r) {
    const promote = r.pipeline === 'Promote';
    return `<div class="wrap">
      <div class="crumbs"><a href="#runs">Runs</a>${ic('chevron-right', 'i14')}<a href="#service/${r.svc}">${r.svc}</a>${ic('chevron-right', 'i14')}<span>${r.pipeline} #${r.id}</span></div>
      <div class="runhead">${st(r.st, true)}<div class="t"><h1>${esc(r.title)}</h1><div class="meta"><span>${r.trigger}${promote ? '' : ` by ${r.by}`}</span><span>${r.pipeline}</span><span>${r.dur}</span></div></div>${r.st === 'bad' ? `<button class="btn primary">${ic('rotate-ccw')}Re-run failed jobs</button>` : ''}</div>
      ${r.st === 'bad' ? `<div class="logs"><div class="lh">${st('bad')}<b>Integration tests · Dev</b><span style="color:#6b7380;font-size:12px">1m 02s</span></div><div class="lines" style="max-height:none">${[['', '$ pnpm --filter supplier test:integration'], ['g', ' ✓ invoices › creates an invoice (211 ms)'], ['r', ' ✗ invoices › gst › adds 18% GST for intra-state orders'], ['r', '     expected 1180 to equal 1180.00'], ['r', ' ✗ invoices › gst › splits CGST and SGST'], ['', ''], ['r', '      Tests  2 failed | 24 passed (26)'], ['d', 'Dev was rolled back to 2.3.0']].map((l, i) => logLine(l, i + 1, 0)).join('')}</div></div>`
        : promote ? `<div class="logs"><div class="lh">${st(r.st)}<b>Promote to Production</b></div><div class="lines" style="max-height:none">${[['b', `Started by ${r.by} after its last approval`], ['', 'Deploy window: open until 18:00 IST'], ['', 'Deploying versions that passed Stage, no rebuild'], ['g', 'Gradual rollout 10% · 50% · 100%, errors under 1% at each step'], ['g', 'Smoke tests passed on Production']].map((l, i) => logLine(l, i + 1, 0)).join('')}</div></div>`
        : '<div class="card cb muted">Open run #1284 to see the full run view with its graph and live logs.</div>'}
    </div>`;
  }

  /* ---------------- Changes ---------------- */
  function changes() {
    return `<div class="wrap">
      <div class="head"><div class="t"><h1>Changes</h1><span class="muted">Change requests move versions into environments that need approval. When the last approver says yes, the deploy starts by itself.</span></div>${ui.role === 'approver' ? '' : `<button class="btn primary" data-act="newchange">${ic('plus')}New change request</button>`}</div>
      <div class="toolbar"><div class="seg">${(ui.role === 'approver' ? ['Waiting for me', 'All'] : ['Open', 'Mine', 'Deployed', 'All']).map((t, i) => `<button class="${i === 0 ? 'on' : ''}">${t}</button>`).join('')}</div><span class="filter">Environment <b>Any</b></span><span class="filter">Service <b>Any</b></span></div>
      <div class="card scrollx"><table class="table" style="min-width:920px">
        <thead><tr><th style="width:110px">Change</th><th style="width:34%">Title</th><th>Versions</th><th>Risk</th><th>Asked by</th><th>Status</th></tr></thead>
        ${D.changes.map((c) => `<tr class="click" data-href="#change/${c.id}">
          <td class="chg-id">CHG-${c.id}</td>
          <td><b style="font-weight:600">${esc(c.title)}</b><div class="faint" style="font-size:12px">To ${envOf(c.env).name} · ${c.at}</div></td>
          <td style="font-size:12.5px">${c.items.map((i) => `<div><span class="mono">${i.svc}</span> <span class="faint">${i.to}</span></div>`).join('')}</td>
          <td>${risk(c.risk)}</td>
          <td><span style="display:inline-flex;gap:8px;align-items:center">${avatar(c.by, person(c.by).color)}${c.by}</span></td>
          <td>${chgStatus(c)}</td>
        </tr>`).join('')}
      </table></div>
    </div>`;
  }

  function routeHtml(c) {
    const env = envOf(c.env);
    const steps = c.approvals.map((a, i) => {
      const cls = a.st === 'ok' ? 'ok' : a.st === 'bad' ? 'bad' : a.st === 'wait' ? 'wait' : '';
      const people = a.assigned.length ? a.assigned.map((n) => {
        const g = a.got.find((x) => x.by === n);
        return `<div class="check-row" style="font-size:12.5px;align-items:center">${avatar(n, person(n).color)}<span style="flex:1">${n}</span>${g ? (g.st === 'bad' ? '<span class="chip bad">Rejected</span>' : `<span class="chip ok">Approved${g.at ? ' ' + g.at : ''}</span>`) : `<span class="chip">${a.st === 'wait' ? 'Waiting' : 'Not yet'}</span>`}</div>${g && g.note ? `<div class="quote">${esc(g.note)}</div>` : ''}`;
      }).join('') : '<span class="faint" style="font-size:12.5px">Not picked yet</span>';
      return `<div class="rstep ${a.st === 'ok' ? 'done' : ''}"><span class="rdot ${cls}">${ic(a.st === 'ok' ? 'check' : a.st === 'bad' ? 'x' : a.st === 'wait' ? 'clock' : 'users', 'i14')}</span>
        <div class="t"><b>${i + 1}. ${a.who}</b><span>${a.got.filter((g) => g.st === 'ok').length} of ${a.need} needed</span><div style="display:grid;gap:8px;margin-top:6px">${people}</div></div></div>`;
    }).join('');
    const hr = env.approval.steps.find((p) => p.when !== 'Always');
    const skip = hr && !c.approvals.some((a) => a.who === hr.who) ? `<div class="rstep"><span class="rdot">${ic('minus', 'i14')}</span><div class="t"><b class="faint">${hr.who}</b><span>Skipped: ${hr.when.toLowerCase()}</span></div></div>` : '';
    const deployState = c.status === 'deployed' ? 'ok' : c.status === 'approved' ? 'run' : c.status === 'rejected' ? 'bad' : '';
    return `<div class="route">${steps}${skip}
      <div class="rstep"><span class="rdot ${deployState}">${ic('rocket', 'i14')}</span><div class="t"><b>Deploy to ${env.name}</b><span>${c.status === 'deployed' ? 'Deployed by Promote' : c.status === 'approved' ? `Deploying now · <a href="#run/1286" style="color:var(--acc)">run #1286</a>` : c.status === 'rejected' ? 'Not deployed' : `Starts by itself after the last approval · ${env.approval.window}`}</span></div></div>
    </div>`;
  }

  function changeView(id) {
    const c = chg(id);
    if (!c) return changes();
    const env = envOf(c.env);
    const waitingOnMe = ui.role === 'approver' && isMine(c);
    const actions = waitingOnMe
      ? `<button class="btn">Ask for changes</button><button class="btn">Reject</button><button class="btn ok" data-act="approvechg" data-id="${c.id}">${ic('check', 'i14')}Approve</button>`
      : ui.role !== 'approver' && ['waiting', 'draft'].includes(c.status) ? `${c.status === 'draft' ? `<button class="btn primary" data-act="toast" data-msg="Sent to the approvers you picked">Send for approval</button>` : ''}<button class="btn">Withdraw</button>` : '';
    const first = c.items[0];
    return `<div class="wrap">
      <div class="crumbs"><a href="#changes">Changes</a>${ic('chevron-right', 'i14')}<span>CHG-${c.id}</span></div>
      <div class="head"><div class="t"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span class="chg-id">CHG-${c.id}</span>${chgStatus(c)}${risk(c.risk)}</div><h1>${esc(c.title)}</h1>
        <div class="meta"><span>${avatar(c.by, person(c.by).color)}${c.by} asked ${c.at}</span><span>${ic('layers', 'i14')}To ${env.name}</span><span>${ic('calendar-clock', 'i14')}${c.when || 'As soon as approved'}</span></div></div>${actions}</div>
      ${waitingOnMe ? `<div class="info">${ic('info')}<span>You're the last approval this needs. When you approve, Promote deploys these versions to ${env.name} straight away, inside the deploy window.</span></div>` : ''}
      <div class="chg-grid">
        <div style="display:grid;gap:16px;min-width:0">
          <div class="card"><div class="ch"><h2>Why</h2></div><div class="cb"><p class="prose">${esc(c.why || 'Routine release.')}</p></div></div>
          <div class="card"><div class="ch"><h2>What changes in ${env.name}</h2></div>
            <table class="table"><thead><tr><th>Service</th><th>Now</th><th>After</th><th>Commits</th><th>Tested on Stage</th></tr></thead>
            ${c.items.map((i) => `<tr><td class="mono">${i.svc}</td><td class="mono faint">${i.from}</td><td class="mono"><b>${i.to}</b></td><td>${i.commits}</td><td>${st('ok')}</td></tr>`).join('')}</table></div>
          <div class="card"><div class="ch"><h2>Commits in ${first.svc} ${first.to}</h2><span class="faint" style="font-size:12px">since ${first.from}</span></div>
            <table class="table">${D.commits.map(([sha, m, by, pr]) => `<tr><td class="mono faint" style="width:90px">${sha}</td><td>${esc(m)}</td><td class="muted">${by}</td><td><span class="chip">${ic('git-pull-request')}${pr}</span></td></tr>`).join('')}</table></div>
          <div class="grid2">
            <div class="card"><div class="ch"><h2>Evidence</h2></div><div class="needs">
              <div class="need">${st('ok')}<div class="t"><b>Integration tests on Dev and Stage</b><span>Deliver #1284 · 45 passed, 1 skipped</span></div></div>
              <div class="need">${st('ok')}<div class="t"><b>Image scan</b><span>No critical or high issues</span></div></div>
              <div class="need">${st('ok')}<div class="t"><b>Running on Stage for 8 min</b><span>0 errors, p95 198 ms</span></div></div>
            </div></div>
            <div class="card"><div class="ch"><h2>If it goes wrong</h2></div><div class="cb" style="display:grid;gap:10px">
              <div class="check-row">${ic('rotate-ccw', 'faint')}<span>Bemmoly rolls back by itself if errors pass 1% during the rollout. ${c.items.map((i) => `${i.svc} ${i.from}`).join(' and ')} stay ready for one-click rollback.</span></div>
              <div class="check-row">${ic('database', 'faint')}<span>No database changes in this request.</span></div>
            </div></div>
          </div>
        </div>
        <div style="display:grid;gap:16px;min-width:0;align-content:start">
          <div class="card"><div class="ch"><h2>Approval route</h2><span class="faint" style="font-size:12px">${env.name} rule</span></div><div class="cb">${routeHtml(c)}</div></div>
          <div class="card"><div class="ch"><h2>Activity</h2></div><div class="cb" style="display:grid;gap:12px;font-size:12.5px">
            ${c.approvals.flatMap((a) => a.got.map((g) => ({ ...g, who: a.who }))).reverse().map((g) => `<div class="check-row">${avatar(g.by, person(g.by).color)}<span><b>${g.by}</b> ${g.st === 'ok' ? 'approved' : 'rejected'} as one of ${g.who}. <span class="faint">${g.at || ''}</span></span></div>`).join('')}
            ${c.approvals[0].assigned.length ? `<div class="check-row">${avatar(c.by, person(c.by).color)}<span><b>${c.by}</b> picked ${c.approvals.flatMap((a) => a.assigned).join(', ')} to approve. <span class="faint">${c.at}</span></span></div>` : ''}
            <div class="check-row">${avatar(c.by, person(c.by).color)}<span><b>${c.by}</b> asked for approval. <span class="faint">${c.at}</span></span></div>
            <div class="input" style="height:36px"><span class="faint">Add a comment</span></div>
          </div></div>
        </div>
      </div>
    </div>`;
  }

  function newChange() {
    const env = envOf('prod');
    const steps = env.approval.steps.filter((s) => s.when === 'Always' || ui.risk === 'High');
    const groupOf = (n) => D.groups.find((g) => g.name === n);
    const picks = (st) => ui.picked[st.who] || [];
    const ready = steps.every((st) => picks(st).length >= st.need);
    return `<div class="wrap">
      <div class="crumbs"><a href="#changes">Changes</a>${ic('chevron-right', 'i14')}<span>New change request</span></div>
      <div class="head"><div class="t"><h1>New change request</h1><span class="muted">${env.name} has an approval rule. Fill this in once: the approvers get it, and the deploy runs itself when they're done.</span></div></div>
      <div class="chg-grid">
        <div class="card"><div class="cb" style="display:grid;gap:16px">
          <div class="field"><label for="t">Title</label><div class="input" id="t">Offer retries for buyer-agent</div></div>
          <div class="field"><label>To</label><div class="select">${env.name} · ${env.project}</div></div>
          <div class="field"><label>Versions</label>
            <div class="plan"><div><span class="mono" style="flex:0 0 140px">buyer-agent</span><span class="arrow-ver"><span class="from">1.7.2</span>${ic('arrow-right', 'i14 faint')}<b>${ui.deployVer}</b></span><span class="faint" style="flex:1;text-align:right">4 commits · passed Stage</span></div>
              <div><button class="btn ghost sm">${ic('plus', 'i14')}Add another service</button></div></div>
            <small>Only versions that passed Stage can go to ${env.name}.</small></div>
          <div class="field"><label for="why">Why</label><textarea class="input" id="why" rows="4" style="font-family:var(--sans);font-size:13.5px">Buyers see failed offers when a supplier returns 503. 1.8.0 retries three times with backoff, then shows a clear error.</textarea></div>
          <div class="field"><label>Risk</label><div class="seg">${['Low', 'Medium', 'High'].map((r) => `<button class="${ui.risk === r ? 'on' : ''}" data-act="risk" data-r="${r}">${r}</button>`).join('')}</div><small>High risk adds a High-risk approver to the route.</small></div>
          <div class="field"><label>When</label><div class="seg"><button class="on">As soon as approved</button><button>At a time</button></div><small>${env.approval.window}. Outside it, the deploy waits for the window to open.</small></div>
          <div class="field"><label>If it goes wrong</label><div class="input">Roll back to 1.7.2 by itself if errors pass 1%</div></div>
        </div></div>
        <div style="display:grid;gap:16px;min-width:0;align-content:start">
          <div class="card"><div class="ch"><h2>Who approves</h2><span class="faint" style="font-size:12px">You pick</span></div><div class="cb"><div class="route">
            ${steps.map((st, i) => `<div class="rstep ${picks(st).length >= st.need ? 'done' : ''}"><span class="rdot ${picks(st).length >= st.need ? 'ok' : ''}">${ic('users', 'i14')}</span><div class="t"><b>${i + 1}. ${st.who}</b><span>Pick ${st.need} · the ${env.name} rule needs ${st.need} of them</span>
              <div style="display:grid;gap:6px;margin-top:8px">${groupOf(st.who).members.filter((m) => m !== 'Keerthi').map((m) => `<div class="vrow ${picks(st).includes(m) ? 'on' : ''}" data-act="pick" data-step="${st.who}" data-name="${m}" style="grid-template-columns:18px 22px minmax(0,1fr);border:1px solid var(--line);border-radius:6px"><span class="cbox" style="${picks(st).includes(m) ? 'background:var(--acc-fill);border-color:var(--acc-fill)' : ''}"></span>${avatar(m, person(m).color)}<span>${m}</span></div>`).join('')}</div></div></div>`).join('')}
            <div class="rstep"><span class="rdot">${ic('rocket', 'i14')}</span><div class="t"><b>Deploy to ${env.name}</b><span>By itself, after the last approval</span></div></div>
          </div><span class="faint" style="font-size:12px">You can't pick yourself.</span></div></div>
          <div class="card"><div class="ch"><h2>Attached for approvers</h2></div><div class="needs">
            <div class="need">${st('ok')}<div class="t"><b>Deliver #1284</b><span>Tests on Dev and Stage</span></div></div>
            <div class="need">${st('ok')}<div class="t"><b>Image scan</b><span>No critical or high issues</span></div></div>
            <div class="need">${ic('git-commit-horizontal', 'faint')}<div class="t"><b>4 commits, 3 pull requests</b><span>Since 1.7.2</span></div></div>
          </div></div>
          <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn">Save draft</button><button class="btn primary" data-act="sendchange" ${ready ? '' : 'disabled style="opacity:.5;pointer-events:none"'}>${ic('send', 'i14')}${ready ? 'Send for approval' : 'Pick approvers to send'}</button></div>
        </div>
      </div>
    </div>`;
  }

  /* ---------------- Environments ---------------- */
  function environments() {
    const live = (k) => D.services.filter((s) => s.env[k]);
    return `<div class="wrap">
      <div class="head"><div class="t"><h1>Environments</h1><span class="muted">Each environment is one Google Cloud project. Versions move left to right. Any environment can have an approval rule; none is special.</span></div><button class="btn">${ic('link')}Link a project</button><button class="btn primary">${ic('plus')}New environment</button></div>
      <div class="lane">
        ${D.envs.map((e, i) => `${i ? `<div class="promote"><button title="Promotion">${ic('arrow-right')}</button></div>` : ''}
          <div class="card envcard">
            <div class="top"><b>${e.name}</b><button class="iconbtn">${ic('ellipsis')}</button></div>
            <div class="prov"><span class="logo">${GCP}</span><div class="t"><b class="mono" style="font-size:12.5px">${e.project}</b><small>Google Cloud · ${e.region} · linked</small></div><a class="iconbtn" title="Open in Google Cloud">${ic('external-link', 'i14')}</a></div>
            <div class="field"><label style="font-size:11.5px;color:var(--tx-3);font-weight:600">To deploy here</label>${e.approval ? `<a class="item" href="#platform/approvals">${ic('clipboard-check', 'i14')}<span style="flex:1">Change request: ${e.approval.steps.filter((s) => s.when === 'Always').map((s) => `${s.need} ${s.who}`).join(', then ')}</span>${ic('chevron-right', 'i14 faint')}</a>` : `<a class="item" href="#platform/approvals">${ic('circle-check', 'i14 faint')}<span style="flex:1">No approval needed</span>${ic('chevron-right', 'i14 faint')}</a>`}</div>
            <div class="rules">${e.rules.map((x) => `<div>${ic('check', 'i14')}${x}</div>`).join('')}</div>
            <div style="display:flex;align-items:center;gap:10px;border-top:1px solid var(--line-2);padding-top:12px"><span style="flex:1"><b>${live(e.key).length}</b> <span class="muted">services live</span></span>${live(e.key).map((s) => `<span class="hdot ${s.env[e.key].h}" title="${s.key}"></span>`).join('')}</div>
          </div>`).join('')}
      </div>
      <div class="card"><div class="ch"><h2>Deploys this week</h2></div><div class="cb">${weekChart()}</div></div>
    </div>`;
  }

  function weekChart() {
    const days = ['Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue'];
    const v = [[6, 4, 1], [8, 5, 2], [5, 4, 3], [1, 0, 0], [0, 0, 0], [9, 6, 2], [7, 4, 1]];
    const H = 120, max = 18;
    return `<svg viewBox="0 0 700 ${H + 26}" style="width:100%;height:190px;display:block">
      ${[0, 6, 12, 18].map((t) => `<line x1="30" x2="700" y1="${H - (t / max) * H + 4}" y2="${H - (t / max) * H + 4}" stroke="var(--line-2)"/><text x="22" y="${H - (t / max) * H + 8}" text-anchor="end" font-size="10" fill="var(--tx-3)">${t}</text>`).join('')}
      ${v.map((d, i) => { let y = H + 4; return d.map((n, k) => { const h = (n / max) * H; y -= h; return `<rect x="${60 + i * 92}" y="${y}" width="44" height="${Math.max(h - 1.5, 0)}" rx="2" fill="${['var(--acc-500)', 'var(--acc-fill)', 'var(--wait)'][k]}"/>`; }).join('') + `<text x="${82 + i * 92}" y="${H + 20}" text-anchor="middle" font-size="11" fill="var(--tx-2)">${days[i]}</text>`; }).join('')}
    </svg><div class="legend" style="margin-top:8px"><span><span class="hdot" style="background:var(--acc-500)"></span>Dev</span><span><span class="hdot" style="background:var(--acc-fill)"></span>Stage</span><span><span class="hdot" style="background:var(--wait)"></span>Production</span></div>`;
  }

  /* ---------------- Platform ---------------- */
  function platform(tab = 'clouds') {
    const tabs = [['clouds', 'Clouds'], ['people', 'People and roles'], ['approvals', 'Approval rules'], ['templates', 'Templates'], ['runners', 'Runners']];
    let body = '';
    if (tab === 'clouds') {
      body = `<div class="cloudgrid">
        <div class="card cloud on"><div class="top"><span class="logo prov" style="padding:0;border:0;background:none">${GCP}</span><b>Google Cloud</b><span class="chip ok">Connected</span></div><span class="muted" style="font-size:12.5px">Cloud Run services and jobs, Cloud Build, Artifact Registry, Secret Manager</span></div>
        ${[['Amazon Web Services', 'App Runner and ECS'], ['Microsoft Azure', 'Container Apps'], ['Kubernetes', 'Any cluster, GKE, EKS or AKS']].map(([n, d]) => `<div class="card cloud"><div class="top">${ic('cloud', 'faint')}<b>${n}</b><span class="chip">Soon</span></div><span class="faint" style="font-size:12.5px">${d}</span></div>`).join('')}
      </div>
      <div class="card"><div class="ch"><h2>Google Cloud</h2><span class="chip ok">${ic('check')}All checks pass · 2 min ago</span><button class="btn sm">${ic('refresh-cw', 'i14')}Check again</button></div>
        <div class="cb grid3">
          <div class="field"><label>Bemmoly can reach</label><div class="input">Every project in folder <b style="margin-left:4px">Hello Robbie</b></div><small>New projects in the folder show up on their own</small></div>
          <div class="field"><label>Signs in as</label><div class="input mono" style="font-size:12px">bemmoly@robbie-tools.iam.gserviceaccount.com</div><small>The VM Bemmoly runs on. No key files</small></div>
          <div class="field"><label>Images go to</label><div class="input mono" style="font-size:12px">asia-south1-docker.pkg.dev/robbie-tools/apps</div></div>
        </div>
        <table class="table"><thead><tr><th>Project</th><th>Environment</th><th>Cloud Run</th><th>Cloud Build</th><th>Secrets</th><th>Can deploy</th></tr></thead>
          ${[['hello-robbie-dev', 'Dev'], ['hello-robbie-stage', 'Stage'], ['hello-robbie-prod', 'Production'], ['robbie-tools', 'Not linked']].map(([p, e]) => `<tr><td class="mono">${p}</td><td>${e === 'Not linked' ? `<button class="btn sm">${ic('link', 'i14')}Link</button>` : e}</td>${[1, 2, 3, 4].map(() => `<td>${st('ok')}</td>`).join('')}</tr>`).join('')}
        </table></div>`;
    } else if (tab === 'people') {
      body = `<div class="rolecards">
        ${[['Platform admin', 'settings-2', 'Connects clouds, makes environments and sets approval rules. Sees everything.'], ['Developer', 'code', 'Services, runs and changes. Deploys where allowed and writes change requests.'], ['Approver', 'clipboard-check', 'Sees changes sent to them and what is live. Approves without being able to deploy.'], ['Viewer', 'eye', 'Reads services, runs and changes. Changes nothing.']]
          .map(([n, i, d]) => `<div class="card rolecard"><b>${ic(i, 'i14')}${n}</b><span>${d}</span></div>`).join('')}
      </div>
      <div class="card scrollx"><div class="ch"><h2>People</h2><button class="btn sm">${ic('user-plus', 'i14')}Invite</button></div>
        <table class="table" style="min-width:820px"><thead><tr><th>Person</th><th>Role</th><th>Approves as</th><th>Deploys without approval to</th><th></th></tr></thead>
        ${D.people.map((p) => `<tr><td><span style="display:inline-flex;gap:10px;align-items:center">${avatar(p.name, p.color)}<b style="font-weight:600">${p.name}</b></span></td>
          <td><span class="lvl ${p.role === 'Platform admin' ? 'approve' : p.role === 'Developer' ? 'deploy' : p.role === 'Approver' ? 'run' : ''}">${p.role}${ic('chevron-down', 'i14 faint')}</span></td>
          <td>${p.groups.map((g) => `<span class="chip acc">${g}</span>`).join(' ') || '<span class="faint">None</span>'}</td>
          <td>${p.deploy.map((e) => `<span class="chip">${e}</span>`).join(' ') || '<span class="faint">None</span>'}</td>
          <td><button class="iconbtn">${ic('ellipsis')}</button></td></tr>`).join('')}
        </table></div>
      <div class="card"><div class="ch"><h2>Approval groups</h2><button class="btn sm">${ic('plus', 'i14')}New group</button></div>
        <table class="table">${D.groups.map((g) => `<tr><td><b>${g.name}</b></td><td class="muted">${g.members.join(', ')}</td><td class="faint" style="font-size:12px">Used in the Production rule</td></tr>`).join('')}</table></div>`;
    } else if (tab === 'approvals') {
      body = D.envs.map((e) => e.approval ? `
        <div class="card"><div class="ch"><h2>${e.name}</h2><span class="chip acc">${ic('clipboard-check')}Change request</span><span class="toggle on" title="On"></span></div>
          <div class="cb" style="display:grid;gap:14px">
            <span class="muted">A version reaches ${e.name} only through an approved change request. Approvers go in this order:</span>
            <div>${e.approval.steps.map((s, i) => `<div class="rule"><span class="n">${i + 1}</span><b>${s.who}</b><div class="select">${s.need} ${s.need === 1 ? 'approval' : 'approvals'}</div><div class="select">${s.when}</div><button class="iconbtn">${ic('x', 'i14')}</button></div>`).join('')}</div>
            <div><button class="btn sm">${ic('plus', 'i14')}Add an approver step</button></div>
            <div class="form">
              <div class="field"><label>After the last approval</label><div class="select">${e.approval.then}</div></div>
              <div class="field"><label>Deploy window</label><div class="select">${e.approval.window}</div></div>
              <div class="field"><label>Versions allowed</label><div class="select">Only versions that passed Stage</div></div>
            </div>
            <div class="check-row"><span class="toggle on"></span><span>The person asking picks who approves, from these groups</span></div>
            <div class="check-row"><span class="toggle on"></span><span>Nobody approves their own change</span></div>
            <div class="check-row"><span class="toggle on"></span><span>Platform admins can deploy in an emergency without approval. They must give a reason, and every approver is told.</span></div>
          </div></div>` : `
        <div class="card"><div class="ch"><h2>${e.name}</h2><span class="chip">No approval</span><span class="toggle"></span></div>
          <div class="cb" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><span class="muted" style="flex:1">Developers deploy here directly. ${e.rules[0]}.</span><button class="btn sm">${ic('plus', 'i14')}Require a change request</button></div></div>`).join('');
    } else if (tab === 'templates') {
      body = `<div class="grid3">
        ${[['Cloud Run service', 'v3', 6, ['Build image and version it', 'Scan image (required)', 'Deploy Dev, then Stage', 'Integration and smoke tests', 'Promote through change requests']], ['Cloud Run job', 'v1', 1, ['Build image', 'Scan image (required)', 'Run a job']], ['Static site', 'v2', 0, ['Build with buildpacks', 'Deploy to Cloud Storage', 'Purge CDN']]].map(([n, v, u, s]) => `
          <div class="card"><div class="ch">${ic('layout-template', 'faint')}<h2>${n}</h2><span class="chip">${v}</span></div><div class="cb" style="display:grid;gap:10px"><span class="muted" style="font-size:12.5px">Used by ${u} services</span>${s.map((x) => `<div style="display:flex;gap:8px;align-items:center;font-size:12.5px">${ic(x.includes('required') ? 'lock' : 'check', 'i14 faint')}${x}</div>`).join('')}</div></div>`).join('')}
      </div><span class="faint" style="font-size:12.5px">A service's pipelines start from a template. Teams can change their copy; steps marked required stay in every copy.</span>`;
    } else {
      body = `<div class="card"><div class="cb" style="display:grid;gap:10px"><h2>Cloud Build runs every job by default</h2><p class="muted" style="margin:0">Nothing to install: jobs run in the environment's own project. Add your own runner only when a job needs a private network, a GPU, or a machine you already pay for.</p><div><button class="btn">${ic('plus')}Add a runner</button></div></div></div>`;
    }
    return `<div class="wrap"><div class="head"><div class="t"><h1>Platform</h1><span class="muted">Clouds, people and roles, approval rules, and the pipeline templates teams start from. Only Platform admins see this.</span></div></div>
      <nav class="tabs">${tabs.map(([k, l]) => `<a class="${k === tab ? 'on' : ''}" href="#platform${k === 'clouds' ? '' : '/' + k}">${l}</a>`).join('')}</nav>${body}</div>`;
  }

  /* ---------------- Overlays ---------------- */
  function overlay() {
    if (ui.fresh && ui.overlay && ui.overlay.startsWith('f')) return FR.overlay(ui.overlay);
    if (ui.overlay === 'deploy') {
      const s = svc(ui.deploySvc || 'buyer-agent'); const env = envOf(ui.deployEnv);
      const vers = D.history.slice(0, 3);
      return `<div class="scrim" data-act="close"><div class="dialog" role="dialog" aria-label="Deploy or promote">
        <div class="dh"><h2 style="font-size:17px">Deploy or promote <span class="mono">${s.key}</span></h2><span class="muted" style="font-size:12.5px">Pick a version and where it goes.</span></div>
        <div class="db">
          <div class="field"><label>Version</label><div class="vlist">${vers.map((v) => `<div class="vrow ${v.ver === ui.deployVer ? 'on' : ''}" data-act="dver" data-ver="${v.ver}"><span class="radio"></span><span class="ver">${v.ver}</span><span class="msg">${esc(v.msg)}</span><span class="envpills">${D.envs.filter((e) => v.in.includes(e.key)).map((e) => `<span class="in">${e.name}</span>`).join('')}</span></div>`).join('')}</div></div>
          <div class="field"><label>To</label><div class="radio-cards">${D.envs.map((e) => `<div class="rc ${e.key === env.key ? 'on' : ''}" data-act="denv" data-env="${e.key}"><b>${e.name}</b><small class="mono">now ${s.env[e.key] ? ver(s.env[e.key].rev) : 'nothing'}</small></div>`).join('')}</div></div>
          ${env.approval
            ? `<div class="info">${ic('clipboard-check')}<span>${env.name} needs a change request. You pick ${env.approval.steps.filter((x) => x.when === 'Always').map((x) => `${x.need} of ${x.who}`).join(', then ')}, and ${ui.deployVer} deploys by itself when they approve.</span></div>
               ${ui.role === 'admin' ? `<div class="check-row" style="color:var(--tx-2)"><span class="cbox"></span><span>Emergency deploy now, without approval. You give a reason and every approver is told.</span></div>` : ''}`
            : `<div class="field"><label>What will run</label><div class="plan">${[['rocket', `Deploy ${ui.deployVer} to ${env.name}, no rebuild`], ['terminal', 'Integration tests'], ['heart-pulse', 'Health check, then traffic moves']].map(([i, t]) => `<div>${ic(i, 'i14 faint')}<span>${t}</span></div>`).join('')}</div></div>`}
        </div>
        <div class="df"><button class="btn" data-act="close">Cancel</button>${env.approval ? `<button class="btn primary" data-act="newchange">${ic('clipboard-check', 'i14')}Write change request</button>` : `<button class="btn primary" data-act="go" data-msg="Run #1285 started: ${ui.deployVer} to ${env.name}.">Deploy ${ui.deployVer} to ${env.name}</button>`}</div>
      </div></div>`;
    }
    if (ui.overlay === 'runpipe') {
      const env = envOf(ui.runEnv);
      return `<div class="scrim" data-act="close"><div class="dialog" role="dialog" aria-label="Run a pipeline">
        <div class="dh"><h2 style="font-size:17px">Run a pipeline</h2><span class="muted" style="font-size:12.5px">Tests, scripts and one-off tasks, against any environment you're allowed to run in.</span></div>
        <div class="db">
          <div class="field"><label>Service</label><div class="select mono">buyer-agent</div></div>
          <div class="field"><label>Pipeline</label><div class="select">${ic('flask-conical', 'i14')}<span style="flex:1">Integration tests</span></div></div>
          <div class="field"><label>Against</label><div class="radio-cards">${D.envs.map((e) => `<div class="rc ${e.key === env.key ? 'on' : ''}" data-act="renv" data-env="${e.key}"><b>${e.name}</b><small class="mono">${ver(svc('buyer-agent').env[e.key].rev)}</small></div>`).join('')}</div></div>
          <div class="form" style="grid-template-columns:1fr 1fr;gap:12px"><div class="field"><label>Branch</label><div class="select">main</div></div><div class="field"><label>Suite</label><div class="seg"><button>Smoke</button><button class="on">Full</button></div></div></div>
        </div>
        <div class="df"><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="go" data-msg="Integration tests started against ${env.name}. Run #1285.">${ic('play', 'i14')}Run</button></div>
      </div></div>`;
    }
    if (ui.overlay === 'add') {
      return `<div class="lib" data-act="close"><div class="panel">
        <div class="ph"><div style="display:flex;align-items:center"><h2 style="flex:1">Add a step</h2><button class="iconbtn" data-act="close">${ic('x')}</button></div><div class="input">${ic('search', 'i14 faint')}<span class="faint" style="flex:1">Search steps</span></div></div>
        <div class="pb">${D.library.map((c) => `<div class="cat">${c.cat}</div>${c.items.map((it) => `<div class="blk ${it.soon ? 'soon' : ''}" ${it.soon ? '' : `data-act="addstep" data-name="${it.name}" data-icon="${it.icon}"`}><span class="ico">${ic(it.icon)}</span><span class="t"><b>${it.name}${it.tags.map((t) => `<span class="chip ${t === 'Required' ? 'wait' : t === 'Soon' ? '' : 'acc'}">${t}</span>`).join('')}</b><span>${it.desc}</span></span></div>`).join('')}`).join('')}
        <div class="cat">Yours</div><div class="blk" data-act="addstep" data-name="Seed test data" data-icon="sprout"><span class="ico">${ic('sprout')}</span><span class="t"><b>Seed test data<span class="chip">Hello Robbie</span></b><span>Shared by the Platform team: loads fixtures into the environment's database.</span></span></div>
        </div></div></div>`;
    }
    return '';
  }

  /* ---------------- Router ---------------- */
  const PLACE_OF = { setup: 'home', home: 'home', services: 'services', service: 'services', runs: 'runs', run: 'runs', changes: 'changes', change: 'changes', environments: 'environments', platform: 'platform' };

  function render() {
    clearInterval(streamTimer);
    const route = (location.hash.replace(/^#\/?/, '') || 'home').split('/');
    document.body.innerHTML = shell(route) + `<div id="overlay">${overlay()}</div>${ui.toast ? `<div class="toast">${ic('circle-check', 'i14')}${ui.toast}</div>` : ''}`;
    const c = $('#content');
    const [head, a, b] = route;
    const place = PLACE_OF[head] || 'home';
    if (ui.fresh) c.innerHTML = freshRoute(head, a, b);
    else if (!can(place)) c.innerHTML = noAccess(PLACES.find((p) => p.id === place).label);
    else if (head === 'services') c.innerHTML = services();
    else if (head === 'service') {
      const s = svc(a) || D.services[0]; const tab = b || 'overview';
      if (tab === 'pipelines') { c.innerHTML = pipelineEditor(s); c.style.overflow = 'hidden'; }
      else c.innerHTML = `<div class="wrap">${serviceHead(s, tab)}${({ overview: serviceOverview, versions: serviceVersions, runs: serviceRuns, settings: serviceSettings, logs: serviceLogs })[tab](s)}</div>`;
    } else if (head === 'runs') c.innerHTML = runs();
    else if (head === 'run') c.innerHTML = runView(a, b);
    else if (head === 'changes') c.innerHTML = changes();
    else if (head === 'change') c.innerHTML = a === 'new' ? newChange() : changeView(a);
    else if (head === 'environments') c.innerHTML = environments();
    else if (head === 'platform') c.innerHTML = platform(a);
    else c.innerHTML = home();
    window.lucide && window.lucide.createIcons({ attrs: { 'stroke-width': 1.75 } });
    requestAnimationFrame(drawWires);
    if (head === 'run' && b === 'it-dev' && ui.streamed < D.steps['it-dev'][3].stream.length) {
      streamTimer = setInterval(() => {
        ui.streamed++;
        render();
        const nb = $('#stream'); if (nb) nb.scrollTop = nb.scrollHeight;
        if (ui.streamed >= D.steps['it-dev'][3].stream.length) clearInterval(streamTimer);
      }, 900);
    }
  }

  function freshRoute(head, a, b) {
    const page = freshPage(head, a, b);
    return head === 'home' || head === '' ? page : page.replace('<div class="wrap">', `<div class="wrap">${FR.backBar()}`);
  }

  function freshPage(head, a, b) {
    if (head === 'setup') return FR.cloud();
    if (head === 'environments') return FR.environments();
    if (head === 'services') return FR.services();
    if (head === 'service') return FR.pipelines(a);
    if (head === 'runs' || head === 'run') return `<div class="wrap"><div class="head"><div class="t"><h1>Runs</h1></div></div>${FR.empty('play', 'No runs yet', 'Runs appear when someone presses Run on a pipeline, or when a trigger you add fires.', '')}</div>`;
    if (head === 'changes' || head === 'change') return `<div class="wrap"><div class="head"><div class="t"><h1>Changes</h1></div></div>${FR.empty('clipboard-check', 'No change requests', 'Change requests appear once an environment needs approval. None does yet.', '<a class="btn" href="#environments">Open environments</a>')}</div>`;
    if (head === 'platform') {
      const tab = a || 'clouds';
      const tabs = [['clouds', 'Clouds'], ['people', 'People and roles'], ['approvals', 'Approval rules'], ['templates', 'Templates'], ['runners', 'Runners']];
      const body = tab === 'people' ? FR.people()
        : tab === 'clouds' ? (FRESH.F.cloud ? '<div class="card cb">Google Cloud is connected.</div>' : FR.empty('cloud', 'No clouds connected', 'Connect one to add environments.', '<a class="btn primary" href="#setup/cloud">Connect a cloud</a>'))
        : tab === 'approvals' ? FR.empty('clipboard-check', 'No approval rules', 'Every environment deploys without approval until you add a rule to it.', '<a class="btn" href="#environments">Open environments</a>')
        : tab === 'templates' ? FR.templates()
        : FR.empty('server', 'Cloud Build runs jobs', 'Nothing to install. Add your own runner when a job needs a private network or a GPU.', `<button class="btn">${ic('plus')}Add a runner</button>`);
      return `<div class="wrap"><div class="head"><div class="t"><h1>Platform</h1></div></div><nav class="tabs">${tabs.map(([k, l]) => `<a class="${k === tab ? 'on' : ''}" href="#platform${k === 'clouds' ? '' : '/' + k}">${l}</a>`).join('')}</nav>${body}</div>`;
    }
    return FR.home();
  }

  function toast(msg) {
    ui.toast = msg; render();
    setTimeout(() => { ui.toast = null; render(); }, 2800);
  }

  function approveChange(id) {
    const c = chg(id); const a = stepOf(c);
    a.got.push({ by: 'Ananya Iyer', st: 'ok', at: 'just now' });
    if (a.got.length >= a.need) {
      a.st = 'ok';
      if (c.step + 1 < c.approvals.length) { c.step++; stepOf(c).st = 'wait'; toast('Approved. It goes to the next approvers.'); return; }
      c.status = 'approved';
      if (!run(1286)) D.runs.unshift({ id: 1286, svc: 'buyer-agent', pipeline: 'Promote', title: `CHG-${c.id} to Production`, sha: 'a41c9e2', branch: '1.8.0', trigger: 'Change approved', by: `CHG-${c.id}`, st: 'run', dur: '12s', at: 'now', bar: ['run', ''] });
      toast(`Approved. Promote is deploying CHG-${c.id} to Production now.`); return;
    }
    toast('Approved. It waits for the other approvers.');
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('input, select, textarea')) return;
    const row = e.target.closest('tr[data-href]');
    if (row) { location.hash = row.dataset.href; return; }
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;
    if (act === 'theme') { const r = document.documentElement; r.dataset.theme = r.dataset.theme === 'light' ? 'dark' : 'light'; render(); return; }
    if (act === 'close') { if (e.target === t || t.tagName === 'BUTTON') { ui.overlay = null; render(); } return; }
    if (act === 'install') { ui.fresh = t.dataset.v === 'fresh'; ui.overlay = null; if (location.hash === '#home') render(); else location.hash = '#home'; return; }
    if (ui.fresh && FRESH.act(act, t, ui, toast, render)) return;
    if (act === 'role') { ui.role = t.dataset.role; if (location.hash === '#home') render(); else location.hash = '#home'; return; }
    if (act === 'deploy') { ui.overlay = 'deploy'; ui.deploySvc = t.dataset.svc; ui.deployEnv = t.dataset.env || 'stage'; ui.deployVer = t.dataset.ver || '1.8.0'; render(); return; }
    if (act === 'runpipe') { ui.overlay = 'runpipe'; render(); return; }
    if (act === 'add') { ui.overlay = 'add'; render(); return; }
    if (act === 'denv') { ui.deployEnv = t.dataset.env; render(); return; }
    if (act === 'dver') { ui.deployVer = t.dataset.ver; render(); return; }
    if (act === 'renv') { ui.runEnv = t.dataset.env; render(); return; }
    if (act === 'go') { ui.overlay = null; toast(t.dataset.msg); return; }
    if (act === 'newchange') { ui.overlay = null; if (location.hash === '#change/new') render(); else location.hash = '#change/new'; return; }
    if (act === 'pick') { const l = ui.picked[t.dataset.step] = ui.picked[t.dataset.step] || []; const i = l.indexOf(t.dataset.name); if (i >= 0) l.splice(i, 1); else l.push(t.dataset.name); render(); return; }
    if (act === 'risk') { ui.risk = t.dataset.r; render(); return; }
    if (act === 'sendchange') {
      if (!chg(1043)) D.changes.unshift({ id: 1043, title: 'Offer retries for buyer-agent', env: 'prod', by: 'Keerthi', at: 'just now', risk: ui.risk, items: [{ svc: 'buyer-agent', from: '1.7.2', to: ui.deployVer, commits: 4 }], why: 'Buyers see failed offers when a supplier returns 503. 1.8.0 retries three times with backoff, then shows a clear error.', when: 'As soon as approved, inside the deploy window', status: 'waiting', step: 0, approvals: D.envs[2].approval.steps.filter((s) => s.when === 'Always' || ui.risk === 'High').map((s, i) => ({ who: s.who, need: s.need, st: i ? 'queued' : 'wait', assigned: [...(ui.picked[s.who] || [])], got: [] })) });
      location.hash = '#change/1043'; setTimeout(() => toast('Sent to the approvers you picked.'), 50); return;
    }
    if (act === 'approvechg') { approveChange(t.dataset.id); return; }
    if (act === 'view') { ui.pipelineView = t.dataset.v; render(); return; }
    if (act === 'select') { e.preventDefault(); ui.selected = t.dataset.id; render(); return; }
    if (act === 'setenv') { ui.settingsEnv = t.dataset.env; render(); return; }
    if (act === 'toast') { toast(t.dataset.msg); return; }
    if (act === 'addstep') {
      const g = D.graph.find((x) => x.cols.flat().some((j) => j.id === ui.selected)) || D.graph[1];
      const id = 'new-' + Date.now();
      g.cols.splice(g.cols.findIndex((c) => c.some((j) => j.id === ui.selected)) + 1, 0, [{ id, name: t.dataset.name, st: 'queued', dur: '', icon: t.dataset.icon, kind: t.dataset.name }]);
      ui.selected = id; ui.overlay = null; toast(`${t.dataset.name} added after the selected step`);
    }
  });
  document.addEventListener('change', (e) => { if (e.target.dataset.fbind) FRESH.bind(e.target); });
  document.addEventListener('input', (e) => { if (e.target.dataset.fbind) FRESH.bind(e.target); });
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea')) return;
    if (e.key === 't' || e.key === 'T') { const r = document.documentElement; r.dataset.theme = r.dataset.theme === 'light' ? 'dark' : 'light'; render(); }
    if (e.key === 'Escape' && ui.overlay) { ui.overlay = null; render(); }
  });
  window.addEventListener('hashchange', () => { ui.overlay = null; render(); });
  window.addEventListener('resize', drawWires);

  const MARK = `<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><g transform="translate(-3.3468 -3.3599) scale(0.06)"><path fill="#2356C9" d="M100.850,252.884 C99.937,252.731 96.849,251.842 93.988,250.909 C83.521,247.494 74.358,239.397 69.391,229.173 C64.880,219.889 64.970,221.175 64.970,165.865 C64.970,118.454 65.034,115.763 66.278,110.899 C70.229,95.453 82.126,82.880 97.860,77.523 C103.001,75.773 103.866,75.693 124.106,75.108 C153.824,74.249 209.378,74.942 215.468,76.248 C230.155,79.397 240.904,90.645 243.478,105.556 C244.272,110.163 244.398,120.617 244.217,167.107 C244.013,219.273 243.915,223.360 242.782,226.764 C238.369,240.016 229.331,248.808 216.835,252.004 C211.782,253.296 209.716,253.339 157.057,253.252 C127.057,253.202 101.764,253.036 100.850,252.884 Z"/><path fill="#2356C9" d="M99.854,454.909 C97.296,454.369 92.661,452.708 89.555,451.218 C84.943,449.007 82.865,447.460 78.226,442.786 C71.722,436.233 68.353,430.476 66.280,422.372 C65.026,417.468 64.970,414.803 64.970,359.987 C64.970,305.572 65.034,302.475 66.254,297.705 C70.074,282.770 79.940,272.007 94.545,266.846 L99.854,264.970 154.775,264.782 C215.517,264.574 215.042,264.547 223.629,268.757 C229.651,271.710 236.732,278.753 239.563,284.607 C243.803,293.373 243.687,291.273 243.698,359.699 C243.704,400.955 243.469,423.195 242.997,425.812 C241.093,436.386 233.160,446.953 223.593,451.661 C214.746,456.014 215.257,455.982 156.997,455.934 C113.335,455.899 103.723,455.726 99.854,454.909 Z"/><path fill="#9A85EA" d="M344.581,244.650 C330.698,243.710 295.296,237.973 288.186,235.511 C268.278,228.616 256.332,213.228 256.332,194.477 C256.332,189.465 270.523,90.474 272.616,80.888 C275.977,65.490 287.355,56.000 302.453,56.000 C309.329,56.000 349.807,63.883 372.279,69.598 C394.814,75.329 408.807,82.412 421.205,94.364 C428.596,101.489 432.673,106.855 436.967,115.111 C444.178,128.977 446.699,139.360 446.650,155.003 C446.621,164.534 446.389,166.882 444.876,172.973 C438.508,198.599 423.826,218.471 401.224,232.055 C391.026,238.184 374.541,243.551 363.381,244.375 C360.600,244.580 356.980,244.844 355.336,244.962 C353.691,245.079 348.851,244.939 344.581,244.650 Z"/><path fill="#5B7BE5" d="M283.094,455.019 C270.966,452.315 261.158,442.916 257.955,430.928 C256.790,426.567 256.704,400.704 257.629,332.744 C258.063,300.907 258.317,294.261 259.225,291.045 C262.982,277.735 272.950,268.338 286.233,265.583 C293.514,264.073 360.494,264.563 367.855,266.180 C387.225,270.437 400.033,277.210 412.511,289.795 C427.175,304.584 436.351,323.468 439.362,345.051 C442.341,366.413 438.262,387.529 427.426,406.836 C413.714,431.266 391.226,447.881 363.441,454.109 C357.345,455.475 355.114,455.564 322.113,455.747 C294.229,455.903 286.399,455.756 283.094,455.019 Z"/></g></svg>`;
  const GCP = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#ea4335" d="M15.2 7.6h.7l2-2 .1-.8A9 9 0 0 0 3.4 9.1c.3-.1.7-.1 1 0l4-.7s.2-.3.3-.3a5 5 0 0 1 6.5-.5z"/><path fill="#4285f4" d="M20.8 9.1a9 9 0 0 0-2.7-4.3l-2.8 2.8a5 5 0 0 1 1.8 4v.5a2.5 2.5 0 0 1 0 5h-5l-.5.5v3l.5.5h5a6.5 6.5 0 0 0 3.7-12z"/><path fill="#34a853" d="M7.1 21.1h5v-4h-5c-.4 0-.7-.1-1-.2l-.7.2-2 2-.2.7a6.4 6.4 0 0 0 3.9 1.3z"/><path fill="#fbbc05" d="M7.1 8.1a6.5 6.5 0 0 0-3.9 11.7l2.9-2.9a2.5 2.5 0 1 1 3.3-3.3l2.9-2.9a6.5 6.5 0 0 0-5.2-2.6z"/></svg>`;

  FR = FRESH.h({ ic, st, esc });
  render();
})();
