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

const summaryRowsRaw = $items("Read Summary").map((item) => item.json);
const retentionRowsRaw = $items("Read Retention").map((item) => item.json);

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

const management = parseManagementForecast(summaryRowsRaw);

const accounts = retentionRowsRaw.map((row, index) => {
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
});

const accountById = Object.fromEntries(accounts.map((account) => [account.id, account]));

const actions = retentionRowsRaw
  .map((row, index) => {
    const action = cleanText(findColumnValue(row, ["Action"]));
    if (!action) return null;

    const accountId = `ret-${index + 2}`;
    const account = accountById[accountId];
    const ownerRaw = cleanText(findColumnValue(row, ["Owner"]));
    const dueDateRaw = cleanText(findColumnValue(row, ["Due Date"]));

    return {
      id: `action-${index + 2}`,
      accountId,
      clientName: account?.clientName || "",
      action,
      ownerRaw,
      owner: resolveActionOwner(ownerRaw, account?.rm || "", account?.csm || ""),
      dueDateRaw,
      dueDate: parseDueDate(dueDateRaw),
      actionStatus: cleanText(findColumnValue(row, ["Action Status"])),
      notes: account?.notes || "",
      rm: account?.rm || "",
      csm: account?.csm || "",
      product: account?.product || "",
      location: account?.location || "",
      renewalStatus: account?.renewalStatus || "",
      updatedValue: account?.updatedValue || 0,
      renewalSchedule: account?.renewalSchedule || [],
    };
  })
  .filter(Boolean);

const dashboardData = {
  generatedAt: new Date().toISOString(),
  source: {
    summary: "Target, Worst, Medium and Best only from Summary",
    retention: "All operational details from Retention",
    refreshType: "n8n Google Sheets scheduled sync",
  },
  management,
  accounts,
  actions,
  rms: buildEntityStats(accounts, "rm"),
  csms: buildEntityStats(accounts, "csm"),
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
        accounts: accounts.length,
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
