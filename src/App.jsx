import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  Filter,
  Gauge,
  LayoutDashboard,
  MapPin,
  Package,
  Search,
  Target,
  UserRound,
  UsersRound,
} from 'lucide-react';

const DATA = window.DASHBOARD_DATA || {
  management: { team: {}, rms: {} },
  accounts: [],
  actions: [],
  rms: {},
  csms: {},
  filters: {},
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STATUS_META = {
  Renewed: { color: 'green', label: 'Renewed' },
  'Pending High': { color: 'blue', label: 'Pending High' },
  'Pending Medium': { color: 'amber', label: 'Pending Medium' },
  'Pending Low': { color: 'purple', label: 'Pending Low' },
  Lost: { color: 'red', label: 'Lost' },
};

function money(value) {
  return `$${Math.round(Number(value || 0)).toLocaleString()}`;
}

function compactMoney(value) {
  const n = Number(value || 0);
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return money(n);
}

function percent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function statusClass(status) {
  return STATUS_META[status]?.color || 'gray';
}

function actionTiming(action) {
  if (!action?.dueDate) return '';
  const actionState = String(action.actionStatus || '').toLowerCase();
  if (actionState.includes('complete') || actionState.includes('done') || actionState.includes('closed')) return 'Completed';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${action.dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return '';
  const days = Math.round((due - today) / 86400000);
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Due Today';
  if (days <= 7) return 'Due This Week';
  return 'Upcoming';
}

function pageEntity(page) {
  if (page.startsWith('rm:')) return { type: 'rm', name: page.slice(3) };
  if (page.startsWith('csm:')) return { type: 'csm', name: page.slice(4) };
  return null;
}

function Sidebar({ page, setPage }) {
  const rms = Object.keys(DATA.management?.rms || {});
  const csms = Object.keys(DATA.csms || {}).filter((name) => name !== 'Unassigned');

  const navButton = (id, label, Icon, nested = false) => (
    <button
      key={id}
      className={`nav-item ${page === id ? 'active' : ''} ${nested ? 'nested' : ''}`}
      onClick={() => setPage(id)}
    >
      <Icon size={nested ? 15 : 18} strokeWidth={2} />
      <span>{label}</span>
    </button>
  );

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">R</div>
        <div>
          <strong>Retention Command</strong>
          <span>2026 portfolio intelligence</span>
        </div>
      </div>

      <nav className="nav-scroll">
        <div className="nav-block">
          <div className="nav-label">Workspace</div>
          {navButton('overview', 'Overview', LayoutDashboard)}
          {navButton('forecast', 'Management Forecast', Gauge)}
          {navButton('calendar', 'Renewal Calendar', CalendarDays)}
          {navButton('accounts', 'Accounts Explorer', Building2)}
          {navButton('actions', 'Action Center', ClipboardList)}
        </div>

        <div className="nav-block">
          <div className="nav-label">RM Performance</div>
          {rms.map((rm) => navButton(`rm:${rm}`, rm, UserRound, true))}
        </div>

        <div className="nav-block">
          <div className="nav-label">CSM Performance</div>
          {csms.map((csm) => navButton(`csm:${csm}`, csm, UsersRound, true))}
        </div>
      </nav>

      <div className="sidebar-meta">
        <span>Data sources</span>
        <strong>Summary + Retention</strong>
        <small>Summary: target & scenarios only</small>
        <small>Retention: all operational details</small>
      </div>
    </aside>
  );
}

function Select({ label, value, options, onChange, icon: Icon }) {
  return (
    <label className="select-wrap">
      {Icon ? <Icon size={14} /> : null}
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="All">All</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      <ChevronDown size={14} />
    </label>
  );
}

function GlobalFilters({ filters, setFilters }) {
  const update = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  return (
    <section className="filter-bar">
      <div className="filter-heading"><Filter size={16} /> Portfolio filters</div>
      <Select label="RM" value={filters.rm} options={DATA.filters?.rms || []} onChange={(v) => update('rm', v)} icon={UserRound} />
      <Select label="CSM" value={filters.csm} options={DATA.filters?.csms || []} onChange={(v) => update('csm', v)} icon={UsersRound} />
      <Select label="Product" value={filters.product} options={DATA.filters?.products || []} onChange={(v) => update('product', v)} icon={Package} />
      <Select label="Location" value={filters.location} options={DATA.filters?.locations || []} onChange={(v) => update('location', v)} icon={MapPin} />
      <Select label="Status" value={filters.status} options={DATA.filters?.renewalStatuses || []} onChange={(v) => update('status', v)} icon={Activity} />
      <Select label="Renewal month" value={filters.month} options={MONTHS} onChange={(v) => update('month', v)} icon={CalendarDays} />
      <label className="search-box">
        <Search size={16} />
        <input
          placeholder="Search client..."
          value={filters.search}
          onChange={(event) => update('search', event.target.value)}
        />
      </label>
      <button className="clear-button" onClick={() => setFilters(DEFAULT_FILTERS)}>Clear</button>
    </section>
  );
}

function KpiCard({ label, value, sub, tone = 'sage', icon: Icon = CircleDollarSign }) {
  return (
    <article className={`kpi-card ${tone}`}>
      <div className="kpi-icon"><Icon size={18} /></div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {sub ? <small>{sub}</small> : null}
      </div>
    </article>
  );
}

function Section({ title, subtitle, children, action }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}

function ForecastCards({ management, selectedScenario, setSelectedScenario }) {
  const target = Number(management?.target || 0);
  const scenarios = ['worst', 'medium', 'best'];
  return (
    <>
      <div className="forecast-selector">
        {scenarios.map((scenario) => (
          <button
            key={scenario}
            className={selectedScenario === scenario ? 'active' : ''}
            onClick={() => setSelectedScenario(scenario)}
          >
            {scenario[0].toUpperCase() + scenario.slice(1)}
          </button>
        ))}
      </div>
      <div className="forecast-grid">
        <KpiCard label="Target" value={money(target)} sub="Directly from Summary" tone="sage" icon={Target} />
        {scenarios.map((scenario) => {
          const value = Number(management?.[scenario] || 0);
          const gap = value - target;
          const achievement = target ? (value / target) * 100 : 0;
          return (
            <KpiCard
              key={scenario}
              label={`${scenario[0].toUpperCase() + scenario.slice(1)} Scenario`}
              value={money(value)}
              sub={`${percent(achievement)} of target · ${gap >= 0 ? '+' : ''}${money(gap)}`}
              tone={scenario === selectedScenario ? 'highlight' : scenario === 'best' ? 'green' : scenario === 'medium' ? 'amber' : 'blue'}
              icon={scenario === 'best' ? ArrowUpRight : scenario === 'worst' ? ArrowDownRight : BarChart3}
            />
          );
        })}
      </div>
    </>
  );
}

function statusTotals(accounts) {
  return accounts.reduce((result, account) => {
    const key = account.renewalStatus || 'Unknown';
    result[key] = (result[key] || 0) + Number(account.updatedValue || 0);
    return result;
  }, {});
}

function StatusMix({ accounts }) {
  const totals = statusTotals(accounts);
  const max = Math.max(...Object.keys(STATUS_META).map((status) => totals[status] || 0), 1);
  return (
    <div className="status-list">
      {Object.entries(STATUS_META).map(([status, meta]) => {
        const value = totals[status] || 0;
        return (
          <div className="status-line" key={status}>
            <div className="status-label"><i className={`dot ${meta.color}`} />{meta.label}</div>
            <div className="bar"><div className={`fill ${meta.color}`} style={{ width: `${Math.max(value ? 3 : 0, (value / max) * 100)}%` }} /></div>
            <strong>{compactMoney(value)}</strong>
          </div>
        );
      })}
    </div>
  );
}

function MonthlyChart({ accounts }) {
  const monthly = MONTHS.map((month) => ({
    month,
    amount: accounts.reduce((sum, account) => {
      const event = (account.renewalSchedule || []).find((item) => item.month === month);
      return sum + Number(event?.amount || 0);
    }, 0),
    count: accounts.filter((account) => (account.renewalSchedule || []).some((item) => item.month === month)).length,
  }));
  const max = Math.max(...monthly.map((item) => item.amount), 1);

  return (
    <div className="month-chart">
      {monthly.map((item) => (
        <div className="month-column" key={item.month} title={`${item.month}: ${money(item.amount)} · ${item.count} accounts`}>
          <span>{compactMoney(item.amount)}</span>
          <div className="month-track"><div style={{ height: `${Math.max(item.amount ? 5 : 0, (item.amount / max) * 100)}%` }} /></div>
          <strong>{item.month}</strong>
        </div>
      ))}
    </div>
  );
}

function PerformanceTable({ rows, type, onOpen }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>{type}</th><th>Accounts</th><th className="num">Updated value</th><th className="num">Renewed</th><th className="num">Pending High</th><th className="num">Lost</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} onClick={() => onOpen(row.name)} className="clickable-row">
              <td><div className="person-cell"><span className="avatar">{initials(row.name)}</span><strong>{row.name}</strong></div></td>
              <td>{row.accountsCount}</td>
              <td className="num">{money(row.updatedValue)}</td>
              <td className="num positive">{money(row.renewed)}</td>
              <td className="num info">{money(row.pendingHigh)}</td>
              <td className="num negative">{money(row.lost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AccountTable({ accounts, limit = 10 }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? accounts : accounts.slice(0, limit);
  return (
    <>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Client</th><th>RM</th><th>CSM</th><th>Product</th><th>Status</th><th>Renewal schedule</th><th className="num">Updated value</th></tr></thead>
          <tbody>
            {visible.map((account) => (
              <tr key={account.id}>
                <td><strong>{account.clientName || '—'}</strong><small className="cell-sub">{account.location || '—'}</small></td>
                <td>{account.rm || '—'}</td>
                <td>{account.csm || '—'}</td>
                <td>{account.product || '—'}</td>
                <td><span className={`status-pill ${statusClass(account.renewalStatus)}`}>{account.renewalStatus || '—'}</span></td>
                <td>{account.renewalSchedule?.length ? account.renewalSchedule.map((event) => `${event.month} ${money(event.amount)}`).join(' · ') : '—'}</td>
                <td className="num">{money(account.updatedValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {accounts.length > limit ? <button className="show-more" onClick={() => setExpanded((value) => !value)}>{expanded ? 'Show less' : `See all ${accounts.length}`}</button> : null}
    </>
  );
}

function ActionTable({ actions }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? actions : actions.slice(0, 10);
  return (
    <>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Client</th><th>Action</th><th>Owner</th><th>RM / CSM</th><th>Due date</th><th>Action status</th><th>Renewal</th></tr></thead>
          <tbody>
            {visible.map((action) => {
              const timing = actionTiming(action);
              return (
                <tr key={action.id}>
                  <td><strong>{action.clientName || '—'}</strong><small className="cell-sub">{money(action.updatedValue)}</small></td>
                  <td>{action.action || '—'}{action.notes ? <small className="cell-sub">{action.notes}</small> : null}</td>
                  <td>{action.owner || '—'}{action.ownerRaw ? <small className="cell-sub">Source: {action.ownerRaw}</small> : null}</td>
                  <td>{action.rm || '—'} / {action.csm || '—'}</td>
                  <td>{action.dueDateRaw || '—'}{timing ? <span className={`timing-pill ${timing.toLowerCase().replaceAll(' ', '-')}`}>{timing}</span> : null}</td>
                  <td>{action.actionStatus || '—'}</td>
                  <td>{action.renewalSchedule?.length ? action.renewalSchedule.map((event) => `${event.month} ${money(event.amount)}`).join(' · ') : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {actions.length > 10 ? <button className="show-more" onClick={() => setExpanded((value) => !value)}>{expanded ? 'Show less' : `See all ${actions.length}`}</button> : null}
    </>
  );
}

function Header({ title, subtitle, selectedScenario, setSelectedScenario }) {
  return (
    <header className="page-header">
      <div>
        <div className="eyebrow">Retention intelligence · 2026</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="header-scenario">
        {['worst', 'medium', 'best'].map((scenario) => (
          <button key={scenario} className={selectedScenario === scenario ? 'active' : ''} onClick={() => setSelectedScenario(scenario)}>
            {scenario[0].toUpperCase() + scenario.slice(1)}
          </button>
        ))}
      </div>
    </header>
  );
}

const DEFAULT_FILTERS = { rm: 'All', csm: 'All', product: 'All', location: 'All', status: 'All', month: 'All', search: '' };

export default function App() {
  const [page, setPage] = useState('overview');
  const [selectedScenario, setSelectedScenario] = useState('medium');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [actionFilters, setActionFilters] = useState({ owner: 'All', status: 'All', timing: 'All' });

  const entity = pageEntity(page);

  const scopedAccounts = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    return (DATA.accounts || []).filter((account) => {
      if (entity?.type === 'rm' && account.rm !== entity.name) return false;
      if (entity?.type === 'csm' && account.csm !== entity.name) return false;
      if (filters.rm !== 'All' && account.rm !== filters.rm) return false;
      if (filters.csm !== 'All' && account.csm !== filters.csm) return false;
      if (filters.product !== 'All' && account.product !== filters.product) return false;
      if (filters.location !== 'All' && account.location !== filters.location) return false;
      if (filters.status !== 'All' && account.renewalStatus !== filters.status) return false;
      if (filters.month !== 'All' && !(account.renewalSchedule || []).some((event) => event.month === filters.month)) return false;
      if (query) {
        const haystack = `${account.clientName} ${account.rm} ${account.csm} ${account.product} ${account.location}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [filters, entity]);

  const accountIds = useMemo(() => new Set(scopedAccounts.map((account) => account.id)), [scopedAccounts]);

  const scopedActions = useMemo(() => (DATA.actions || []).filter((action) => {
    if (!accountIds.has(action.accountId)) return false;
    if (actionFilters.owner !== 'All' && action.owner !== actionFilters.owner) return false;
    if (actionFilters.status !== 'All' && action.actionStatus !== actionFilters.status) return false;
    if (actionFilters.timing !== 'All' && actionTiming(action) !== actionFilters.timing) return false;
    return true;
  }), [accountIds, actionFilters]);

  const managementScope = useMemo(() => {
    const selectedRm = entity?.type === 'rm' ? entity.name : filters.rm !== 'All' ? filters.rm : null;
    return selectedRm ? DATA.management?.rms?.[selectedRm] || DATA.management?.team : DATA.management?.team;
  }, [entity, filters.rm]);

  const status = statusTotals(scopedAccounts);
  const totalUpdated = scopedAccounts.reduce((sum, account) => sum + Number(account.updatedValue || 0), 0);
  const currentMonth = MONTHS[new Date().getMonth()];
  const renewalsThisMonth = scopedAccounts.reduce((sum, account) => {
    return sum + (account.renewalSchedule || []).filter((event) => event.month === currentMonth).reduce((value, event) => value + Number(event.amount || 0), 0);
  }, 0);

  const pageMeta = (() => {
    if (entity?.type === 'rm') return { title: `${entity.name} · RM Performance`, subtitle: 'Operational portfolio detail from the Retention tab.' };
    if (entity?.type === 'csm') return { title: `${entity.name} · CSM Performance`, subtitle: 'Accounts, renewal schedule, statuses and actions owned across the portfolio.' };
    if (page === 'forecast') return { title: 'Management Forecast', subtitle: 'Target, Worst, Medium and Best come directly from the Summary tab.' };
    if (page === 'calendar') return { title: 'Renewal Calendar', subtitle: 'Every populated month is preserved as a renewal event with its own amount.' };
    if (page === 'accounts') return { title: 'Accounts Explorer', subtitle: 'Detailed Retention data using Updated 2026 Value.' };
    if (page === 'actions') return { title: 'Action Center', subtitle: 'Actions are read only from Action, Owner, Due Date and Action Status columns.' };
    return { title: 'Retention Command Center', subtitle: 'Management forecast from Summary. Full operational detail from Retention.' };
  })();

  const renderOperationalKpis = () => (
    <div className="kpi-grid operational">
      <KpiCard label="Accounts" value={scopedAccounts.length.toLocaleString()} sub="Current filter scope" tone="sage" icon={Building2} />
      <KpiCard label="Updated 2026 Value" value={money(totalUpdated)} sub="Retention source of truth" tone="highlight" icon={CircleDollarSign} />
      <KpiCard label="Renewed" value={money(status.Renewed || 0)} sub="Updated value" tone="green" icon={CheckCircle2} />
      <KpiCard label="Pending High" value={money(status['Pending High'] || 0)} sub="Updated value" tone="blue" icon={ArrowUpRight} />
      <KpiCard label={`Renewals in ${currentMonth}`} value={money(renewalsThisMonth)} sub="Based on monthly columns" tone="amber" icon={CalendarDays} />
    </div>
  );

  const rmRows = Object.values(DATA.rms || {}).filter((row) => row.name !== 'Unassigned').sort((a, b) => b.updatedValue - a.updatedValue);
  const csmRows = Object.values(DATA.csms || {}).filter((row) => row.name !== 'Unassigned').sort((a, b) => b.updatedValue - a.updatedValue);

  return (
    <div className="app-shell">
      <Sidebar page={page} setPage={setPage} />
      <main className="main-content">
        <Header {...pageMeta} selectedScenario={selectedScenario} setSelectedScenario={setSelectedScenario} />
        <GlobalFilters filters={filters} setFilters={setFilters} />

        {page === 'overview' && (
          <div className="page-stack">
            <Section title="Management Forecast" subtitle="This section responds to the selected RM only. CSM and portfolio filters do not rewrite Summary values.">
              <ForecastCards management={managementScope} selectedScenario={selectedScenario} setSelectedScenario={setSelectedScenario} />
            </Section>
            {renderOperationalKpis()}
            <div className="two-column">
              <Section title="Renewal Status Mix" subtitle="Calculated from Updated 2026 Value in Retention"><StatusMix accounts={scopedAccounts} /></Section>
              <Section title="Renewal Timeline" subtitle="Each populated month remains a separate renewal amount"><MonthlyChart accounts={scopedAccounts} /></Section>
            </div>
            <div className="two-column">
              <Section title="RM Performance" subtitle="Click an RM to open the full portfolio"><PerformanceTable rows={rmRows} type="RM" onOpen={(name) => setPage(`rm:${name}`)} /></Section>
              <Section title="CSM Performance" subtitle="Click a CSM to open the full portfolio"><PerformanceTable rows={csmRows} type="CSM" onOpen={(name) => setPage(`csm:${name}`)} /></Section>
            </div>
            <Section title="Priority Accounts" subtitle="Largest accounts in the current filter scope"><AccountTable accounts={[...scopedAccounts].sort((a, b) => b.updatedValue - a.updatedValue)} /></Section>
          </div>
        )}

        {page === 'forecast' && (
          <div className="page-stack">
            <Section title="Summary Forecast" subtitle="No operational value is used to recreate these four numbers."><ForecastCards management={managementScope} selectedScenario={selectedScenario} setSelectedScenario={setSelectedScenario} /></Section>
            <Section title="RM Forecast Detail" subtitle="Direct values from the Property of closing the year section">
              <div className="table-wrap"><table><thead><tr><th>RM</th><th className="num">Target</th><th className="num">Worst</th><th className="num">Medium</th><th className="num">Best</th></tr></thead><tbody>{Object.values(DATA.management?.rms || {}).map((row) => <tr key={row.rm}><td><strong>{row.rm}</strong></td><td className="num">{money(row.target)}</td><td className="num">{money(row.worst)}</td><td className="num">{money(row.medium)}</td><td className="num">{money(row.best)}</td></tr>)}</tbody></table></div>
            </Section>
          </div>
        )}

        {entity && (
          <div className="page-stack">
            {renderOperationalKpis()}
            {entity.type === 'rm' ? <Section title="Management Forecast" subtitle="Direct Summary values for this RM"><ForecastCards management={managementScope} selectedScenario={selectedScenario} setSelectedScenario={setSelectedScenario} /></Section> : null}
            <div className="two-column">
              <Section title="Status Mix"><StatusMix accounts={scopedAccounts} /></Section>
              <Section title="Renewal Timeline"><MonthlyChart accounts={scopedAccounts} /></Section>
            </div>
            <Section title="Accounts"><AccountTable accounts={[...scopedAccounts].sort((a, b) => b.updatedValue - a.updatedValue)} /></Section>
            <Section title="Actions"><ActionTable actions={scopedActions} /></Section>
          </div>
        )}

        {page === 'calendar' && (
          <div className="page-stack">
            {renderOperationalKpis()}
            <Section title="2026 Renewal Calendar" subtitle="Accounts can appear in more than one month when more than one monthly amount is populated.">
              <div className="calendar-grid">{MONTHS.map((month) => {
                const events = scopedAccounts.flatMap((account) => (account.renewalSchedule || []).filter((event) => event.month === month).map((event) => ({ ...event, account })));
                const total = events.reduce((sum, event) => sum + Number(event.amount || 0), 0);
                return <article className="calendar-card" key={month}><div className="calendar-head"><strong>{month} 2026</strong><span>{money(total)}</span></div><small>{events.length} renewal events</small><div className="calendar-events">{events.slice(0, 6).map((event) => <div key={`${event.account.id}-${month}`}><span>{event.account.clientName}</span><strong>{money(event.amount)}</strong></div>)}</div>{events.length > 6 ? <em>+{events.length - 6} more</em> : null}</article>;
              })}</div>
            </Section>
          </div>
        )}

        {page === 'accounts' && (
          <div className="page-stack">
            {renderOperationalKpis()}
            <Section title="Accounts Explorer" subtitle={`${scopedAccounts.length} matching accounts`}><AccountTable accounts={[...scopedAccounts].sort((a, b) => b.updatedValue - a.updatedValue)} limit={15} /></Section>
          </div>
        )}

        {page === 'actions' && (
          <div className="page-stack">
            <div className="kpi-grid operational">
              <KpiCard label="Actions" value={scopedActions.length.toLocaleString()} sub="Rows with an Action value" tone="sage" icon={ClipboardList} />
              <KpiCard label="Overdue" value={scopedActions.filter((action) => actionTiming(action) === 'Overdue').length.toLocaleString()} sub="Only where a due date exists" tone="red" icon={ArrowDownRight} />
              <KpiCard label="Due This Week" value={scopedActions.filter((action) => actionTiming(action) === 'Due This Week').length.toLocaleString()} sub="Only where a due date exists" tone="amber" icon={CalendarDays} />
              <KpiCard label="With Owner" value={scopedActions.filter((action) => action.owner).length.toLocaleString()} sub="RM/CSM references resolved" tone="blue" icon={UserRound} />
            </div>
            <section className="action-filter-bar">
              <Select label="Action owner" value={actionFilters.owner} options={DATA.filters?.actionOwners || []} onChange={(v) => setActionFilters((current) => ({ ...current, owner: v }))} icon={UserRound} />
              <Select label="Action status" value={actionFilters.status} options={DATA.filters?.actionStatuses || []} onChange={(v) => setActionFilters((current) => ({ ...current, status: v }))} icon={Activity} />
              <Select label="Due timing" value={actionFilters.timing} options={['Overdue', 'Due Today', 'Due This Week', 'Upcoming', 'Completed']} onChange={(v) => setActionFilters((current) => ({ ...current, timing: v }))} icon={CalendarDays} />
            </section>
            <Section title="Action Center" subtitle="Blank values remain blank; the dashboard does not invent action details."><ActionTable actions={scopedActions} /></Section>
          </div>
        )}

        <footer>Generated from Summary + Retention · Updated 2026 Value powers operational detail · Summary powers Target / Worst / Medium / Best only</footer>
      </main>
    </div>
  );
}
