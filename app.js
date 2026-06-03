(() => {
  "use strict";

  const TEAM = ["Fadi", "Jihad", "Faizan"];
  const SCENARIOS = {
    worst: { label: "Worst", note: "Confirmed + Pending High" },
    medium: { label: "Medium", note: "Worst + Pending Medium" },
    best: { label: "Best", note: "Medium + Pending Low" },
    bestPlusLost: { label: "Best + Lost", note: "Audit only" }
  };

  const state = {
    tab: "overview",
    scenario: "medium",
    owner: "All",
    status: "All",
    product: "All",
    location: "All",
    search: "",
    actionFilter: "All"
  };

  const DATA = window.DASHBOARD_DATA;

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  function esc(value) {
    return String(value ?? "").replace(/[&<>'"]/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    }[char]));
  }

  function money(value) {
    const n = Number(value || 0);
    const sign = n < 0 ? "-" : "";
    return `${sign}$${Math.abs(Math.round(n)).toLocaleString()}`;
  }

  function shortMoney(value) {
    const n = Number(value || 0);
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return `${n < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${n < 0 ? "-" : ""}$${Math.round(abs / 1_000)}K`;
    return money(n);
  }

  function pct(value) {
    return `${Number(value || 0).toFixed(1)}%`;
  }

  function safeNumber(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  }

  function badge(label, type = "gray") {
    return `<span class="badge b-${type}">${esc(label)}</span>`;
  }

  function statusBadge(status) {
    const map = {
      "Renewed": "green",
      "Pending High": "blue",
      "Pending Medium": "amber",
      "Pending Low": "purple",
      "Lost": "red"
    };
    return badge(status || "Unknown", map[status] || "gray");
  }

  function forecastStatusBadge(status) {
    const type = status === "Safe" ? "green" : status === "Watch" ? "amber" : "red";
    return badge(status || "Critical", type);
  }

  function app() {
    return $("#app");
  }

  function ownersArray() {
    return TEAM.map(name => DATA?.owners?.[name]).filter(Boolean);
  }

  function accountsArray() {
    return Array.isArray(DATA?.accounts) ? DATA.accounts : [];
  }

  function byStatus() {
    return DATA?.retention?.byStatus || {};
  }

  function scenarioForOwner(ownerObj, scenarioKey = state.scenario) {
    if (!ownerObj) return { revenue: 0, gapToTarget: 0, achievementPct: 0, status: "Critical" };

    if (scenarioKey === "bestPlusLost") {
      const revenue = safeNumber(ownerObj?.calculatedForecasts?.bestIncludingLost || ownerObj?.forecasts?.outstanding?.revenue);
      const target = safeNumber(ownerObj.retentionTarget ?? ownerObj.target);
      return {
        revenue,
        gapToTarget: revenue - target,
        achievementPct: target ? (revenue / target) * 100 : 0,
        status: revenue >= target ? "Safe" : revenue >= target * 0.85 ? "Watch" : "Critical"
      };
    }

    const key = scenarioKey === "best" ? "best" : scenarioKey;
    return ownerObj?.forecasts?.[key] || { revenue: 0, gapToTarget: 0, achievementPct: 0, status: "Critical" };
  }

  function teamRetentionTarget() {
    return ownersArray().reduce((sum, owner) => sum + safeNumber(owner.retentionTarget ?? owner.target), 0);
  }

  function teamForecastValue(scenarioKey = state.scenario) {
    return ownersArray().reduce((sum, owner) => sum + safeNumber(scenarioForOwner(owner, scenarioKey).revenue), 0);
  }

  function teamGap(scenarioKey = state.scenario) {
    return teamForecastValue(scenarioKey) - teamRetentionTarget();
  }

  function teamAchievement(scenarioKey = state.scenario) {
    const target = teamRetentionTarget();
    return target ? (teamForecastValue(scenarioKey) / target) * 100 : 0;
  }

  function teamStatus(scenarioKey = state.scenario) {
    const achievement = teamAchievement(scenarioKey);
    if (achievement >= 100) return "Safe";
    if (achievement >= 85) return "Watch";
    return "Critical";
  }

  function allProducts() {
    return [...new Set(accountsArray().map(a => a.product).filter(Boolean))].sort();
  }

  function allLocations() {
    return [...new Set(accountsArray().map(a => a.location).filter(Boolean))].sort();
  }

  function filteredAccounts() {
    return accountsArray().filter(account => {
      if (state.owner !== "All" && account.owner !== state.owner) return false;
      if (state.status !== "All" && account.renewalStatus !== state.status) return false;
      if (state.product !== "All" && account.product !== state.product) return false;
      if (state.location !== "All" && account.location !== state.location) return false;
      if (state.search) {
        const q = state.search.toLowerCase();
        const haystack = `${account.clientName || ""} ${account.owner || ""} ${account.product || ""} ${account.location || ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }

  function setPage(title, subtitle = "") {
    $("#pageTitle").textContent = title;
    $("#pageSubtitle").textContent = subtitle;
  }

  function card(title, body, subtitle = "", extraClass = "") {
    return `
      <section class="card ${extraClass}">
        <div class="card-head">
          <div>
            <div class="card-title">${esc(title)}</div>
            ${subtitle ? `<div class="card-sub">${esc(subtitle)}</div>` : ""}
          </div>
        </div>
        <div class="card-body">${body}</div>
      </section>
    `;
  }

  function kpi(label, value, sub = "", color = "blue", extraClass = "") {
    return `
      <div class="kpi ${color} ${extraClass}">
        <div class="label">${esc(label)}</div>
        <div class="value">${value}</div>
        ${sub ? `<div class="sub">${sub}</div>` : ""}
      </div>
    `;
  }

  function table(headers, rows, emptyText = "No rows to show.") {
    if (!rows.length) {
      return `<div class="empty-state" style="box-shadow:none;border:0;padding:24px">${esc(emptyText)}</div>`;
    }

    return `
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              ${headers.map(header => `<th class="${header.num ? "num" : ""}">${esc(header.label)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>${rows.join("")}</tbody>
        </table>
      </div>
    `;
  }

  function renderMeta() {
    const generated = DATA?.generatedAt ? new Date(DATA.generatedAt) : null;
    $("#sidebarMeta").innerHTML = `
      Updated:<br>
      ${generated ? generated.toLocaleString() : "Not available"}<br><br>
      Retention rows: ${safeNumber(DATA?.retention?.accountsCount || DATA?.source?.retentionRows)}<br>
      Actions: ${safeNumber(DATA?.actions?.length)}<br>
      Data issues: ${safeNumber(DATA?.dataQuality?.length)}<br><br>
      Acquisition: hidden
    `;
  }

  function renderRiskBanner() {
    const status = teamStatus();
    const forecast = teamForecastValue();
    const target = teamRetentionTarget();
    const gap = forecast - target;
    const achievement = teamAchievement();
    const el = $("#riskBanner");

    el.className = `alert show ${status.toLowerCase()}`;
    el.innerHTML = `
      ${status === "Safe" ? "Safe" : status === "Watch" ? "Watch" : "Critical"} —
      ${SCENARIOS[state.scenario].label} retention forecast is <strong>${money(forecast)}</strong>
      (${pct(achievement)} of retention target). Gap: <strong>${money(gap)}</strong>.
      ${state.scenario === "bestPlusLost" ? "Best + Lost is shown as audit only." : SCENARIOS[state.scenario].note}.
    `;
  }

  function bindEvents() {
    $$(".nav-item").forEach(button => {
      button.addEventListener("click", () => {
        state.tab = button.dataset.tab;
        $$(".nav-item").forEach(item => item.classList.toggle("active", item === button));
        render();
      });
    });

    $$("#scenarioSwitch button").forEach(button => {
      button.addEventListener("click", () => {
        state.scenario = button.dataset.scenario;
        $$("#scenarioSwitch button").forEach(item => item.classList.toggle("active", item === button));
        render();
      });
    });
  }

  function render() {
    if (!DATA) {
      app().innerHTML = `
        <div class="empty-state">
          <h2>No dashboard data found</h2>
          <p>Make sure <code>window.DASHBOARD_DATA</code> exists inside <code>data/live-data.js</code>.</p>
        </div>
      `;
      return;
    }

    renderMeta();
    renderRiskBanner();

    if (state.tab === "overview") return renderOverview();
    if (state.tab === "forecast") return renderForecastView();
    if (TEAM.includes(state.tab)) return renderOwner(state.tab);
    if (state.tab === "compare") return renderCompare();
    if (state.tab === "accounts") return renderAccountsExplorer();
    if (state.tab === "actions") return renderActions();
    if (state.tab === "quality") return renderQuality();
  }

  function renderOverview() {
    const status = byStatus();
    const forecast = teamForecastValue();
    const target = teamRetentionTarget();
    const gap = forecast - target;

    setPage("Retention Overview", "Management view for Fadi, Jihad, and Faizan only.");

    app().innerHTML = `
      <div class="grid cols-5">
        ${kpi("Retention Target", money(target), "Acquisition hidden", "navy")}
        ${kpi("Selected Forecast", money(forecast), `${SCENARIOS[state.scenario].label} · Gap ${money(gap)}`, teamStatus().toLowerCase())}
        ${kpi("Renewed", money(status.renewed), "Closed renewal value", "green")}
        ${kpi("Pending High", money(status.pendingHigh), "High-confidence renewals", "blue")}
        ${kpi("Lost Impact", money(status.lost), "Shown separately, not in Best", "red")}
      </div>

      <div class="grid cols-2">
        ${card("Retention Funnel", renderStatusFunnel(), "Renewed, pending pipeline, and lost impact")}
        ${card("Monthly Renewal Concentration", renderMonthChart(), "Based on Jan-Dec distribution in Retention")}
      </div>

      ${card("Owner Performance Board", renderOwnerBoard(), `Scenario: ${SCENARIOS[state.scenario].label}`)}

      <div class="grid cols-2">
        ${card("Product Mix", renderProductBars(), "Talentera · AfterHire · Evalufy")}
        ${card("Location Mix", renderLocationBars(), "Top retention locations by 2026 value")}
      </div>
    `;
  }

  function renderForecastView() {
    setPage("Forecast View", "Same calculations, richer visual management layer.");

    const rows = Object.entries(SCENARIOS).map(([key, meta]) => {
      const forecast = teamForecastValue(key);
      const target = teamRetentionTarget();
      const ach = target ? forecast / target * 100 : 0;
      const gap = forecast - target;
      const status = ach >= 100 ? "Safe" : ach >= 85 ? "Watch" : "Critical";
      const type = status === "Safe" ? "green" : status === "Watch" ? "amber" : "red";
      return `
        <tr>
          <td>${badge(meta.label, key === "bestPlusLost" ? "red" : "blue")}</td>
          <td class="num">${money(forecast)}</td>
          <td class="num">${money(target)}</td>
          <td class="num">${money(gap)}</td>
          <td class="num">${pct(ach)}</td>
          <td>${badge(status, type)}</td>
          <td>${esc(meta.note)}</td>
        </tr>
      `;
    });

    app().innerHTML = `
      <div class="grid cols-4">
        ${scenarioKpi("Worst", "worst", "Confirmed + High")}
        ${scenarioKpi("Medium", "medium", "Worst + Medium")}
        ${scenarioKpi("Best", "best", "Excludes Lost")}
        ${scenarioKpi("Best + Lost", "bestPlusLost", "Audit comparison")}
      </div>

      ${card("Scenario Comparison", table([
        { label: "Scenario" },
        { label: "Forecast", num: true },
        { label: "Retention Target", num: true },
        { label: "Gap", num: true },
        { label: "Achievement", num: true },
        { label: "Status" },
        { label: "Logic" }
      ], rows))}

      ${card("What is driving the forecast?", renderStatusFunnel(), "No calculation changes; visualizing existing generated values")}
    `;
  }

  function scenarioKpi(label, key, sub) {
    const forecast = teamForecastValue(key);
    const target = teamRetentionTarget();
    const ach = target ? forecast / target * 100 : 0;
    const color = key === "bestPlusLost" ? "red" : ach >= 100 ? "green" : ach >= 85 ? "amber" : "blue";
    return kpi(label, money(forecast), `${pct(ach)} · ${sub}`, color);
  }

  function renderStatusFunnel() {
    const status = byStatus();
    const rows = [
      ["Renewed", status.renewed, "green"],
      ["Pending High", status.pendingHigh, "blue"],
      ["Pending Medium", status.pendingMedium, "amber"],
      ["Pending Low", status.pendingLow, "purple"],
      ["Lost", status.lost, "red"]
    ];

    const max = Math.max(...rows.map(row => safeNumber(row[1])), 1);

    return `
      <div class="stat-stack">
        ${rows.map(([label, value, color]) => `
          <div class="status-row">
            <div class="status-name">${esc(label)}</div>
            <div class="progress">
              <div class="progress-fill" style="width:${Math.max(2, safeNumber(value) / max * 100)}%; background: var(--${color});"></div>
            </div>
            <div class="status-value">${money(value)}</div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderMonthChart() {
    const months = DATA?.retention?.byMonth || [];
    const max = Math.max(...months.map(item => safeNumber(item.value)), 1);

    return `
      <div class="month-grid">
        ${months.map(item => {
          const value = safeNumber(item.value);
          const height = Math.max(4, value / max * 150);
          const color = value > max * .75 ? "var(--red)" : value > max * .45 ? "var(--amber)" : "var(--blue)";
          return `
            <div class="month-col" title="${esc(item.month)} · ${money(value)} · ${item.accountsCount || 0} accounts">
              <div class="month-value">${shortMoney(value)}</div>
              <div class="month-bar" style="height:${height}px; background:${color};"></div>
              <div class="month-name">${esc(item.month)}</div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderOwnerBoard() {
    return `
      <div class="grid cols-3">
        ${ownersArray().map(owner => {
          const f = scenarioForOwner(owner);
          const target = safeNumber(owner.retentionTarget ?? owner.target);
          const gap = safeNumber(f.revenue) - target;
          return `
            <div class="owner-card" onclick="window.__setRetentionTab('${esc(owner.owner)}')">
              <div class="owner-top">
                <div>
                  <div class="owner-name">${esc(owner.owner)}</div>
                  <div class="owner-sub">${owner.accountsCount || 0} accounts · ${pct(f.achievementPct)} achievement</div>
                </div>
                ${forecastStatusBadge(f.status)}
              </div>
              <div class="owner-metrics">
                <div class="owner-mini"><span>Retention Target</span><strong>${money(target)}</strong></div>
                <div class="owner-mini"><span>Forecast</span><strong>${money(f.revenue)}</strong></div>
                <div class="owner-mini"><span>Pending High</span><strong>${money(owner.pendingHigh)}</strong></div>
                <div class="owner-mini"><span>Gap</span><strong>${money(gap)}</strong></div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderProductBars() {
    const rows = DATA?.retention?.byProduct || [];
    const max = Math.max(...rows.map(item => safeNumber(item.value)), 1);

    return `
      <div class="chart-grid">
        ${rows.map(item => `
          <div class="horizontal-bar">
            <div class="bar-label">${esc(item.product)}</div>
            <div class="bar-track">
              <div class="bar-fill" style="width:${Math.max(2, safeNumber(item.value) / max * 100)}%; background: var(--blue);"></div>
            </div>
            <div class="bar-value">${money(item.value)}</div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderLocationBars() {
    const rows = (DATA?.retention?.byLocation || []).slice(0, 10);
    const max = Math.max(...rows.map(item => safeNumber(item.value)), 1);

    return `
      <div class="chart-grid">
        ${rows.map(item => `
          <div class="horizontal-bar">
            <div class="bar-label">${esc(item.location)}</div>
            <div class="bar-track">
              <div class="bar-fill" style="width:${Math.max(2, safeNumber(item.value) / max * 100)}%; background: var(--cyan);"></div>
            </div>
            <div class="bar-value">${money(item.value)}</div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderOwner(ownerName) {
    const owner = DATA?.owners?.[ownerName];
    if (!owner) {
      app().innerHTML = `<div class="empty-state">Owner not found.</div>`;
      return;
    }

    const f = scenarioForOwner(owner);
    const target = safeNumber(owner.retentionTarget ?? owner.target);
    const gap = safeNumber(f.revenue) - target;

    setPage(`${ownerName} — Retention`, `${owner.accountsCount || 0} accounts · ${SCENARIOS[state.scenario].label} forecast ${money(f.revenue)}`);

    app().innerHTML = `
      <div class="grid cols-5">
        ${kpi("Retention Target", money(target), "Acquisition hidden", "navy")}
        ${kpi("Cashing Ret", money(owner.cashedYtd), "From generated retention data", "green")}
        ${kpi("Booking Ret", money(owner.bookedYtd), "Booked retention value", "purple")}
        ${kpi("Receivables", money(owner.receivables), "Retention receivables", "amber")}
        ${kpi(`${SCENARIOS[state.scenario].label} Forecast`, money(f.revenue), `${pct(f.achievementPct)} · Gap ${money(gap)}`, f.status === "Safe" ? "green" : f.status === "Watch" ? "amber" : "red")}
      </div>

      <div class="grid cols-5">
        ${kpi("Renewed", money(owner.renewed), "", "green", "compact")}
        ${kpi("Pending High", money(owner.pendingHigh), "", "blue", "compact")}
        ${kpi("Pending Medium", money(owner.pendingMedium), "", "amber", "compact")}
        ${kpi("Pending Low", money(owner.pendingLow), "", "purple", "compact")}
        ${kpi("Lost Impact", money(owner.lost), "Shown separately", "red", "compact")}
      </div>

      ${card("Plan vs Calculated", renderOwnerPlanComparison(owner), "Best excludes Lost by default. Best + Lost is audit only.")}

      <div class="grid cols-2">
        ${card("Pending High Accounts", renderAccountsTable(owner.pendingHighAccounts || []), "Accounts expected to renew with high probability")}
        ${card("Top Accounts by 2026 Value", renderAccountsTable(owner.topAccounts || []), "Largest accounts under this owner")}
      </div>

      ${card("Risk / Data Issues for Owner", renderAccountsTable(owner.riskyAccounts || [], true), "Lost, expected lost, and value/monthly mismatches")}
    `;
  }

  function renderOwnerPlanComparison(owner) {
    const comparison = owner.planComparison;
    if (!comparison) {
      return `<div class="empty-state" style="box-shadow:none;border:0;padding:24px">No plan comparison available for this owner.</div>`;
    }

    const plan = comparison.plan || {};
    const calc = owner.calculatedForecasts || {};
    const deltas = comparison.deltas || {};

    const rows = [
      ["Worst", plan.worst, calc.worst, deltas.worst, "Confirmed + High"],
      ["Medium", plan.medium, calc.medium, deltas.medium, "Worst + Medium"],
      ["Best", plan.best, calc.bestExcludingLost, deltas.bestExcludingLost, "Lost excluded"],
      ["Best + Lost", plan.best, calc.bestIncludingLost, deltas.bestIncludingLost, "Audit only"]
    ].map(([scenario, planValue, calcValue, delta, logic]) => `
      <tr>
        <td>${esc(scenario)}</td>
        <td class="num">${money(planValue)}</td>
        <td class="num">${money(calcValue)}</td>
        <td class="num">${money(delta)}</td>
        <td>${esc(logic)}</td>
      </tr>
    `);

    return table([
      { label: "Scenario" },
      { label: "Plan", num: true },
      { label: "Calculated", num: true },
      { label: "Delta", num: true },
      { label: "Logic" }
    ], rows);
  }

  function renderCompare() {
    setPage("Plan vs Calculated", "Compares Summary plan with generated retention calculations.");

    const team = DATA?.planComparison;
    const teamRows = team ? [
      ["Target", team.plan?.target ?? team.retentionTarget ?? team.target, team.retentionTarget ?? team.target, team.deltas?.target ?? 0],
      ["Worst", team.plan?.worst, team.worst, team.deltas?.worst],
      ["Medium", team.plan?.medium, team.medium, team.deltas?.medium],
      ["Best", team.plan?.best, team.bestExcludingLost, team.deltas?.bestExcludingLost],
      ["Best + Lost", team.plan?.best, team.bestIncludingLost, team.deltas?.bestIncludingLost]
    ].map(([name, plan, calculated, delta]) => `
      <tr>
        <td>${esc(name)}</td>
        <td class="num">${money(plan)}</td>
        <td class="num">${money(calculated)}</td>
        <td class="num">${money(delta)}</td>
      </tr>
    `) : [];

    app().innerHTML = `
      ${card("Team Comparison", table([
        { label: "Metric" },
        { label: "Plan", num: true },
        { label: "Calculated", num: true },
        { label: "Delta", num: true }
      ], teamRows, "No team comparison available."), "Best + Lost is audit only.")}

      <div class="grid cols-3">
        ${ownersArray().map(owner => card(`${owner.owner} Comparison`, renderOwnerPlanComparison(owner))).join("")}
      </div>
    `;
  }

  function renderAccountsTable(rows, includeIssue = false) {
    const sorted = [...rows].sort((a, b) => safeNumber(b.value2026) - safeNumber(a.value2026));
    const tableRows = sorted.slice(0, 30).map(account => {
      const months = Object.entries(account.monthly || {})
        .filter(([, value]) => safeNumber(value) !== 0)
        .map(([month]) => month)
        .join(", ") || "—";

      const issue = account.status || (safeNumber(account.valueVsMonthlyDiff) ? `Diff ${money(account.valueVsMonthlyDiff)}` : "—");

      return `
        <tr>
          <td><strong>${esc(account.clientName)}</strong><div style="color:var(--muted);font-size:12px;margin-top:3px">${esc(account.location || "")}</div></td>
          <td>${esc(account.owner || "")}</td>
          <td>${esc(account.product || "")}</td>
          <td>${statusBadge(account.renewalStatus)}</td>
          <td class="num">${money(account.value2026)}</td>
          <td>${includeIssue ? esc(issue) : esc(months)}</td>
        </tr>
      `;
    });

    return table([
      { label: "Account" },
      { label: "Owner" },
      { label: "Product" },
      { label: "Status" },
      { label: "Value", num: true },
      { label: includeIssue ? "Issue" : "Month" }
    ], tableRows, "No matching accounts.");
  }

  function renderAccountsExplorer() {
    setPage("Accounts Explorer", "Filter all retention accounts by owner, status, product, location, and search.");

    const rows = filteredAccounts()
      .sort((a, b) => safeNumber(b.value2026) - safeNumber(a.value2026))
      .map(account => {
        const diff = safeNumber(account.valueVsMonthlyDiff);
        return `
          <tr>
            <td><strong>${esc(account.clientName)}</strong><div style="color:var(--muted);font-size:12px;margin-top:3px">${esc(account.location || "")}</div></td>
            <td>${esc(account.owner)}</td>
            <td>${esc(account.product)}</td>
            <td>${statusBadge(account.renewalStatus)}</td>
            <td class="num">${money(account.value2026)}</td>
            <td class="num">${money(account.monthlyTotal)}</td>
            <td class="num">${diff ? money(diff) : "—"}</td>
          </tr>
        `;
      });

    app().innerHTML = `
      ${renderAccountFilters()}
      ${card("Filtered Accounts", table([
        { label: "Account" },
        { label: "Owner" },
        { label: "Product" },
        { label: "Status" },
        { label: "2026 Value", num: true },
        { label: "Monthly Total", num: true },
        { label: "Diff", num: true }
      ], rows), `${rows.length} matching accounts`)}
    `;
  }

  function renderAccountFilters() {
    const statuses = ["All", "Renewed", "Pending High", "Pending Medium", "Pending Low", "Lost"];

    return `
      <div class="filters">
        <select class="select" onchange="window.__setFilter('owner', this.value)">
          ${["All", ...TEAM].map(item => `<option ${state.owner === item ? "selected" : ""}>${esc(item)}</option>`).join("")}
        </select>

        <select class="select" onchange="window.__setFilter('status', this.value)">
          ${statuses.map(item => `<option ${state.status === item ? "selected" : ""}>${esc(item)}</option>`).join("")}
        </select>

        <select class="select" onchange="window.__setFilter('product', this.value)">
          ${["All", ...allProducts()].map(item => `<option ${state.product === item ? "selected" : ""}>${esc(item)}</option>`).join("")}
        </select>

        <select class="select" onchange="window.__setFilter('location', this.value)">
          ${["All", ...allLocations()].map(item => `<option ${state.location === item ? "selected" : ""}>${esc(item)}</option>`).join("")}
        </select>

        <input class="input" placeholder="Search account..." value="${esc(state.search)}" oninput="window.__setFilter('search', this.value)" />

        ${statuses.slice(1).map(status => `
          <button class="filter-chip ${state.status === status ? "active" : ""}" onclick="window.__setFilter('status','${esc(status)}')">${esc(status)}</button>
        `).join("")}
      </div>
    `;
  }

  function renderActions() {
    setPage("Action Center", "Prioritized retention actions generated by the data engine.");

    const filters = ["All", "High", ...TEAM];
    const actions = (DATA?.actions || []).filter(action => {
      if (state.actionFilter !== "All" && action.priority !== state.actionFilter && action.owner !== state.actionFilter) return false;
      if (state.search) {
        const q = state.search.toLowerCase();
        const haystack = `${action.account || ""} ${action.owner || ""} ${action.issue || ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    app().innerHTML = `
      <div class="filters">
        ${filters.map(item => `
          <button class="filter-chip ${state.actionFilter === item ? "active" : ""}" onclick="window.__setActionFilter('${esc(item)}')">${esc(item)}</button>
        `).join("")}
        <input class="input" placeholder="Search action..." value="${esc(state.search)}" oninput="window.__setFilter('search', this.value)" />
      </div>

      <section class="card">
        <div class="card-head">
          <div>
            <div class="card-title">Action List</div>
            <div class="card-sub">${actions.length} actions</div>
          </div>
        </div>
        <div>
          ${actions.length ? actions.map(action => `
            <div class="action-row">
              <div>${badge(action.priority || "High", action.priority === "High" ? "red" : "amber")}</div>
              <div><strong>${esc(action.owner)}</strong></div>
              <div><strong>${esc(action.account)}</strong><div style="color:var(--muted);font-size:12px;margin-top:3px">${esc(action.issue)}</div></div>
              <div class="num">${money(action.value)}</div>
              <div>${esc(action.recommendedAction)}</div>
            </div>
          `).join("") : `<div class="empty-state" style="box-shadow:none;border:0;padding:28px">No actions match the selected filters.</div>`}
        </div>
      </section>
    `;
  }

  function renderQuality() {
    setPage("Data Quality", "Issues detected by n8n while generating retention data.");

    const issues = DATA?.dataQuality || [];

    app().innerHTML = `
      <div class="grid cols-3">
        ${kpi("Issues", issues.length, "Total issue groups", issues.some(i => i.severity === "critical") ? "red" : "amber")}
        ${kpi("Critical", issues.filter(i => i.severity === "critical").length, "Needs immediate cleanup", "red")}
        ${kpi("Financial Impact", money(issues.reduce((sum, issue) => sum + safeNumber(issue.financialImpact), 0)), "Where available", "amber")}
      </div>

      <div class="grid cols-2">
        ${issues.map(issue => `
          <div class="issue-card ${esc(issue.severity)}">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px">
              <strong>${esc(issue.title)}</strong>
              ${badge(issue.severity || "warning", issue.severity === "critical" ? "red" : "amber")}
            </div>
            <div style="color:var(--muted);font-size:13px;line-height:1.6">
              Count: <strong>${safeNumber(issue.count)}</strong><br>
              Financial impact: <strong>${issue.financialImpact == null ? "N/A" : money(issue.financialImpact)}</strong><br>
              Fix: ${esc(issue.recommendedFix || "Review source sheet.")}
            </div>
          </div>
        `).join("") || `<div class="empty-state">No data quality issues detected.</div>`}
      </div>
    `;
  }

  window.__setRetentionTab = (tab) => {
    state.tab = tab;
    $$(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.tab === tab));
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  window.__setFilter = (key, value) => {
    state[key] = value;
    render();
  };

  window.__setActionFilter = (value) => {
    state.actionFilter = value;
    render();
  };

  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    render();
  });

  if (document.readyState !== "loading") {
    bindEvents();
    render();
  }
})();
