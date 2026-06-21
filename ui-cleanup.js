(() => {
  "use strict";

  const ANNUAL_COST = 3773275;
  const MONTHLY_COST = 314440;
  let syncQueued = false;

  function money(value) {
    const number = Number(value || 0);
    const sign = number < 0 ? "-" : "";
    return `${sign}$${Math.abs(Math.round(number)).toLocaleString()}`;
  }

  function percent(value) {
    return `${Number(value || 0).toFixed(1)}%`;
  }

  function selectedScenario() {
    return document.querySelector("#scenarioSwitch button.active")?.dataset.scenario || "medium";
  }

  function scenarioLabel(key) {
    return ({ worst: "Worst", medium: "Medium", best: "Best" })[key] || "Medium";
  }

  function ownerForecast(owner, scenario) {
    if (!owner) return 0;
    return Number(owner?.forecasts?.[scenario]?.revenue || 0);
  }

  function selectedForecast() {
    const data = window.DASHBOARD_DATA;
    if (!data?.owners) return 0;

    const scenario = selectedScenario();
    return ["Fadi", "Jihad", "Faizan"].reduce(
      (total, ownerName) => total + ownerForecast(data.owners[ownerName], scenario),
      0
    );
  }

  function removeBestPlusLost() {
    document.querySelectorAll('[data-scenario="bestPlusLost"]').forEach((element) => element.remove());

    document.querySelectorAll("tr").forEach((row) => {
      const firstCell = row.querySelector("td, th");
      if (firstCell && firstCell.textContent.trim() === "Best + Lost") {
        row.remove();
      }
    });

    document.querySelectorAll(".kpi").forEach((card) => {
      const label = card.querySelector(".label");
      if (label && label.textContent.trim() === "Best + Lost") {
        card.remove();
      }
    });
  }

  function ensureCostStyles() {
    if (document.getElementById("management-cost-styles")) return;

    const style = document.createElement("style");
    style.id = "management-cost-styles";
    style.textContent = `
      .management-cost-section {
        background: linear-gradient(135deg, #28483f 0%, #365c53 58%, #4f7b6e 100%);
        color: #fff;
        border-radius: 24px;
        padding: 22px;
        box-shadow: 0 16px 36px rgba(33, 55, 50, .18);
        overflow: hidden;
        position: relative;
      }
      .management-cost-section::after {
        content: "";
        position: absolute;
        width: 230px;
        height: 230px;
        right: -95px;
        top: -115px;
        border-radius: 999px;
        background: rgba(255,255,255,.08);
        pointer-events: none;
      }
      .management-cost-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 18px;
        margin-bottom: 17px;
        position: relative;
        z-index: 1;
      }
      .management-cost-title {
        font-size: 18px;
        font-weight: 900;
        letter-spacing: -.02em;
      }
      .management-cost-subtitle {
        color: rgba(255,255,255,.72);
        font-size: 12px;
        margin-top: 4px;
      }
      .management-cost-badge {
        display: inline-flex;
        align-items: center;
        border: 1px solid rgba(255,255,255,.22);
        background: rgba(255,255,255,.12);
        padding: 7px 11px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 900;
        white-space: nowrap;
      }
      .management-cost-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
        position: relative;
        z-index: 1;
      }
      .management-cost-card {
        background: rgba(255,255,255,.12);
        border: 1px solid rgba(255,255,255,.14);
        border-radius: 17px;
        padding: 15px;
        backdrop-filter: blur(8px);
      }
      .management-cost-card span {
        display: block;
        color: rgba(255,255,255,.70);
        font-size: 10px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: .06em;
      }
      .management-cost-card strong {
        display: block;
        margin-top: 7px;
        font-size: 22px;
        line-height: 1;
        letter-spacing: -.04em;
      }
      .management-cost-card small {
        display: block;
        margin-top: 7px;
        color: rgba(255,255,255,.68);
        font-size: 11px;
      }
      .management-cost-card.positive strong { color: #bff3cd; }
      .management-cost-card.negative strong { color: #ffd1d1; }
      .management-cost-progress-wrap {
        margin-top: 15px;
        position: relative;
        z-index: 1;
      }
      .management-cost-progress-label {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        color: rgba(255,255,255,.76);
        font-size: 11px;
        font-weight: 800;
        margin-bottom: 7px;
      }
      .management-cost-progress {
        height: 10px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(255,255,255,.16);
      }
      .management-cost-progress > div {
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #9edbb0, #d7f5df);
      }
      @media (max-width: 1050px) {
        .management-cost-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
      }
      @media (max-width: 620px) {
        .management-cost-grid { grid-template-columns: 1fr; }
        .management-cost-head { flex-direction: column; }
      }
    `;
    document.head.appendChild(style);
  }

  function shouldShowCostSection() {
    const title = document.getElementById("pageTitle")?.textContent?.trim() || "";
    return title === "Retention Overview" || title === "Forecast View" || title === "Retention Command Center";
  }

  function renderCostSection() {
    const app = document.getElementById("app");
    if (!app) return;

    const existing = document.getElementById("management-cost-section");
    if (!shouldShowCostSection()) {
      existing?.remove();
      return;
    }

    const forecast = selectedForecast();
    if (!forecast) return;

    const scenario = selectedScenario();
    const annualNet = forecast - ANNUAL_COST;
    const monthlyRevenue = forecast / 12;
    const monthlyNet = monthlyRevenue - MONTHLY_COST;
    const margin = forecast ? (annualNet / forecast) * 100 : 0;
    const coverage = ANNUAL_COST ? (forecast / ANNUAL_COST) * 100 : 0;
    const coverageWidth = Math.max(0, Math.min(100, coverage));

    const section = existing || document.createElement("section");
    section.id = "management-cost-section";
    section.className = "management-cost-section";
    section.innerHTML = `
      <div class="management-cost-head">
        <div>
          <div class="management-cost-title">Management Cost & Profitability</div>
          <div class="management-cost-subtitle">Fixed management cost benchmark compared with the selected retention forecast.</div>
        </div>
        <div class="management-cost-badge">${scenarioLabel(scenario)} Scenario</div>
      </div>
      <div class="management-cost-grid">
        <div class="management-cost-card">
          <span>Annual Cost</span>
          <strong>${money(ANNUAL_COST)}</strong>
          <small>Manager-approved 2026 cost</small>
        </div>
        <div class="management-cost-card">
          <span>Monthly Cost</span>
          <strong>${money(MONTHLY_COST)}</strong>
          <small>Monthly cost benchmark</small>
        </div>
        <div class="management-cost-card ${annualNet >= 0 ? "positive" : "negative"}">
          <span>Net After Annual Cost</span>
          <strong>${money(annualNet)}</strong>
          <small>${percent(margin)} projected margin</small>
        </div>
        <div class="management-cost-card ${monthlyNet >= 0 ? "positive" : "negative"}">
          <span>Monthly Net Run Rate</span>
          <strong>${money(monthlyNet)}</strong>
          <small>${money(monthlyRevenue)} monthly revenue equivalent</small>
        </div>
      </div>
      <div class="management-cost-progress-wrap">
        <div class="management-cost-progress-label">
          <span>Cost Coverage</span>
          <span>${percent(coverage)}</span>
        </div>
        <div class="management-cost-progress"><div style="width:${coverageWidth}%"></div></div>
      </div>
    `;

    if (!existing) {
      const firstGrid = app.querySelector(":scope > .grid");
      if (firstGrid?.nextSibling) app.insertBefore(section, firstGrid.nextSibling);
      else app.prepend(section);
    }
  }

  function syncDashboardEnhancements() {
    if (syncQueued) return;
    syncQueued = true;
    requestAnimationFrame(() => {
      removeBestPlusLost();
      ensureCostStyles();
      renderCostSection();
      syncQueued = false;
    });
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest("#scenarioSwitch button, .nav-item")) {
      setTimeout(syncDashboardEnhancements, 0);
    }
  });

  syncDashboardEnhancements();

  const observer = new MutationObserver(syncDashboardEnhancements);
  observer.observe(document.body, { childList: true, subtree: true });
})();
