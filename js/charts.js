// ====================================================
// BFM Charts — Simple SVG-based charts
// ====================================================

const Charts = (() => {
  const COLORS = [
    '#1a3a6b', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444',
    '#8b5cf6', '#06b6d4', '#f97316', '#6366f1', '#ec4899'
  ];

  function pieChart(container, data, options = {}) {
    if (!data || !data.length) {
      container.innerHTML = '<p class="no-data">ไม่มีข้อมูล</p>';
      return;
    }

    const size = options.size || 200;
    const total = data.reduce((s, d) => s + d.amount, 0);
    if (total === 0) {
      container.innerHTML = '<p class="no-data">ไม่มีข้อมูล</p>';
      return;
    }

    let cumulative = 0;
    const slices = data.map((d, i) => {
      const start = cumulative;
      cumulative += d.amount;
      return {
        ...d,
        startAngle: (start / total) * 360,
        endAngle: (cumulative / total) * 360,
        percent: ((d.amount / total) * 100).toFixed(1),
        color: COLORS[i % COLORS.length]
      };
    });

    const cx = size / 2, cy = size / 2, r = size / 2 - 5;

    let paths = '';
    slices.forEach(s => {
      if (s.endAngle - s.startAngle >= 359.99) {
        // Full circle
        paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${s.color}"/>`;
        return;
      }
      const start = polarToCartesian(cx, cy, r, s.startAngle);
      const end = polarToCartesian(cx, cy, r, s.endAngle);
      const largeArc = s.endAngle - s.startAngle > 180 ? 1 : 0;
      paths += `<path d="M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z" fill="${s.color}"/>`;
    });

    const svg = `<svg viewBox="0 0 ${size} ${size}" class="pie-chart">${paths}</svg>`;
    const legend = slices.map(s =>
      `<div class="legend-item">
        <span class="legend-color" style="background:${s.color}"></span>
        <span class="legend-label">${s.category}</span>
        <span class="legend-value">${formatMoney(s.amount)} (${s.percent}%)</span>
      </div>`
    ).join('');

    container.innerHTML = `
      <div class="chart-wrapper">
        <div class="chart-svg">${svg}</div>
        <div class="chart-legend">${legend}</div>
      </div>`;
  }

  function barChart(container, data, options = {}) {
    if (!data || !data.length) {
      container.innerHTML = '<p class="no-data">ไม่มีข้อมูล</p>';
      return;
    }

    const maxVal = Math.max(...data.map(d => Math.max(d.totalIncome || 0, d.totalExpense || 0)));
    if (maxVal === 0) {
      container.innerHTML = '<p class="no-data">ไม่มีข้อมูล</p>';
      return;
    }

    const bars = data.map(d => {
      const incH = maxVal > 0 ? ((d.totalIncome || 0) / maxVal) * 100 : 0;
      const expH = maxVal > 0 ? ((d.totalExpense || 0) / maxVal) * 100 : 0;
      const label = d.month ? d.month.split('-')[1] : '';
      return `
        <div class="bar-group">
          <div class="bar-pair">
            <div class="bar bar-income" style="height:${incH}%" title="รายรับ ${formatMoney(d.totalIncome)}"></div>
            <div class="bar bar-expense" style="height:${expH}%" title="รายจ่าย ${formatMoney(d.totalExpense)}"></div>
          </div>
          <div class="bar-label">${label}</div>
        </div>`;
    }).join('');

    container.innerHTML = `
      <div class="bar-chart-wrapper">
        <div class="bar-chart">${bars}</div>
        <div class="bar-legend">
          <span class="legend-item"><span class="legend-color" style="background:#4ECDC4"></span>รายรับ</span>
          <span class="legend-item"><span class="legend-color" style="background:#FF6B6B"></span>รายจ่าย</span>
        </div>
      </div>`;
  }

  function polarToCartesian(cx, cy, r, angle) {
    const rad = ((angle - 90) * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad)
    };
  }

  function formatMoney(n) {
    return Number(n || 0).toLocaleString('th-TH');
  }

  return { pieChart, barChart };
})();
