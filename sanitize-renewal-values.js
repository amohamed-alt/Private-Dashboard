(() => {
  const data = window.DASHBOARD_DATA;
  if (!data || !Array.isArray(data.accounts)) return;

  const VALID_RENEWAL_STATUSES = new Set([
    'Renewed',
    'Pending High',
    'Pending Medium',
    'Pending Low',
    'Lost',
  ]);

  const value = (input) => {
    const parsed = Number(input || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const sumSchedule = (account) => (Array.isArray(account.renewalSchedule) ? account.renewalSchedule : [])
    .reduce((sum, event) => sum + value(event.amount), 0);

  const validAccounts = data.accounts.filter((account) => VALID_RENEWAL_STATUSES.has(String(account.renewalStatus || '').trim()));
  const invalidAccounts = data.accounts.filter((account) => !VALID_RENEWAL_STATUSES.has(String(account.renewalStatus || '').trim()));
  const validScheduleTotal = validAccounts.reduce((sum, account) => sum + (sumSchedule(account) || value(account.updatedValue)), 0);
  const invalidScheduleTotal = invalidAccounts.reduce((sum, account) => sum + (sumSchedule(account) || value(account.updatedValue)), 0);

  const looksMirrored =
    validAccounts.length > 0 &&
    invalidAccounts.length > 0 &&
    Math.abs(validScheduleTotal - invalidScheduleTotal) <= Math.max(1000, validScheduleTotal * 0.03);

  if (!looksMirrored) return;

  const invalidIds = new Set(invalidAccounts.map((account) => account.id));
  data.accounts = data.accounts.map((account) => {
    if (!invalidIds.has(account.id)) return account;
    return {
      ...account,
      originalUpdatedValue: account.updatedValue,
      originalRenewalSchedule: account.renewalSchedule,
      updatedValue: 0,
      renewalSchedule: [],
      renewalMonths: [],
      monthlyTotal: 0,
      ignoredFromTotals: true,
      ignoredReason: 'Duplicated mirrored batch without a recognized renewal status',
    };
  });

  data.actions = (Array.isArray(data.actions) ? data.actions : []).map((action) => {
    if (!invalidIds.has(action.accountId)) return action;
    return {
      ...action,
      updatedValue: 0,
      renewalSchedule: [],
      ignoredFromTotals: true,
    };
  });

  data.valueSanitization = {
    applied: true,
    validAccounts: validAccounts.length,
    sanitizedAccounts: invalidAccounts.length,
    keptValue: validScheduleTotal,
    removedMirroredValue: invalidScheduleTotal,
    reason: 'A duplicated Retention batch was present with blank/unrecognized renewal statuses.',
  };

  window.DASHBOARD_DATA = data;
  console.warn('[Retention Dashboard] Sanitized duplicated renewal values', data.valueSanitization);
})();
