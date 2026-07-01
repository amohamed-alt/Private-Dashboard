# Retention Command Center V2 — React

## Source rules

- `Summary` is used only for `Target`, `Worst`, `Medium`, and `Best` from the `Property of closing the year` section.
- `Retention` supplies every operational detail.
- `Updated 2026 Value` is the operational account value.
- Every populated month is retained as a separate renewal event with its own amount. No largest-month assumption is used.
- Action Center reads `Action`, `Owner`, `Due Date`, and `Action Status` plus the account context.
- Blank source values remain blank.
- `Owner = RM` resolves to the row RM.
- `Owner = CSM` resolves to the row CSM.
- Direct owner names remain unchanged.

## React pages

- Overview
- Management Forecast
- Renewal Calendar
- Accounts Explorer
- Action Center
- Dynamic RM pages
- Dynamic CSM pages

## Global filters

- RM
- CSM
- Product
- Location
- Renewal Status
- Renewal Month
- Client search

The Management Forecast is scoped only by RM. CSM, product, location, status, and month filters do not rewrite Summary forecast values.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## n8n update

1. Keep `Read Summary` and `Read Retention`.
2. Replace the code inside `Build Dashboard Data` with `n8n-build-dashboard-data-react-v2.js`.
3. Change the GitHub Edit File path to:

```text
public/data/live-data.js
```

The React branch contains sample data only for visual review. n8n replaces it with the live full data after deployment.
