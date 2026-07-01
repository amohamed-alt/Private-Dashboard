(() => {
  const data = window.DASHBOARD_DATA;
  if (!data || !Array.isArray(data.accounts)) return;

  const YEAR = 2026;
  const normalize = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const number = (value) => {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const accountKey = (account) => {
    const client = normalize(account.clientName);
    const product = normalize(account.product) || 'no-product';
    return client ? `${client}|${product}|${YEAR}` : `row|${account.id || account.rowNumber}`;
  };

  const completeness = (account) => [
    account.renewalStatus,
    account.rm,
    account.csm,
    account.location,
    account.product,
    account.updatedValue,
    account.originalValue,
    account.notes,
    ...(account.renewalSchedule || []),
  ].filter(Boolean).length;

  const pickText = (preferred, fallback, field) => {
    const primary = String(preferred?.[field] || '').trim();
    return primary || String(fallback?.[field] || '').trim();
  };

  const pickNumber = (preferred, fallback, field) => {
    const primary = number(preferred?.[field]);
    if (primary !== 0) return primary;
    return number(fallback?.[field]);
  };

  const mergeNotes = (...values) => [...new Set(values
    .map((value) => String(value || '').trim())
    .filter(Boolean))]
    .join(' · ');

  const mergeSchedule = (...schedules) => {
    const byMonth = new Map();
    schedules.flat().filter(Boolean).forEach((event) => {
      const month = String(event.month || '').trim();
      if (!month) return;
      const year = Number(event.year || YEAR);
      const key = `${year}|${month.toLowerCase()}`;
      const current = byMonth.get(key);
      if (!current || Math.abs(number(event.amount)) > Math.abs(number(current.amount))) {
        byMonth.set(key, { ...event, month, year, amount: number(event.amount) });
      }
    });
    return [...byMonth.values()].sort((a, b) => number(a.monthNumber) - number(b.monthNumber));
  };

  const groups = new Map();
  const rawIdToKey = new Map();

  data.accounts.forEach((sourceAccount) => {
    const key = accountKey(sourceAccount);
    rawIdToKey.set(sourceAccount.id, key);

    if (!groups.has(key)) {
      groups.set(key, {
        ...sourceAccount,
        sourceIds: [sourceAccount.id].filter(Boolean),
        renewalSchedule: mergeSchedule(sourceAccount.renewalSchedule || []),
      });
      return;
    }

    const current = groups.get(key);
    const incomingWins = completeness(sourceAccount) > completeness(current)
      || (completeness(sourceAccount) === completeness(current)
        && number(sourceAccount.rowNumber) > number(current.rowNumber));
    const preferred = incomingWins ? sourceAccount : current;
    const fallback = incomingWins ? current : sourceAccount;
    const renewalSchedule = mergeSchedule(current.renewalSchedule || [], sourceAccount.renewalSchedule || []);

    groups.set(key, {
      ...current,
      ...preferred,
      id: current.id,
      rowNumber: Math.min(number(current.rowNumber) || Infinity, number(sourceAccount.rowNumber) || Infinity),
      clientName: pickText(preferred, fallback, 'clientName'),
      product: pickText(preferred, fallback, 'product'),
      rm: pickText(preferred, fallback, 'rm'),
      csm: pickText(preferred, fallback, 'csm'),
      location: pickText(preferred, fallback, 'location'),
      status: pickText(preferred, fallback, 'status'),
      renewalStatus: pickText(preferred, fallback, 'renewalStatus'),
      renewalStatusRaw: pickText(preferred, fallback, 'renewalStatusRaw'),
      originalValue: pickNumber(preferred, fallback, 'originalValue'),
      originalValueRaw: pickText(preferred, fallback, 'originalValueRaw'),
      updatedValue: pickNumber(preferred, fallback, 'updatedValue'),
      updatedValueRaw: pickText(preferred, fallback, 'updatedValueRaw'),
      difference: pickNumber(preferred, fallback, 'difference'),
      differenceRaw: pickText(preferred, fallback, 'differenceRaw'),
      notes: mergeNotes(current.notes, sourceAccount.notes),
      renewalSchedule,
      renewalMonths: renewalSchedule.map((event) => event.month),
      monthlyTotal: renewalSchedule.reduce((sum, event) => sum + number(event.amount), 0),
      sourceIds: [...new Set([...(current.sourceIds || []), sourceAccount.id].filter(Boolean))],
    });
  });

  const accounts = [...groups.values()];
  const canonicalByKey = new Map(accounts.map((account) => [accountKey(account), account]));
  const canonicalIdByRawId = new Map();
  rawIdToKey.forEach((key, rawId) => {
    canonicalIdByRawId.set(rawId, canonicalByKey.get(key)?.id || rawId);
  });
  const accountById = new Map(accounts.map((account) => [account.id, account]));

  const actionMap = new Map();
  (Array.isArray(data.actions) ? data.actions : []).forEach((sourceAction) => {
    const accountId = canonicalIdByRawId.get(sourceAction.accountId) || sourceAction.accountId;
    const account = accountById.get(accountId);
    const action = {
      ...sourceAction,
      accountId,
      clientName: account?.clientName || sourceAction.clientName || '',
      rm: account?.rm || sourceAction.rm || '',
      csm: account?.csm || sourceAction.csm || '',
      product: account?.product || sourceAction.product || '',
      location: account?.location || sourceAction.location || '',
      renewalStatus: account?.renewalStatus || sourceAction.renewalStatus || '',
      updatedValue: account?.updatedValue || 0,
      renewalSchedule: account?.renewalSchedule || [],
    };
    const key = [
      accountId,
      normalize(action.action),
      normalize(action.owner),
      String(action.dueDate || action.dueDateRaw || '').trim(),
      normalize(action.actionStatus),
    ].join('|');
    if (!actionMap.has(key)) actionMap.set(key, action);
  });
  const actions = [...actionMap.values()];

  const buildStats = (field) => {
    const result = {};
    accounts.forEach((account) => {
      const name = account[field] || 'Unassigned';
      if (!result[name]) {
        result[name] = {
          name,
          accountsCount: 0,
          updatedValue: 0,
          renewed: 0,
          pendingHigh: 0,
          pendingMedium: 0,
          pendingLow: 0,
          lost: 0,
        };
      }
      const row = result[name];
      const value = number(account.updatedValue);
      row.accountsCount += 1;
      row.updatedValue += value;
      if (account.renewalStatus === 'Renewed') row.renewed += value;
      if (account.renewalStatus === 'Pending High') row.pendingHigh += value;
      if (account.renewalStatus === 'Pending Medium') row.pendingMedium += value;
      if (account.renewalStatus === 'Pending Low') row.pendingLow += value;
      if (account.renewalStatus === 'Lost') row.lost += value;
    });
    return result;
  };

  const unique = (values) => [...new Set(values.filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b)));

  const rawAccountCount = data.accounts.length;
  data.accounts = accounts;
  data.actions = actions;
  data.rms = buildStats('rm');
  data.csms = buildStats('csm');
  data.filters = {
    ...(data.filters || {}),
    rms: unique(accounts.map((account) => account.rm)),
    csms: unique(accounts.map((account) => account.csm)),
    products: unique(accounts.map((account) => account.product)),
    locations: unique(accounts.map((account) => account.location)),
    renewalStatuses: unique(accounts.map((account) => account.renewalStatus)),
    actionOwners: unique(actions.map((action) => action.owner)),
    actionStatuses: unique(actions.map((action) => action.actionStatus)),
  };
  data.deduplication = {
    key: 'normalized client + product + year',
    year: YEAR,
    sourceAccounts: rawAccountCount,
    uniqueAccounts: accounts.length,
    removedDuplicates: rawAccountCount - accounts.length,
  };

  window.DASHBOARD_DATA = data;
  console.info('[Retention Dashboard] Deduplicated accounts', data.deduplication);
})();
