(() => {
  const text = (node) => String(node?.textContent || '').trim().toLowerCase();

  function dispatchChange(select, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    if (setter) setter.call(select, value);
    else select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function patchActionCenter() {
    const pageTitle = [...document.querySelectorAll('h1')].find((node) => text(node) === 'action center');
    if (!pageTitle) return;

    const pageSubtitle = pageTitle.parentElement?.querySelector('p');
    if (pageSubtitle) pageSubtitle.textContent = 'Actions, owners and due-date tracking from Retention';

    const filterBar = document.querySelector('.action-filters');
    if (filterBar) {
      [...filterBar.querySelectorAll('.select')].forEach((field) => {
        const label = text(field.querySelector('span'));
        if (label === 'action status') field.remove();
        if (label === 'due timing') {
          [...field.querySelectorAll('option')].forEach((option) => {
            if (text(option) === 'completed') option.remove();
          });
        }
      });

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

    const actionPanel = [...document.querySelectorAll('.panel')].find((panel) => text(panel.querySelector('h2')) === 'action center');
    if (actionPanel) {
      const subtitle = actionPanel.querySelector('.panel-head p');
      if (subtitle) subtitle.textContent = 'Action, Owner and Due Date come from Retention. No Action Status field is used.';

      const table = actionPanel.querySelector('table');
      if (table) {
        table.classList.add('actions-table');
        const headers = [...table.querySelectorAll('thead th')];
        const statusIndex = headers.findIndex((header) => ['status', 'action status'].includes(text(header)));
        if (statusIndex >= 0) {
          headers[statusIndex].remove();
          table.querySelectorAll('tbody tr').forEach((row) => row.children[statusIndex]?.remove());
        }
      }
    }

    const kpiLabels = [...document.querySelectorAll('.kpi-grid.four .kpi span')];
    kpiLabels.forEach((label) => {
      if (text(label) === 'actions') label.textContent = 'Total Actions';
      if (text(label) === 'no due date') label.textContent = 'Missing Due Date';
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

  new MutationObserver(schedulePatch).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('load', schedulePatch);
  schedulePatch();
})();
