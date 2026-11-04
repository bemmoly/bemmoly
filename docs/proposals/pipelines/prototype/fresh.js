/* Fresh install: an empty workspace and the setup checklist. Nothing is on until someone turns it
   on; suggestions fill a form that a person confirms. Loaded before app.js, which calls into it. */
window.FRESH = (() => {
  const F = { cloud: false, signin: null, reach: null, checked: false, envs: [], groups: [], services: [], picks: [], pipelines: {}, invited: false,
    pl: { start: null, tpl: null, store: null, ver: null },
    suggest: { dev: true, stage: true, prod: true, order: true, prodApproval: true, stageApproval: false, window: false },
    env: { dev: { name: 'Dev', id: 'dev', project: 'hello-robbie-dev' }, stage: { name: 'Stage', id: 'stage', project: 'hello-robbie-stage' }, prod: { name: 'Production', id: 'production', project: 'hello-robbie-prod' } } };
  /* Built-in templates ship with Bemmoly. They are starting points to pick, never applied on their own. */
  const TEMPLATES = [
    { key: 'path', name: 'Dev, then Stage, then Production', desc: 'Build once, deploy to each environment in order, test after each. Production goes through a change request if it needs approval.', suggested: true,
      groups: [['Build', ['Build image', 'Unit tests']], ['Dev', ['Deploy', 'Integration tests']], ['Stage', ['Deploy', 'Smoke tests']], ['Production', ['Promote when approved']]], trigger: 'On push to main' },
    { key: 'one', name: 'One environment', desc: 'Build, test and deploy to a single environment you choose.',
      groups: [['Build', ['Build image', 'Unit tests']], ['Deploy', ['Deploy', 'Smoke tests']]], trigger: 'On push to main' },
    { key: 'job', name: 'Cloud Run job', desc: 'Build an image and run it once, for migrations, backfills and scheduled work.',
      groups: [['Build', ['Build image']], ['Run', ['Run a job']]], trigger: 'Manual or on a schedule' },
    { key: 'pr', name: 'Pull request checks', desc: 'Build and test every pull request. Deploys nothing.',
      groups: [['Check', ['Build image', 'Unit tests', 'Lint']]], trigger: 'On pull request' },
  ];
  const tpl = (k) => TEMPLATES.find((t) => t.key === k);
  const PROJECTS = ['hello-robbie-dev', 'hello-robbie-stage', 'hello-robbie-prod', 'robbie-tools'];
  const FOUND = [['buyer-agent', 'services/buyer-agent'], ['supplier', 'services/supplier'], ['storefront-web', 'apps/storefront'], ['ai-research-engine', 'services/ai-research-engine'], ['mcp', 'services/mcp'], ['nightly-reconcile', 'jobs/reconcile']];

  function h({ ic, st, esc }) {
    const radio = (on, act, val, title, desc, extra = '') => `<div class="vrow ${on ? 'on' : ''}" data-act="${act}" data-v="${val}" style="grid-template-columns:18px minmax(0,1fr);align-items:start;border:1px solid var(--line);border-radius:8px;padding:12px 14px"><span class="radio" style="margin-top:2px"></span><span style="display:grid;gap:2px"><b style="font-weight:600;font-size:13.5px">${title}</b><span class="faint" style="font-size:12.5px">${desc}</span>${extra}</span></div>`;
    const check = (on, act, key, title, desc, extra = '') => `<div class="vrow ${on ? 'on' : ''}" data-act="${act}" data-k="${key}" style="grid-template-columns:18px minmax(0,1fr) auto;align-items:start;border:1px solid var(--line);border-radius:8px;padding:11px 14px"><span class="cbox ${on ? 'on' : ''}"></span><span style="display:grid;gap:2px"><b style="font-weight:600;font-size:13.5px">${title}</b><span class="faint" style="font-size:12.5px">${desc}</span></span>${extra}</div>`;
    const empty = (icon, title, text, actions) => `<div class="card" style="padding:48px 24px;display:grid;justify-items:center;gap:12px;text-align:center"><span class="svc-name"><span class="ico" style="width:44px;height:44px;border-radius:10px">${ic(icon)}</span></span><h2 style="font-size:17px">${title}</h2><p class="muted" style="margin:0;max-width:56ch">${text}</p><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">${actions}</div></div>`;
    const offRow = (k, v) => `<div style="display:flex;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid var(--line-2);font-size:13px"><span style="flex:1">${k}</span><span class="${v === 'Off' || v === 'None' || v === 'Not chosen' ? 'faint' : ''}">${v}</span></div>`;

    const steps = () => [
      { n: 1, title: 'Connect a cloud', text: 'Pick a provider and the projects Bemmoly may reach. Nothing is created in your cloud.', done: F.cloud, href: '#setup/cloud', btn: 'Connect' },
      { n: 2, title: 'Add environments', text: 'Name them, link a project to each, and set their order and rules.', done: F.envs.length > 0, needs: !F.cloud && 'Needs a connected cloud', href: '#environments', btn: 'Add' },
      { n: 3, title: 'Invite people', text: 'Give each person a role. Make approval groups if you want approvals.', done: F.invited, optional: true, href: '#platform/people', btn: 'Invite' },
      { n: 4, title: 'Add services', text: 'Connect GitHub and pick the services to deploy.', done: F.services.length > 0, href: '#services', btn: 'Add' },
      { n: 5, title: 'Set up pipelines', text: 'For each service: start empty, from a template, or from a file in your repository.', done: Object.keys(F.pipelines).length > 0, needs: !F.services.length && 'Needs a service', href: `#service/${F.services[0] || 'buyer-agent'}/pipelines`, btn: 'Set up' },
      { n: 6, title: 'Templates and required steps', text: '4 built-in templates are ready. Add your own, and steps every pipeline must keep.', done: false, optional: true, href: '#platform/templates', btn: 'Open' },
    ];

    function home() {
      const S = steps(); const done = S.filter((x) => x.done).length;
      const rules = F.envs.filter((e) => e.approval).map((e) => `${e.name}: ${e.approval}`);
      return `<div class="wrap">
        <div class="hello"><div class="t"><span class="eyebrow">Fresh install</span><h1>Welcome, Vikram</h1><span class="muted">Bemmoly Pipelines is empty, and nothing runs until you set it up. Do these in any order.</span></div></div>
        <div class="cols">
          <div class="card"><div class="ch"><h2>Set up Pipelines</h2><span class="faint" style="font-size:12.5px">${done} of 6 done</span></div>
            <div style="height:4px;background:var(--line-2)"><div style="height:4px;width:${(done / 6) * 100}%;background:var(--ok)"></div></div>
            ${S.map((x) => `<div class="need" style="padding:16px">
              <span class="rdot ${x.done ? 'ok' : ''}" style="flex:none">${x.done ? ic('check', 'i14') : `<b style="font-size:12px">${x.n}</b>`}</span>
              <div class="t"><b>${x.title} ${x.optional ? '<span class="chip" style="margin-left:6px">Optional</span>' : ''}</b><span>${x.needs || x.text}</span></div>
              ${x.done ? '<span class="chip ok">Done</span>' : x.needs ? `<button class="btn sm" disabled style="opacity:.5">${x.btn}</button>` : `<a class="btn sm ${x.n === S.find((y) => !y.done && !y.needs)?.n ? 'primary' : ''}" href="${x.href}">${x.btn}</a>`}
            </div>`).join('')}
          </div>
          <div class="card"><div class="ch"><h2>What's switched on</h2></div><div class="cb" style="padding-top:6px">
            ${offRow('Clouds', F.cloud ? 'Google Cloud' : 'None')}
            ${offRow('Environments', F.envs.length ? F.envs.map((e) => e.name).join(', ') : 'None')}
            ${offRow('Approval rules', rules.length ? rules.join('<br>') : 'None')}
            ${offRow('Deploy on push', 'Off')}
            ${offRow('Required steps', 'None')}
            ${offRow('Image scan, rollouts, rollback', 'Off')}
            ${offRow('Version numbers', F.pl.ver || 'Not chosen')}
            ${offRow('Notifications', 'Off')}
            <p class="faint" style="margin:12px 0 0;font-size:12.5px">Everything starts off. Turn on what you need, when you need it.</p>
          </div></div>
        </div>
      </div>`;
    }

    function cloud() {
      const cmd = F.signin && F.reach;
      return `<div class="wrap">
        <div class="crumbs"><a href="#home">Set up</a>${ic('chevron-right', 'i14')}<span>Connect a cloud</span></div>
        <div class="head"><div class="t"><h1>Connect a cloud</h1><span class="muted">Bemmoly reads and deploys only where you allow it. Connecting creates nothing in your cloud.</span></div></div>
        <div class="cloudgrid">
          <div class="card cloud on"><div class="top"><b>Google Cloud</b><span class="chip acc">Selected</span></div><span class="muted" style="font-size:12.5px">Cloud Run, Cloud Build, Artifact Registry, Secret Manager</span></div>
          ${['Amazon Web Services', 'Microsoft Azure', 'Kubernetes'].map((n) => `<div class="card cloud"><div class="top">${ic('cloud', 'faint')}<b>${n}</b><span class="chip">Soon</span></div></div>`).join('')}
        </div>
        <div class="grid2">
          <div class="card"><div class="ch"><h2>How Bemmoly signs in</h2></div><div class="cb" style="display:grid;gap:8px">
            ${radio(F.signin === 'vm', 'signin', 'vm', 'The machine Bemmoly runs on', "Uses that VM's service account. No key files.")}
            ${radio(F.signin === 'gcloud', 'signin', 'gcloud', 'My gcloud sign-in on this machine', 'For a laptop install. Acts as you.')}
            ${radio(F.signin === 'wif', 'signin', 'wif', 'A workload identity file', 'For Bemmoly running outside Google Cloud.')}
          </div></div>
          <div class="card"><div class="ch"><h2>What Bemmoly can reach</h2></div><div class="cb" style="display:grid;gap:8px">
            ${radio(F.reach === 'folder', 'reach', 'folder', 'Every project in a folder or organization', 'Includes projects added later.', F.reach === 'folder' ? '<div class="input" style="margin-top:6px">Folder: Hello Robbie</div>' : '')}
            ${radio(F.reach === 'pick', 'reach', 'pick', 'Only the projects I pick', 'Bemmoly sees nothing else.', F.reach === 'pick' ? '<div class="input" style="margin-top:6px">hello-robbie-dev, hello-robbie-stage, hello-robbie-prod</div>' : '')}
          </div></div>
        </div>
        ${cmd ? `<div class="card"><div class="ch"><h2>Grant access</h2><span class="faint" style="font-size:12.5px">Run once as a project owner</span></div><div class="cb" style="display:grid;gap:12px">
          <div class="code" style="background:var(--sunken);border:1px solid var(--line);border-radius:8px;padding:12px 14px;font:12.5px/1.6 var(--mono);white-space:pre;overflow-x:auto">curl -fsSL https://bemmoly.hellorobbie.com/pipelines/connect.sh | bash -s -- \\
  ${F.reach === 'folder' ? '--folder "Hello Robbie"' : '--projects hello-robbie-dev,hello-robbie-stage,hello-robbie-prod'} --signin ${F.signin}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn">${ic('terminal', 'i14')}Open in Cloud Shell</button><button class="btn">${ic('copy', 'i14')}Copy</button><span style="flex:1"></span><button class="btn ${F.checked ? '' : 'primary'}" data-act="fcheck">${ic('refresh-cw', 'i14')}Check access</button></div>
          ${F.checked ? `<table class="table"><thead><tr><th>Project Bemmoly can see</th><th>Cloud Run</th><th>Cloud Build</th><th>Secrets</th></tr></thead>${PROJECTS.slice(0, F.reach === 'folder' ? 4 : 3).map((p) => `<tr><td class="mono">${p}</td><td>${st('ok')}</td><td>${st('ok')}</td><td>${st('ok')}</td></tr>`).join('')}</table>
            <div style="display:flex;justify-content:flex-end"><button class="btn primary" data-act="fconnect">Connect Google Cloud</button></div>` : ''}
        </div></div>` : `<div class="info">${ic('info')}<span>Choose how Bemmoly signs in and what it can reach, and the command to grant access appears here.</span></div>`}
      </div>`;
    }

    function environments() {
      if (!F.envs.length) {
        return `<div class="wrap"><div class="head"><div class="t"><h1>Environments</h1><span class="muted">Each environment is one cloud project that versions deploy into.</span></div></div>
          ${F.cloud ? empty('layers', 'No environments yet', 'Add them one at a time, or start from a suggested setup you can change before anything is created.', `<button class="btn" data-act="faddenv">${ic('plus')}Add an environment</button><button class="btn primary" data-act="fsuggest">${ic('sparkles')}Use a suggested setup</button>`)
            : empty('cloud-off', 'Connect a cloud first', 'Environments live in cloud projects, so Bemmoly needs to reach them first.', `<a class="btn primary" href="#setup/cloud">Connect a cloud</a>`)}</div>`;
      }
      return `<div class="wrap"><div class="head"><div class="t"><h1>Environments</h1><span class="muted">${F.envs.length} environments. Every setting below is yours to change.</span></div><button class="btn primary" data-act="faddenv">${ic('plus')}Add an environment</button></div>
        <div class="lane" style="grid-template-columns:${F.envs.map(() => 'minmax(0,1fr)').join(' 44px ')}">
          ${F.envs.map((e, i) => `${i ? `<div class="promote"><button>${ic('arrow-right')}</button></div>` : ''}<div class="card envcard">
            <div class="top"><b>${e.name}</b><button class="iconbtn">${ic('pencil', 'i14')}</button></div>
            <div class="prov"><div class="t"><b class="mono" style="font-size:12.5px">${e.project}</b><small>Google Cloud · asia-south1 · linked</small></div></div>
            <div>${offRow('Who can deploy', e.deployers)}${offRow('Approval', e.approval || 'Off')}${offRow('Deploy window', e.window || 'None')}${offRow('Versions allowed', e.versions)}</div>
          </div>`).join('')}
        </div></div>`;
    }

    function services() {
      if (!F.services.length) return `<div class="wrap"><div class="head"><div class="t"><h1>Services</h1></div></div>${empty('layout-grid', 'No services yet', 'Connect a GitHub repository and pick the folders Bemmoly should build and deploy. Nothing is picked for you.', `<button class="btn primary" data-act="faddsvc">${ic('git-branch')}Add from GitHub</button>`)}</div>`;
      return `<div class="wrap"><div class="head"><div class="t"><h1>Services</h1><span class="muted">${F.services.length} services. None has been deployed yet.</span></div><button class="btn" data-act="faddsvc">${ic('git-branch')}Add from GitHub</button></div>
        <div class="card scrollx"><table class="table" style="min-width:760px"><thead><tr><th>Service</th>${F.envs.map((e) => `<th>${e.name}</th>`).join('') || '<th>Environments</th>'}<th>Pipeline</th></tr></thead>
        ${F.services.map((k) => `<tr class="click" data-href="#service/${k}/pipelines"><td class="mono">${k}</td>${F.envs.map(() => '<td><span class="rev empty">Not deployed</span></td>').join('') || '<td class="faint">None yet</td>'}<td>${F.pipelines[k] ? '<span class="chip ok">Deliver, no triggers</span>' : `<span class="chip">${ic('plus')}Set up</span>`}</td></tr>`).join('')}
        </table></div></div>`;
    }

    function pipelines(key) {
      if (F.pipelines[key]) {
        return `<div class="wrap"><div class="crumbs"><a href="#services">Services</a>${ic('chevron-right', 'i14')}<span class="mono">${key}</span>${ic('chevron-right', 'i14')}<span>Pipelines</span></div>
          <div class="head"><div class="t"><h1>Deliver</h1><span class="muted">${F.pl.start === 'empty' ? 'Empty' : F.pl.start === 'template' ? `From the template "${tpl(F.pl.tpl).name}"` : 'From the repository file'} · kept ${F.pl.store === 'repo' ? 'in the repository as .bemmoly/deliver.yml' : 'in Bemmoly'} · versions: ${F.pl.ver}</span></div><button class="btn">${ic('play')}Run</button></div>
          <div class="card" style="background-color:var(--sunken);background-image:radial-gradient(var(--line) 1px, transparent 1px);background-size:18px 18px">
            <div class="trig"><span class="chip">No triggers: it runs when someone presses Run</span><button class="chip">${ic('plus')}Add trigger</button></div>
            ${F.pl.start === 'template' ? `<div style="padding:16px 20px 24px;display:flex;gap:16px;flex-wrap:wrap">${tplGroups(tpl(F.pl.tpl), true)}</div><div style="padding:0 20px 20px"><span class="faint" style="font-size:12.5px">The template suggests the trigger "${tpl(F.pl.tpl).trigger}". It's off until you add it.</span></div>`
              : `<div style="padding:40px 20px 48px;display:grid;justify-items:center;gap:10px"><button class="addnode" data-act="add" style="width:240px;height:56px">${ic('plus', 'i14')}Add the first step</button><span class="faint" style="font-size:12.5px">Build, test, deploy, approve or run a script. Each step is yours to add.</span></div>`}
          </div></div>`;
      }
      const ready = F.pl.start && (F.pl.start !== 'template' || F.pl.tpl) && F.pl.store && F.pl.ver;
      return `<div class="wrap"><div class="crumbs"><a href="#services">Services</a>${ic('chevron-right', 'i14')}<span class="mono">${key}</span>${ic('chevron-right', 'i14')}<span>Pipelines</span></div>
        <div class="head"><div class="t"><h1>Set up a pipeline for <span class="mono">${key}</span></h1><span class="muted">Three choices. Nothing is picked for you, and each can change later.</span></div><button class="btn" data-act="fplsuggest">${ic('sparkles')}Use suggested</button></div>
        <div class="card"><div class="ch"><h2>Start from</h2></div><div class="cb grid3">
          ${radio(F.pl.start === 'empty', 'fpl', 'start:empty', 'Nothing', 'An empty pipeline. You add each step.')}
          ${radio(F.pl.start === 'template', 'fpl', 'start:template', 'A template', `${TEMPLATES.length} built in, ready to use`)}
          ${radio(F.pl.start === 'repo', 'fpl', 'start:repo', 'A file in the repository', 'Found .github/workflows/deploy.yml. Bemmoly reads its steps.')}
        </div></div>
        ${F.pl.start === 'template' ? `<div class="card"><div class="ch"><h2>Template</h2><span class="faint" style="font-size:12.5px">Built in · steps for environments you don't have are left out</span></div><div class="cb" style="display:grid;gap:10px">
          ${TEMPLATES.map((t) => radio(F.pl.tpl === t.key, 'fpl', 'tpl:' + t.key, `${t.name}${t.suggested ? ' <span class="chip acc" style="margin-left:6px">Suggested</span>' : ''}`, t.desc, F.pl.tpl === t.key ? `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:10px">${tplGroups(t)}</div>` : '')).join('')}
        </div></div>` : ''}
        <div class="card"><div class="ch"><h2>Where the pipeline lives</h2></div><div class="cb grid2">
          ${radio(F.pl.store === 'bemmoly', 'fpl', 'store:bemmoly', 'In Bemmoly', 'Edit it here. Changes are saved with a history.')}
          ${radio(F.pl.store === 'repo', 'fpl', 'store:repo', 'In the repository', 'As .bemmoly/deliver.yml. Saving opens a pull request.')}
        </div></div>
        <div class="card"><div class="ch"><h2>How versions are numbered</h2></div><div class="cb" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px">
          ${[['From commit messages', '1.8.0, from feat and fix commits'], ['Build number', '#142, counting up'], ['Git tags', 'Whatever tag you push'], ['Commit only', 'a41c9e2, no version']].map(([t, d]) => radio(F.pl.ver === t, 'fpl', 'ver:' + t, t, d)).join('')}
        </div></div>
        <div class="info">${ic('info')}<span>The pipeline starts with no triggers. It runs only when someone presses Run, until you add one such as "on push to main".</span></div>
        <div style="display:flex;justify-content:flex-end"><button class="btn primary" data-act="fplcreate" ${ready ? '' : 'disabled style="opacity:.5;pointer-events:none"'}>Create pipeline</button></div>
      </div>`;
    }

    function tplGroups(t, big) {
      return t.groups.filter(([g]) => !['Dev', 'Stage', 'Production'].includes(g) || !F.envs.length || F.envs.some((e) => e.name === g)).map(([g, jobs]) => `<div class="gbox" style="padding:10px 12px;gap:8px"><div class="sh">${g}</div><div style="display:flex;flex-direction:column;gap:6px">${jobs.map((j) => `<span class="item" style="${big ? 'height:34px;min-width:160px' : ''}">${j}</span>`).join('')}</div></div>`).join('');
    }

    function templates() {
      return `<div class="grid2">${TEMPLATES.map((t) => `<div class="card"><div class="ch">${ic('layout-template', 'faint')}<h2>${t.name}</h2><span class="chip">Built in</span>${t.suggested ? '<span class="chip acc">Suggested</span>' : ''}</div><div class="cb" style="display:grid;gap:12px"><span class="muted" style="font-size:12.5px">${t.desc}</span><div style="display:flex;gap:10px;flex-wrap:wrap">${tplGroups(t)}</div><div style="display:flex;gap:8px"><button class="btn sm">${ic('copy', 'i14')}Copy and edit</button></div></div></div>`).join('')}</div>
        <div class="card"><div class="ch"><h2>Your templates</h2><button class="btn sm">${ic('plus', 'i14')}New template</button></div><div class="cb muted">None yet. Copy a built-in one, or turn any pipeline into a template.</div></div>
        <div class="card"><div class="ch"><h2>Required steps</h2><button class="btn sm">${ic('plus', 'i14')}Require a step</button></div><div class="cb muted">None. A required step stays in every pipeline that uses a template, for example an image scan.</div></div>`;
    }

    function people() {
      const list = [['Vikram Rao', 'Platform admin', 'You'], ...(F.invited ? [['Keerthi', 'Developer', 'Invited'], ['Riya Menon', 'Developer', 'Invited'], ['Ananya Iyer', 'Approver', 'Invited']] : [])];
      return `<div class="card scrollx"><div class="ch"><h2>People</h2><button class="btn sm ${F.invited ? '' : 'primary'}" data-act="finvite">${ic('user-plus', 'i14')}Invite</button></div>
          <table class="table"><thead><tr><th>Person</th><th>Role</th><th>Approval groups</th><th></th></tr></thead>
          ${list.map(([n, r, s]) => `<tr><td><b style="font-weight:600">${n}</b></td><td><span class="lvl">${r}${ic('chevron-down', 'i14 faint')}</span></td><td>${n === 'Ananya Iyer' && F.groups.length ? `<span class="chip acc">${F.groups[0]}</span>` : '<span class="faint">None</span>'}</td><td><span class="chip">${s}</span></td></tr>`).join('')}</table></div>
        <div class="card"><div class="ch"><h2>Approval groups</h2><button class="btn sm">${ic('plus', 'i14')}New group</button></div>
          ${F.groups.length ? `<table class="table">${F.groups.map((g) => `<tr><td><b>${g}</b></td><td class="faint">${F.invited && g === 'Production approvers' ? 'Ananya Iyer' : 'No members yet'}</td><td><button class="btn sm">Add people</button></td></tr>`).join('')}</table>` : '<div class="cb muted">None. Make one when an environment needs approval, for example "Production approvers".</div>'}</div>`;
    }

    function overlay(kind) {
      if (kind === 'fsuggest') {
        const S = F.suggest; const n = Object.values(S).filter(Boolean).length;
        const envFields = (k) => { const v = F.env[k]; return `<div style="display:grid;grid-template-columns:1fr 1fr 1.3fr;gap:8px;margin-top:8px">
            <label class="field" style="gap:3px"><small>Name</small><input class="input" data-fbind="${k}.name" value="${esc(v.name)}"></label>
            <label class="field" style="gap:3px"><small>ID, used in pipeline files</small><input class="input mono" data-fbind="${k}.id" value="${esc(v.id)}"></label>
            <label class="field" style="gap:3px"><small>Project</small><select class="input mono" data-fbind="${k}.project">${PROJECTS.map((p) => `<option ${p === v.project ? 'selected' : ''}>${p}</option>`).join('')}</select></label></div>`; };
        return `<div class="scrim" data-act="close"><div class="dialog" role="dialog" style="width:min(640px,100%)">
          <div class="dh"><h2 style="font-size:17px">Suggested setup</h2><span class="muted" style="font-size:12.5px">A common starting point. Untick what you don't want; nothing is created until you confirm.</span></div>
          <div class="db" style="gap:8px">
            ${check(S.dev, 'fsug', 'dev', `${esc(F.env.dev.name)}`, 'Developers deploy any version' + (S.dev ? envFields('dev') : ''))}
            ${check(S.stage, 'fsug', 'stage', `${esc(F.env.stage.name)}`, 'Developers deploy versions that passed Dev' + (S.stage ? envFields('stage') : ''))}
            ${check(S.prod, 'fsug', 'prod', `${esc(F.env.prod.name)}`, 'Only versions that passed Stage' + (S.prod ? envFields('prod') : ''))}
            ${check(S.order, 'fsug', 'order', 'Versions move Dev, then Stage, then Production', 'A version must pass one before the next')}
            ${check(S.prodApproval, 'fsug', 'prodApproval', 'Production needs approval', 'Makes the group "Production approvers". 1 approval needed. You add the people.')}
            ${check(S.stageApproval, 'fsug', 'stageApproval', 'Stage needs approval', 'Makes the group "Stage approvers". 1 approval needed.')}
            ${check(S.window, 'fsug', 'window', 'Production deploy window', 'Weekdays 10:00 to 18:00')}
          </div>
          <div class="df"><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="fsugcreate">Create ${n} ${n === 1 ? 'thing' : 'things'}</button></div>
        </div></div>`;
      }
      if (kind === 'faddenv') {
        return `<div class="scrim" data-act="close"><div class="dialog" role="dialog">
          <div class="dh"><h2 style="font-size:17px">Add an environment</h2><span class="muted" style="font-size:12.5px">Every setting starts off. Turn on only what this environment needs.</span></div>
          <div class="db">
            <div class="field"><label>Name</label><div class="input">QA</div></div>
            <div class="field"><label>Project</label><div class="seg"><button class="on">Link a project I have</button><button>Create a new one</button></div><div class="select mono">robbie-tools</div></div>
            <div class="field"><label>Who can deploy</label><div class="select">Choose people or a role</div></div>
            <div class="check-row"><span class="toggle"></span><span>Needs approval <span class="faint">· off</span></span></div>
            <div class="check-row"><span class="toggle"></span><span>Deploy window <span class="faint">· none</span></span></div>
            <div class="field"><label>Versions allowed</label><div class="select">Any version</div></div>
          </div>
          <div class="df"><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="faddenvok">Add environment</button></div>
        </div></div>`;
      }
      if (kind === 'faddsvc') {
        return `<div class="scrim" data-act="close"><div class="dialog" role="dialog" style="width:min(600px,100%)">
          <div class="dh"><h2 style="font-size:17px">Add services from GitHub</h2><span class="muted" style="font-size:12.5px">Bemmoly found ${FOUND.length} folders it can build. Tick the ones you want.</span></div>
          <div class="db" style="gap:8px">
            <div class="select mono">robbie-flow/hello-robbie</div>
            ${FOUND.map(([k, p]) => check(F.picks.includes(k), 'fpick', k, k, p)).join('')}
            <span class="faint" style="font-size:12px">Domain and team are optional; set them on each service later.</span>
          </div>
          <div class="df"><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="faddsvcok" ${F.picks.length ? '' : 'disabled style="opacity:.5;pointer-events:none"'}>Add ${F.picks.length || ''} ${F.picks.length === 1 ? 'service' : 'services'}</button></div>
        </div></div>`;
      }
      return '';
    }

    function backBar() {
      const S = steps(); const done = S.filter((x) => x.done).length;
      return done === S.length ? '' : `<a href="#home" class="info" style="align-items:center;margin-bottom:-8px">${ic('list-checks')}<span style="flex:1">Setting up Pipelines · ${done} of ${S.length} done</span><span style="font-weight:600;color:var(--acc)">Back to the checklist</span></a>`;
    }

    return { backBar, home, cloud, environments, services, pipelines, people, templates, overlay, empty };
  }

  function bind(el) {
    const [k, f] = el.dataset.fbind.split('.'); F.env[k][f] = el.value;
  }

  function act(a, t, ui, toast, render) {
    if (a === 'signin') { F.signin = t.dataset.v; F.checked = false; }
    else if (a === 'reach') { F.reach = t.dataset.v; F.checked = false; }
    else if (a === 'fcheck') { F.checked = true; }
    else if (a === 'fconnect') { F.cloud = true; location.hash = '#home'; setTimeout(() => toast('Google Cloud connected. Nothing was created.'), 50); return true; }
    else if (a === 'fsuggest' || a === 'faddenv' || a === 'faddsvc') { ui.overlay = a; }
    else if (a === 'fsug') { F.suggest[t.dataset.k] = !F.suggest[t.dataset.k]; }
    else if (a === 'fsugcreate') {
      const S = F.suggest;
      const mk = (name, project, versions, extra = {}) => ({ name, project, deployers: 'Developers', versions, approval: null, window: null, ...extra });
      const E = F.env;
      if (S.dev) F.envs.push(mk(E.dev.name, E.dev.project, 'Any version', { id: E.dev.id }));
      if (S.stage) F.envs.push(mk(E.stage.name, E.stage.project, S.order ? `Passed ${E.dev.name}` : 'Any version', { id: E.stage.id, ...(S.stageApproval ? { approval: `1 of ${E.stage.name} approvers` } : {}) }));
      if (S.prod) F.envs.push(mk(E.prod.name, E.prod.project, S.order ? `Passed ${E.stage.name}` : 'Any version', { id: E.prod.id, deployers: S.prodApproval ? 'Through a change request' : 'Developers', ...(S.prodApproval ? { approval: `1 of ${E.prod.name} approvers` } : {}), ...(S.window ? { window: 'Weekdays 10:00 to 18:00' } : {}) }));
      if (S.prodApproval) F.groups.push(`${E.prod.name} approvers`);
      if (S.stageApproval) F.groups.push(`${E.stage.name} approvers`);
      ui.overlay = null; location.hash = '#home'; toast(`Created ${F.envs.length} environments${F.groups.length ? ' and ' + F.groups.join(', ') : ''}.`); return true;
    }
    else if (a === 'faddenvok') { location.hash = '#home'; F.envs.push({ name: 'QA', project: 'robbie-tools', deployers: 'Not set', versions: 'Any version', approval: null, window: null }); ui.overlay = null; toast('QA added. Its settings are all off.'); return true; }
    else if (a === 'fpick') { const k = t.dataset.k; F.picks = F.picks.includes(k) ? F.picks.filter((x) => x !== k) : [...F.picks, k]; }
    else if (a === 'faddsvcok') { F.services = [...new Set([...F.services, ...F.picks])]; F.picks = []; ui.overlay = null; location.hash = '#home'; toast(`Added ${F.services.length} services. None has a pipeline yet.`); return true; }
    else if (a === 'fpl') { const [k, v] = t.dataset.v.split(':'); F.pl[k] = v; }
    else if (a === 'fplsuggest') { F.pl = { start: 'template', tpl: 'path', store: 'bemmoly', ver: 'From commit messages' }; toast('Filled in the suggested choices. Check them, then create.'); return true; }
    else if (a === 'fplcreate') { const key = location.hash.split('/')[1]; F.pipelines[key] = true; location.hash = '#home'; toast(F.pl.start === 'template' ? 'Deliver created from the template. No triggers yet.' : 'Deliver created. It has no steps and no triggers yet.'); return true; }
    else if (a === 'finvite') { F.invited = true; location.hash = '#home'; toast('Invited 3 people. They get an email with their role.'); return true; }
    else return false;
    render(); return true;
  }

  return { F, h, act, bind };
})();
