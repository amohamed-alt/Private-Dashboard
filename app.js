(() => {
  'use strict';

  const TEAM = ['Fadi', 'Jihad', 'Faizan'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const state = {
    tab: 'overview',
    scenario: 'medium',
    actionFilter: 'All',
    ownerFilter: 'All',
    statusFilter: 'All',
    productFilter: 'All',
    search: ''
  };

  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const app = () => $('#app');
  const DATA = window.DASHBOARD_DATA;

  function num(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  }

  function money(value) {
    const n = Math.round(num(value));
    const prefix = n < 0 ? '-$' : '$';
    return prefix + Math.abs(n).toLocaleString();
  }

  function pct(value) {
    return `${num(value).toFixed(1)}%`;
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[c]));
  }

  function badge(label, type = 'slate') {
    return `<span class="badge b-${type}">${esc(label)}</span>`;
  }

  function statusBadge(status) {
    const s = String(status || 'Unknown');
    if (s === 'Renewed') return badge('Renewed', 'green');
    if (s === 'Pending High') return badge('Pending High', 'blue');
    if (s === 'Pending Medium') return badge('Pending Medium', 'amber');
    if (s === 'Pending Low') return badge('Pending Low', 'purple');
    if (s === 'Lost') return badge('Lost', 'red');
    return badge(s, 'slate');
  }

  function riskType(status) {
    if (status === 'Safe') return 'green';
    if (status === 'Watch') return 'amber';
    return 'red';
  }

  function classify(achievementPct) {
    if (achievementPct >= 100) return 'Safe';
    if (achievementPct >= 80) return 'Watch';
    return 'Critical';
  }

  function gapStatus(gap) {
    return gap >= 0 ? 'Safe' : 'Critical';
  }

  function table(headers, rows, empty = 'No rows to show') {
    const body = rows.length ? rows.join('') : `<tr><td colspan="${headers.length}" class="empty-cell">${esc(empty)}</td></tr>`;
    return `
      <div class="table-wrap">
        <table class="table">
          <thead><tr>${headers.map(h => `<th class="${h.num ? 'num' : ''}">${esc(h.label)}</th>`).join('')}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>`;
  }

  function kpi(label, value, sub = '', accent = '') {
    return `<div class="kpi ${accent}"><div class="label">${esc(label)}</div><div class="value">${value}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;
  }

  function card(title, body, sub = '', flush = false) {
    return `
      <section class="card">
        <div class="card-head"><div><div class="card-title">${esc(title)}</div>${sub ? `<div class="card-sub">${esc(sub)}</div>` : ''}</div></div>
        <div class="card-body ${flush ? 'flush' : ''}">${body}</div>
      </section>`;
  }

  function ownerList() {
    return TEAM.filter(owner => DATA?.owners?.[owner]);
  }

  function retentionTarget() {
    return num(DATA?.planComparison?.retentionTarget) || ownerList().reduce((t, owner) => t + ownerTarget(DATA.owners[owner]), 0);
  }

  function ownerTarget(ownerData) {
    return num(ownerData?.retentionTarget) || num(ownerData?.target);
  }

  function ownerPlan(ownerData) {
    return ownerData?.planComparison?.plan || {};
  }

  function ownerCash(ownerData) {
    return num(ownerPlan(ownerData).cashing) || num(ownerData?.cashedYtd);
  }

  function ownerBooking(ownerData) {
    return num(ownerPlan(ownerData).booking) || num(ownerData?.bookedYtd);
  }

  function ownerForecast(ownerData, scenario = state.scenario) {
    const calc = ownerData?.calculatedForecasts || {};
    if (scenario === 'worst') return num(calc.worst) || num(ownerData?.forecasts?.worst?.revenue);
    if (scenario === 'medium') return num(calc.medium) || num(ownerData?.forecasts?.medium?.revenue);
    if (scenario === 'bestIncludingLost') return num(calc.bestIncludingLost) || num(calc.bestExcludingLost) + num(ownerData?.lost);
    return num(calc.bestExcludingLost) || num(ownerData?.forecasts?.best?.revenue);
  }

  function teamForecast(scenario = state.scenario) {
    const pc = DATA?.planComparison || {};
    if (scenario === 'worst') return num(pc.worst) || ownerList().reduce((t, o) => t + ownerForecast(DATA.owners[o], 'worst'), 0);
    if (scenario === 'medium') return num(pc.medium) || ownerList().reduce((t, o) => t + ownerForecast(DATA.owners[o], 'medium'), 0);
    if (scenario === 'bestIncludingLost') return num(pc.bestIncludingLost) || ownerList().reduce((t, o) => t + ownerForecast(DATA.owners[o], 'bestIncludingLost'), 0);
    return num(pc.bestExcludingLost) || ownerList().reduce((t, o) => t + ownerForecast(DATA.owners[o], 'bestExcludingLost'), 0);
  }

  function teamConfirmedRevenue() {
    return num(DATA?.planComparison?.confirmedRevenue) || ownerList().reduce((t, o) => t + num(DATA.owners[o].confirmedRevenue), 0);
  }

  function scenarioLabel(key = state.scenario) {
    return {
      worst: 'Worst',
      medium: 'Medium',
      bestExcludingLost: 'Best',
      bestIncludingLost: 'Best + Lost'
    }[key] || key;
  }

  function scenarioSub(key = state.scenario) {
    return {
      worst: 'Confirmed + Pending High',
      medium: 'Worst + Pending Medium',
      bestExcludingLost: 'Medium + Pending Low, excluding Lost',
      bestIncludingLost: 'Audit view only: Best plus Lost impact'
    }[key] || '';
  }

  function scenarioType(key = state.scenario) {
    return {
      worst: 'red',
      medium: 'amber',
      bestExcludingLost: 'green',
      bestIncludingLost: 'purple'
    }[key] || 'blue';
  }

  function setPage(title, subtitle) {
    $('#pageTitle').textContent = title;
    $('#pageSubtitle').textContent = subtitle || '';
  }

  function setActiveNav() {
    $$('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.tab === state.tab));
    $$('#scenarioSwitch button').forEach(button => button.classList.toggle('active', button.dataset.scenario === state.scenario));
  }

  function updateMeta() {
    const generatedAt = DATA?.generatedAt ? new Date(DATA.generatedAt) : null;
    const accounts = DATA?.retention?.accountsCount || DATA?.accounts?.length || 0;
    const dq = DATA?.dataQuality?.length || 0;
    const actions = DATA?.actions?.length || 0;
    $('#sidebarMeta').innerHTML = `
      Updated:<br>${generatedAt ? generatedAt.toLocaleString() : '—'}<br><br>
      Retention rows: ${accounts}<br>
      Actions: ${actions}<br>
      Data issues: ${dq}<br><br>
      Acquisition: hidden
    `;
  }

  function renderRiskBanner() {
    const target = retentionTarget();
    const forecast = teamForecast(state.scenario);
    const achievement = target ? forecast / target * 100 : 0;
    const gap = forecast - target;
    const status = classify(achievement);
    const el = $('#riskBanner');
    el.className = `alert ${status.toLowerCase()}`;
    el.textContent = `${status} — ${scenarioLabel()} retention forecast is ${money(forecast)} (${pct(achievement)} of retention target). Gap: ${money(gap)}. ${scenarioSub()}.`;
  }

  function bindEvents() {
    $$('.nav-item').forEach(button => {
      button.addEventListener('click', () => {
        state.tab = button.dataset.tab;
        render();
      });
    });

    $$('#scenarioSwitch button').forEach(button => {
      button.addEventListener('click', () => {
        state.scenario = button.dataset.scenario;
        render();
      });
    });
  }

  function render() {
    if (!DATA || !DATA.retention || !DATA.owners) {
      $('#riskBanner').style.display = 'none';
      app().innerHTML = `<div class="empty-state"><h2>No valid retention data found</h2><p>Confirm n8n generated <code>window.DASHBOARD_DATA</code> in <code>data/live-data.js</code>.</p></div>`;
      return;
    }

    $('#riskBanner').style.display = '';
    setActiveNav();
    updateMeta();
    renderRiskBanner();

    if (state.tab === 'overview') return renderOverview();
    if (ownerList().includes(state.tab)) return renderOwner(state.tab);
    if (state.tab === 'compare') return renderCompare();
    if (state.tab === 'accounts') return renderAccountsPage();
    if (state.tab === 'actions') return renderActions();
    if (state.tab === 'quality') return renderQuality();

    renderOverview();
  }

  function renderOverview() {
    const r = DATA.retention;
    const target = retentionTarget();
    const forecast = teamForecast(state.scenario);
    const achievement = target ? forecast / target * 100 : 0;
    const gap = forecast - target;
    const confirmed = teamConfirmedRevenue();
    const lostImpact = num(DATA?.planComparison?.bestIncludingLost) - num(DATA?.planComparison?.bestExcludingLost);

    setPage('Retention Overview', 'Retention-only view for Fadi, Jihad and Faizan. Acquisition numbers are not displayed.');

    app().innerHTML = `
      <div class="grid cols-5">
        ${kpi('Retention Target', money(target), 'Fadi + Jihad + Faizan retention target', 'accent-blue')}
        ${kpi('Confirmed Revenue', money(confirmed), 'Cashing + receivables from retention plan', 'accent-green')}
        ${kpi('Renewed', money(r.byStatus.renewed), 'Actual renewed value', 'accent-green')}
        ${kpi('Pending High', money(r.byStatus.pendingHigh), 'Highest conversion priority', 'accent-blue')}
        ${kpi(`${scenarioLabel()} Forecast`, money(forecast), `${pct(achievement)} · Gap ${money(gap)}`, gap >= 0 ? 'accent-green' : 'accent-red')}
      </div>
      <div class="section-gap"></div>
      <div class="grid cols-4">${renderScenarioCards()}</div>
      <div class="section-gap"></div>
      <div class="grid cols-2">
        ${card('Retention Status Mix', renderStatusBars())}
        ${card('Monthly Renewal Concentration', renderMonthBars(), 'Based on Jan-Dec values in Retention sheet')}
      </div>
      <div class="section-gap"></div>
      ${card('Team Performance', renderTeamTable(), 'Targets shown are retention targets only; acquisition is ignored.')}
      <div class="section-gap"></div>
      <div class="grid cols-2">
        ${card('Product Breakdown', renderProductTable())}
        ${card('Location Breakdown', renderLocationTable())}
      </div>
      <div class="section-gap"></div>
      ${card('Lost Impact', `<div class="grid cols-3">
        ${kpi('Lost Value', money(r.byStatus.lost), 'Not included in Best forecast', 'accent-red')}
        ${kpi('Best Excluding Lost', money(num(DATA?.planComparison?.bestExcludingLost)), 'Management forecast', 'accent-green')}
        ${kpi('Best + Lost', money(num(DATA?.planComparison?.bestIncludingLost)), `Audit view · Difference ${money(lostImpact)}`, 'accent-purple')}
      </div>`, 'This confirms why Summary plan Best can look higher.')}
    `;
  }

  function renderScenarioCards() {
    return ['worst', 'medium', 'bestExcludingLost', 'bestIncludingLost'].map(key => {
      const target = retentionTarget();
      const value = teamForecast(key);
      const achievement = target ? value / target * 100 : 0;
      const gap = value - target;
      const status = classify(achievement);
      return `
        <div class="kpi clickable accent-${scenarioType(key)}" onclick="window.__setScenario('${key}')">
          <div class="label">${scenarioLabel(key)}</div>
          <div class="value">${money(value)}</div>
          <div class="sub">${pct(achievement)} · Gap ${money(gap)} · ${status}</div>
          <div class="progress"><div class="bar" style="width:${Math.min(100, Math.max(0, achievement))}%; background:var(--${scenarioType(key)})"></div></div>
        </div>`;
    }).join('');
  }

  function renderStatusBars() {
    const s = DATA.retention.byStatus || {};
    const total = Math.max(num(DATA.retention.totalValue), 1);
    const rows = [
      ['Renewed', s.renewed, 'green'],
      ['Pending High', s.pendingHigh, 'blue'],
      ['Pending Medium', s.pendingMedium, 'amber'],
      ['Pending Low', s.pendingLow, 'purple'],
      ['Lost', s.lost, 'red']
    ];

    return rows.map(([label, value, type]) => `
      <div class="status-row">
        <div class="status-line"><span>${esc(label)}</span><span>${money(value)}</span></div>
        <div class="progress"><div class="bar" style="width:${Math.min(100, num(value) / total * 100)}%; background:var(--${type})"></div></div>
      </div>`).join('');
  }

  function renderMonthBars() {
    const rows = DATA.retention.byMonth || [];
    const max = Math.max(...rows.map(r => num(r.value)), 1);
    return `<div class="mini-bars">${rows.map(r => `
      <div class="mini-bar" title="${esc(r.month)} · ${money(r.value)} · ${r.accountsCount || 0} accounts">
        <strong>${num(r.value) ? '$' + Math.round(num(r.value) / 1000) + 'K' : ''}</strong>
        <div class="mini-fill" style="height:${Math.max(3, num(r.value) / max * 105)}px; background:var(--${num(r.value) > max * .75 ? 'red' : num(r.value) > max * .45 ? 'amber' : 'blue'})"></div>
        <span>${esc(r.month)}</span>
      </div>`).join('')}</div>`;
  }

  function renderTeamTable() {
    const rows = ownerList().map(owner => {
      const o = DATA.owners[owner];
      const target = ownerTarget(o);
      const forecast = ownerForecast(o, state.scenario);
      const achievement = target ? forecast / target * 100 : 0;
      const gap = forecast - target;
      const status = classify(achievement);
      return `<tr>
        <td><strong>${esc(owner)}</strong></td>
        <td class="num">${o.accountsCount || 0}</td>
        <td class="num">${money(target)}</td>
        <td class="num">${money(o.totalValue)}</td>
        <td class="num">${money(ownerCash(o))}</td>
        <td class="num">${money(o.renewed)}</td>
        <td class="num">${money(o.pendingHigh)}</td>
        <td class="num">${money(forecast)}</td>
        <td class="num">${money(gap)}</td>
        <td class="num">${pct(achievement)}</td>
        <td>${badge(status, riskType(status))}</td>
      </tr>`;
    });

    return table([
      { label: 'Owner' }, { label: 'Accounts', num: true }, { label: 'Retention Target', num: true },
      { label: '2026 Value', num: true }, { label: 'Cashing', num: true }, { label: 'Renewed', num: true },
      { label: 'Pending High', num: true }, { label: `${scenarioLabel()} Forecast`, num: true },
      { label: 'Gap', num: true }, { label: 'Achv.', num: true }, { label: 'Status' }
    ], rows);
  }

  function renderProductTable() {
    return table([
      { label: 'Product' }, { label: 'Accounts', num: true }, { label: 'Value', num: true }
    ], (DATA.retention.byProduct || []).map(p => `<tr><td>${esc(p.product || 'Unknown')}</td><td class="num">${p.accountsCount || 0}</td><td class="num">${money(p.value)}</td></tr>`));
  }

  function renderLocationTable() {
    return table([
      { label: 'Location' }, { label: 'Accounts', num: true }, { label: 'Value', num: true },
      { label: 'High', num: true }, { label: 'Lost', num: true }
    ], (DATA.retention.byLocation || []).map(l => `<tr><td>${esc(l.location || 'Unknown')}</td><td class="num">${l.accountsCount || 0}</td><td class="num">${money(l.value)}</td><td class="num">${money(l.pendingHigh)}</td><td class="num">${money(l.lost)}</td></tr>`));
  }

  function renderOwner(owner) {
    const o = DATA.owners[owner];
    if (!o) return;

    const target = ownerTarget(o);
    const forecast = ownerForecast(o, state.scenario);
    const achievement = target ? forecast / target * 100 : 0;
    const gap = forecast - target;
    const status = classify(achievement);
    const lostImpact = num(o.calculatedForecasts?.bestIncludingLost) - num(o.calculatedForecasts?.bestExcludingLost);

    setPage(`${owner} — Retention`, `${o.accountsCount || 0} accounts · ${scenarioLabel()} forecast ${money(forecast)} · ${pct(achievement)} of retention target`);

    app().innerHTML = `
      <div class="grid cols-5">
        ${kpi('Retention Target', money(target), 'Acquisition excluded', 'accent-blue')}
        ${kpi('Cashing', money(ownerCash(o)), 'From Summary plan for retention', 'accent-green')}
        ${kpi('Booking', money(ownerBooking(o)), 'Booked retention value', 'accent-purple')}
        ${kpi(`${scenarioLabel()} Forecast`, money(forecast), `${pct(achievement)} · Gap ${money(gap)}`, status === 'Safe' ? 'accent-green' : status === 'Watch' ? 'accent-amber' : 'accent-red')}
        ${kpi('Lost Impact', money(lostImpact), 'Shown separately, not in Best forecast', 'accent-red')}
      </div>
      <div class="section-gap"></div>
      <div class="grid cols-5">
        ${kpi('Renewed', money(o.renewed), '', 'accent-green')}
        ${kpi('Pending High', money(o.pendingHigh), '', 'accent-blue')}
        ${kpi('Pending Medium', money(o.pendingMedium), '', 'accent-amber')}
        ${kpi('Pending Low', money(o.pendingLow), '', 'accent-purple')}
        ${kpi('Lost', money(o.lost), '', 'accent-red')}
      </div>
      <div class="section-gap"></div>
      ${card('Plan vs Calculated', renderOwnerComparisonTable(o), 'Best forecast excludes Lost by default.')}
      <div class="section-gap"></div>
      <div class="grid cols-2">
        ${card('Top Accounts by 2026 Value', renderAccountsTable(o.topAccounts || []), '', true)}
        ${card('Pending High Accounts', renderAccountsTable(o.pendingHighAccounts || []), '', true)}
      </div>
      <div class="section-gap"></div>
      ${card('Risk / Data Issues', renderAccountsTable(o.riskyAccounts || [], true), 'Lost, expected lost, or value/month mismatch.', true)}
    `;
  }

  function renderOwnerComparisonTable(ownerData) {
    const pc = ownerData.planComparison || {};
    const plan = pc.plan || {};
    const calc = ownerData.calculatedForecasts || {};
    const rows = [
      ['Worst', plan.worst, calc.worst, num(calc.worst) - num(plan.worst), 'Confirmed + High'],
      ['Medium', plan.medium, calc.medium, num(calc.medium) - num(plan.medium), 'Worst + Medium'],
      ['Best', plan.best, calc.bestExcludingLost, num(calc.bestExcludingLost) - num(plan.best), 'Lost excluded'],
      ['Best + Lost', plan.best, calc.bestIncludingLost, num(calc.bestIncludingLost) - num(plan.best), 'Audit only']
    ].map(([name, planned, calculated, delta, note]) => `<tr>
      <td>${esc(name)}</td>
      <td class="num">${money(planned)}</td>
      <td class="num">${money(calculated)}</td>
      <td class="num">${money(delta)}</td>
      <td>${esc(note)}</td>
    </tr>`);

    return table([
      { label: 'Scenario' }, { label: 'Plan', num: true }, { label: 'Calculated', num: true },
      { label: 'Delta', num: true }, { label: 'Logic' }
    ], rows);
  }

  function renderCompare() {
    const pc = DATA.planComparison || {};
    const rows = [
      ['Target', pc.plan?.target || pc.retentionTarget, pc.retentionTarget, num(pc.retentionTarget) - num(pc.plan?.target || pc.retentionTarget), 'Retention target only'],
      ['Worst', pc.plan?.worst, pc.worst, num(pc.worst) - num(pc.plan?.worst), 'Confirmed + Pending High'],
      ['Medium', pc.plan?.medium, pc.medium, num(pc.medium) - num(pc.plan?.medium), 'Worst + Pending Medium'],
      ['Best', pc.plan?.best, pc.bestExcludingLost, num(pc.bestExcludingLost) - num(pc.plan?.best), 'Dashboard excludes Lost'],
      ['Best + Lost', pc.plan?.best, pc.bestIncludingLost, num(pc.bestIncludingLost) - num(pc.plan?.best), 'Audit view']
    ].map(([label, plan, calculated, delta, logic]) => `<tr><td>${esc(label)}</td><td class="num">${money(plan)}</td><td class="num">${money(calculated)}</td><td class="num">${money(delta)}</td><td>${esc(logic)}</td></tr>`);

    setPage('Plan vs Calculated', 'Compare Summary plan with recalculated Retention values. Acquisition is ignored in dashboard display.');

    app().innerHTML = `
      <div class="grid cols-4">
        ${kpi('Retention Target', money(pc.retentionTarget), 'Target used by this dashboard', 'accent-blue')}
        ${kpi('Confirmed Revenue', money(pc.confirmedRevenue), 'Retention team confirmed value', 'accent-green')}
        ${kpi('Best Excluding Lost', money(pc.bestExcludingLost), 'Default management forecast', 'accent-green')}
        ${kpi('Lost Impact', money(num(pc.bestIncludingLost) - num(pc.bestExcludingLost)), 'Explains Summary Best difference', 'accent-red')}
      </div>
      <div class="section-gap"></div>
      ${card('Team Plan Comparison', table([
        { label: 'Metric' }, { label: 'Summary Plan', num: true }, { label: 'Dashboard Calc', num: true }, { label: 'Delta', num: true }, { label: 'Logic' }
      ], rows))}
      <div class="section-gap"></div>
      <div class="grid cols-3">${ownerList().map(owner => card(`${owner} Comparison`, renderOwnerComparisonTable(DATA.owners[owner]))).join('')}</div>
    `;
  }

  function accountMonthList(account) {
    const months = Object.entries(account.monthly || {}).filter(([, value]) => num(value) !== 0).map(([month]) => month);
    return months.length ? months.join(', ') : '—';
  }

  function renderAccountsTable(rows, withIssue = false) {
    return table([
      { label: 'Account' }, { label: 'Owner' }, { label: 'Product' }, { label: 'Status' },
      { label: 'Value', num: true }, { label: withIssue ? 'Issue' : 'Month' }
    ], rows.map(account => `<tr>
      <td><strong>${esc(account.clientName || '—')}</strong><br><small>${esc(account.location || '')}</small></td>
      <td>${esc(account.owner || '—')}</td>
      <td>${esc(account.product || '—')}</td>
      <td>${statusBadge(account.renewalStatus)}</td>
      <td class="num">${money(account.value2026)}</td>
      <td>${withIssue ? renderAccountIssue(account) : esc(accountMonthList(account))}</td>
    </tr>`));
  }

  function renderAccountIssue(account) {
    const issues = [];
    if (account.renewalStatus === 'Lost') issues.push('Lost');
    if (String(account.status || '').toLowerCase().includes('expected')) issues.push(account.status);
    if (Math.abs(num(account.valueVsMonthlyDiff)) > 1) issues.push(`Value/month diff ${money(account.valueVsMonthlyDiff)}`);
    return issues.length ? issues.map(x => esc(x)).join('<br>') : esc(account.status || 'Review');
  }

  function accountMatchesFilters(account) {
    const search = state.search.trim().toLowerCase();
    return (state.ownerFilter === 'All' || account.owner === state.ownerFilter) &&
      (state.statusFilter === 'All' || account.renewalStatus === state.statusFilter) &&
      (state.productFilter === 'All' || account.product === state.productFilter) &&
      (!search || String(account.clientName || '').toLowerCase().includes(search));
  }

  function uniqueValues(rows, key) {
    return Array.from(new Set(rows.map(row => row[key]).filter(Boolean))).sort();
  }

  function renderAccountsPage() {
    setPage('Accounts', 'Search and filter all retention accounts only.');
    const accounts = DATA.accounts || [];
    const filtered = accounts.filter(accountMatchesFilters).sort((a, b) => num(b.value2026) - num(a.value2026));
    const statuses = ['All', 'Renewed', 'Pending High', 'Pending Medium', 'Pending Low', 'Lost'];
    const products = ['All', ...uniqueValues(accounts, 'product')];

    app().innerHTML = `
      ${renderAccountFilters(statuses, products)}
      <div class="grid cols-4">
        ${kpi('Filtered Accounts', filtered.length.toLocaleString(), `${accounts.length.toLocaleString()} total`)}
        ${kpi('Filtered Value', money(filtered.reduce((t, a) => t + num(a.value2026), 0)), '')}
        ${kpi('Pending High Value', money(filtered.filter(a => a.renewalStatus === 'Pending High').reduce((t, a) => t + num(a.value2026), 0)), '', 'accent-blue')}
        ${kpi('Lost Value', money(filtered.filter(a => a.renewalStatus === 'Lost').reduce((t, a) => t + num(a.value2026), 0)), '', 'accent-red')}
      </div>
      <div class="section-gap"></div>
      ${card('Retention Account List', renderAccountsTable(filtered.slice(0, 120)), 'Showing top 120 by value after filters.', true)}
    `;
  }

  function renderAccountFilters(statuses, products) {
    return `<div class="filters">
      <select onchange="window.__setFilter('ownerFilter', this.value)">${['All', ...ownerList()].map(v => `<option value="${esc(v)}" ${state.ownerFilter === v ? 'selected' : ''}>${esc(v === 'All' ? 'All Owners' : v)}</option>`).join('')}</select>
      <select onchange="window.__setFilter('statusFilter', this.value)">${statuses.map(v => `<option value="${esc(v)}" ${state.statusFilter === v ? 'selected' : ''}>${esc(v === 'All' ? 'All Statuses' : v)}</option>`).join('')}</select>
      <select onchange="window.__setFilter('productFilter', this.value)">${products.map(v => `<option value="${esc(v)}" ${state.productFilter === v ? 'selected' : ''}>${esc(v === 'All' ? 'All Products' : v)}</option>`).join('')}</select>
      <input class="search" value="${esc(state.search)}" placeholder="Search account..." oninput="window.__setFilter('search', this.value)" />
    </div>`;
  }

  function renderActions() {
    setPage('Action Center', 'Prioritized retention actions generated by n8n.');
    const filters = ['All', 'High', ...ownerList()];
    const actions = (DATA.actions || []).filter(action => {
      const search = state.search.trim().toLowerCase();
      const filterOk = state.actionFilter === 'All' || action.priority === state.actionFilter || action.owner === state.actionFilter;
      const searchOk = !search || String(action.account || '').toLowerCase().includes(search) || String(action.issue || '').toLowerCase().includes(search);
      return filterOk && searchOk;
    });

    app().innerHTML = `
      <div class="filters">
        ${filters.map(f => `<button class="${state.actionFilter === f ? 'active' : ''}" onclick="window.__setFilter('actionFilter', '${esc(f)}')">${esc(f)}</button>`).join('')}
        <input class="search" value="${esc(state.search)}" placeholder="Search action/account..." oninput="window.__setFilter('search', this.value)" />
      </div>
      <div class="card"><div class="card-body flush">
        ${actions.length ? actions.map(action => `
          <div class="action-row">
            <div>${badge(action.priority || 'Action', action.priority === 'High' ? 'red' : 'amber')}</div>
            <div><strong>${esc(action.account || '—')}</strong><small>${esc(action.owner || '')}</small></div>
            <div><strong>${money(action.value)}</strong><small>Financial impact</small></div>
            <div>${esc(action.issue || 'Review')}</div>
            <div>${esc(action.recommendedAction || 'Follow up and update status.')}</div>
          </div>`).join('') : `<div class="empty-state"><h2>No actions match the current filters.</h2></div>`}
      </div></div>`;
  }

  function renderQuality() {
    setPage('Data Quality', 'Retention data validation and issues detected by n8n.');
    const issues = DATA.dataQuality || [];

    if (!issues.length) {
      app().innerHTML = `<div class="empty-state"><h2>No data quality issues detected.</h2><p>n8n did not return validation warnings for the current sync.</p></div>`;
      return;
    }

    const rows = issues.map(issue => `<tr>
      <td>${badge(issue.severity || 'info', issue.severity === 'critical' ? 'red' : issue.severity === 'warning' ? 'amber' : 'blue')}</td>
      <td><strong>${esc(issue.title || 'Issue')}</strong><br><small>${esc(issue.recommendedFix || '')}</small></td>
      <td class="num">${issue.count || 0}</td>
      <td class="num">${issue.financialImpact === null || issue.financialImpact === undefined ? '—' : money(issue.financialImpact)}</td>
      <td>${renderQualityExamples(issue.examples || [])}</td>
    </tr>`);

    app().innerHTML = `
      <div class="grid cols-3">
        ${kpi('Issues', issues.length.toLocaleString(), 'Validation groups')}
        ${kpi('Critical', issues.filter(i => i.severity === 'critical').length.toLocaleString(), '', 'accent-red')}
        ${kpi('Warnings', issues.filter(i => i.severity === 'warning').length.toLocaleString(), '', 'accent-amber')}
      </div>
      <div class="section-gap"></div>
      ${card('Data Quality Issues', table([
        { label: 'Severity' }, { label: 'Issue' }, { label: 'Count', num: true }, { label: 'Impact', num: true }, { label: 'Examples' }
      ], rows), '', true)}
    `;
  }

  function renderQualityExamples(examples) {
    if (!examples.length) return '—';
    return examples.slice(0, 4).map(example => {
      const name = example.clientName || example.account || example.column || `Row ${example.rowNumber || ''}`;
      const diff = example.difference !== undefined ? ` · Diff ${money(example.difference)}` : '';
      const val = example.value2026 !== undefined ? ` · ${money(example.value2026)}` : '';
      return `<div>${esc(name)}${esc(val)}${esc(diff)}</div>`;
    }).join('');
  }

  window.__setScenario = scenario => {
    state.scenario = scenario;
    render();
  };

  window.__setFilter = (key, value) => {
    state[key] = value;
    render();
  };

  if (!DATA) {
    $('#riskBanner').style.display = 'none';
    app().innerHTML = `<div class="empty-state"><h2>No live data found</h2><p>The dashboard loaded, but <code>window.DASHBOARD_DATA</code> was not found. Check <code>data/live-data.js</code>.</p></div>`;
    return;
  }

  bindEvents();
  render();
})();
