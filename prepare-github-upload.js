const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const RETENTION_TEAM = ["Fadi", "Jihad", "Faizan"];
const OWNER_ALIASES = { fadi: "Fadi", faizan: "Faizan", jehad: "Jihad", jihad: "Jihad", gihad: "Jihad" };
const PROJECTED_EXPENSES = 3600000;

function cleanText(value) { return String(value ?? "").trim(); }
function normalizeOwner(value) { return OWNER_ALIASES[cleanText(value).toLowerCase()] || cleanText(value); }
function normalizeProduct(value) {
  const key = cleanText(value).toLowerCase();
  if (key === "afterhire") return "AfterHire";
  if (key === "talentera") return "Talentera";
  if (key === "evalufy") return "Evalufy";
  return cleanText(value);
}
function normalizeRenewalStatus(value) {
  const status = cleanText(value).replace(/Pending\s*-\s*/i, "Pending ").replace(/\s+/g, " ").trim().toLowerCase();
  if (status === "renewed") return "Renewed";
  if (status === "lost") return "Lost";
  if (status.includes("high")) return "Pending High";
  if (status.includes("medium")) return "Pending Medium";
  if (status.includes("low")) return "Pending Low";
  return cleanText(value) || "Unknown";
}
function parseMoney(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  let text = String(value).trim();
  if (!text || text.toLowerCase() === "nan") return 0;
  if (/#REF!|#VALUE!|#DIV\/0!/i.test(text)) return 0;
  let negative = text.startsWith("-") || (text.startsWith("(") && text.endsWith(")"));
  text = text.replace(/[$,%()\s]/g, "").replace(/-/g, "").replace(/,/g, "");
  const number = Number(text);
  if (!Number.isFinite(number)) return 0;
  return negative ? -number : number;
}
function hasFormulaError(value) { return /#REF!|#VALUE!|#DIV\/0!/i.test(String(value ?? "")); }
function roundMoney(value) { return Math.round(Number(value || 0)); }
function sum(rows, fn) { return roundMoney(rows.reduce((total, row) => total + fn(row), 0)); }
function groupBy(rows, fn) {
  return rows.reduce((acc, row) => {
    const key = fn(row) || "Unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});
}

const summaryRows = $items("Read Summary").map(item => item.json);
const retentionRowsRaw = $items("Read Retention").map(item => item.json);

const summaryNameCol = "Unnamed: 0";
const summaryCols = {
  acqTarget: "Target",
  retTarget: "Unnamed: 2",
  totalTarget: "Unnamed: 3",
  bookedRet: "Actual",
  bookedAcq: "Unnamed: 5",
  cashedRet: "Unnamed: 6",
  cashedAcq: "Unnamed: 7",
  totalBooking: "Unnamed: 8",
  totalCashing: "Unnamed: 9",
  receivables: "Receivables \n(booked - cashed) + last year load",
  confirmedRevenue: "Cashed YTD + Prospective Receivables"
};

const summaryPeopleNames = ["Ursula", "Marita", "Zain", "Ahmed", "Mohammed", "Jehad", "Jihad", "Fadi", "Faizan", "Bandar"];
const seenSummaryNames = new Set();
const summaryPeople = summaryRows
  .filter(row => {
    const name = cleanText(row[summaryNameCol]);
    if (!summaryPeopleNames.includes(name) || seenSummaryNames.has(name)) return false;
    seenSummaryNames.add(name);
    return true;
  })
  .map(row => ({
    owner: normalizeOwner(row[summaryNameCol]),
    sourceName: cleanText(row[summaryNameCol]),
    acqTarget: roundMoney(parseMoney(row[summaryCols.acqTarget])),
    retTarget: roundMoney(parseMoney(row[summaryCols.retTarget])),
    totalTarget: roundMoney(parseMoney(row[summaryCols.totalTarget])),
    bookedRet: roundMoney(parseMoney(row[summaryCols.bookedRet])),
    bookedAcq: roundMoney(parseMoney(row[summaryCols.bookedAcq])),
    cashedRet: roundMoney(parseMoney(row[summaryCols.cashedRet])),
    cashedAcq: roundMoney(parseMoney(row[summaryCols.cashedAcq])),
    totalBooking: roundMoney(parseMoney(row[summaryCols.totalBooking])),
    totalCashing: roundMoney(parseMoney(row[summaryCols.totalCashing])),
    receivables: roundMoney(parseMoney(row[summaryCols.receivables])),
    confirmedRevenue: roundMoney(parseMoney(row[summaryCols.confirmedRevenue]))
  }));

const retentionRows = retentionRowsRaw
  .map((row, index) => {
    const owner = normalizeOwner(row["RM 2026"]);
    const monthly = Object.fromEntries(MONTHS.map(month => [month, roundMoney(parseMoney(row[month]))]));
    const value2026 = roundMoney(parseMoney(row["2026 Value"]));
    const monthlyTotal = sum(MONTHS, month => monthly[month]);
    return {
      rowNumber: index + 2,
      status: cleanText(row["Status (Abdullah)"]),
      product: normalizeProduct(row["Product"]),
      csmName: cleanText(row["CSM Name"]),
      location: cleanText(row["Location"]),
      owner,
      clientName: cleanText(row["Client name"]),
      value2026,
      renewalStatus: normalizeRenewalStatus(row["Renewal Status"]),
      monthly,
      monthlyTotal,
      sheetTotal: roundMoney(parseMoney(row["Total"])),
      sheetDifference: roundMoney(parseMoney(row["Difference"])),
      valueVsMonthlyDiff: roundMoney(monthlyTotal - value2026)
    };
  })
  .filter(row => RETENTION_TEAM.includes(row.owner));

const summaryErrors = [];
summaryRows.forEach((row, index) => {
  Object.entries(row).forEach(([column, value]) => {
    if (hasFormulaError(value)) summaryErrors.push({ rowNumber: index + 2, column, value: String(value) });
  });
});

const totalTarget = sum(summaryPeople, row => row.totalTarget);
const totalBooking = sum(summaryPeople, row => row.totalBooking);
const totalCashing = sum(summaryPeople, row => row.totalCashing);
const totalReceivables = sum(summaryPeople, row => row.receivables);
const confirmedRevenue = roundMoney(totalCashing + totalReceivables);

const byStatus = {
  renewed: sum(retentionRows.filter(row => row.renewalStatus === "Renewed"), row => row.value2026),
  pendingHigh: sum(retentionRows.filter(row => row.renewalStatus === "Pending High"), row => row.value2026),
  pendingMedium: sum(retentionRows.filter(row => row.renewalStatus === "Pending Medium"), row => row.value2026),
  pendingLow: sum(retentionRows.filter(row => row.renewalStatus === "Pending Low"), row => row.value2026),
  lost: sum(retentionRows.filter(row => row.renewalStatus === "Lost"), row => row.value2026)
};

const scenarioValues = {
  worst: confirmedRevenue + byStatus.pendingHigh,
  medium: confirmedRevenue + byStatus.pendingHigh + byStatus.pendingMedium,
  best: confirmedRevenue + byStatus.pendingHigh + byStatus.pendingMedium + byStatus.pendingLow,
  outstanding: confirmedRevenue + byStatus.pendingHigh + byStatus.pendingMedium + byStatus.pendingLow
};

function scenarioModel(value, target = totalTarget) {
  const revenue = roundMoney(value);
  const gapToTarget = roundMoney(revenue - target);
  const netAfterExpenses = roundMoney(revenue - PROJECTED_EXPENSES);
  const achievementPct = target ? Number(((revenue / target) * 100).toFixed(1)) : 0;
  const marginPct = revenue ? Number(((netAfterExpenses / revenue) * 100).toFixed(1)) : 0;
  let status = "Critical";
  if (achievementPct >= 100 && netAfterExpenses > 0) status = "Safe";
  else if (achievementPct >= 80 && netAfterExpenses > 0) status = "Watch";
  return { revenue, gapToTarget, netAfterExpenses, achievementPct, marginPct, status };
}

const summaryByOwner = Object.fromEntries(summaryPeople.map(row => [row.owner, row]));
function ownerSummary(owner) {
  const rows = retentionRows.filter(row => row.owner === owner);
  const summary = summaryByOwner[owner] || {};
  const target = summary.retTarget || summary.totalTarget || 0;
  const cashedYtd = (summary.cashedRet || 0) + (summary.cashedAcq || 0);
  const receivables = summary.receivables || 0;
  const confirmed = roundMoney(cashedYtd + receivables);
  const renewed = sum(rows.filter(row => row.renewalStatus === "Renewed"), row => row.value2026);
  const pendingHigh = sum(rows.filter(row => row.renewalStatus === "Pending High"), row => row.value2026);
  const pendingMedium = sum(rows.filter(row => row.renewalStatus === "Pending Medium"), row => row.value2026);
  const pendingLow = sum(rows.filter(row => row.renewalStatus === "Pending Low"), row => row.value2026);
  const lost = sum(rows.filter(row => row.renewalStatus === "Lost"), row => row.value2026);
  const worst = confirmed + pendingHigh;
  const medium = worst + pendingMedium;
  const best = medium + pendingLow;
  return {
    owner,
    accountsCount: rows.length,
    target,
    totalValue: sum(rows, row => row.value2026),
    bookedYtd: (summary.bookedRet || 0) + (summary.bookedAcq || 0),
    cashedYtd,
    receivables,
    confirmedRevenue: confirmed,
    renewed,
    pendingHigh,
    pendingMedium,
    pendingLow,
    lost,
    forecasts: {
      worst: scenarioModel(worst, target),
      medium: scenarioModel(medium, target),
      best: scenarioModel(best, target),
      outstanding: scenarioModel(best, target)
    },
    topAccounts: [...rows].sort((a, b) => b.value2026 - a.value2026).slice(0, 15),
    pendingHighAccounts: rows.filter(row => row.renewalStatus === "Pending High").sort((a, b) => b.value2026 - a.value2026).slice(0, 15),
    riskyAccounts: rows.filter(row => row.renewalStatus === "Lost" || row.status.toLowerCase().includes("expected to be lost") || Math.abs(row.valueVsMonthlyDiff) > 1).sort((a, b) => Math.max(b.value2026, Math.abs(b.valueVsMonthlyDiff)) - Math.max(a.value2026, Math.abs(a.valueVsMonthlyDiff))).slice(0, 15)
  };
}

const owners = Object.fromEntries(RETENTION_TEAM.map(owner => [owner, ownerSummary(owner)]));
const byProduct = Object.entries(groupBy(retentionRows, row => row.product)).map(([product, rows]) => ({ product, accountsCount: rows.length, value: sum(rows, row => row.value2026) })).sort((a, b) => b.value - a.value);
const byMonth = MONTHS.map(month => ({ month, value: sum(retentionRows, row => row.monthly[month] || 0), accountsCount: retentionRows.filter(row => (row.monthly[month] || 0) !== 0).length }));
const byLocation = Object.entries(groupBy(retentionRows, row => row.location)).map(([location, rows]) => ({
  location,
  accountsCount: rows.length,
  value: sum(rows, row => row.value2026),
  renewed: sum(rows.filter(row => row.renewalStatus === "Renewed"), row => row.value2026),
  pendingHigh: sum(rows.filter(row => row.renewalStatus === "Pending High"), row => row.value2026),
  pendingMedium: sum(rows.filter(row => row.renewalStatus === "Pending Medium"), row => row.value2026),
  pendingLow: sum(rows.filter(row => row.renewalStatus === "Pending Low"), row => row.value2026),
  lost: sum(rows.filter(row => row.renewalStatus === "Lost"), row => row.value2026)
})).sort((a, b) => b.value - a.value);

const lostWithValue = retentionRows.filter(row => row.renewalStatus === "Lost" && row.value2026 > 0);
const expectedLost = retentionRows.filter(row => row.status.toLowerCase().includes("expected to be lost"));
const monthlyMismatches = retentionRows.filter(row => Math.abs(row.valueVsMonthlyDiff) > 1);
const zeroRenewed = retentionRows.filter(row => row.renewalStatus === "Renewed" && row.value2026 === 0);
const dataQuality = [];
if (summaryErrors.length) dataQuality.push({ severity: "critical", title: "Summary sheet contains formula errors", count: summaryErrors.length, financialImpact: null, examples: summaryErrors.slice(0, 20), recommendedFix: "Fix #REF!, #VALUE!, and #DIV/0! formulas in the Summary sheet." });
if (lostWithValue.length) dataQuality.push({ severity: "critical", title: "Lost accounts still carry 2026 value", count: lostWithValue.length, financialImpact: sum(lostWithValue, row => row.value2026), examples: lostWithValue.slice(0, 15).map(row => ({ rowNumber: row.rowNumber, owner: row.owner, clientName: row.clientName, value2026: row.value2026 })), recommendedFix: "Exclude confirmed Lost accounts from positive forecast or move them to a win-back scenario." });
if (monthlyMismatches.length) dataQuality.push({ severity: "warning", title: "2026 Value does not match monthly total", count: monthlyMismatches.length, financialImpact: sum(monthlyMismatches, row => Math.abs(row.valueVsMonthlyDiff)), examples: monthlyMismatches.slice(0, 15).map(row => ({ rowNumber: row.rowNumber, owner: row.owner, clientName: row.clientName, value2026: row.value2026, monthlyTotal: row.monthlyTotal, valueVsMonthlyDiff: row.valueVsMonthlyDiff })), recommendedFix: "Reconcile official 2026 Value with Jan-Dec distribution." });
if (zeroRenewed.length) dataQuality.push({ severity: "warning", title: "Renewed accounts with zero value", count: zeroRenewed.length, financialImpact: 0, examples: zeroRenewed.slice(0, 15).map(row => ({ rowNumber: row.rowNumber, owner: row.owner, clientName: row.clientName, product: row.product })), recommendedFix: "Confirm whether these are true zero-value renewals or missing values." });
if (expectedLost.length) dataQuality.push({ severity: "warning", title: "Expected to Be Lost accounts need separate risk handling", count: expectedLost.length, financialImpact: sum(expectedLost, row => row.value2026), examples: expectedLost.slice(0, 15).map(row => ({ rowNumber: row.rowNumber, owner: row.owner, clientName: row.clientName, value2026: row.value2026, renewalStatus: row.renewalStatus })), recommendedFix: "Keep Expected to Be Lost accounts in a risk register." });

const actions = [];
retentionRows.filter(row => row.renewalStatus === "Pending High" && row.value2026 >= 30000).sort((a, b) => b.value2026 - a.value2026).slice(0, 20).forEach(row => actions.push({ priority: "High", owner: row.owner, account: row.clientName, value: row.value2026, issue: "High-value Pending High renewal", recommendedAction: "Immediate follow-up. Confirm renewal timeline, owner next step, and expected cashing month." }));
monthlyMismatches.sort((a, b) => Math.abs(b.valueVsMonthlyDiff) - Math.abs(a.valueVsMonthlyDiff)).slice(0, 15).forEach(row => actions.push({ priority: "High", owner: row.owner, account: row.clientName, value: Math.abs(row.valueVsMonthlyDiff), issue: `2026 Value differs from monthly total by ${row.valueVsMonthlyDiff}`, recommendedAction: "Reconcile official value vs monthly distribution before management review." }));
lostWithValue.sort((a, b) => b.value2026 - a.value2026).slice(0, 15).forEach(row => actions.push({ priority: "High", owner: row.owner, account: row.clientName, value: row.value2026, issue: "Lost account still has positive value", recommendedAction: "Remove from active forecast or move to separate win-back scenario." }));

const dashboardData = {
  generatedAt: new Date().toISOString(),
  source: { summaryRows: summaryRows.length, retentionRows: retentionRows.length, refreshType: "n8n scheduled sync", refreshEveryHours: 12 },
  executive: { totalTarget, totalBooking, totalCashing, totalReceivables, confirmedRevenue, projectedExpenses: PROJECTED_EXPENSES, scenarios: Object.fromEntries(Object.entries(scenarioValues).map(([key, value]) => [key, scenarioModel(value)])) },
  retention: { team: RETENTION_TEAM, accountsCount: retentionRows.length, totalValue: sum(retentionRows, row => row.value2026), byStatus, byProduct, byMonth, byLocation },
  owners,
  summaryPeople,
  accounts: retentionRows,
  actions,
  dataQuality
};
const generatedFileContent = `window.DASHBOARD_DATA = ${JSON.stringify(dashboardData, null, 2)};\nwindow.DASHBOARD_DATA_LOADED_AT = "${new Date().toISOString()}";\n`;
return [{ json: { repository: "amohamed-alt/Private-Dashboard", path: "data/live-data.js", commitMessage: `Update dashboard data - ${new Date().toISOString()}`, generatedFileContent, generatedAt: dashboardData.generatedAt, summary: { totalTarget, totalCashing, totalReceivables, confirmedRevenue, retentionAccounts: retentionRows.length, actions: actions.length, dataQualityIssues: dataQuality.length } } }];
