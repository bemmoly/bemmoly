/* Example data for the prototype: Hello Robbie's services. Every name, version and number here is
   made up to show the screens; none of it is read from a real install. */

window.DATA = {
  org: { name: 'Hello Robbie', tile: 'H' },

  /* Who is looking. The prototype's "View as" switch moves between them. */
  roles: {
    admin: { person: 'Vikram Rao', initials: 'VR', color: 'sky', label: 'Platform admin',
      sees: ['home', 'services', 'runs', 'changes', 'environments', 'platform'] },
    developer: { person: 'Keerthi', initials: 'KD', color: '', label: 'Developer',
      sees: ['home', 'services', 'runs', 'changes'] },
    approver: { person: 'Ananya Iyer', initials: 'AI', color: 'pink', label: 'Approver',
      sees: ['home', 'changes'] },
  },

  people: [
    { name: 'Vikram Rao', role: 'Platform admin', groups: [], deploy: ['Dev', 'Stage', 'Production'], color: 'sky' },
    { name: 'Keerthi', role: 'Developer', groups: [], deploy: ['Dev', 'Stage'], color: '' },
    { name: 'Arun Kumar', role: 'Developer', groups: ['Production approvers'], deploy: ['Dev', 'Stage'], color: 'green' },
    { name: 'Riya Menon', role: 'Developer', groups: ['Production approvers'], deploy: ['Dev', 'Stage'], color: 'orange' },
    { name: 'Sana Qureshi', role: 'Developer', groups: [], deploy: ['Dev', 'Stage'], color: 'pink' },
    { name: 'Ananya Iyer', role: 'Approver', groups: ['Production approvers', 'High-risk approvers'], deploy: [], color: 'pink' },
    { name: 'Rahul Shah', role: 'Approver', groups: ['High-risk approvers'], deploy: [], color: 'green' },
    { name: 'Meera Pillai', role: 'Viewer', groups: [], deploy: [], color: 'orange' },
  ],

  /* Environments are equal. Order is the promotion path; any of them can carry an approval rule. */
  envs: [
    { key: 'dev', name: 'Dev', project: 'hello-robbie-dev', region: 'asia-south1', approval: null,
      rules: ['Every push to main deploys here', 'Developers deploy any version'] },
    { key: 'stage', name: 'Stage', project: 'hello-robbie-stage', region: 'asia-south1', approval: null,
      rules: ['Follows Dev once integration tests pass', 'Developers deploy any version that passed Dev'] },
    { key: 'prod', name: 'Production', project: 'hello-robbie-prod', region: 'asia-south1',
      approval: { steps: [
        { who: 'Production approvers', need: 2, when: 'Always' },
        { who: 'High-risk approvers', need: 1, when: 'Only when risk is high' } ],
        then: 'Deploy automatically', window: 'Weekdays 10:00 to 18:00 IST' },
      rules: ['Only versions that passed Stage', 'Change request: 2 Production approvers', 'Deploys itself once approved, Weekdays 10:00 to 18:00'] },
  ],

  /* Every build that passes its tests becomes a version. */
  versions: { a41c9e2: '1.8.0', '3b77d10': '1.7.2', '9e01f2c': '2.3.1', '7d03b11': '2.3.0', '51aa0c4': '4.1.0', '2f9d8e1': '4.0.3',
    e90f4aa: '0.9.0', c12be07: '0.4.1', '0bd4e17': '1.2.0', '8c2e5b9': '0.2.0' },

  domains: [
    { key: 'marketplace', name: 'Marketplace', hue: '#2356c9' },
    { key: 'ai', name: 'AI', hue: '#6e56cf' },
    { key: 'platform', name: 'Platform', hue: '#0e9bb0' },
  ],

  services: [
    { key: 'buyer-agent', domain: 'marketplace', team: 'Engineering', icon: 'shopping-bag', path: 'services/buyer-agent', kind: 'Cloud Run service',
      env: { dev: { rev: 'a41c9e2', h: 'ok', inst: 2, msg: 'Fix offer retries on supplier 503s', at: '12 min ago', by: 'Keerthi' },
             stage: { rev: 'a41c9e2', h: 'ok', inst: 1, msg: 'Fix offer retries on supplier 503s', at: '8 min ago', by: 'Pipeline' },
             prod: { rev: '3b77d10', h: 'ok', inst: 4, msg: 'Cache supplier catalogue for 60 s', at: '2 days ago', by: 'CHG-1039', change: 1042 } },
      last: 'run' },
    { key: 'supplier', domain: 'marketplace', team: 'Engineering', icon: 'truck', path: 'services/supplier', kind: 'Cloud Run service',
      env: { dev: { rev: '9e01f2c', h: 'bad', inst: 1, msg: 'Add GST fields to invoices', at: '34 min ago', by: 'Arun' },
             stage: { rev: '7d03b11', h: 'ok', inst: 1, msg: 'Paginate supplier search', at: 'yesterday', by: 'Pipeline' },
             prod: { rev: '7d03b11', h: 'ok', inst: 3, msg: 'Paginate supplier search', at: 'yesterday', by: 'CHG-1039' } },
      last: 'bad' },
    { key: 'storefront-web', domain: 'marketplace', team: 'Web', icon: 'store', path: 'apps/storefront', kind: 'Cloud Run service',
      env: { dev: { rev: '51aa0c4', h: 'ok', inst: 1, msg: 'New checkout summary', at: '1 h ago', by: 'Meera' },
             stage: { rev: '51aa0c4', h: 'ok', inst: 1, msg: 'New checkout summary', at: '58 min ago', by: 'Pipeline' },
             prod: { rev: '2f9d8e1', h: 'ok', inst: 6, msg: 'Lazy-load product images', at: '3 days ago', by: 'CHG-1037', change: 1042 } },
      last: 'ok' },
    { key: 'ai-research-engine', domain: 'ai', team: 'AI', icon: 'brain', path: 'services/ai-research-engine', kind: 'Cloud Run service',
      env: { dev: { rev: 'e90f4aa', h: 'ok', inst: 1, msg: 'Stream partial answers', at: '2 h ago', by: 'Sana' },
             stage: { rev: 'e90f4aa', h: 'run', inst: 1, msg: 'Stream partial answers', at: 'deploying', by: 'Pipeline' },
             prod: null },
      last: 'run' },
    { key: 'mcp', domain: 'ai', team: 'AI', icon: 'plug', path: 'services/mcp', kind: 'Cloud Run service',
      env: { dev: { rev: 'c12be07', h: 'ok', inst: 1, msg: 'Add catalogue search tool', at: '5 h ago', by: 'Sana' },
             stage: { rev: 'c12be07', h: 'ok', inst: 1, msg: 'Add catalogue search tool', at: '5 h ago', by: 'Pipeline' },
             prod: null },
      last: 'ok' },
    { key: 'nightly-reconcile', domain: 'platform', team: 'Platform', icon: 'calendar-clock', path: 'jobs/reconcile', kind: 'Cloud Run job',
      env: { dev: { rev: '0bd4e17', h: 'ok', inst: 0, msg: 'Retry failed ledger rows', at: 'yesterday', by: 'Vikram' },
             stage: { rev: '0bd4e17', h: 'ok', inst: 0, msg: 'Retry failed ledger rows', at: 'yesterday', by: 'Pipeline' },
             prod: { rev: '0bd4e17', h: 'ok', inst: 0, msg: 'Retry failed ledger rows', at: 'yesterday', by: 'CHG-1040' } },
      last: 'ok' },
    { key: 'backstage', domain: 'platform', team: 'Platform', icon: 'layout-dashboard', path: 'apps/backstage', kind: 'Cloud Run service',
      env: { dev: { rev: '8c2e5b9', h: 'ok', inst: 1, msg: 'Upgrade to Node 22', at: '1 day ago', by: 'Vikram' },
             stage: null, prod: null },
      last: 'ok' },
  ],

  /* buyer-agent's versions, newest first, and where each one runs. */
  history: [
    { ver: '1.8.0', sha: 'a41c9e2', msg: 'Fix offer retries on supplier 503s', at: 'Today, 10:36', by: 'Keerthi', in: ['dev', 'stage'], change: 1042, tests: 'ok' },
    { ver: '1.7.3', sha: 'f02b6d1', msg: 'Log negotiation outcomes', at: 'Yesterday', by: 'Riya', in: [], tests: 'ok' },
    { ver: '1.7.2', sha: '3b77d10', msg: 'Cache supplier catalogue for 60 s', at: '30 Oct', by: 'Arun', in: ['prod'], change: 1039, tests: 'ok' },
    { ver: '1.7.1', sha: '8e44c02', msg: 'Handle empty supplier list', at: '28 Oct', by: 'Keerthi', in: [], change: 1036, tests: 'ok' },
    { ver: '1.7.0', sha: '2ad91f7', msg: 'Counter offers', at: '24 Oct', by: 'Riya', in: [], change: 1033, tests: 'ok' },
  ],

  runs: [
    { id: 1284, svc: 'buyer-agent', pipeline: 'Deliver', title: 'Fix offer retries on supplier 503s', sha: 'a41c9e2', branch: 'main', trigger: 'Push', by: 'Keerthi', st: 'run', dur: '6m 41s', at: 'now', bar: ['ok','ok','ok','ok','run',''] },
    { id: 1283, svc: 'ai-research-engine', pipeline: 'Deliver', title: 'Stream partial answers', sha: 'e90f4aa', branch: 'main', trigger: 'Push', by: 'Sana', st: 'run', dur: '3m 05s', at: 'now', bar: ['ok','ok','ok','ok','run',''] },
    { id: 1282, svc: 'storefront-web', pipeline: 'Integration tests', title: 'Integration tests on Stage', sha: '51aa0c4', branch: 'main', trigger: 'Manual', by: 'Meera', st: 'run', dur: '1m 12s', at: 'now', bar: ['ok','run',''] },
    { id: 1281, svc: 'supplier', pipeline: 'Deliver', title: 'Add GST fields to invoices', sha: '9e01f2c', branch: 'main', trigger: 'Push', by: 'Arun', st: 'bad', dur: '4m 18s', at: '34 min ago', bar: ['ok','ok','ok','ok','bad',''] },
    { id: 1280, svc: 'buyer-agent', pipeline: 'Pull request checks', title: 'Retry supplier calls with backoff', sha: '6c90aa1', branch: 'kd/retry-backoff', trigger: 'Pull request #412', by: 'Keerthi', st: 'ok', dur: '2m 02s', at: '1 h ago', bar: ['ok','ok','ok'] },
    { id: 1279, svc: 'storefront-web', pipeline: 'Deliver', title: 'New checkout summary', sha: '51aa0c4', branch: 'main', trigger: 'Push', by: 'Meera', st: 'ok', dur: '7m 55s', at: '1 h ago', bar: ['ok','ok','ok','ok','ok','ok'] },
    { id: 1278, svc: 'nightly-reconcile', pipeline: 'Smoke tests', title: 'Nightly smoke tests, all environments', sha: '0bd4e17', branch: 'main', trigger: 'Schedule', by: 'Bemmoly', st: 'ok', dur: '58s', at: '6 h ago', bar: ['ok','ok','ok'] },
    { id: 1277, svc: 'nightly-reconcile', pipeline: 'Promote', title: 'CHG-1040 to Production', sha: '0bd4e17', branch: '1.2.0', trigger: 'Change approved', by: 'CHG-1040', st: 'ok', dur: '1m 30s', at: 'yesterday', bar: ['ok','ok'] },
    { id: 1276, svc: 'supplier', pipeline: 'Database migration', title: 'Migrate invoices to v14 schema', sha: '7d03b11', branch: 'main', trigger: 'Manual', by: 'Arun', st: 'ok', dur: '41s', at: 'yesterday', bar: ['ok','ok'] },
  ],

  /* Run #1284: the Deliver pipeline. It stops at the last environment without an approval rule;
     Production is reached by promoting the version it made. */
  graph: [
    { name: 'Build', cols: [
      [ { id: 'build', name: 'Build image', st: 'ok', dur: '1m 48s', icon: 'package', kind: 'Build image' },
        { id: 'unit', name: 'Unit tests', st: 'ok', dur: '52s', icon: 'flask-conical', kind: 'Run a script' } ],
      [ { id: 'scan', name: 'Scan image', st: 'ok', dur: '31s', icon: 'shield-check', kind: 'Scan image', required: true } ] ] },
    { name: 'Dev', env: 'dev', cols: [
      [ { id: 'deploy-dev', name: 'Deploy', st: 'ok', dur: '38s', icon: 'rocket', kind: 'Deploy service' } ],
      [ { id: 'it-dev', name: 'Integration tests', st: 'run', dur: '2m 10s', icon: 'terminal', kind: 'Run a script' } ] ] },
    { name: 'Stage', env: 'stage', cols: [
      [ { id: 'deploy-stage', name: 'Deploy', st: 'queued', dur: '', icon: 'rocket', kind: 'Deploy service' } ],
      [ { id: 'smoke-stage', name: 'Smoke tests', st: 'queued', dur: '', icon: 'terminal', kind: 'Run a script' } ] ] },
  ],

  steps: {
    'it-dev': [
      { name: 'Set up job', st: 'ok', dur: '2s', lines: [
        ['d', 'Runner: Cloud Build in hello-robbie-dev (e2-standard-4)'],
        ['d', 'Image: node:22-bookworm'],
        ['', 'Secrets: TEST_API_KEY (from Secret Manager)'] ] },
      { name: 'Check out a41c9e2', st: 'ok', dur: '4s', lines: [
        ['', 'Fetching robbie-flow/hello-robbie at a41c9e2'],
        ['g', 'HEAD is now at a41c9e2 Fix offer retries on supplier 503s'] ] },
      { name: 'Install dependencies', st: 'ok', dur: '11s', lines: [
        ['', '$ pnpm install --frozen-lockfile --filter buyer-agent...'],
        ['d', 'Lockfile is up to date, resolution step is skipped'],
        ['d', 'Packages: +412 (restored from cache)'],
        ['g', 'Done in 9.8s'] ] },
      { name: 'Run integration tests', st: 'run', dur: '1m 53s', open: true, lines: [
        ['', '$ pnpm --filter buyer-agent test:integration'],
        ['d', 'BASE_URL=https://buyer-agent-dev-x7k2-el.a.run.app'],
        ['', ''],
        ['b', ' RUN  v3.2.4 services/buyer-agent'],
        ['', ''],
        ['g', ' ✓ offers › creates an offer for a known supplier (318 ms)'],
        ['g', ' ✓ offers › rejects an offer above the buyer limit (122 ms)'],
        ['g', ' ✓ offers › retries on supplier 503 and succeeds (1204 ms)'],
        ['g', ' ✓ offers › gives up after 3 retries with a clear error (3611 ms)'],
        ['g', ' ✓ negotiation › counters within 5% of list price (451 ms)'],
        ['g', ' ✓ negotiation › stops after the buyer accepts (207 ms)'],
      ], stream: [
        ['g', ' ✓ catalogue › reads a cached supplier catalogue (96 ms)'],
        ['g', ' ✓ catalogue › refreshes after 60 s (1033 ms)'],
        ['y', ' ↓ payments › refunds a cancelled order [skipped: needs sandbox]'],
        ['g', ' ✓ webhooks › signs outgoing order events (88 ms)'],
        ['g', ' ✓ webhooks › retries a failed delivery (742 ms)'],
        ['', ''],
        ['', ' Test Files  6 passed (6)'],
        ['g', '      Tests  45 passed | 1 skipped (46)'],
      ] },
      { name: 'Upload test report', st: 'queued', dur: '', lines: [] },
    ],
  },

  pipelines: [
    { key: 'deliver', name: 'Deliver', on: 'Push to main', icon: 'workflow', last: 'run' },
    { key: 'promote', name: 'Promote', on: 'When a change is approved', icon: 'arrow-up-right', last: 'ok' },
    { key: 'pr', name: 'Pull request checks', on: 'Pull request', icon: 'git-pull-request', last: 'ok' },
    { key: 'it', name: 'Integration tests', on: 'Manual · after deploy', icon: 'flask-conical', last: 'ok' },
    { key: 'smoke', name: 'Smoke tests', on: 'Nightly at 02:00', icon: 'calendar-clock', last: 'ok' },
    { key: 'migrate', name: 'Database migration', on: 'Manual', icon: 'database', last: 'ok' },
  ],

  library: [
    { cat: 'Build', items: [
      { icon: 'package', name: 'Build image', desc: 'Build a container image from a Dockerfile and push it to your registry.', tags: ['Cloud Build'] },
      { icon: 'boxes', name: 'Build with buildpacks', desc: 'No Dockerfile needed. Detects Node, Python, Go and Java.', tags: ['Cloud Build'] } ] },
    { cat: 'Test', items: [
      { icon: 'terminal', name: 'Run a script', desc: 'Any shell commands in any image. Gets the deployed URL and secrets.', tags: [] },
      { icon: 'flask-conical', name: 'Integration tests', desc: 'Runs your test command against the environment that was just deployed.', tags: [] },
      { icon: 'gauge', name: 'Load test', desc: 'k6 against a URL, fails the run when p95 latency crosses your limit.', tags: [] },
      { icon: 'shield-check', name: 'Scan image', desc: 'Known vulnerabilities in the image. Required by your organization.', tags: ['Required'] } ] },
    { cat: 'Deploy', items: [
      { icon: 'rocket', name: 'Deploy service', desc: 'Roll out a new revision and move traffic after it is healthy.', tags: ['Cloud Run'] },
      { icon: 'split', name: 'Gradual rollout', desc: 'Send 10%, then 50%, then 100% of traffic, checking errors at each step.', tags: ['Cloud Run'] },
      { icon: 'play', name: 'Run a job', desc: 'Execute a Cloud Run job once, for migrations or backfills.', tags: ['Cloud Run'] },
      { icon: 'database', name: 'Database migration', desc: 'Run your migrate command before traffic moves.', tags: ['Cloud SQL'] },
      { icon: 'container', name: 'Deploy to Kubernetes', desc: 'Apply manifests or a Helm chart to GKE or any cluster.', tags: ['Soon'], soon: true },
      { icon: 'cloud', name: 'Deploy to AWS', desc: 'App Runner and ECS services.', tags: ['Soon'], soon: true } ] },
    { cat: 'Control', items: [
      { icon: 'timer', name: 'Wait', desc: 'Pause for a time, or until a window opens.', tags: [] },
      { icon: 'git-fork', name: 'Only when', desc: 'Run the next steps only on a branch, path or label.', tags: [] } ] },
    { cat: 'Tell people', items: [
      { icon: 'message-square', name: 'Slack message', desc: 'Post to a channel when a run passes, fails or waits.', tags: [] },
      { icon: 'webhook', name: 'Webhook', desc: 'Call any URL with the run as JSON.', tags: [] } ] },
  ],

  /* Change requests: how a version reaches an environment with an approval rule. */
  changes: [
    { id: 1042, title: 'Offer retries and the new checkout summary', env: 'prod', by: 'Keerthi', at: '40 min ago', risk: 'Medium',
      items: [ { svc: 'buyer-agent', from: '1.7.2', to: '1.8.0', commits: 4 }, { svc: 'storefront-web', from: '4.0.3', to: '4.1.0', commits: 7 } ],
      why: 'Buyers see failed offers when a supplier returns 503. 1.8.0 retries three times with backoff, then shows a clear error. Storefront 4.1.0 ships the new checkout summary that product signed off on Friday.',
      when: 'As soon as approved, inside the deploy window',
      status: 'waiting', step: 0,
      approvals: [ { who: 'Production approvers', need: 2, st: 'wait', assigned: ['Riya Menon', 'Ananya Iyer'],
                     got: [ { by: 'Riya Menon', st: 'ok', at: '22 min ago', note: 'Read the retry code and the test run. Fine by me.' } ] } ] },
    { id: 1041, title: 'Catalogue search tool for MCP', env: 'prod', by: 'Sana Qureshi', at: '3 h ago', risk: 'Low',
      items: [ { svc: 'mcp', from: 'nothing', to: '0.4.1', commits: 12 } ],
      why: 'First release of the MCP server to Production, read-only tools only.', when: 'As soon as approved', status: 'draft', step: 0,
      approvals: [ { who: 'Production approvers', need: 2, st: 'queued', assigned: [], got: [] } ] },
    { id: 1040, title: 'Retry failed ledger rows in nightly reconcile', env: 'prod', by: 'Vikram Rao', at: 'yesterday', risk: 'Low',
      items: [ { svc: 'nightly-reconcile', from: '1.1.4', to: '1.2.0', commits: 3 } ], status: 'deployed', step: 2,
      approvals: [ { who: 'Production approvers', need: 2, st: 'ok', assigned: ['Arun Kumar', 'Ananya Iyer'], got: [ { by: 'Arun Kumar', st: 'ok' }, { by: 'Ananya Iyer', st: 'ok' } ] } ] },
    { id: 1039, title: 'Supplier search pagination and catalogue cache', env: 'prod', by: 'Arun Kumar', at: '2 days ago', risk: 'Medium',
      items: [ { svc: 'supplier', from: '2.2.4', to: '2.3.0', commits: 6 }, { svc: 'buyer-agent', from: '1.7.1', to: '1.7.2', commits: 2 } ], status: 'deployed', step: 2,
      approvals: [ { who: 'Production approvers', need: 2, st: 'ok', assigned: ['Riya Menon', 'Ananya Iyer'], got: [ { by: 'Riya Menon', st: 'ok' }, { by: 'Ananya Iyer', st: 'ok' } ] } ] },
    { id: 1038, title: 'Raise the buyer offer limit to ₹5 lakh', env: 'prod', by: 'Keerthi', at: '4 days ago', risk: 'High',
      items: [ { svc: 'buyer-agent', from: '1.7.1', to: '1.7.1-limit', commits: 1 } ], status: 'rejected', step: 2,
      approvals: [ { who: 'Production approvers', need: 2, st: 'ok', assigned: ['Arun Kumar', 'Ananya Iyer'], got: [ { by: 'Arun Kumar', st: 'ok' }, { by: 'Ananya Iyer', st: 'ok' } ] },
                   { who: 'High-risk approvers', need: 1, st: 'bad', assigned: ['Rahul Shah'], got: [ { by: 'Rahul Shah', st: 'bad', note: 'Not before finance signs off on the new limit.' } ] } ] },
  ],

  groups: [
    { name: 'Production approvers', members: ['Riya Menon', 'Arun Kumar', 'Ananya Iyer'] },
    { name: 'High-risk approvers', members: ['Ananya Iyer', 'Rahul Shah'] },
  ],

  commits: [
    ['a41c9e2', 'Fix offer retries on supplier 503s', 'Keerthi', '#415'],
    ['6c90aa1', 'Retry supplier calls with backoff', 'Keerthi', '#412'],
    ['f02b6d1', 'Log negotiation outcomes', 'Riya Menon', '#409'],
    ['d71e0a3', 'Bump vitest to 3.2.4', 'Arun Kumar', '#408'],
  ],
};
