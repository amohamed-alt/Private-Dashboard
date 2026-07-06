(() => {
  const data = window.DASHBOARD_DATA;
  if (!data || !Array.isArray(data.accounts)) return;

  const VALID = new Set(['Renewed', 'Pending High', 'Pending Medium', 'Pending Low', 'Lost']);
  const num = (x) => {
    const n = Number(x || 0);
    return Number.isFinite(n) ? n : 0;
  };
  const txt = (x) => String(x || '').trim();
  const empty = (x) => !txt(x);
  const sumSchedule = (account) => (Array.isArray(account.renewalSchedule) ? account.renewalSchedule : [])
    .reduce((sum, event) => sum + num(event.amount), 0);

  const isManualTotalRow = (account) => (
    empty(account.clientName) &&
    empty(account.product) &&
    empty(account.location) &&
    empty(account.rm) &&
    empty(account.csm) &&
    empty(account.status) &&
    empty(account.renewalStatus) &&
    empty(account.renewalStatusRaw) &&
    (num(account.updatedValue) !== 0 || num(account.originalValue) !== 0)
  );

  const totalRowIds = new Set(data.accounts.filter(isManualTotalRow).map((account) => account.id));
  if (totalRowIds.size) {
    data.accounts = data.accounts.filter((account) => !totalRowIds.has(account.id));
    data.actions = (Array.isArray(data.actions) ? data.actions : []).filter((action) => !totalRowIds.has(action.accountId));
    data.removedManualTotalRows = { applied: true, removedAccounts: totalRowIds.size };
  }

  const validAccounts = data.accounts.filter((account) => VALID.has(txt(account.renewalStatus)));
  const invalidAccounts = data.accounts.filter((account) => !VALID.has(txt(account.renewalStatus)));
  const validTotal = validAccounts.reduce((sum, account) => sum + (sumSchedule(account) || num(account.updatedValue)), 0);
  const invalidTotal = invalidAccounts.reduce((sum, account) => sum + (sumSchedule(account) || num(account.updatedValue)), 0);

  const looksMirrored = validAccounts.length > 0 && invalidAccounts.length > 0 && Math.abs(validTotal - invalidTotal) <= Math.max(1000, validTotal * 0.03);
  if (!looksMirrored) {
    window.DASHBOARD_DATA = data;
    return;
  }

  const invalidIds = new Set(invalidAccounts.map((account) => account.id));
  data.accounts = data.accounts.map((account) => invalidIds.has(account.id) ? {
    ...account,
    originalUpdatedValue: account.updatedValue,
    originalRenewalSchedule: account.renewalSchedule,
    updatedValue: 0,
    renewalSchedule: [],
    renewalMonths: [],
    monthlyTotal: 0,
    ignoredFromTotals: true,
    ignoredReason: 'Duplicated mirrored batch without recognized renewal status',
  } : account);

  data.actions = (Array.isArray(data.actions) ? data.actions : []).map((action) => invalidIds.has(action.accountId) ? {
    ...action,
    updatedValue: 0,
    renewalSchedule: [],
    ignoredFromTotals: true,
  } : action);

  data.valueSanitization = {
    applied: true,
    validAccounts: validAccounts.length,
    sanitizedAccounts: invalidAccounts.length,
    keptValue: validTotal,
    removedMirroredValue: invalidTotal,
  };

  window.DASHBOARD_DATA = data;
})();
