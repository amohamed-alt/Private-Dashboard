(() => {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const ACTIONS = ['Onsite Visit','Executive Call','Conduct Early Renewal Meeting','Prioritize Their Tickets','Flexible Payment Terms','Restaurant Voucher','Free Feature/Module','Push Security Team','Round Table','Talk with Abdurahman'];
  const clean = (value) => String(value || '').trim();
  const norm = (value) => clean(value).toLowerCase();
  const text = (node) => clean(node?.textContent);
  const makeOption = (value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    return option;
  };
  const makeSelect = (label, values, className) => {
    const field = document.createElement('label');
    field.className = `select ${className}`;
    const caption = document.createElement('span');
    caption.textContent = label;
    const select = document.createElement('select');
    select.append(makeOption('All'));
    values.forEach((value) => select.append(makeOption(value)));
    field.append(caption, select);
    return field;
  };
  const makeSearch = () => {
    const field = document.createElement('label');
    field.className = 'action-search action-extra-filter';
    const icon = document.createElement('span');
    icon.textContent = '⌕';
    const input = document.createElement('input');
    input.placeholder = 'Search action/client...';
    field.append(icon, input);
    return field;
  };
  function currentFilters() {
    const action = document.querySelector('.action-extra-action select')?.value || 'All';
    const dueMonth = document.querySelector('.action-extra-due-month select')?.value || 'All';
    const query = norm(document.querySelector('.action-extra-filter input')?.value || '');
    return { action, dueMonth, query };
  }
  function applyExtraFilters() {
    const title = [...document.querySelectorAll('h1')].find((node) => norm(text(node)) === 'action center');
    if (!title) return;
    const { action, dueMonth, query } = currentFilters();
    const rows = [...document.querySelectorAll('.actions-table tbody tr')];
    let visible = 0;
    rows.forEach((row) => {
      const rowText = norm(text(row));
      const actionOk = action === 'All' || rowText.includes(norm(action));
      const monthOk = dueMonth === 'All' || rowText.includes(norm(dueMonth));
      const queryOk = !query || rowText.includes(query);
      const show = actionOk && monthOk && queryOk;
      row.style.display = show ? '' : 'none';
      if (show) visible += 1;
    });
    const subtitle = [...document.querySelectorAll('.panel')].find((panel) => norm(text(panel.querySelector('h2'))) === 'action center')?.querySelector('.panel-head p');
    if (subtitle && rows.length) subtitle.textContent = `${visible} visible actions after extra filters. Use See all first if you want to filter all rendered rows.`;
  }
  function install() {
    const title = [...document.querySelectorAll('h1')].find((node) => norm(text(node)) === 'action center');
    if (!title) return;
    const bar = document.querySelector('.action-filters');
    if (!bar || bar.querySelector('.action-extra-filter')) return;
    const availableActions = ACTIONS.filter((option) => (window.DASHBOARD_DATA?.actions || []).some((action) => norm(action.action).includes(norm(option))));
    const actionSelect = makeSelect('Action', availableActions, 'action-extra-filter action-extra-action');
    const dueSelect = makeSelect('Due Month', MONTHS, 'action-extra-filter action-extra-due-month');
    const search = makeSearch();
    [actionSelect, dueSelect, search].forEach((node) => {
      node.addEventListener('change', applyExtraFilters, true);
      node.addEventListener('input', applyExtraFilters, true);
      bar.append(node);
    });
  }
  let queued = false;
  function run() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      install();
      applyExtraFilters();
    });
  }
  document.addEventListener('change', run, true);
  document.addEventListener('input', run, true);
  new MutationObserver(run).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('load', run);
  run();
})();
