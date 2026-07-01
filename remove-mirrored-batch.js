(() => {
  const data = window.DASHBOARD_DATA;
  if (!data || !Array.isArray(data.accounts)) return;

  const VALID_STATUSES = new Set([
    'Renewed',
    'Pending High',
    'Pending Medium',
    'Pending Low',
    'Lost',
  ]);

  const value = (account) => {
    const amount = Number(account?.updatedValue || 0);
    return Number.isFinite(amount) ? amount : 0;
  };

  const known = data.accounts.filter((account) => VALID_STATUSES.has(String(account?.renewalStatus || '').trim()));
  const unknown = data.accounts.filter((account) => !VALID_STATUSES.has(String(account?.renewalStatus || '').trim()));

  const knownTotal = known.reduce((sum, account) => sum + value(account), 0);
  const unknownTotal = unknown.reduce((sum, account) => sum + value(account), 0);
  const totalTolerance = Math.max(2, Math.abs(knownTotal) * 0.00001);
  const countTolerance = Math.max(3, Math.ceil(known.length * 0.05));

  const isMirroredBatch =
    known.length > 0 &&
    unknown.length > 0 &&
    Math.abs(knownTotal - unknownTotal) <= totalTolerance &&
    Math.abs(known.length - unknown.length) <= countTolerance;

  if (!isMirroredBatch) return;

  const keptIds = new Set(known.map((account) => account.id));
  data.accounts = known;
  data.actions = (Array.isArray(data.actions) ? data.actions : []).filter((action) => keptIds.has(action.accountId));
  data.mirroredBatchFix = {
    applied: true,
    removedAccounts: unknown.length,
    removedValue: unknownTotal,
    reason: 'A second Retention batch had the same total value but no recognized renewal status.',
  };

  window.DASHBOARD_DATA = data;
  console.warn('[Retention Dashboard] Removed mirrored Retention batch', data.mirroredBatchFix);
})();
