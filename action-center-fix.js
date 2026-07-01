(() => {
  const STATUS_OPTIONS = ['Done', 'Postponed', 'Cancelled', 'To Do', 'N/A'];
  const STATUS_CLASSES = {
    done: 'done',
    postponed: 'postponed',
    cancelled: 'cancelled',
    'to do': 'todo',
    'n/a': 'na',
  };

  const text = (node) => String(node?.textContent || '').trim();
  const normalized = (value) => String(value || '').trim().toLowerCase();
  const canonicalStatus = (value) => STATUS_OPTIONS.find((status) => normalized(status) === normalized(value)) || String(value || '').trim();

  const dashboardData = window.DASHBOARD_DATA;
  if (dashboardData) {
    dashboardData.filters = dashboardData.filters || {};
    dashboardData.filters.actionStatuses = [...new Set([
      ...STATUS_OPTIONS,
      ...(dashboardData.filters.actionStatuses || []).map(canonicalStatus),
    ].filter(Boolean))];
    dashboardData.actions = (dashboardData.actions || []).map((action) => ({
      ...action,
      actionStatus: canonicalStatus(action.actionStatus),
    }));
  }

  function dispatchChange(select, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    if (setter) setter.call(select, value);
    else select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function ensureStatusOptions(filterBar) {
    const statusField = [...filterBar.querySelectorAll('.select')].find(
      (field) => normalized(text(field.querySelector('span'))) === 'action status',
    );
    if (!statusField) return;

    const select = statusField.querySelector('select');
    if (!select) return;

    const existing = new Set([...select.options].map((option) => normalized(option.value || option.textContent)));
    STATUS_OPTIONS.forEach((status) => {
      if (existing.has(normalized(status))) return;
      const option = document.createElement('option');
      option.value = status;
      option.textContent = status;
      select.append(option);
    });
  }

  function enhanceStatusCells(panel) {
    const table = panel.querySelector('table');
    if (!table) return;

    table.classList.add('actions-table');
    const headers = [...table.querySelectorAll('thead th')];
    const statusIndex = headers.findIndex((header) => {
      const label = normalized(text(header));
      return label === 'status' || label === 'action status';
    });
    if (statusIndex < 0) return;

    const header = headers[statusIndex];
    if (normalized(text(header)) === 'status') header.textContent = 'Action Status';

    table.querySelectorAll('tbody tr').forEach((row) => {
      const cell = row.children[statusIndex];
      if (!cell || cell.dataset.statusEnhanced === 'true') return;

      const value = text(cell);
      cell.dataset.statusEnhanced = 'true';
      cell.textContent = '';

      if (!value || value === '—') {
        const empty = document.createElement('span');
        empty.className = 'action-status-empty';
        empty.textContent = '—';
        cell.append(empty);
        return;
      }

      const pill = document.createElement('span');
      pill.className = `action-status-pill ${STATUS_CLASSES[normalized(value)] || 'other'}`;
      pill.textContent = canonicalStatus(value);
      cell.append(pill);
    });
  }

  function patchActionCenter() {
    document.querySelectorAll('.panel').forEach((panel) => {
      const title = normalized(text(panel.querySelector('h2')));
      if (title === 'actions' || title === 'action center') enhanceStatusCells(panel);
    });

    const pageTitle = [...document.querySelectorAll('h1')].find(
      (node) => normalized(text(node)) === 'action center',
    );
    if (!pageTitle) return;

    const pageSubtitle = pageTitle.parentElement?.querySelector('p');
    if (pageSubtitle) pageSubtitle.textContent = 'Actions, owners, due dates and action statuses from Retention';

    const filterBar = document.querySelector('.action-filters');
    if (filterBar) {
      ensureStatusOptions(filterBar);

      if (!filterBar.querySelector('.action-filter-title')) {
        const title = document.createElement('strong');
        title.className = 'action-filter-title';
        title.textContent = 'Action filters';
        filterBar.prepend(title);
      }

      if (!filterBar.querySelector('.action-filter-clear')) {
        const clear = document.createElement('button');
        clear.type = 'button';
        clear.className = 'clear action-filter-clear';
        clear.textContent = 'Clear';
        clear.addEventListener('click', () => {
          filterBar.querySelectorAll('select').forEach((select) => dispatchChange(select, 'All'));
        });
        filterBar.append(clear);
      }
    }

    const actionPanel = [...document.querySelectorAll('.panel')].find(
      (panel) => normalized(text(panel.querySelector('h2'))) === 'action center',
    );
    const subtitle = actionPanel?.querySelector('.panel-head p');
    if (subtitle) subtitle.textContent = 'Action Status supports Done, Postponed, Cancelled, To Do and N/A.';

    document.querySelectorAll('.kpi-grid.four .kpi span').forEach((label) => {
      const current = normalized(text(label));
      if (current === 'actions') label.textContent = 'Total Actions';
      if (current === 'no due date') label.textContent = 'Missing Due Date';
    });
  }

  let queued = false;
  const schedulePatch = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      patchActionCenter();
    });
  };

  new MutationObserver(schedulePatch).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  window.addEventListener('load', schedulePatch);
  schedulePatch();
})();
