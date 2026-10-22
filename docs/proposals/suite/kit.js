/* Bemmoly suite proposal kit: portal nav, appearance, the drawn AppFrame sidebar, screen tabs,
   stage scaling, and a tiny prototype layer (data-go, data-toggle, data-show, data-hide). */
(function () {
  'use strict';

  var PRODUCTS = [
    { id: 'people', name: 'People', long: 'HRMS', file: 'people.html', icon: 'contact-round',
      desc: 'Directory, org chart, leave, onboarding and every person record, in one place.',
      links: [['people.dir', 'Directory', 'users'], ['people.org', 'Org chart', 'network'], ['people.leave', 'Time off', 'palmtree'], ['people.onb', 'Onboarding', 'list-checks'], ['people.docs', 'Documents', 'folder-lock']], views: ['Joining this month','Probation ending','Berlin office'] },
    { id: 'time', name: 'Time', long: 'Timesheets', file: 'time.html', icon: 'timer',
      desc: 'Timesheets that fill themselves from your calendar and your work, approved in a tap.',
      links: [['time.mine', 'My timesheet', 'calendar-days'], ['time.appr', 'Approvals', 'check-check'], ['time.proj', 'Projects and codes', 'folder-kanban'], ['time.rep', 'Reports', 'chart-column']], views: ['Billable this week','Northwind project','Missing days'] },
    { id: 'expenses', name: 'Expenses', long: 'Expense management', file: 'expenses.html', icon: 'receipt',
      desc: 'Snap a receipt, it files itself. Policy checks before you submit, not after.',
      links: [['exp.mine', 'My expenses', 'wallet'], ['exp.appr', 'Approvals', 'check-check'], ['exp.trips', 'Trips', 'plane'], ['exp.cards', 'Cards', 'credit-card'], ['exp.rep', 'Reports', 'chart-column']], views: ['Over policy','Client meals','Waiting on receipts'] },
    { id: 'assets', name: 'Assets', long: 'Asset management', file: 'assets.html', icon: 'laptop',
      desc: 'Every laptop, phone and badge: who has it, what it costs, when it comes back.',
      links: [['as.inv', 'Inventory', 'boxes'], ['as.mine', 'Assigned to me', 'user-round'], ['as.req', 'Requests', 'inbox'], ['as.maint', 'Maintenance', 'wrench'], ['as.audit', 'Audits', 'scan-line']], views: ['Laptops due for refresh','In repair','Berlin stockroom'] },
    { id: 'licences', name: 'Licences', long: 'Software licences', file: 'licences.html', icon: 'key-round',
      desc: 'All the software you pay for, who uses it, and the seats you can stop paying for.',
      links: [['li.apps', 'Applications', 'layout-grid'], ['li.spend', 'Spend', 'banknote'], ['li.ren', 'Renewals', 'calendar-clock'], ['li.shadow', 'Discovered', 'radar']], views: ['Renewing in 60 days','Under 50% used','No owner'] },
    { id: 'hiring', name: 'Hiring', long: 'Recruitment and ATS', file: 'hiring.html', icon: 'user-round-plus',
      desc: 'Open a role, run a fair process, make the offer. Candidates feel the care.',
      links: [['hi.jobs', 'Jobs', 'briefcase'], ['hi.cand', 'Candidates', 'users'], ['hi.int', 'Interviews', 'calendar-check'], ['hi.off', 'Offers', 'file-signature'], ['hi.site', 'Careers page', 'globe']], views: ['My open roles','Offers out','Stuck over 5 days'] },
    { id: 'access', name: 'Access', long: 'Identity and access', file: 'access.html', icon: 'shield-check',
      desc: 'One identity per person. Access that follows the role, and leaves when they do.',
      links: [['ac.people', 'People and groups', 'users'], ['ac.apps', 'Applications', 'layout-grid'], ['ac.req', 'Requests', 'inbox'], ['ac.rev', 'Access reviews', 'list-checks'], ['ac.log', 'Audit log', 'scroll-text']], views: ['Leaving this week','Admin access','Unused for 90 days'] },
    { id: 'performance', name: 'Performance', long: 'Performance management', file: 'performance.html', icon: 'target',
      desc: 'Goals, check-ins and reviews that people actually want to open.',
      links: [['pe.goals', 'Goals', 'target'], ['pe.chk', 'Check-ins', 'messages-square'], ['pe.one', '1:1s', 'users-round'], ['pe.rev', 'Reviews', 'clipboard-check'], ['pe.cal', 'Calibration', 'scale']], views: ['My team','At risk','Company goals'] },
    { id: 'helpdesk', name: 'Helpdesk', long: 'Help desk', file: 'helpdesk.html', icon: 'life-buoy',
      desc: 'Ask in plain words. AI answers what it can, and routes the rest to the right person.',
      links: [['hd.queue', 'Queue', 'inbox'], ['hd.mine', 'My requests', 'user-round'], ['hd.kb', 'Knowledge', 'book-open'], ['hd.cat', 'Categories', 'shapes'], ['hd.ins', 'Insights', 'chart-column']], views: ['Breaching SLA','Unassigned','VPN and network'] }
  ];
  var CORE = [
    { id: 'work', name: 'Work', icon: 'square-kanban' },
    { id: 'docs', name: 'Docs', icon: 'file-text' }
  ];
  window.SUITE = { PRODUCTS: PRODUCTS };

  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function ic(name) { return '<i data-lucide="' + name + '"></i>'; }
  function tile(id, icon, size) { return '<span class="tile" style="background:var(--m-' + id + ')' + (size ? ';width:' + size + 'px;height:' + size + 'px' : '') + '">' + ic(icon) + '</span>'; }
  window.SUITE.tile = tile;

  /* ---------- appearance ---------- */
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private window */ } } };
  function applyMode(m) {
    if (m === 'light' || m === 'dark') document.documentElement.setAttribute('data-theme', m);
    else document.documentElement.removeAttribute('data-theme');
    document.querySelectorAll('.modes button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.mode === m)); });
  }
  var mode = store.get('bemmoly-suite-mode') || 'system';
  applyMode(mode);

  /* ---------- the portal's top bar ---------- */
  function topbar(host) {
    var cur = host.dataset.page;
    var nav = '<a href="index.html"' + (cur === 'index' ? ' aria-current="page"' : '') + '>' + ic('layout-grid') + 'Overview</a>' +
      PRODUCTS.map(function (p) {
        return '<a href="' + p.file + '"' + (cur === p.id ? ' aria-current="page"' : '') + '><span class="dot" style="background:var(--m-' + p.id + ')"></span>' + p.name + '</a>';
      }).join('');
    host.innerHTML = '<div class="topbar-in"><a href="index.html" class="logo" data-logo="lockup" aria-label="Bemmoly suite overview"></a>' +
      '<span class="proj">Suite proposal</span><nav class="topnav" aria-label="Products">' + nav + '</nav>' +
      '<button class="uitog" type="button" aria-pressed="false">' + ic('presentation') + '<span>Screens only</span></button>' +
      '<div class="modes" role="group" aria-label="Appearance">' +
      '<button data-mode="light" aria-label="Light">' + ic('sun') + '</button>' +
      '<button data-mode="dark" aria-label="Dark">' + ic('moon') + '</button>' +
      '<button data-mode="system" aria-label="Match system">' + ic('monitor') + '</button></div></div>';
    host.querySelectorAll('.modes button').forEach(function (b) {
      b.addEventListener('click', function () { mode = b.dataset.mode; store.set('bemmoly-suite-mode', mode); applyMode(mode); });
    });
    applyMode(mode);
    host.querySelector('.uitog').addEventListener('click', function () { setUi(!ui); });
    var a = host.querySelector('[aria-current="page"]'); if (a) a.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  /* ---------- the drawn product shell sidebar ----------
     Every product is its own app with its own shell (like Pipelines). The sidebar is the
     product's own: its brand block, its places, its settings. Other products are reached
     through the product switcher (the grid button), never listed here.
     <aside class="bx-side" data-cur="expenses" data-link="exp.mine" data-me="Arjun Mehta"
            data-counts='{"exp.appr":"!14","exp.mine":"2"}' data-hide-links="exp.cards,exp.rep"></aside>
     data-link may also be "<prefix>.set" (Settings) or "<prefix>.help". */
  function sidebar(host) {
    var cur = host.dataset.cur || '';
    var p = PRODUCTS.filter(function (x) { return x.id === cur; })[0];
    if (!p) return;
    var link = host.dataset.link || '';
    var me = host.dataset.me || 'Priya Raman';
    var hide = (host.dataset.hideLinks || '').split(',');
    var initials = me.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2);
    var counts = {}; try { counts = JSON.parse(host.dataset.counts || '{}'); } catch (e) { counts = {}; }
    var pfx = p.links[0][0].split('.')[0];
    function row(id, label, icon) {
      var ct = counts[id];
      return '<div class="bx-r' + (link === id ? ' on' : '') + '">' + ic(icon) + esc(label) +
        (ct ? (String(ct).charAt(0) === '!' ? '<span class="pill">' + ct.slice(1) + '</span>' : '<span class="ct">' + ct + '</span>') : '') + '</div>';
    }
    var h = '<div class="ps-brand">' + tile(p.id, p.icon) + '<div class="ps-name"><b>' + esc(p.name) + '</b>' +
      '<span class="ps-ws"><span class="logo" data-logo="mark"></span>Bemmoly · Acme Labs</span></div>' +
      '<span class="ps-apps" title="Bemmoly products">' + ic('layout-grid') + '</span></div>' +
      '<div class="bx-tools"><div class="bx-search">' + ic('search') + '<span class="sp">Search ' + esc(p.name.toLowerCase()) + '</span><span class="kbd">' + ic('command') + 'K</span></div><div class="bx-new">' + ic('plus') + '</div></div>' +
      '<nav class="bx-nav">';
    p.links.forEach(function (l) { if (hide.indexOf(l[0]) < 0) h += row(l[0], l[1], l[2]); });
    if (p.views && p.views.length && host.dataset.hideViews === undefined) {
      h += '<div class="bx-label">Saved views</div>';
      p.views.forEach(function (v) { h += '<div class="bx-r">' + ic('list-filter') + esc(v) + '</div>'; });
    }
    h += '</nav><div class="ps-foot">' + row(pfx + '.help', 'Help and shortcuts', 'circle-help') + row(pfx + '.set', 'Settings', 'settings') +
      '<div class="bx-me"><span class="av s me">' + esc(initials) + '</span><b>' + esc(me) + '</b><span class="mode">' + ic('sun-moon') + '</span></div></div>';
    host.innerHTML = h;
  }

  /* ---------- the product switcher: <div class="ps-launch" data-cur="expenses" data-only="a,b"></div> ---------- */
  function launcher(host) {
    var only = host.dataset.only ? host.dataset.only.split(',') : null;
    var all = CORE.concat(PRODUCTS);
    host.innerHTML = '<div class="cap" style="padding:6px 8px 8px">Bemmoly products</div><div class="ps-grid">' + all.filter(function (p) { return !only || only.indexOf(p.id) >= 0; }).map(function (p) {
      return '<div class="ps-app' + (p.id === host.dataset.cur ? ' on' : '') + '">' + tile(p.id, p.icon) + '<span>' + esc(p.name) + '</span></div>';
    }).join('') + '</div>';
  }

  /* ---------- logos ---------- */
  function logos(root) {
    if (!window.BRAND) return;
    root.querySelectorAll('[data-logo]').forEach(function (n) {
      if (n.dataset.done) return;
      n.insertAdjacentHTML('afterbegin', window.BRAND[n.dataset.logo] || '');
      var s = n.querySelector('svg'); if (s) { s.setAttribute('aria-hidden', 'true'); s.removeAttribute('width'); s.removeAttribute('height'); }
      n.dataset.done = '1';
    });
  }

  /* ---------- screens: tabs + scale-to-fit stages ---------- */
  var stages = [];
  function fit(stage) {
    var f = stage.querySelector('.frame'); if (!f) return;
    var fw = f.offsetWidth || 1280, fh = f.offsetHeight || 800;
    var s;
    if (ui && stage.closest('.screen')) {
      var pw = (stage.parentElement && stage.parentElement.clientWidth) || innerWidth;
      var ah = innerHeight - (stage.getBoundingClientRect().top + scrollY) - 20;
      s = Math.min(pw / fw, Math.max(ah, 200) / fh);
      stage.style.width = Math.round(fw * s) + 'px';
    } else {
      stage.style.width = '';
      var w = stage.clientWidth; if (!w) return;
      s = w / fw;
    }
    f.style.transform = 'scale(' + s + ')';
    stage.style.height = Math.round(fh * s) + 'px';
  }
  function screens(group) {
    var list = Array.prototype.slice.call(group.querySelectorAll(':scope > .screen'));
    if (!list.length) return;
    var bar = document.createElement('div');
    bar.className = 'scr-tabs'; bar.setAttribute('role', 'tablist');
    list.forEach(function (s, i) {
      if (!s.id) s.id = (group.id || 'g') + '-s' + i;
      var b = document.createElement('button');
      b.setAttribute('role', 'tab'); b.dataset.target = s.id;
      b.innerHTML = '<span class="k">' + (i + 1) + '</span>' + esc(s.dataset.title || ('Screen ' + (i + 1)));
      b.addEventListener('click', function () { show(group, s.id, true); });
      bar.appendChild(b);
      s.setAttribute('role', 'tabpanel');
    });
    group.insertBefore(bar, group.firstChild);
    bar.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var bs = Array.prototype.slice.call(bar.children); var i = bs.indexOf(document.activeElement);
      if (i < 0) return; var n = bs[(i + (e.key === 'ArrowRight' ? 1 : bs.length - 1)) % bs.length];
      n.focus(); n.click(); e.preventDefault();
    });
    show(group, list[0].id, false);
  }
  function show(group, id, focus) {
    group.querySelectorAll(':scope > .screen').forEach(function (s) { s.hidden = s.id !== id; });
    group.querySelectorAll(':scope > .scr-tabs button').forEach(function (b) {
      var on = b.dataset.target === id; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;
      if (on && focus) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    var s = document.getElementById(id);
    if (s) s.querySelectorAll('.stage').forEach(fit);
    if (ui) uiSync(id);
  }
  window.SUITE.show = function (id) {
    var s = document.getElementById(id); if (!s) return;
    var g = s.closest('.screens'); if (g) show(g, id, true);
  };

  /* ---------- screens only: the UI as a full-size prototype, without the proposal ---------- */
  var ui = false, all = [];
  function uiSync(id) {
    var i = all.indexOf(document.getElementById(id)); if (i < 0) return;
    document.querySelectorAll('.screens').forEach(function (g) { g.classList.toggle('ui-cur', g.contains(all[i])); });
    var bar = document.querySelector('.uibar'); if (!bar) return;
    bar.querySelectorAll('.ui-list button').forEach(function (b, k) { b.setAttribute('aria-current', String(k === i)); if (k === i) b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); });
    bar.querySelector('.ui-n').textContent = (i + 1) + ' of ' + all.length;
  }
  function uiGo(d) {
    var cur = all.filter(function (s) { return !s.hidden && s.closest('.screens').classList.contains('ui-cur'); })[0];
    var i = Math.max(0, all.indexOf(cur)); var n = all[(i + d + all.length) % all.length];
    window.SUITE.show(n.id);
  }
  function buildUiBar() {
    if (document.querySelector('.uibar') || !all.length) return;
    var bar = document.createElement('div'); bar.className = 'uibar';
    var groups = Array.prototype.slice.call(document.querySelectorAll('.screens'));
    var h = '<button class="ui-step" data-d="-1" aria-label="Previous screen">' + ic('chevron-left') + '</button><div class="ui-list">';
    all.forEach(function (s, k) {
      var g = groups.indexOf(s.closest('.screens'));
      if (k > 0 && all[k - 1].closest('.screens') !== s.closest('.screens')) h += '<span class="ui-sep">' + (g > 0 ? 'Settings' : '') + '</span>';
      h += '<button type="button" data-id="' + s.id + '">' + esc(s.dataset.title || s.id) + '</button>';
    });
    h += '</div><button class="ui-step" data-d="1" aria-label="Next screen">' + ic('chevron-right') + '</button><span class="ui-n"></span>';
    bar.innerHTML = h;
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.id) window.SUITE.show(b.dataset.id); else if (b.dataset.d) uiGo(+b.dataset.d);
    });
    var main = document.querySelector('main'); main.insertBefore(bar, main.firstChild);
    window.SUITE.icons();
  }
  function setUi(on) {
    ui = !!on && all.length > 0;
    document.documentElement.classList.toggle('ui', ui);
    store.set('bemmoly-suite-ui', ui ? '1' : '0');
    document.querySelectorAll('.uitog').forEach(function (b) { b.setAttribute('aria-pressed', String(ui)); b.querySelector('span').textContent = ui ? 'Read the proposal' : 'Screens only'; });
    document.querySelectorAll('.topnav a').forEach(function (a) { a.href = a.getAttribute('href').split('#')[0] + (ui ? '#ui' : ''); });
    if (ui) {
      buildUiBar();
      var vis = all.filter(function (s) { return !s.hidden; })[0] || all[0];
      window.SUITE.show(vis.id); scrollTo(0, 0);
    } else {
      document.querySelectorAll('.screens').forEach(function (g) { g.classList.remove('ui-cur'); });
    }
    stages.forEach(fit);
  }
  document.addEventListener('keydown', function (e) {
    if (!ui || e.target.closest('input,textarea,[contenteditable]')) return;
    if (e.key === 'ArrowRight' && !e.target.closest('.scr-tabs')) { uiGo(1); e.preventDefault(); }
    if (e.key === 'ArrowLeft' && !e.target.closest('.scr-tabs')) { uiGo(-1); e.preventDefault(); }
    if (e.key === 'Escape') setUi(false);
  });

  /* ---------- prototype layer ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-go],[data-toggle],[data-show],[data-hide],[data-on]');
    if (!t || !t.closest('.bx, .screens')) return;
    var scope = t.closest('.bx') || document;
    if (t.dataset.go) { window.SUITE.show(t.dataset.go); var g = ui ? null : document.getElementById(t.dataset.go); if (g) { var top = g.closest('.screens').getBoundingClientRect().top; if (top < 0 || top > innerHeight * .6) g.closest('.screens').scrollIntoView({ behavior: 'smooth', block: 'start' }); } } if (false) { var g = document.getElementById(t.dataset.go); if (g) { var top = g.closest('.screens').getBoundingClientRect().top; if (top < 0 || top > innerHeight * .6) g.closest('.screens').scrollIntoView({ behavior: 'smooth', block: 'start' }); } }
    if (t.dataset.toggle) scope.querySelectorAll(t.dataset.toggle).forEach(function (n) { n.hidden = !n.hidden; });
    if (t.dataset.show) scope.querySelectorAll(t.dataset.show).forEach(function (n) { n.hidden = false; });
    if (t.dataset.hide) scope.querySelectorAll(t.dataset.hide).forEach(function (n) { n.hidden = true; });
    if (t.hasAttribute('data-on')) { var grp = t.parentElement; grp.querySelectorAll(':scope > .on').forEach(function (n) { n.classList.remove('on'); }); t.classList.add('on'); }
    document.dispatchEvent(new CustomEvent('suite:act', { detail: { el: t } }));
  });

  /* ---------- contents rail highlight ---------- */
  function toc() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.toc a[href^="#"]'));
    if (!links.length || !('IntersectionObserver' in window)) return;
    var map = {}; links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (en.isIntersecting) { links.forEach(function (a) { a.classList.remove('on'); }); var a = map[en.target.id]; if (a) a.classList.add('on'); }
      });
    }, { rootMargin: '-80px 0px -70% 0px' });
    Object.keys(map).forEach(function (id) { var n = document.getElementById(id); if (n) io.observe(n); });
  }

  function init() {
    document.querySelectorAll('header.topbar[data-page]').forEach(topbar);
    document.querySelectorAll('.bx-side[data-cur]').forEach(sidebar);
    document.querySelectorAll('.ps-launch').forEach(launcher);
    logos(document);
    if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 1.75 } });
    document.querySelectorAll('.screens').forEach(screens);
    stages = Array.prototype.slice.call(document.querySelectorAll('.stage'));
    if ('ResizeObserver' in window) { var ro = new ResizeObserver(function (es) { es.forEach(function (en) { fit(en.target); }); }); stages.forEach(function (s) { ro.observe(s); }); }
    window.addEventListener('resize', function () { stages.forEach(fit); });
    stages.forEach(fit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { stages.forEach(fit); });
    toc();
    all = Array.prototype.slice.call(document.querySelectorAll('.screens > .screen'));
    if (!all.length) document.querySelectorAll('.uitog').forEach(function (b) { b.hidden = true; });
    var want = location.hash === '#ui' || (location.hash === '' && store.get('bemmoly-suite-ui') === '1');
    if (want) setUi(true);
    window.addEventListener('hashchange', function () { if (location.hash === '#ui') setUi(true); });
    document.dispatchEvent(new Event('suite:ready'));
  }
  window.SUITE.icons = function () { if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 1.75 } }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
