/**
 * Retention Command Center V2
 *
 * Sources:
 * - Read Summary: Target / Worst / Medium / Best only
 * - Read Retention: every operational detail
 *
 * Output:
 * - public/data/live-data.js for the React dashboard
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const RETENTION_TEAM = ["Fadi", "Jihad", "Faizan"];

const OWNER_ALIASES = {
  fadi: "Fadi",
  faizan: "Faizan",
  jehad: "Jihad",
  jihad: "Jihad",
  gihad: "Jihad",
};

function cleanText(value) {
  return String(value ?? "").trim();
}

function normalizeIdentity(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeOwner(value) {
  const raw = cleanText(value);
  return OWNER_ALIASES[raw.toLowerCase()] || raw;
}

function normalizeProduct(value) {
  const raw = cleanText(value);
  const key = raw.toLowerCase();
  if (key === "after hire" || key === "afterhire") return "AfterHire";
  if (key === "talentera") return "Talentera";
  if (key === "evalufy") return "Evalufy";
  return raw;
}

function normalizeRenewalStatus(value) {
  const raw = cleanText(value);
  const key = raw
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/pending\s*-\s*/g, "pending ")
    .replace(/pending-/g, "pending ")
    .trim();

  if (key === "renewed") return "Renewed";
  if (key === "lost") return "Lost";
  if (key.includes("high")) return "Pending High";
  if (key.includes("medium")) return "Pending Medium";
  if (key.includes("low")) return "Pending Low";
  return raw;
}

function parseMoney(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value) : 0;

  let text = String(value).trim();
  if (!text) return 0;
  if (text.includes("#REF!") || text.includes("#VALUE!") || text.includes("#DIV/0!")) return 0;

  const negative = text.startsWith("-") || (text.startsWith("(") && text.endsWith(")"));
  text = text
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/%/g, "")
    .replace(/[()]/g, "")
    .replace(/-/g, "")
    .trim();

  const number = Number(text);
  if (!Number.isFinite(number)) return 0;
  return Math.round(negative ? -number : number);
}

function rowValues(row) {
  return Object.entries(row)
    .filter(([key]) => key !== "row_number" && key !== "__rowNum__")
    .map(([, value]) => value);
}

function normalizeColumnName(value) {
  return cleanText(value).toLowerCase().replace(/\s+/g, " ");
}

function findColumnValue(row, candidates, fallback = "") {
  const keys = Object.keys(row).map((key) => ({
    original: key,
    normalized: normalizeColumnName(key),
  }));

  for (const candidate of candidates) {
    const wanted = normalizeColumnName(candidate);
    const exact = keys.find((key) => key.normalized === wanted);
    if (exact) return row[exact.original];
  }

  for (const candidate of candidates) {
    const wanted = normalizeColumnName(candidate);
    const partial = keys.find((key) => key.normalized.includes(wanted) || wanted.includes(key.normalized));
    if (partial) return row[partial.original];
  }

  return fallback;
}

function parseDueDate(value) {
  const raw = cleanText(value);
  if (!raw) return null;

  const fullDate = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (fullDate) {
    const [, month, day, year] = fullDate;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const isoDate = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoDate) {
    const [, year, month, day] = isoDate;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const dayMonth = raw.match(/^(\d{1,2})-(\d{1,2})$/);
  if (dayMonth) {
    const [, day, month] = dayMonth;
    return `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

function resolveActionOwner(ownerRaw, rm, csm) {
  const raw = cleanText(ownerRaw);
  if (raw.toLowerCase() === "rm") return rm;
  if (raw.toLowerCase() === "csm") return csm;
  return raw;
}

function buildEntityStats(accounts, field) {
  const result = {};

  for (const account of accounts) {
    const name = account[field] || "Unassigned";
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

    const entity = result[name];
    entity.accountsCount += 1;
    entity.updatedValue += Number(account.updatedValue || 0);

    if (account.renewalStatus === "Renewed") entity.renewed += Number(account.updatedValue || 0);
    if (account.renewalStatus === "Pending High") entity.pendingHigh += Number(account.updatedValue || 0);
    if (account.renewalStatus === "Pending Medium") entity.pendingMedium += Number(account.updatedValue || 0);
    if (account.renewalStatus === "Pending Low") entity.pendingLow += Number(account.updatedValue || 0);
    if (account.renewalStatus === "Lost") entity.lost += Number(account.updatedValue || 0);
  }

  return result;
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function readRowsFromFirstAvailableNode(nodeNames) {
  for (const nodeName of nodeNames) {
    try {
      const rows = $items(nodeName).map((item) => item.json);
      if (rows.length) return rows;
    } catch (error) {
      // Try the next possible node name.
    }
  }
  throw new Error(`None of these source nodes returned rows: ${nodeNames.join(", ")}`);
}

const summaryRowsRaw = readRowsFromFirstAvailableNode(["Read Summary1", "Read Summary"]);
const retentionRowsRaw = readRowsFromFirstAvailableNode(["Read Retention1", "Read Retention"]);

if (!summaryRowsRaw.length) throw new Error("Read Summary returned 0 rows.");
if (!retentionRowsRaw.length) throw new Error("Read Retention returned 0 rows.");

function parseManagementForecast(summaryRows) {
  const rms = {};
  let insideClosingYear = false;

  for (const row of summaryRows) {
    const values = rowValues(row);
    const label = cleanText(values[0]);
    const key = label.toLowerCase();

    if (key === "property of closing the year") {
      insideClosingYear = true;
      continue;
    }

    if (!insideClosingYear) continue;
    if (key.trim() === "delta") break;

    const rm = normalizeOwner(label);
    if (!RETENTION_TEAM.includes(rm)) continue;

    rms[rm] = {
      rm,
      target: parseMoney(values[1]),
      worst: parseMoney(values[2]),
      medium: parseMoney(values[4]),
      best: parseMoney(values[6]),
    };
  }

  const team = { rm: "Team", target: 0, worst: 0, medium: 0, best: 0 };
  for (const rm of RETENTION_TEAM) {
    const row = rms[rm];
    if (!row) continue;
    team.target += row.target;
    team.worst += row.worst;
    team.medium += row.medium;
    team.best += row.best;
  }

  return { team, rms };
}

function accountDedupKey(account) {
  const client = normalizeIdentity(account.clientName);
  const product = normalizeIdentity(account.product) || "no-product";
  return client ? `${client}|${product}|2026` : `row|${account.id}`;
}

function accountCompleteness(account) {
  return [
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
}

function pickText(preferred, fallback, field) {
  return cleanText(preferred?.[field]) || cleanText(fallback?.[field]);
}

function pickMoney(preferred, fallback, field) {
  const preferredValue = Number(preferred?.[field] || 0);
  if (preferredValue !== 0) return preferredValue;
  return Number(fallback?.[field] || 0);
}

function mergeNotes(...values) {
  return [...new Set(values.map(cleanText).filter(Boolean))].join(" · ");
}

function mergeRenewalSchedules(...schedules) {
  const byMonth = new Map();
  schedules.flat().filter(Boolean).forEach((event) => {
    const month = cleanText(event.month);
    if (!month) return;
    const key = `${event.year || 2026}|${month.toLowerCase()}`;
    const current = byMonth.get(key);
    if (!current || Math.abs(Number(event.amount || 0)) > Math.abs(Number(current.amount || 0))) {
      byMonth.set(key, { ...event, month, year: Number(event.year || 2026), amount: Number(event.amount || 0) });
    }
  });
  return [...byMonth.values()].sort((a, b) => Number(a.monthNumber || 0) - Number(b.monthNumber || 0));
}

function deduplicateAccounts(mappedAccounts) {
  const groups = new Map();
  const canonicalIdByRawId = {};

  for (const sourceAccount of mappedAccounts) {
    const key = accountDedupKey(sourceAccount);

    if (!groups.has(key)) {
      groups.set(key, {
        ...sourceAccount,
        sourceIds: [sourceAccount.id],
        renewalSchedule: mergeRenewalSchedules(sourceAccount.renewalSchedule || []),
      });
      continue;
    }

    const current = groups.get(key);
    const incomingWins = accountCompleteness(sourceAccount) > accountCompleteness(current)
      || (accountCompleteness(sourceAccount) === accountCompleteness(current)
        && Number(sourceAccount.rowNumber || 0) > Number(current.rowNumber || 0));
    const preferred = incomingWins ? sourceAccount : current;
    const fallback = incomingWins ? current : sourceAccount;
    const renewalSchedule = mergeRenewalSchedules(current.renewalSchedule || [], sourceAccount.renewalSchedule || []);

    groups.set(key, {
      ...current,
      ...preferred,
      id: current.id,
      rowNumber: Math.min(Number(current.rowNumber || Infinity), Number(sourceAccount.rowNumber || Infinity)),
      clientName: pickText(preferred, fallback, "clientName"),
      product: pickText(preferred, fallback, "product"),
      rm: pickText(preferred, fallback, "rm"),
      csm: pickText(preferred, fallback, "csm"),
      location: pickText(preferred, fallback, "location"),
      status: pickText(preferred, fallback, "status"),
      renewalStatus: pickText(preferred, fallback, "renewalStatus"),
      renewalStatusRaw: pickText(preferred, fallback, "renewalStatusRaw"),
      originalValue: pickMoney(preferred, fallback, "originalValue"),
      originalValueRaw: pickText(preferred, fallback, "originalValueRaw"),
      updatedValue: pickMoney(preferred, fallback, "updatedValue"),
      updatedValueRaw: pickText(preferred, fallback, "updatedValueRaw"),
      difference: pickMoney(preferred, fallback, "difference"),
      differenceRaw: pickText(preferred, fallback, "differenceRaw"),
      notes: mergeNotes(current.notes, sourceAccount.notes),
      renewalSchedule,
      renewalMonths: renewalSchedule.map((event) => event.month),
      monthlyTotal: renewalSchedule.reduce((total, event) => total + Number(event.amount || 0), 0),
      sourceIds: [...new Set([...(current.sourceIds || []), sourceAccount.id])],
    });
  }

  const accounts = [...groups.values()];
  const canonicalByKey = Object.fromEntries(accounts.map((account) => [accountDedupKey(account), account]));
  mappedAccounts.forEach((account) => {
    canonicalIdByRawId[account.id] = canonicalByKey[accountDedupKey(account)]?.id || account.id;
  });

  return { accounts, canonicalIdByRawId };
}

function isManualTotalAccount(account) {
  const totalLabels = new Set(["total", "grand total", "subtotal", "total renewal", "renewal total"]);
  const identityLabel = normalizeIdentity(account.clientName || account.status || account.product || account.notes);
  const hasTotalLabel = totalLabels.has(identityLabel);
  const hasNoIdentity = !cleanText(account.clientName) && !cleanText(account.product) && !cleanText(account.location);
  const hasNoOwners = !cleanText(account.rm) && !cleanText(account.csm);
  const hasNoStatus = !cleanText(account.status) && !cleanText(account.renewalStatus) && !cleanText(account.renewalStatusRaw);
  const hasMoney = Number(account.updatedValue || 0) !== 0 || Number(account.originalValue || 0) !== 0 || Number(account.monthlyTotal || 0) !== 0;
  return hasTotalLabel || (hasNoIdentity && hasNoOwners && hasNoStatus && hasMoney);
}

const management = parseManagementForecast(summaryRowsRaw);

const mappedAccounts = retentionRowsRaw
  .map((row, index) => {
    const rm = normalizeOwner(findColumnValue(row, ["RM 2026", "RM"]));
    const csm = cleanText(findColumnValue(row, ["CSM Name", "CSM"]));
    const updatedValueRaw = cleanText(findColumnValue(row, ["Updated 2026 Value", "Updated 2026 Value "]));

    const renewalSchedule = MONTHS
      .map((month, monthIndex) => ({
        month,
        monthNumber: monthIndex + 1,
        year: 2026,
        amount: parseMoney(findColumnValue(row, [month])),
      }))
      .filter((event) => event.amount !== 0);

    return {
      id: `ret-${index + 2}`,
      rowNumber: index + 2,
      status: cleanText(findColumnValue(row, ["Status (Abdullah)", "Status"])),
      product: normalizeProduct(findColumnValue(row, ["Product"])),
      csm,
      location: cleanText(findColumnValue(row, ["Location", "Country", "Region"])),
      rm,
      clientName: cleanText(findColumnValue(row, ["Client name", "Client Name", "Company"])),
      originalValueRaw: cleanText(findColumnValue(row, ["Original 2026 Value"])),
      originalValue: parseMoney(findColumnValue(row, ["Original 2026 Value"])),
      updatedValueRaw,
      updatedValue: parseMoney(updatedValueRaw),
      renewalStatusRaw: cleanText(findColumnValue(row, ["Renewal Status"])),
      renewalStatus: normalizeRenewalStatus(findColumnValue(row, ["Renewal Status"])),
      renewalSchedule,
      renewalMonths: renewalSchedule.map((event) => event.month),
      monthlyTotal: renewalSchedule.reduce((total, event) => total + event.amount, 0),
      differenceRaw: cleanText(findColumnValue(row, ["Difference"])),
      difference: parseMoney(findColumnValue(row, ["Difference"])),
      notes: cleanText(findColumnValue(row, ["Notes"])),
    };
  })
  .filter((account) => account.clientName || account.updatedValue || account.renewalSchedule.length || account.notes);

const manualTotalAccounts = mappedAccounts.filter(isManualTotalAccount);
const sourceAccounts = mappedAccounts.filter((account) => !isManualTotalAccount(account));
const removedTotalRows = manualTotalAccounts.length;
const removedTotalRowValue = manualTotalAccounts.reduce((total, account) => total + Number(account.updatedValue || account.monthlyTotal || account.originalValue || 0), 0);

const { accounts: dedupedSourceAccounts, canonicalIdByRawId } = deduplicateAccounts(sourceAccounts);

const RECOGNIZED_RENEWAL_STATUSES = new Set(["Renewed", "Pending High", "Pending Medium", "Pending Low", "Lost"]);
const recognizedAccounts = dedupedSourceAccounts.filter((account) => RECOGNIZED_RENEWAL_STATUSES.has(account.renewalStatus));
const unclassifiedAccounts = dedupedSourceAccounts.filter((account) => !RECOGNIZED_RENEWAL_STATUSES.has(account.renewalStatus));

const recognizedTotal = recognizedAccounts.reduce((total, account) => total + Number(account.updatedValue || 0), 0);
const unclassifiedTotal = unclassifiedAccounts.reduce((total, account) => total + Number(account.updatedValue || 0), 0);
const mirroredValueTolerance = Math.max(2, Math.abs(recognizedTotal) * 0.00001);
const mirroredCountTolerance = Math.max(3, Math.ceil(recognizedAccounts.length * 0.05));

const mirroredBatchDetected =
  recognizedAccounts.length > 0 &&
  unclassifiedAccounts.length > 0 &&
  Math.abs(recognizedTotal - unclassifiedTotal) <= mirroredValueTolerance &&
  Math.abs(recognizedAccounts.length - unclassifiedAccounts.length) <= mirroredCountTolerance;

const accounts = mirroredBatchDetected ? recognizedAccounts : dedupedSourceAccounts;
const removedMirroredAccounts = mirroredBatchDetected ? unclassifiedAccounts.length : 0;
const removedMirroredValue = mirroredBatchDetected ? unclassifiedTotal : 0;
const accountById = Object.fromEntries(accounts.map((account) => [account.id, account]));

const actionsByKey = new Map();
retentionRowsRaw.forEach((row, index) => {
  const action = cleanText(findColumnValue(row, ["Action"]));
  if (!action) return;

  const rawAccountId = `ret-${index + 2}`;
  const accountId = canonicalIdByRawId[rawAccountId] || rawAccountId;
  const account = accountById[accountId];
  if (!account) return;

  const ownerRaw = cleanText(findColumnValue(row, ["Owner"]));
  const dueDateRaw = cleanText(findColumnValue(row, ["Due Date"]));
  const actionStatus = cleanText(findColumnValue(row, ["Action Status"]));

  const actionRecord = {
    id: `action-${index + 2}`,
    accountId,
    clientName: account.clientName || "",
    action,
    ownerRaw,
    owner: resolveActionOwner(ownerRaw, account.rm || "", account.csm || ""),
    dueDateRaw,
    dueDate: parseDueDate(dueDateRaw),
    actionStatus,
    notes: account.notes || "",
    rm: account.rm || "",
    csm: account.csm || "",
    product: account.product || "",
    location: account.location || "",
    renewalStatus: account.renewalStatus || "",
    updatedValue: account.updatedValue || 0,
    renewalSchedule: account.renewalSchedule || [],
  };

  const actionKey = [
    accountId,
    normalizeIdentity(action),
    normalizeIdentity(actionRecord.owner),
    dueDateRaw,
    normalizeIdentity(actionStatus),
  ].join("|");

  if (!actionsByKey.has(actionKey)) actionsByKey.set(actionKey, actionRecord);
});
const actions = [...actionsByKey.values()];

const dashboardData = {
  generatedAt: new Date().toISOString(),
  source: {
    summary: "Target, Worst, Medium and Best only from Summary",
    retention: "All operational details from Retention",
    refreshType: "n8n Google Sheets scheduled sync",
    totalRowCorrection: removedTotalRows ? "Applied: removed manual total/subtotal rows" : "Not required",
    mirroredBatchCorrection: mirroredBatchDetected ? "Applied: removed duplicated unclassified batch" : "Not required",
  },
  management,
  accounts,
  actions,
  rms: buildEntityStats(accounts, "rm"),
  csms: buildEntityStats(accounts, "csm"),
  corrections: {
    sourceRows: retentionRowsRaw.length,
    mappedAccounts: mappedAccounts.length,
    removedTotalRows,
    removedTotalRowValue,
    dedupedAccounts: dedupedSourceAccounts.length,
    mirroredBatchDetected,
    removedMirroredAccounts,
    removedMirroredValue,
    finalAccounts: accounts.length,
  },
  filters: {
    rms: uniqueSorted(accounts.map((account) => account.rm)),
    csms: uniqueSorted(accounts.map((account) => account.csm)),
    products: uniqueSorted(accounts.map((account) => account.product)),
    locations: uniqueSorted(accounts.map((account) => account.location)),
    renewalStatuses: uniqueSorted(accounts.map((account) => account.renewalStatus)),
    renewalMonths: MONTHS,
    actionOwners: uniqueSorted(actions.map((action) => action.owner)),
    actionStatuses: uniqueSorted(actions.map((action) => action.actionStatus)),
  },
};

const generatedFileContent =
  `window.DASHBOARD_DATA = ${JSON.stringify(dashboardData, null, 2)};\n` +
  `window.DASHBOARD_DATA_LOADED_AT = ${JSON.stringify(new Date().toISOString())};\n`;

return [
  {
    json: {
      repositoryOwner: "amohamed-alt",
      repositoryName: "Private-Dashboard",
      repositoryFullName: "amohamed-alt/Private-Dashboard",
      path: "public/data/live-data.js",
      branch: "main",
      commitMessage: `Update React retention dashboard data - ${new Date().toISOString()}`,
      generatedFileContent,
      summary: {
        sourceRows: retentionRowsRaw.length,
        mappedAccounts: mappedAccounts.length,
        removedTotalRows,
        removedTotalRowValue,
        accounts: accounts.length,
        removedMirroredAccounts,
        removedMirroredValue,
        mirroredBatchDetected,
        recognizedTotal,
        unclassifiedTotal,
        actions: actions.length,
        rms: Object.keys(dashboardData.rms).length,
        csms: Object.keys(dashboardData.csms).length,
        managementTarget: management.team.target,
        managementWorst: management.team.worst,
        managementMedium: management.team.medium,
        managementBest: management.team.best,
      },
    },
  },
];
