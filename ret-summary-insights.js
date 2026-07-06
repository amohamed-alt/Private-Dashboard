(() => {
  const DATA = window.DASHBOARD_DATA || {};
  const RET_TEAM = ['Jihad', 'Fadi', 'Faizan'];
  const money = (value) => `$${Math.round(Number(value || 0)).toLocaleString()}`;
  const pct = (value) => value === null || value === undefined || value === '' ? '—' : `${Number(value).toFixed(1)}%`;
  const text = (node) => String(node?.textContent || '').trim();
  const norm = (value) => String(value || '').trim().toLowerCase();
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
  const num = (value) => Number(value || 0) || 0;
  const add = (...values) => values.reduce((sum, value) => sum + num(value), 0);

  function fallbackSummary() {
    const rmStats = DATA.rms || {};
    const forecast = DATA.management?.rms || {};
    const projectionRows = RET_TEAM.map((name) => {
      const stat = rmStats[name] || {};
      const worst = num(stat.pendingHigh);
      const medium = add(stat.pendingHigh, stat.pendingMedium);
      const best = add(stat.pendingHigh, stat.pendingMedium, stat.pendingLow, stat.lost);
      return {
        name,
        lost: num(stat.lost),
        pendingHigh: num(stat.pendingHigh),
        pendingLow: num(stat.pendingLow),
        pendingMedium: num(stat.pendingMedium),
        late: 0,
        totalProjection: { worst, medium, best, outstanding: best },
      };
    });
    const projectionTotal = projectionRows.reduce((total, row) => ({
      name: 'Total',
      isTotal: true,
      lost: add(total.lost, row.lost),
      pendingHigh: add(total.pendingHigh, row.pendingHigh),
      pendingLow: add(total.pendingLow, row.pendingLow),
      pendingMedium: add(total.pendingMedium, row.pendingMedium),
      late: add(total.late, row.late),
      totalProjection: {
        worst: add(total.totalProjection?.worst, row.totalProjection.worst),
        medium: add(total.totalProjection?.medium, row.totalProjection.medium),
        best: add(total.totalProjection?.best, row.totalProjection.best),
        outstanding: add(total.totalProjection?.outstanding, row.totalProjection.outstanding),
      },
    }), { totalProjection: {} });
    const topRows = RET_TEAM.map((name) => ({
      name,
      retTarget: num(forecast[name]?.target),
      bookedRet: 0,
      cashedRet: 0,
      receivables: 0,
      achievement: { bookingRet: null, cashingRet: null },
      ytdProspective: { totalCashing: 0, percent: null },
    }));
    return { topRows, topTotal: null, projectionRows, projectionTotal, closingYear: { reps: [], total: null, delta: [] }, byName: {} };
  }

  function summary() {
    const exact = DATA.summaryRet;
    if (exact && (exact.topRows?.length || exact.projectionRows?.length)) return exact;
    return fallbackSummary();
  }

  function currentPage() {
    return norm(document.querySelector('h1')?.textContent || '');
  }

  function currentRmName() {
    const title = document.querySelector('h1')?.textContent || '';
    const match = title.match(/^(.+?)\s*·\s*RM\s*Performance/i);
    return match ? match[1].trim() : null;
  }

  function card(label, value, sub = '', tone = '') {
    return `<article class="ret-summary-card ${tone}"><span>${esc(label)}</span><strong>${esc(value)}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</article>`;
  }

  function topTotalCards(s) {
    const total = s.topTotal || {};
    return `<div class="ret-summary-grid">
      ${card('RET Target', money(total.retTarget), 'From Summary · Ret Target', 'info')}
      ${card('Booked (Ret)', money(total.bookedRet), `Achievement ${pct(total.achievement?.bookingRet)}`, 'good')}
      ${card('Cashed (Ret)', money(total.cashedRet), `Achievement ${pct(total.achievement?.cashingRet)}`, 'good')}
      ${card('Receivables', money(total.receivables), 'Booked - cashed + last year load', 'warn')}
      ${card('Total Projection · Worst', money(s.projectionTotal?.totalProjection?.worst), 'RET projection from Summary')}
      ${card('Total Projection · Med', money(s.projectionTotal?.totalProjection?.medium), 'RET projection from Summary')}
      ${card('Total Projection · Best', money(s.projectionTotal?.totalProjection?.best), 'RET projection from Summary')}
      ${card('YTD + Prospective', money(total.ytdProspective?.totalCashing), `Rate ${pct(total.ytdProspective?.percent)}`, 'info')}
    </div>`;
  }

  function projectionTable(rows) {
    return `<div class="ret-table-wrap"><table class="ret-table"><thead><tr><th>RM</th><th class="num">Lost</th><th class="num">High</th><th class="num">Low</th><th class="num">Medium</th><th class="num">Late</th><th class="num">Worst</th><th class="num">Med</th><th class="num">Best</th><th class="num">Outstanding</th></tr></thead><tbody>
      ${rows.map((row) => `<tr><td><strong>${esc(row.name)}</strong></td><td class="num">${money(row.lost)}</td><td class="num">${money(row.pendingHigh)}</td><td class="num">${money(row.pendingLow)}</td><td class="num">${money(row.pendingMedium)}</td><td class="num">${money(row.late)}</td><td class="num">${money(row.totalProjection?.worst)}</td><td class="num">${money(row.totalProjection?.medium)}</td><td class="num">${money(row.totalProjection?.best)}</td><td class="num">${money(row.totalProjection?.outstanding)}</td></tr>`).join('')}
    </tbody></table></div>`;
  }

  function performanceTable(rows) {
    return `<div class="ret-table-wrap"><table class="ret-table"><thead><tr><th>RM</th><th class="num">RET Target</th><th class="num">Booked Ret</th><th class="num">Cashed Ret</th><th class="num">Receivables</th><th class="center">Booking %</th><th class="center">Cashing %</th><th class="num">YTD + Prospective</th></tr></thead><tbody>
      ${rows.map((row) => `<tr><td><strong>${esc(row.name)}</strong></td><td class="num">${money(row.retTarget)}</td><td class="num">${money(row.bookedRet)}</td><td class="num">${money(row.cashedRet)}</td><td class="num">${money(row.receivables)}</td><td class="center"><span class="ret-pill ${num(row.achievement?.bookingRet) >= 50 ? 'green' : 'amber'}">${pct(row.achievement?.bookingRet)}</span></td><td class="center"><span class="ret-pill ${num(row.achievement?.cashingRet) >= 25 ? 'green' : 'amber'}">${pct(row.achievement?.cashingRet)}</span></td><td class="num">${money(row.ytdProspective?.totalCashing)}</td></tr>`).join('')}
    </tbody></table></div>`;
  }

  function closingTable(closing) {
    const rows = closing?.reps || [];
    if (!rows.length) return '';
    return `<div class="ret-summary-panel"><h3>Closing Year RET Forecast</h3><p>Worst / Medium / Best / Outstanding versus RET target.</p><div class="ret-table-wrap"><table class="ret-table"><thead><tr><th>RM</th><th class="num">Target</th><th class="num">Worst</th><th class="center">%</th><th class="num">Med</th><th class="center">%</th><th class="num">Best</th><th class="center">%</th><th class="num">Booking</th><th class="num">Cashing</th></tr></thead><tbody>${rows.map((row) => `<tr><td><strong>${esc(row.name)}</strong></td><td class="num">${money(row.target)}</td><td class="num">${money(row.worst?.value)}</td><td class="center">${pct(row.worst?.vsTarget)}</td><td class="num">${money(row.medium?.value)}</td><td class="center">${pct(row.medium?.vsTarget)}</td><td class="num">${money(row.best?.value)}</td><td class="center">${pct(row.best?.vsTarget)}</td><td class="num">${money(row.actual?.booking)}</td><td class="num">${money(row.actual?.cashing)}</td></tr>`).join('')}</tbody></table></div></div>`;
  }

  function teamSection() {
    const s = summary();
    const topRows = (s.topRows || []).filter((row) => row.name !== 'Total' && (RET_TEAM.includes(row.name) || row.retTarget || row.bookedRet || row.cashedRet));
    const projectionRows = (s.projectionRows || []).filter((row) => row.name !== 'Total');
    return `<section class="ret-summary-section" data-ret-summary="team">
      ${topTotalCards(s)}
      <div class="ret-summary-tables">
        <div class="ret-summary-panel"><h3>RET Performance by Rep</h3><p>Target, booked, cashed, receivables and YTD prospective from Summary.</p>${performanceTable(topRows)}</div>
        <div class="ret-summary-panel"><h3>Retention Projection by RM</h3><p>Lost, pending buckets and total projection scenarios.</p>${projectionTable(projectionRows)}</div>
      </div>
      <div style="height:14px"></div>
      ${closingTable(s.closingYear)}
    </section>`;
  }

  function rmSection(name) {
    const s = summary();
    const top = (s.topRows || []).find((row) => row.name === name) || s.byName?.[name]?.top || {};
    const projection = (s.projectionRows || []).find((row) => row.name === name) || s.byName?.[name]?.projection || {};
    const closing = (s.closingYear?.reps || []).find((row) => row.name === name) || s.byName?.[name]?.closing || {};
    return `<section class="ret-summary-section" data-ret-summary="rm">
      <div class="ret-summary-rm">
        ${card(`${name} · RET Target`, money(top.retTarget || closing.target), 'Summary target', 'info')}
        ${card(`${name} · Booked Ret`, money(top.bookedRet || closing.actual?.booking), `Booking achievement ${pct(top.achievement?.bookingRet)}`, 'good')}
        ${card(`${name} · Cashed Ret`, money(top.cashedRet || closing.actual?.cashing), `Cashing achievement ${pct(top.achievement?.cashingRet)}`, 'good')}
        ${card(`${name} · Receivables`, money(top.receivables), 'Booked - cashed + last year load', 'warn')}
        ${card(`${name} · Pending High`, money(projection.pendingHigh), 'Likely renewal bucket')}
        ${card(`${name} · Best Projection`, money(projection.totalProjection?.best || closing.best?.value), `Vs target ${pct(closing.best?.vsTarget)}`, 'info')}
      </div>
    </section>`;
  }

  function shouldRender() {
    const page = currentPage();
    return page === 'retention command center' || page === 'management forecast' || page.includes('· rm performance');
  }

  function render() {
    if (!shouldRender()) return;
    const main = document.querySelector('main');
    if (!main) return;
    main.querySelectorAll('[data-ret-summary]').forEach((node) => node.remove());
    const rm = currentRmName();
    const html = rm ? rmSection(rm) : teamSection();
    const filters = main.querySelector('.filters');
    if (filters) filters.insertAdjacentHTML('afterend', html);
  }

  let queued = false;
  function scheduleRender() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      render();
    });
  }

  new MutationObserver(scheduleRender).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('load', scheduleRender);
  scheduleRender();
})();
