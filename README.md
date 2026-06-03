<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Private Dashboard — 2026 Sales & P&L Command Center</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-mark">P</div>
      <div><strong>Private Dashboard</strong><span>Sales & P&L Command Center</span></div>
    </div>
    <nav class="nav">
      <button class="nav-item active" data-tab="executive">Executive Overview</button>
      <button class="nav-item" data-tab="retention">Retention Overview</button>
      <button class="nav-item" data-tab="Fadi">Fadi</button>
      <button class="nav-item" data-tab="Jihad">Jihad</button>
      <button class="nav-item" data-tab="Faizan">Faizan</button>
      <button class="nav-item" data-tab="pnl">P&L / Expenses</button>
      <button class="nav-item" data-tab="actions">Action Center</button>
      <button class="nav-item" data-tab="quality">Data Quality</button>
    </nav>
    <div class="sidebar-foot" id="sidebarMeta">Waiting for data...</div>
  </aside>

  <main class="main">
    <header class="topbar">
      <div>
        <h1 id="pageTitle">Executive Overview</h1>
        <p id="pageSubtitle">Loading latest GitHub-synced data...</p>
      </div>
      <div class="scenario-switch" id="scenarioSwitch">
        <button data-scenario="worst">Worst</button>
        <button data-scenario="medium" class="active">Medium</button>
        <button data-scenario="best">Best</button>
        <button data-scenario="outstanding">Outstanding</button>
      </div>
    </header>

    <section class="alert" id="riskBanner"></section>
    <section id="app"></section>
  </main>

  <script>
    const script = document.createElement('script');
    script.src = './data/live-data.js?v=' + Date.now();
    script.onerror = () => {
      window.DASHBOARD_DATA_LOAD_ERROR = true;
    };
    document.head.appendChild(script);
  </script>
  <script src="app.js?v=1.0.0"></script>
</body>
</html>
