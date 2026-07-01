import React, { useMemo, useState } from 'https://esm.sh/react@19.1.0';
import { createRoot } from 'https://esm.sh/react-dom@19.1.0/client';
import htm from 'https://esm.sh/htm@3.1.1';

const html = htm.bind(React.createElement);
const DATA = window.DASHBOARD_DATA || { management: { team: {}, rms: {} }, accounts: [], actions: [], rms: {}, csms: {}, filters: {} };
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DEFAULT_FILTERS = { rm:'All', csm:'All', product:'All', location:'All', status:'All', month:'All', search:'' };

const money = (v) => `$${Math.round(Number(v || 0)).toLocaleString()}`;
const compact = (v) => {
  const n = Number(v || 0);
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return money(n);
};
const pct = (v) => `${Number(v || 0).toFixed(1)}%`;
const initials = (name='?') => name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()).join('');
const statusTone = (s='') => s === 'Renewed' ? 'green' : s === 'Pending High' ? 'blue' : s === 'Pending Medium' ? 'amber' : s === 'Pending Low' ? 'purple' : s === 'Lost' ? 'red' : 'gray';

function actionTiming(action) {
  if (!action?.dueDate) return 'No Due Date';
  const state = String(action.actionStatus || '').toLowerCase();
  if (state.includes('complete') || state.includes('done') || state.includes('closed')) return 'Completed';
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(`${action.dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return 'No Due Date';
  const days = Math.round((due - today) / 86400000);
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Due Today';
  if (days <= 7) return 'Due This Week';
  return 'Upcoming';
}

function entityFromPage(page) {
  if (page.startsWith('rm:')) return { type:'rm', name:page.slice(3) };
  if (page.startsWith('csm:')) return { type:'csm', name:page.slice(4) };
  return null;
}

function Kpi({ label, value, sub, tone='sage', icon='●', onClick }) {
  return html`<article className=${`kpi ${tone} ${onClick ? 'clickable' : ''}`} onClick=${onClick}>
    <div className="kpi-icon">${icon}</div>
    <div><span>${label}</span><strong>${value}</strong>${sub ? html`<small>${sub}</small>` : null}</div>
  </article>`;
}

function Select({ label, value, options=[], onChange }) {
  return html`<label className="select"><span>${label}</span><select value=${value} onChange=${e=>onChange(e.target.value)}><option value="All">All</option>${options.map(o=>html`<option key=${o} value=${o}>${o}</option>`)}</select></label>`;
}

function Panel({ title, subtitle, children, action }) {
  return html`<section className="panel"><div className="panel-head"><div><h2>${title}</h2>${subtitle ? html`<p>${subtitle}</p>` : null}</div>${action || null}</div><div className="panel-body">${children}</div></section>`;
}

function Forecast({ management, scenario, setScenario }) {
  const target = Number(management?.target || 0);
  const rows = ['worst','medium','best'];
  return html`<div>
    <div className="scenario-pills">${rows.map(key=>html`<button key=${key} className=${scenario===key?'active':''} onClick=${()=>setScenario(key)}>${key[0].toUpperCase()+key.slice(1)}</button>`)}</div>
    <div className="forecast-grid">
      <${Kpi} label="Target" value=${money(target)} sub="From Summary" tone="sage" icon="◎" />
      ${rows.map(key=>{
        const value=Number(management?.[key]||0); const gap=value-target; const ach=target?(value/target)*100:0;
        return html`<${Kpi} key=${key} label=${`${key[0].toUpperCase()+key.slice(1)} Scenario`} value=${money(value)} sub=${`${pct(ach)} of target · ${gap>=0?'+':''}${money(gap)}`} tone=${scenario===key?'highlight':key==='best'?'green':key==='medium'?'amber':'blue'} icon=${key==='best'?'↗':key==='worst'?'↘':'≋'} />`;
      })}
    </div>
  </div>`;
}

function StatusMix({ accounts }) {
  const statuses=['Renewed','Pending High','Pending Medium','Pending Low','Lost'];
  const totals=Object.fromEntries(statuses.map(s=>[s,0]));
  accounts.forEach(a=>{ if (totals[a.renewalStatus] !== undefined) totals[a.renewalStatus]+=Number(a.updatedValue||0); });
  const max=Math.max(1,...Object.values(totals));
  return html`<div className="status-list">${statuses.map(s=>html`<div className="status-row" key=${s}><div><i className=${`dot ${statusTone(s)}`}></i>${s}</div><div className="bar"><span className=${statusTone(s)} style=${{width:`${Math.max(totals[s]?3:0,(totals[s]/max)*100)}%`}}></span></div><strong>${compact(totals[s])}</strong></div>`)}</div>`;
}

function Timeline({ accounts }) {
  const rows=MONTHS.map(month=>({month, amount:accounts.reduce((sum,a)=>sum+(a.renewalSchedule||[]).filter(x=>x.month===month).reduce((s,x)=>s+Number(x.amount||0),0),0)}));
  const max=Math.max(1,...rows.map(x=>x.amount));
  return html`<div className="timeline">${rows.map(x=>html`<div className="month" key=${x.month} title=${`${x.month}: ${money(x.amount)}`}><small>${compact(x.amount)}</small><div><span style=${{height:`${Math.max(x.amount?4:0,(x.amount/max)*100)}%`}}></span></div><b>${x.month}</b></div>`)}</div>`;
}

function AccountsTable({ accounts, limit=12 }) {
  const [all,setAll]=useState(false); const rows=all?accounts:accounts.slice(0,limit);
  return html`<div><div className="table-wrap"><table><thead><tr><th>Client</th><th>RM</th><th>CSM</th><th>Product</th><th>Status</th><th>Renewal</th><th className="num">Updated Value</th></tr></thead><tbody>${rows.map(a=>html`<tr key=${a.id}><td><strong>${a.clientName||'—'}</strong><small>${a.location||'—'}</small></td><td>${a.rm||'—'}</td><td>${a.csm||'—'}</td><td>${a.product||'—'}</td><td><span className=${`pill ${statusTone(a.renewalStatus)}`}>${a.renewalStatus||'—'}</span></td><td>${(a.renewalSchedule||[]).length?(a.renewalSchedule||[]).map(x=>`${x.month} ${money(x.amount)}`).join(' · '):'—'}</td><td className="num">${money(a.updatedValue)}</td></tr>`)}</tbody></table></div>${accounts.length>limit?html`<button className="more" onClick=${()=>setAll(!all)}>${all?'Show less':`See all ${accounts.length}`}</button>`:null}</div>`;
}

function ActionsTable({ actions, limit=12 }) {
  const [all,setAll]=useState(false); const rows=all?actions:actions.slice(0,limit);
  return html`<div><div className="table-wrap"><table><thead><tr><th>Client</th><th>Action</th><th>Owner</th><th>RM / CSM</th><th>Due</th><th>Status</th><th>Renewal</th></tr></thead><tbody>${rows.map(a=>{const timing=actionTiming(a); return html`<tr key=${a.id}><td><strong>${a.clientName||'—'}</strong><small>${money(a.updatedValue)}</small></td><td>${a.action||'—'}${a.notes?html`<small>${a.notes}</small>`:null}</td><td>${a.owner||'—'}</td><td>${a.rm||'—'} / ${a.csm||'—'}</td><td>${a.dueDateRaw||'—'}<span className=${`timing ${timing.toLowerCase().replaceAll(' ','-')}`}>${timing}</span></td><td>${a.actionStatus||'—'}</td><td>${(a.renewalSchedule||[]).map(x=>`${x.month} ${money(x.amount)}`).join(' · ')||'—'}</td></tr>`;})}</tbody></table></div>${actions.length>limit?html`<button className="more" onClick=${()=>setAll(!all)}>${all?'Show less':`See all ${actions.length}`}</button>`:null}</div>`;
}

function Performance({ rows, label, open }) {
  return html`<div className="table-wrap"><table><thead><tr><th>${label}</th><th>Accounts</th><th className="num">Updated Value</th><th className="num">Renewed</th><th className="num">Pending High</th><th className="num">Lost</th></tr></thead><tbody>${rows.map(r=>html`<tr key=${r.name} className="link-row" onClick=${()=>open(r.name)}><td><div className="person"><span>${initials(r.name)}</span><strong>${r.name}</strong></div></td><td>${r.accountsCount}</td><td className="num">${money(r.updatedValue)}</td><td className="num good">${money(r.renewed)}</td><td className="num info">${money(r.pendingHigh)}</td><td className="num bad">${money(r.lost)}</td></tr>`)}</tbody></table></div>`;
}

function Sidebar({ page, setPage }) {
  const rms=Object.keys(DATA.management?.rms||{}); const csms=Object.keys(DATA.csms||{}).filter(x=>x!=='Unassigned');
  const item=(id,label,icon,nested=false)=>html`<button key=${id} className=${`nav-item ${page===id?'active':''} ${nested?'nested':''}`} onClick=${()=>setPage(id)}><span>${icon}</span><b>${label}</b></button>`;
  return html`<aside className="sidebar"><div className="brand"><div>R</div><section><strong>Retention Command</strong><small>2026 portfolio intelligence</small></section></div><nav><p>Workspace</p>${item('overview','Overview','⌂')}${item('forecast','Management Forecast','↗')}${item('calendar','Renewal Calendar','▦')}${item('accounts','Accounts Explorer','□')}${item('actions','Action Center','✓')}<p>RM Performance</p>${rms.map(x=>item(`rm:${x}`,x,'●',true))}<p>CSM Performance</p>${csms.map(x=>item(`csm:${x}`,x,'●',true))}</nav><footer><small>Summary + Retention</small><strong>${DATA.generatedAt?new Date(DATA.generatedAt).toLocaleString():'Live data'}</strong></footer></aside>`;
}

function App() {
  const [page,setPage]=useState('overview'); const [scenario,setScenario]=useState('medium'); const [filters,setFilters]=useState(DEFAULT_FILTERS); const [actionFilters,setActionFilters]=useState({owner:'All',status:'All',timing:'All'});
  const entity=entityFromPage(page);
  const accounts=useMemo(()=>{
    const q=filters.search.trim().toLowerCase();
    return (DATA.accounts||[]).filter(a=>{
      if(entity?.type==='rm'&&a.rm!==entity.name)return false; if(entity?.type==='csm'&&a.csm!==entity.name)return false;
      if(filters.rm!=='All'&&a.rm!==filters.rm)return false; if(filters.csm!=='All'&&a.csm!==filters.csm)return false; if(filters.product!=='All'&&a.product!==filters.product)return false; if(filters.location!=='All'&&a.location!==filters.location)return false; if(filters.status!=='All'&&a.renewalStatus!==filters.status)return false; if(filters.month!=='All'&&!(a.renewalSchedule||[]).some(x=>x.month===filters.month))return false;
      if(q&&!`${a.clientName} ${a.rm} ${a.csm} ${a.product} ${a.location}`.toLowerCase().includes(q))return false; return true;
    });
  },[filters,entity]);
  const ids=useMemo(()=>new Set(accounts.map(a=>a.id)),[accounts]);
  const actions=useMemo(()=>(DATA.actions||[]).filter(a=>ids.has(a.accountId)&&(actionFilters.owner==='All'||a.owner===actionFilters.owner)&&(actionFilters.status==='All'||a.actionStatus===actionFilters.status)&&(actionFilters.timing==='All'||actionTiming(a)===actionFilters.timing)),[ids,actionFilters]);
  const selectedRm=entity?.type==='rm'?entity.name:filters.rm!=='All'?filters.rm:null;
  const management=selectedRm?(DATA.management?.rms?.[selectedRm]||DATA.management?.team):DATA.management?.team;
  const total=accounts.reduce((s,a)=>s+Number(a.updatedValue||0),0); const renewed=accounts.filter(a=>a.renewalStatus==='Renewed').reduce((s,a)=>s+Number(a.updatedValue||0),0); const high=accounts.filter(a=>a.renewalStatus==='Pending High').reduce((s,a)=>s+Number(a.updatedValue||0),0); const current=MONTHS[new Date().getMonth()]; const thisMonth=accounts.reduce((s,a)=>s+(a.renewalSchedule||[]).filter(x=>x.month===current).reduce((q,x)=>q+Number(x.amount||0),0),0);
  const rmRows=Object.values(DATA.rms||{}).filter(x=>x.name!=='Unassigned').sort((a,b)=>b.updatedValue-a.updatedValue); const csmRows=Object.values(DATA.csms||{}).filter(x=>x.name!=='Unassigned').sort((a,b)=>b.updatedValue-a.updatedValue);
  const meta=entity?{title:`${entity.name} · ${entity.type==='rm'?'RM':'CSM'} Performance`,sub:'Operational details from Retention'}:page==='forecast'?{title:'Management Forecast',sub:'Target, Worst, Medium and Best from Summary'}:page==='calendar'?{title:'Renewal Calendar',sub:'Every populated month is preserved'}:page==='accounts'?{title:'Accounts Explorer',sub:'Detailed retention portfolio'}:page==='actions'?{title:'Action Center',sub:'Actions, owners, due dates and statuses'}:{title:'Retention Command Center',sub:'Management forecast from Summary. Operational detail from Retention.'};
  const setFilter=(k,v)=>setFilters(f=>({...f,[k]:v}));
  const kpis=html`<div className="kpi-grid"><${Kpi} label="Accounts" value=${accounts.length.toLocaleString()} sub="Current scope" icon="□"/><${Kpi} label="Updated 2026 Value" value=${money(total)} sub="Retention source" tone="highlight" icon="$"/><${Kpi} label="Renewed" value=${money(renewed)} sub="Updated value" tone="green" icon="✓"/><${Kpi} label="Pending High" value=${money(high)} sub="Updated value" tone="blue" icon="↗"/><${Kpi} label=${`Renewals in ${current}`} value=${money(thisMonth)} sub="Monthly columns" tone="amber" icon="▦"/></div>`;
  return html`<div className="shell"><${Sidebar} page=${page} setPage=${setPage}/><main><header className="top"><div><small>Retention intelligence · 2026</small><h1>${meta.title}</h1><p>${meta.sub}</p></div><div className="scenario-pills top-pills">${['worst','medium','best'].map(x=>html`<button className=${scenario===x?'active':''} onClick=${()=>setScenario(x)}>${x[0].toUpperCase()+x.slice(1)}</button>`)}</div></header><section className="filters"><b>Portfolio filters</b><${Select} label="RM" value=${filters.rm} options=${DATA.filters?.rms||[]} onChange=${v=>setFilter('rm',v)}/><${Select} label="CSM" value=${filters.csm} options=${DATA.filters?.csms||[]} onChange=${v=>setFilter('csm',v)}/><${Select} label="Product" value=${filters.product} options=${DATA.filters?.products||[]} onChange=${v=>setFilter('product',v)}/><${Select} label="Location" value=${filters.location} options=${DATA.filters?.locations||[]} onChange=${v=>setFilter('location',v)}/><${Select} label="Renewal Status" value=${filters.status} options=${DATA.filters?.renewalStatuses||[]} onChange=${v=>setFilter('status',v)}/><${Select} label="Month" value=${filters.month} options=${MONTHS} onChange=${v=>setFilter('month',v)}/><label className="search"><span>⌕</span><input value=${filters.search} onInput=${e=>setFilter('search',e.target.value)} placeholder="Search client..."/></label><button className="clear" onClick=${()=>setFilters(DEFAULT_FILTERS)}>Clear</button></section>
  ${page==='overview'?html`<div className="stack"><${Panel} title="Management Forecast" subtitle="Summary values"><${Forecast} management=${management} scenario=${scenario} setScenario=${setScenario}/></${Panel}>${kpis}<div className="two"><${Panel} title="Renewal Status Mix"><${StatusMix} accounts=${accounts}/></${Panel}><${Panel} title="Renewal Timeline"><${Timeline} accounts=${accounts}/></${Panel}></div><div className="two"><${Panel} title="RM Performance"><${Performance} rows=${rmRows} label="RM" open=${name=>setPage(`rm:${name}`)}/></${Panel}><${Panel} title="CSM Performance"><${Performance} rows=${csmRows} label="CSM" open=${name=>setPage(`csm:${name}`)}/></${Panel}></div><${Panel} title="Priority Accounts" subtitle="Largest accounts"><${AccountsTable} accounts=${[...accounts].sort((a,b)=>b.updatedValue-a.updatedValue)}/></${Panel}></div>`:null}
  ${page==='forecast'?html`<div className="stack"><${Panel} title="Summary Forecast"><${Forecast} management=${management} scenario=${scenario} setScenario=${setScenario}/></${Panel}><${Panel} title="RM Forecast Detail"><div className="table-wrap"><table><thead><tr><th>RM</th><th className="num">Target</th><th className="num">Worst</th><th className="num">Medium</th><th className="num">Best</th></tr></thead><tbody>${Object.values(DATA.management?.rms||{}).map(r=>html`<tr><td><strong>${r.rm}</strong></td><td className="num">${money(r.target)}</td><td className="num">${money(r.worst)}</td><td className="num">${money(r.medium)}</td><td className="num">${money(r.best)}</td></tr>`)}</tbody></table></div></${Panel}></div>`:null}
  ${entity?html`<div className="stack">${kpis}${entity.type==='rm'?html`<${Panel} title="Management Forecast"><${Forecast} management=${management} scenario=${scenario} setScenario=${setScenario}/></${Panel}>`:null}<div className="two"><${Panel} title="Status Mix"><${StatusMix} accounts=${accounts}/></${Panel}><${Panel} title="Renewal Timeline"><${Timeline} accounts=${accounts}/></${Panel}></div><${Panel} title="Accounts"><${AccountsTable} accounts=${[...accounts].sort((a,b)=>b.updatedValue-a.updatedValue)}/></${Panel}><${Panel} title="Actions"><${ActionsTable} actions=${actions}/></${Panel}></div>`:null}
  ${page==='calendar'?html`<div className="stack">${kpis}<${Panel} title="2026 Renewal Calendar"><div className="calendar">${MONTHS.map(m=>{const events=accounts.flatMap(a=>(a.renewalSchedule||[]).filter(x=>x.month===m).map(x=>({...x,account:a}))); const val=events.reduce((s,x)=>s+Number(x.amount||0),0); return html`<article><header><b>${m} 2026</b><strong>${money(val)}</strong></header><small>${events.length} renewal events</small><div>${events.slice(0,7).map(x=>html`<p><span>${x.account.clientName}</span><b>${money(x.amount)}</b></p>`)}</div>${events.length>7?html`<em>+${events.length-7} more</em>`:null}</article>`;})}</div></${Panel}></div>`:null}
  ${page==='accounts'?html`<div className="stack">${kpis}<${Panel} title="Accounts Explorer" subtitle=${`${accounts.length} matching accounts`}><${AccountsTable} accounts=${[...accounts].sort((a,b)=>b.updatedValue-a.updatedValue)} limit=${18}/></${Panel}></div>`:null}
  ${page==='actions'?html`<div className="stack"><div className="kpi-grid four"><${Kpi} label="Actions" value=${actions.length} sub="Rows with Action" icon="✓"/><${Kpi} label="Overdue" value=${actions.filter(a=>actionTiming(a)==='Overdue').length} tone="red" icon="!"/><${Kpi} label="Due This Week" value=${actions.filter(a=>actionTiming(a)==='Due This Week').length} tone="amber" icon="▦"/><${Kpi} label="No Due Date" value=${actions.filter(a=>actionTiming(a)==='No Due Date').length} tone="purple" icon="—"/></div><section className="filters action-filters"><${Select} label="Owner" value=${actionFilters.owner} options=${DATA.filters?.actionOwners||[]} onChange=${v=>setActionFilters(a=>({...a,owner:v}))}/><${Select} label="Action Status" value=${actionFilters.status} options=${DATA.filters?.actionStatuses||[]} onChange=${v=>setActionFilters(a=>({...a,status:v}))}/><${Select} label="Due Timing" value=${actionFilters.timing} options=${['Overdue','Due Today','Due This Week','Upcoming','No Due Date','Completed']} onChange=${v=>setActionFilters(a=>({...a,timing:v}))}/></section><${Panel} title="Action Center" subtitle="Blank source values remain blank"><${ActionsTable} actions=${actions}/></${Panel}></div>`:null}
  <div className="foot">Updated from Summary + Retention · ${DATA.generatedAt?new Date(DATA.generatedAt).toLocaleString():''}</div></main></div>`;
}

createRoot(document.getElementById('root')).render(html`<${App}/>`);
