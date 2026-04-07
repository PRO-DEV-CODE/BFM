// ====================================================
// BFM App — Banking UI Controller (Material Icons)
// ====================================================

const App = (() => {
  let currentTab = 'home';
  let settings = null;
  let profileCache = null;

  // ── Icon Helper ──
  function mi(name, cls = '') { return `<span class="mi ${cls}">${name}</span>`; }

  // ── Format Helpers ──
  function formatMoney(n) { return Number(n || 0).toLocaleString('th-TH'); }
  function formatDate(d) {
    if (!d) return '';
    const parts = d.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return d;
  }
  function getCurrentMonth() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  function getToday() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function showLoading(el) {
    el.innerHTML = '<div class="loading"><div class="spinner"></div><p>กำลังโหลด...</p></div>';
  }
  function showToast(msg, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 2500);
  }

  // ── Category Icon Mapping (Material Symbols names) ──
  const CAT_ICONS = {
    'อาหาร': 'restaurant', 'ค่าเดินทาง': 'directions_car', 'ค่าบัตรเครดิต': 'credit_card',
    'พรบ./ประกัน': 'description', 'ค่าน้ำ/ไฟ/เน็ต': 'bolt', 'ช้อปปิ้ง': 'shopping_bag',
    'สุขภาพ': 'favorite', 'การศึกษา': 'menu_book', 'อื่นๆ': 'inventory_2',
    'เงินเดือน': 'account_balance_wallet', 'งานเสริม': 'work', 'ลงทุน': 'trending_up'
  };
  const CAT_COLORS = {
    'อาหาร': '#f59e0b', 'ค่าเดินทาง': '#3b82f6', 'ค่าบัตรเครดิต': '#8b5cf6',
    'พรบ./ประกัน': '#6366f1', 'ค่าน้ำ/ไฟ/เน็ต': '#06b6d4', 'ช้อปปิ้ง': '#ef4444',
    'สุขภาพ': '#22c55e', 'การศึกษา': '#f97316', 'อื่นๆ': '#94a3b8',
    'เงินเดือน': '#22c55e', 'งานเสริม': '#3b82f6', 'ลงทุน': '#8b5cf6'
  };
  const CAT_BG = {
    'อาหาร': 'food', 'ค่าเดินทาง': 'transport', 'ช้อปปิ้ง': 'shopping',
    'ค่าน้ำ/ไฟ/เน็ต': 'bills', 'สุขภาพ': 'health'
  };

  function getCatIcon(cat) { return mi(CAT_ICONS[cat] || 'inventory_2'); }
  function getCatIconName(cat) { return CAT_ICONS[cat] || 'inventory_2'; }
  function getCatColor(cat) { return CAT_COLORS[cat] || '#94a3b8'; }
  function getCatBg(cat) { return CAT_BG[cat] || 'other'; }

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  async function init() {
    const app = document.getElementById('app');
    Auth.startAuthFlow(app, async () => {
      app.innerHTML = renderShell();
      bindNav();
      navigate('home');
      Promise.all([
        API.getSettings().then(s => settings = s).catch(() => settings = {}),
        API.getProfile().then(p => { profileCache = p; updateHeaderAvatar(); }).catch(() => {})
      ]);
      checkNotifications();
    });
  }

  function updateHeaderAvatar() {
    const el = document.getElementById('header-avatar');
    if (el && profileCache && profileCache.avatarColor) {
      el.style.background = profileCache.avatarColor;
    }
  }

  function renderShell() {
    return `
      <div class="app-shell">
        <header class="app-header">
          <div class="header-left">
            <div class="header-avatar" id="header-avatar">${mi('person')}</div>
            <span class="header-title">BFM</span>
          </div>
          <div class="header-right">
            <button class="btn-icon" id="btn-calendar-header" title="ปฏิทิน">${mi('calendar_month')}</button>
          </div>
        </header>
        <div id="notification-bar" class="notification-bar hidden"></div>
        <main id="main-content" class="main-content"></main>
        <nav class="bottom-nav">
          <button class="nav-btn active" data-tab="home">
            <span class="nav-icon">${mi('home')}</span><span class="nav-label">HOME</span>
          </button>
          <button class="nav-btn" data-tab="history">
            <span class="nav-icon">${mi('schedule')}</span><span class="nav-label">HISTORY</span>
          </button>
          <button class="nav-btn-add" id="btn-nav-add">${mi('add', 'mi-lg')}</button>
          <button class="nav-btn" data-tab="calendar">
            <span class="nav-icon">${mi('calendar_month')}</span><span class="nav-label">CALENDAR</span>
          </button>
          <button class="nav-btn" data-tab="profile">
            <span class="nav-icon">${mi('person')}</span><span class="nav-label">PROFILE</span>
          </button>
        </nav>
      </div>`;
  }

  function bindNav() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => navigate(btn.dataset.tab));
    });
    document.getElementById('btn-nav-add').addEventListener('click', () => navigate('add'));
    document.getElementById('btn-calendar-header').addEventListener('click', () => navigate('calendar'));
    document.getElementById('header-avatar').addEventListener('click', () => navigate('profile'));
  }

  function navigate(tab) {
    currentTab = tab;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    const main = document.getElementById('main-content');
    switch (tab) {
      case 'home': renderHome(main); break;
      case 'history': renderHistory(main); break;
      case 'add': renderAddTransaction(main); break;
      case 'calendar': renderCalendar(main); break;
      case 'profile': renderProfile(main); break;
      case 'settings': renderSettings(main); break;
      case 'reminders': renderReminders(main); break;
      case 'summary': renderSummary(main); break;
    }
  }

  async function checkNotifications() {
    try {
      const upcoming = await API.getUpcomingReminders(7);
      if (upcoming && upcoming.length > 0) {
        const bar = document.getElementById('notification-bar');
        const msgs = upcoming.map(r =>
          `${mi('warning', 'mi-sm')} ${r.name} — ครบกำหนด${r.daysLeft === 0 ? 'วันนี้!' : 'อีก ' + r.daysLeft + ' วัน'} (${formatMoney(r.amount)} ฿)`
        );
        bar.innerHTML = msgs.join('<br>') + `<button class="notif-close" onclick="this.parentElement.classList.add('hidden')">${mi('close', 'mi-sm')}</button>`;
        bar.classList.remove('hidden');
      }
    } catch {}
  }

  // ══════════════════════════════════════
  // HOME — Banking Dashboard
  // ══════════════════════════════════════
  async function renderHome(el) {
    showLoading(el);
    try {
      const month = getCurrentMonth();
      const [summaryData, transactions, upcoming] = await Promise.all([
        API.getMonthlySummary(month),
        API.getTransactions(month),
        API.getUpcomingReminders(7)
      ]);
      const txns = transactions || [];
      const recent = txns.slice(0, 5);
      const balance = (summaryData.totalIncome || 0) - (summaryData.totalExpense || 0);

      const weekDays = ['จ','อ','พ','พฤ','ศ','ส','อา'];
      const weeklyTotals = [0,0,0,0,0,0,0];
      txns.forEach(t => {
        if (t.type === 'expense') {
          const d = new Date(t.date);
          const day = (d.getDay() + 6) % 7;
          weeklyTotals[day] += t.amount;
        }
      });
      const maxWeekly = Math.max(...weeklyTotals, 1);

      const catTotals = {};
      const totalExpense = summaryData.totalExpense || 1;
      txns.filter(t => t.type === 'expense').forEach(t => {
        catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
      });
      const topCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 4);

      el.innerHTML = `
        <div class="balance-card">
          <div class="balance-label">ยอดเงินคงเหลือทั้งหมด</div>
          <div class="balance-amount">฿${formatMoney(balance)}</div>
          <div class="balance-sub">
            <div class="balance-sub-item">
              <div class="balance-sub-label">รายรับเดือนนี้</div>
              <div class="balance-sub-value">฿${formatMoney(summaryData.totalIncome)}</div>
            </div>
            <div class="balance-sub-item">
              <div class="balance-sub-label">รายจ่ายเดือนนี้</div>
              <div class="balance-sub-value">฿${formatMoney(summaryData.totalExpense)}</div>
            </div>
          </div>
        </div>

        <div class="section-header">
          <span class="section-title">แนวโน้มการใช้จ่าย</span>
          <button class="section-link" onclick="App.navigate('summary')">ดูทั้งหมด</button>
        </div>
        <div class="weekly-chart-card">
          <div class="weekly-bars">
            ${weekDays.map((day, i) => {
              const h = Math.max(8, (weeklyTotals[i] / maxWeekly) * 100);
              const isActive = weeklyTotals[i] > 0;
              return `<div class="weekly-bar">
                <div class="weekly-bar-fill ${isActive ? 'active' : ''}" style="height:${isActive ? h : 8}%"></div>
                <span class="weekly-bar-label">${day}</span>
              </div>`;
            }).join('')}
          </div>
        </div>

        ${topCats.length ? `
          <div class="section-header">
            <span class="section-title">หมวดหมู่รายจ่าย</span>
          </div>
          ${topCats.slice(0, 2).map(([cat, amt]) => {
            const pct = Math.round((amt / totalExpense) * 100);
            return `<div class="category-card">
              <div class="cat-icon ${getCatBg(cat)}">${getCatIcon(cat)}</div>
              <div class="cat-info">
                <div class="cat-name">${cat}</div>
                <div class="cat-remaining">คงเหลือ ฿${formatMoney(amt)}</div>
                <div class="cat-progress">
                  <div class="cat-progress-fill" style="width:${pct}%;background:${getCatColor(cat)}"></div>
                </div>
              </div>
              <div class="cat-percent">${pct}%</div>
            </div>`;
          }).join('')}
          ${topCats.length > 2 ? `
            <div class="category-cards-grid">
              ${topCats.slice(2).map(([cat, amt]) => {
                const pct = Math.round((amt / totalExpense) * 100);
                return `<div class="category-mini-card">
                  <div class="cat-icon ${getCatBg(cat)}">${getCatIcon(cat)}</div>
                  <div class="cat-name">${cat}</div>
                  <div class="cat-mini-progress">
                    <div class="cat-progress-fill" style="width:${pct}%;background:${getCatColor(cat)}"></div>
                  </div>
                </div>`;
              }).join('')}
            </div>` : ''}
        ` : ''}

        ${(upcoming || []).length ? `
          <div class="section-header">
            <span class="section-title">${mi('notifications', 'mi-sm')} การชำระที่ใกล้ถึง</span>
            <button class="section-link" onclick="App.navigate('reminders')">ดูทั้งหมด</button>
          </div>
          ${(upcoming || []).slice(0, 3).map(r => `
            <div class="reminder-item ${r.daysLeft === 0 ? 'urgent' : r.daysLeft <= 2 ? 'warning' : ''}">
              <div class="reminder-info">
                <span class="reminder-name">${r.name}</span>
                <span class="reminder-due">${r.daysLeft === 0 ? 'วันนี้!' : 'อีก ' + r.daysLeft + ' วัน'}</span>
              </div>
              <span class="reminder-amount">${formatMoney(r.amount)} ฿</span>
            </div>
          `).join('')}
        ` : ''}

        <div class="section-header">
          <span class="section-title">รายการล่าสุด</span>
          <button class="section-link" onclick="App.navigate('history')">ดูทั้งหมด</button>
        </div>
        ${recent.length ? `
          <div class="transaction-list">
            ${recent.map(t => `
              <div class="transaction-item">
                <div class="txn-icon ${t.type}">${getCatIcon(t.category)}</div>
                <div class="txn-left">
                  <span class="txn-name">${t.description || t.category}</span>
                  <span class="txn-meta">${t.category} • ${formatDate(t.date)}</span>
                </div>
                <div class="txn-right">
                  <span class="txn-amount ${t.type}">${t.type === 'income' ? '+' : '-'}฿${formatMoney(t.amount)}</span>
                </div>
              </div>
            `).join('')}
          </div>
        ` : '<p class="no-data">ยังไม่มีรายการเดือนนี้</p>'}
      `;
    } catch (err) {
      el.innerHTML = `<div class="error-page"><p>${mi('error')} ${err.message}</p><button class="btn btn-primary" onclick="App.navigate('home')">ลองใหม่</button></div>`;
    }
  }

  // ══════════════════════════════════════
  // ADD TRANSACTION
  // ══════════════════════════════════════
  function renderAddTransaction(el, editData = null) {
    const cats_exp = settings?.categories_expense || ['อาหาร','ค่าเดินทาง','ค่าบัตรเครดิต','พรบ./ประกัน','ค่าน้ำ/ไฟ/เน็ต','ช้อปปิ้ง','สุขภาพ','การศึกษา','อื่นๆ'];
    const cats_inc = settings?.categories_income || ['เงินเดือน','งานเสริม','ลงทุน','อื่นๆ'];
    const isEdit = !!editData;
    const type = editData?.type || 'expense';
    const cats = type === 'income' ? cats_inc : cats_exp;

    function renderCatGrid(categories, selectedCat) {
      return categories.map(c => {
        const iconName = getCatIconName(c);
        const color = getCatColor(c);
        const isActive = selectedCat === c;
        return `<button type="button" class="add-cat-item ${isActive ? 'active' : ''}" data-cat="${c}">
          <div class="add-cat-icon" style="background:${color}15;color:${color}">${mi(iconName)}</div>
          <span class="add-cat-label">${c}</span>
        </button>`;
      }).join('');
    }

    function formatDisplay(val) {
      if (!val || Number(val) === 0) return '฿ 0.00';
      return '฿ ' + Number(val).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    el.innerHTML = `
      <div class="add-page">
        <div class="add-header-section">
          <h2 class="add-title">บันทึกรายการ</h2>
          <p class="add-subtitle">กรอกรายละเอียดรายการเงินของคุณเเล้วกดบันทึก</p>
        </div>

        <div class="add-body-card">
          <form id="txn-form">
            <input type="hidden" id="txn-id" value="${editData?.id || ''}">
            <input type="hidden" id="txn-type" value="${type}">

            <div class="add-type-toggle">
              <button type="button" class="add-toggle-btn ${type === 'expense' ? 'active' : ''}" data-type="expense">
                ${mi('south_west', 'mi-sm')} รายจ่าย
              </button>
              <button type="button" class="add-toggle-btn ${type === 'income' ? 'active' : ''}" data-type="income">
                ${mi('north_east', 'mi-sm')} รายรับ
              </button>
            </div>

            <div class="add-amount-section">
              <div class="add-amount-label">จำนวนเงิน</div>
              <div class="add-amount-display" id="amount-display"><span class="add-currency">฿</span>${editData?.amount ? Number(editData.amount).toFixed(2) : '0.00'}</div>
              <div class="add-amount-line"></div>
              <input type="number" id="txn-amount" class="add-amount-input" placeholder="0"
                     value="${editData?.amount || ''}" inputmode="decimal" step="0.01" required>
            </div>

            <div class="add-section">
              <label class="add-section-label">หมวดหมู่</label>
              <div class="add-cat-grid" id="category-grid">
                ${renderCatGrid(cats, editData?.category)}
              </div>
              <input type="hidden" id="txn-category" value="${editData?.category || ''}">
            </div>

            <div class="add-section">
              <label class="add-section-label">วันที่ทำรายการ</label>
              <div class="add-input-row">
                <div class="add-input-icon">${mi('calendar_month')}</div>
                <input type="date" id="txn-date" class="add-input-field" value="${editData?.date || getToday()}">
              </div>
            </div>

            <div class="add-section">
              <label class="add-section-label">หมายเหตุ</label>
              <textarea id="txn-desc" class="add-note-area" placeholder="บรรยายรายละเอียดเพิ่มเติม..." rows="3">${editData?.description || ''}</textarea>
            </div>

            <button type="submit" class="add-submit-btn" id="btn-save-txn">
              ${isEdit ? mi('save', 'mi-sm') + ' บันทึกการแก้ไข' : mi('check_circle', 'mi-sm') + ' บันทึกรายการ'}
            </button>
          </form>
        </div>
      </div>`;

    function formatDisplay(val) {
      if (!val || Number(val) === 0) return '<span class="add-currency">฿</span>0.00';
      return '<span class="add-currency">฿</span>' + Number(val).toFixed(2);
    }

    // Amount display sync
    const amountInput = document.getElementById('txn-amount');
    const amountDisplay = document.getElementById('amount-display');
    amountInput.addEventListener('input', () => {
      amountDisplay.innerHTML = formatDisplay(amountInput.value);
    });
    amountDisplay.addEventListener('click', () => { amountInput.style.pointerEvents = 'auto'; amountInput.focus(); });

    // Type toggle
    el.querySelectorAll('.add-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.type;
        document.getElementById('txn-type').value = t;
        el.querySelectorAll('.add-toggle-btn').forEach(b => b.classList.toggle('active', b.dataset.type === t));
        const newCats = t === 'income' ? cats_inc : cats_exp;
        document.getElementById('category-grid').innerHTML = renderCatGrid(newCats, '');
        document.getElementById('txn-category').value = '';
        bindCatButtons();
      });
    });

    function bindCatButtons() {
      el.querySelectorAll('.add-cat-item').forEach(btn => {
        btn.addEventListener('click', () => {
          el.querySelectorAll('.add-cat-item').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          document.getElementById('txn-category').value = btn.dataset.cat;
        });
      });
    }
    bindCatButtons();

    document.getElementById('txn-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const amount = document.getElementById('txn-amount').value;
      const category = document.getElementById('txn-category').value;
      if (!amount || Number(amount) <= 0) { showToast('กรุณาใส่จำนวนเงิน', 'error'); return; }
      if (!category) { showToast('กรุณาเลือกหมวดหมู่', 'error'); return; }
      const btn = document.getElementById('btn-save-txn');
      btn.disabled = true; btn.textContent = 'กำลังบันทึก...';
      try {
        const data = {
          type: document.getElementById('txn-type').value,
          amount: Number(amount), category,
          date: document.getElementById('txn-date').value,
          description: document.getElementById('txn-desc').value
        };
        if (isEdit) { data.id = editData.id; await API.editTransaction(data); showToast('แก้ไขสำเร็จ'); navigate('history'); }
        else { await API.addTransaction(data); showToast('บันทึกสำเร็จ');
          document.getElementById('txn-amount').value = '';
          document.getElementById('amount-display').innerHTML = '<span class="add-currency">฿</span>0.00';
          document.getElementById('txn-desc').value = '';
          document.getElementById('txn-category').value = '';
          el.querySelectorAll('.add-cat-item').forEach(b => b.classList.remove('active'));
        }
      } catch (err) { showToast(err.message, 'error'); }
      finally {
        btn.disabled = false;
        btn.innerHTML = isEdit ? mi('save', 'mi-sm') + ' บันทึกการแก้ไข' : mi('check_circle', 'mi-sm') + ' บันทึกรายการ';
      }
    });
  }

  // ══════════════════════════════════════
  // HISTORY (Transaction List)
  // ══════════════════════════════════════
  async function renderHistory(el) {
    const month = getCurrentMonth();
    el.innerHTML = `
      <div class="hist-page">
        <div class="hist-search-bar">
          <div class="hist-search-input-wrap">
            ${mi('search', 'mi-sm')}
            <input type="text" id="hist-search" class="hist-search-input" placeholder="ค้นหารายการ...">
          </div>
          <button class="hist-filter-btn" id="hist-filter-btn">${mi('tune')}</button>
        </div>

        <div class="hist-balance-card">
          <div class="hist-balance-top">
            <span class="hist-balance-label">ค่าใช้จ่ายเดือนนี้</span>
            <span class="hist-badge" id="hist-pct-badge"></span>
          </div>
          <div class="hist-balance-amount" id="hist-total-expense">฿0</div>
          <div class="hist-month-nav">
            <button class="hist-dot active" id="hist-dot-prev"></button>
            <button class="hist-dot" id="hist-dot-next"></button>
          </div>
          <input type="month" id="month-select" value="${month}" class="hist-month-hidden">
          <div class="hist-summary-row">
            <div class="hist-summary-card expense">
              <div class="hist-summary-icon expense">${mi('south_west')}</div>
              <div>
                <div class="hist-summary-label">รายจ่ายเดือนนี้</div>
                <div class="hist-summary-value expense" id="hist-exp-val">฿0</div>
              </div>
            </div>
            <div class="hist-summary-card income">
              <div class="hist-summary-icon income">${mi('north_east')}</div>
              <div>
                <div class="hist-summary-label">รับเข้า</div>
                <div class="hist-summary-value income" id="hist-inc-val">฿0</div>
              </div>
            </div>
          </div>
        </div>

        <div id="txn-list-container"></div>
      </div>`;

    const monthInput = document.getElementById('month-select');
    const container = document.getElementById('txn-list-container');
    let allTxns = [];

    function groupByDate(txns) {
      const today = getToday();
      const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();
      const groups = {};
      txns.forEach(t => {
        let label;
        if (t.date === today) label = 'วันนี้';
        else if (t.date === yesterday) label = 'เมื่อวานนี้';
        else label = formatDate(t.date);
        if (!groups[label]) groups[label] = [];
        groups[label].push(t);
      });
      return groups;
    }

    function renderTxnList(txns) {
      if (!txns || !txns.length) { container.innerHTML = '<p class="no-data">ไม่มีรายการในเดือนนี้</p>'; return; }
      const totalInc = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const totalExp = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const total = totalInc + totalExp;
      const pct = total > 0 ? Math.round((totalExp / total) * 100) : 0;

      document.getElementById('hist-total-expense').textContent = '฿' + formatMoney(totalExp);
      document.getElementById('hist-exp-val').textContent = '฿' + formatMoney(totalExp);
      document.getElementById('hist-inc-val').textContent = '฿' + formatMoney(totalInc);
      document.getElementById('hist-pct-badge').innerHTML = `${mi('trending_down', 'mi-sm')} ${pct}%`;

      const groups = groupByDate(txns);
      let html = '';
      for (const [label, items] of Object.entries(groups)) {
        html += `<div class="hist-date-group">
          <div class="hist-date-label">${label}</div>
          ${items.map(t => `
            <div class="hist-txn-row" data-id="${t.id}">
              <div class="hist-txn-icon" style="background:${getCatColor(t.category)}15;color:${getCatColor(t.category)}">
                ${getCatIcon(t.category)}
              </div>
              <div class="hist-txn-info">
                <span class="hist-txn-name">${t.description || t.category}</span>
                <span class="hist-txn-meta">${t.category} · ${formatDate(t.date)}</span>
              </div>
              <div class="hist-txn-amount ${t.type}">${t.type === 'income' ? '+' : '-'}฿${formatMoney(t.amount)}</div>
            </div>
          `).join('')}
        </div>`;
      }
      container.innerHTML = html;

      // Swipe-to-action on each row
      container.querySelectorAll('.hist-txn-row').forEach(row => {
        let startX = 0, currentX = 0, swiping = false;
        row.addEventListener('touchstart', e => { startX = e.touches[0].clientX; swiping = true; }, { passive: true });
        row.addEventListener('touchmove', e => {
          if (!swiping) return;
          currentX = e.touches[0].clientX - startX;
          if (currentX < -30) row.style.transform = `translateX(${Math.max(currentX, -120)}px)`;
        }, { passive: true });
        row.addEventListener('touchend', () => {
          swiping = false;
          if (currentX < -80) {
            row.style.transform = 'translateX(-120px)';
            showRowActions(row);
          } else { row.style.transform = ''; hideRowActions(row); }
          currentX = 0;
        });
        row.addEventListener('click', () => {
          if (Math.abs(currentX) < 10) {
            const txn = allTxns.find(t => t.id === row.dataset.id);
            if (txn) renderAddTransaction(document.getElementById('main-content'), txn);
          }
        });
      });
    }

    function showRowActions(row) {
      if (row.querySelector('.hist-row-actions')) return;
      const actions = document.createElement('div');
      actions.className = 'hist-row-actions';
      actions.innerHTML = `
        <button class="hist-act-btn edit">${mi('edit', 'mi-sm')}</button>
        <button class="hist-act-btn delete">${mi('delete', 'mi-sm')}</button>`;
      row.appendChild(actions);
      actions.querySelector('.edit').addEventListener('click', (e) => {
        e.stopPropagation();
        const txn = allTxns.find(t => t.id === row.dataset.id);
        if (txn) renderAddTransaction(document.getElementById('main-content'), txn);
      });
      actions.querySelector('.delete').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('ลบรายการนี้?')) return;
        try { await API.deleteTransaction(row.dataset.id); showToast('ลบสำเร็จ'); loadTransactions(); }
        catch (err) { showToast(err.message, 'error'); }
      });
    }

    function hideRowActions(row) {
      const actions = row.querySelector('.hist-row-actions');
      if (actions) actions.remove();
    }

    async function loadTransactions() {
      showLoading(container);
      try {
        allTxns = await API.getTransactions(monthInput.value) || [];
        renderTxnList(allTxns);
      } catch (err) { container.innerHTML = `<div class="error-page"><p>${mi('error')} ${err.message}</p></div>`; }
    }

    // Search
    document.getElementById('hist-search').addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (!q) { renderTxnList(allTxns); return; }
      const filtered = allTxns.filter(t =>
        (t.description || '').toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
      renderTxnList(filtered);
    });

    // Filter button - toggle month picker
    document.getElementById('hist-filter-btn').addEventListener('click', () => monthInput.showPicker?.() || monthInput.focus());

    // Month navigation via dots
    document.getElementById('hist-dot-prev').addEventListener('click', () => {
      const d = new Date(monthInput.value + '-01'); d.setMonth(d.getMonth() - 1);
      monthInput.value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      loadTransactions();
    });
    document.getElementById('hist-dot-next').addEventListener('click', () => {
      const d = new Date(monthInput.value + '-01'); d.setMonth(d.getMonth() + 1);
      monthInput.value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      loadTransactions();
    });
    monthInput.addEventListener('change', loadTransactions);
    loadTransactions();
  }

  // ══════════════════════════════════════
  // CALENDAR
  // ══════════════════════════════════════
  async function renderCalendar(el) {
    let calDate = new Date();
    let selectedDate = getToday();
    let monthTxns = [];

    el.innerHTML = `<div class="calendar-page">
      <div id="cal-header-wrap"></div>
      <div id="cal-grid-wrap"></div>
      <div id="cal-daily-wrap"></div>
    </div>`;

    async function loadMonth() {
      const year = calDate.getFullYear();
      const month = calDate.getMonth();
      const monthStr = year + '-' + String(month + 1).padStart(2, '0');
      const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

      try { monthTxns = await API.getTransactions(monthStr) || []; } catch { monthTxns = []; }
      const txnDates = new Set(monthTxns.map(t => t.date));

      document.getElementById('cal-header-wrap').innerHTML = `
        <div class="cal-header">
          <div>
            <div class="cal-month-label">Monthly View</div>
            <div class="cal-month-value">${monthNames[month]} ${year}</div>
          </div>
          <div class="cal-nav">
            <button id="cal-prev">${mi('chevron_left')}</button>
            <button id="cal-next">${mi('chevron_right')}</button>
          </div>
        </div>`;

      document.getElementById('cal-prev').addEventListener('click', () => { calDate.setMonth(calDate.getMonth() - 1); loadMonth(); });
      document.getElementById('cal-next').addEventListener('click', () => { calDate.setMonth(calDate.getMonth() + 1); loadMonth(); });

      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const today = getToday();

      let daysHtml = '';
      for (let i = 0; i < firstDay; i++) daysHtml += '<button class="cal-day empty" disabled></button>';
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isToday = dateStr === today;
        const isSelected = dateStr === selectedDate;
        const hasTxn = txnDates.has(dateStr);
        daysHtml += `<button class="cal-day${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}${hasTxn ? ' has-txn' : ''}" data-date="${dateStr}">${d}</button>`;
      }

      document.getElementById('cal-grid-wrap').innerHTML = `
        <div class="cal-grid">
          <div class="cal-weekdays"><span>SU</span><span>MO</span><span>TU</span><span>WE</span><span>TH</span><span>FR</span><span>SA</span></div>
          <div class="cal-days">${daysHtml}</div>
        </div>`;

      document.querySelectorAll('.cal-day:not(.empty)').forEach(btn => {
        btn.addEventListener('click', () => {
          selectedDate = btn.dataset.date;
          document.querySelectorAll('.cal-day').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          renderDailyTxns();
        });
      });
      renderDailyTxns();
    }

    function renderDailyTxns() {
      const dayTxns = monthTxns.filter(t => t.date === selectedDate);
      const parts = selectedDate.split('-');
      const dateLabel = `${parts[1]}/${parts[2]}`;

      document.getElementById('cal-daily-wrap').innerHTML = `
        <div class="cal-daily-header">
          <span class="cal-daily-title">Daily Transactions</span>
          <span class="cal-daily-date">${dateLabel}</span>
        </div>
        ${dayTxns.length ? `
          <div class="transaction-list">
            ${dayTxns.map(t => `
              <div class="transaction-item">
                <div class="txn-icon ${t.type}">${getCatIcon(t.category)}</div>
                <div class="txn-left">
                  <span class="txn-name">${t.description || t.category}</span>
                  <span class="txn-meta">${t.category}</span>
                </div>
                <div class="txn-right">
                  <span class="txn-amount ${t.type}">${t.type === 'income' ? '+' : '-'}฿${formatMoney(t.amount)}</span>
                </div>
              </div>
            `).join('')}
          </div>
        ` : '<p class="no-data">ไม่มีรายการในวันนี้</p>'}`;
    }
    loadMonth();
  }

  // ══════════════════════════════════════
  // REMINDERS
  // ══════════════════════════════════════
  async function renderReminders(el) {
    el.innerHTML = `<div>
      <button class="btn btn-primary btn-full" id="btn-add-reminder" style="margin-bottom:16px">${mi('add_circle', 'mi-sm')} เพิ่มรายการแจ้งเตือน</button>
      <div id="reminder-list-container"></div>
      <div id="reminder-form-container" class="hidden"></div>
    </div>`;

    const listContainer = document.getElementById('reminder-list-container');
    const formContainer = document.getElementById('reminder-form-container');

    async function loadReminders() {
      showLoading(listContainer);
      try {
        const reminders = await API.getReminders();
        if (!reminders || !reminders.length) { listContainer.innerHTML = '<p class="no-data">ยังไม่มีรายการแจ้งเตือน</p>'; return; }
        listContainer.innerHTML = reminders.map(r => `
          <div class="reminder-card ${r.active ? '' : 'inactive'}">
            <div class="reminder-header">
              <span class="reminder-name">${r.name}</span>
              <label class="switch"><input type="checkbox" ${r.active ? 'checked' : ''} data-id="${r.id}" class="toggle-active"><span class="slider"></span></label>
            </div>
            <div class="reminder-details">
              <span>${mi('event', 'mi-sm')} ${formatDate(r.dueDate)}</span>
              <span>${mi('payments', 'mi-sm')} ${formatMoney(r.amount)} ฿</span>
              <span>${mi('repeat', 'mi-sm')} ${r.frequency === 'monthly' ? 'รายเดือน' : r.frequency === 'yearly' ? 'รายปี' : 'ครั้งเดียว'}</span>
            </div>
            <div class="reminder-actions">
              <button class="btn-sm btn-edit" data-id="${r.id}">${mi('edit', 'mi-sm')} แก้ไข</button>
              <button class="btn-sm btn-delete" data-id="${r.id}">${mi('delete', 'mi-sm')} ลบ</button>
            </div>
          </div>
        `).join('');
        listContainer.querySelectorAll('.toggle-active').forEach(chk => {
          chk.addEventListener('change', async () => { try { await API.toggleReminder(chk.dataset.id); loadReminders(); } catch (err) { showToast(err.message, 'error'); } });
        });
        listContainer.querySelectorAll('.btn-delete').forEach(btn => {
          btn.addEventListener('click', async () => { if (!confirm('ลบ?')) return; try { await API.deleteReminder(btn.dataset.id); showToast('ลบสำเร็จ'); loadReminders(); } catch (err) { showToast(err.message, 'error'); } });
        });
        listContainer.querySelectorAll('.btn-edit').forEach(btn => {
          btn.addEventListener('click', () => { const r = reminders.find(x => x.id === btn.dataset.id); if (r) showReminderForm(r); });
        });
      } catch (err) { listContainer.innerHTML = `<div class="error-page"><p>${mi('error')} ${err.message}</p></div>`; }
    }

    function showReminderForm(editData = null) {
      const isEdit = !!editData;
      formContainer.classList.remove('hidden');
      formContainer.innerHTML = `
        <div class="form-overlay"><div class="form-modal">
          <h3>${isEdit ? mi('edit', 'mi-sm') + ' แก้ไขแจ้งเตือน' : mi('add_circle', 'mi-sm') + ' เพิ่มแจ้งเตือน'}</h3>
          <form id="reminder-form" class="form">
            <div class="form-group"><label>ชื่อรายการ</label><input type="text" id="rem-name" class="input-field" value="${editData?.name || ''}" required></div>
            <div class="form-group"><label>วันครบกำหนด</label><input type="date" id="rem-due" class="input-field" value="${editData?.dueDate || ''}" required></div>
            <div class="form-group"><label>จำนวนเงิน</label><input type="number" id="rem-amount" class="input-field" value="${editData?.amount || ''}" inputmode="decimal" step="0.01"></div>
            <div class="form-group"><label>ความถี่</label><select id="rem-freq" class="input-field">
              <option value="once" ${editData?.frequency === 'once' ? 'selected' : ''}>ครั้งเดียว</option>
              <option value="monthly" ${editData?.frequency === 'monthly' ? 'selected' : ''}>รายเดือน</option>
              <option value="yearly" ${editData?.frequency === 'yearly' ? 'selected' : ''}>รายปี</option>
            </select></div>
            <div class="form-group"><label>หมวดหมู่</label><input type="text" id="rem-cat" class="input-field" value="${editData?.category || ''}"></div>
            <div class="form-group"><label>แจ้งเตือนก่อนกี่วัน</label><input type="number" id="rem-notify-days" class="input-field" min="0" max="30" value="${editData?.notifyDaysBefore ?? 3}"></div>
            <div class="form-buttons">
              <button type="button" class="btn btn-outline" id="btn-cancel-rem">ยกเลิก</button>
              <button type="submit" class="btn btn-primary" id="btn-save-rem">${isEdit ? 'บันทึก' : 'เพิ่ม'}</button>
            </div>
          </form>
        </div></div>`;
      document.getElementById('btn-cancel-rem').addEventListener('click', () => { formContainer.classList.add('hidden'); formContainer.innerHTML = ''; });
      document.getElementById('reminder-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-save-rem'); btn.disabled = true;
        try {
          const data = { name: document.getElementById('rem-name').value, dueDate: document.getElementById('rem-due').value,
            amount: Number(document.getElementById('rem-amount').value) || 0, frequency: document.getElementById('rem-freq').value,
            category: document.getElementById('rem-cat').value || 'อื่นๆ', notifyDaysBefore: Number(document.getElementById('rem-notify-days').value) || 3 };
          if (isEdit) { data.id = editData.id; await API.updateReminder(data); showToast('แก้ไขสำเร็จ'); }
          else { await API.addReminder(data); showToast('เพิ่มสำเร็จ'); }
          formContainer.classList.add('hidden'); formContainer.innerHTML = ''; loadReminders();
        } catch (err) { showToast(err.message, 'error'); } finally { btn.disabled = false; }
      });
    }
    document.getElementById('btn-add-reminder').addEventListener('click', () => showReminderForm());
    loadReminders();
  }

  // ══════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════
  async function renderSummary(el) {
    const month = getCurrentMonth();
    const year = new Date().getFullYear().toString();
    el.innerHTML = `<div class="sum-page">
      <div class="month-picker">
        <button class="btn-icon" id="sum-month-prev">${mi('chevron_left')}</button>
        <input type="month" id="sum-month-select" value="${month}" class="input-field input-month">
        <button class="btn-icon" id="sum-month-next">${mi('chevron_right')}</button>
      </div>
      <div id="summary-content"></div>
      <div class="section-header"><span class="section-title">${mi('bar_chart', 'mi-sm')} ภาพรวมปี ${year}</span></div>
      <div id="yearly-chart"></div>
    </div>`;
    const monthInput = document.getElementById('sum-month-select');
    const content = document.getElementById('summary-content');

    async function loadSummary() {
      showLoading(content);
      try {
        const data = await API.getMonthlySummary(monthInput.value);
        const balance = data.balance || 0;
        const balClass = balance >= 0 ? 'positive' : 'negative';
        content.innerHTML = `
          <div class="sum-balance-card ${balClass}">
            <div class="sum-bal-label">ยอมคงเหลือ</div>
            <div class="sum-bal-value">${balance >= 0 ? '+' : ''}${formatMoney(balance)}</div>
            <div class="sum-bal-row">
              <div class="sum-bal-item income">
                <span class="sum-bal-dot"></span>
                <span class="sum-bal-item-label">รายรับ</span>
                <span class="sum-bal-item-val">+${formatMoney(data.totalIncome)}</span>
              </div>
              <div class="sum-bal-item expense">
                <span class="sum-bal-dot"></span>
                <span class="sum-bal-item-label">รายจ่าย</span>
                <span class="sum-bal-item-val">-${formatMoney(data.totalExpense)}</span>
              </div>
            </div>
          </div>
          <div class="sum-breakdown-card">
            <div class="sum-breakdown-header">
              <div>
                <div class="sum-breakdown-title">Content Breakdown</div>
                <div class="sum-breakdown-sub">สัดส่วนรายจ่ายตามหมวด</div>
              </div>
            </div>
            <div id="category-donut"></div>
          </div>`;
        const totalExp = data.totalExpense || 0;
        Charts.donutChart(document.getElementById('category-donut'), data.categoryBreakdown, {
          size: 200,
          centerLabel: '100%',
          centerSub: 'TOTAL EXPENSE'
        });
      } catch (err) { content.innerHTML = `<div class="error-page"><p>${mi('error')} ${err.message}</p></div>`; }
    }
    async function loadYearly() {
      const yearlyEl = document.getElementById('yearly-chart');
      try { const yearVal = monthInput.value.split('-')[0]; const yearlyData = await API.getYearlySummary(yearVal); Charts.barChart(yearlyEl, yearlyData); } catch {}
    }
    monthInput.addEventListener('change', () => { loadSummary(); loadYearly(); });
    document.getElementById('sum-month-prev').addEventListener('click', () => { const d = new Date(monthInput.value + '-01'); d.setMonth(d.getMonth() - 1); monthInput.value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); loadSummary(); loadYearly(); });
    document.getElementById('sum-month-next').addEventListener('click', () => { const d = new Date(monthInput.value + '-01'); d.setMonth(d.getMonth() + 1); monthInput.value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); loadSummary(); loadYearly(); });
    loadSummary(); loadYearly();
  }

  // ══════════════════════════════════════
  // PROFILE
  // ══════════════════════════════════════
  async function renderProfile(el) {
    showLoading(el);
    try {
      const profile = await API.getProfile();
      profileCache = profile;
      const initials = (profile.displayName || 'U').charAt(0).toUpperCase();
      const avatarColor = profile.avatarColor || '#1a3a6b';
      const name = profile.displayName || 'ยังไม่ได้ตั้งชื่อ';
      const email = profile.email || '';

      el.innerHTML = `
        <div class="profile-page">
          <div class="profile-card">
            <div class="profile-avatar-lg" id="avatar-picker" style="background:${avatarColor}">
              <span class="profile-initial">${initials}</span>
              <div class="profile-avatar-edit">${mi('edit', 'mi-sm')}</div>
            </div>
            <div class="profile-name">${name}</div>
            ${email ? `<div class="profile-email">${email}</div>` : ''}
          </div>

          <div class="profile-section">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
              <h3 style="margin:0">Account Information</h3>
              <button class="section-link" id="btn-edit-profile">Edit All</button>
            </div>
            <div class="profile-info-row">
              <div class="profile-info-label">FULL NAME</div>
              <div class="profile-info-value">${profile.displayName || '-'}</div>
            </div>
            <div class="profile-info-row">
              <div class="profile-info-label">NICKNAME</div>
              <div class="profile-info-value">${profile.nickname || '-'}</div>
            </div>
            <div class="profile-info-row">
              <div class="profile-info-label">EMAIL ADDRESS</div>
              <div class="profile-info-value">${profile.email || '-'}</div>
            </div>
            <div class="profile-info-row">
              <div class="profile-info-label">PHONE</div>
              <div class="profile-info-value">${profile.phone || '-'}</div>
            </div>
            <div class="profile-info-row">
              <div class="profile-info-label">BIRTHDAY</div>
              <div class="profile-info-value">${profile.birthday ? formatDate(profile.birthday) : '-'}</div>
            </div>
          </div>

          <div class="profile-section">
            <h3>Notification Preferences</h3>
            <div class="notification-pref-item">
              <div class="notif-pref-icon" style="background:#dbeafe;color:#3b82f6">${mi('notifications')}</div>
              <div class="notif-pref-info">
                <div class="notif-pref-name">Push Notifications</div>
                <div class="notif-pref-desc">แจ้งเตือนการชำระรายวัน</div>
              </div>
              <label class="switch"><input type="checkbox" checked disabled><span class="slider"></span></label>
            </div>
            <div class="notification-pref-item">
              <div class="notif-pref-icon" style="background:#dcfce7;color:#22c55e">${mi('smartphone')}</div>
              <div class="notif-pref-info">
                <div class="notif-pref-name">LINE Notify</div>
                <div class="notif-pref-desc">${settings?.hasLineToken ? mi('check_circle', 'mi-sm') + ' เชื่อมต่อแล้ว' : 'ยังไม่ได้เชื่อมต่อ'}</div>
              </div>
              <button class="btn-sm" onclick="App.navigate('settings')">ตั้งค่า</button>
            </div>
          </div>

          <div class="profile-section">
            <h3>จัดการ</h3>
            <div style="display:flex;flex-direction:column;gap:8px">
              <button class="btn btn-outline btn-full" onclick="App.navigate('reminders')">${mi('notifications', 'mi-sm')} จัดการแจ้งเตือน</button>
              <button class="btn btn-outline btn-full" onclick="App.navigate('summary')">${mi('bar_chart', 'mi-sm')} สรุปรายเดือน</button>
              <button class="btn btn-outline btn-full" onclick="App.navigate('settings')">${mi('settings', 'mi-sm')} ตั้งค่าทั้งหมด</button>
            </div>
          </div>

          <div class="profile-section">
            <h3>${mi('shield', 'mi-sm')} ความปลอดภัย</h3>
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0">
              <div><div style="font-weight:500">PIN เข้าใช้งาน</div><div style="font-size:0.75rem;color:var(--success)">${mi('check_circle', 'mi-sm')} ตั้งค่าแล้ว</div></div>
              <button class="btn-sm" id="btn-go-change-pin">เปลี่ยน PIN</button>
            </div>
          </div>

          <button class="btn btn-danger btn-full" id="btn-logout-profile" style="margin-top:8px">${mi('logout', 'mi-sm')} ออกจากระบบ</button>
        </div>

        <div id="color-modal" class="form-overlay hidden">
          <div class="form-modal">
            <h3>เลือกสีโปรไฟล์</h3>
            <div class="color-grid">${
              ['#1a3a6b','#2d5aa0','#3b82f6','#6366f1','#8b5cf6','#a855f7',
               '#ec4899','#ef4444','#f59e0b','#f97316','#22c55e','#06b6d4',
               '#14b8a6','#64748b','#334155','#0f172a'].map(c =>
                `<button type="button" class="color-btn" data-color="${c}" style="background:${c}"></button>`
              ).join('')}
            </div>
            <button class="btn btn-outline btn-full" id="btn-close-color">ปิด</button>
          </div>
        </div>

        <div id="edit-profile-modal" class="form-overlay hidden">
          <div class="form-modal">
            <h3>${mi('edit_note', 'mi-sm')} แก้ไขข้อมูล</h3>
            <form id="profile-form" class="form">
              <div class="form-group"><label>FULL NAME</label><input type="text" id="pf-name" class="input-field" value="${profile.displayName || ''}"></div>
              <div class="form-group"><label>NICKNAME</label><input type="text" id="pf-nick" class="input-field" value="${profile.nickname || ''}"></div>
              <div class="form-group"><label>EMAIL</label><input type="email" id="pf-email" class="input-field" value="${profile.email || ''}"></div>
              <div class="form-group"><label>PHONE</label><input type="tel" id="pf-phone" class="input-field" value="${profile.phone || ''}"></div>
              <div class="form-group"><label>BIRTHDAY</label><input type="date" id="pf-birthday" class="input-field" value="${profile.birthday || ''}"></div>
              <div class="form-group"><label>BIO</label><textarea id="pf-bio" class="input-field" rows="3">${profile.bio || ''}</textarea></div>
              <div class="form-buttons">
                <button type="button" class="btn btn-outline" id="btn-cancel-profile">ยกเลิก</button>
                <button type="submit" class="btn btn-primary" id="btn-save-profile">บันทึก</button>
              </div>
            </form>
          </div>
        </div>`;

      // Color picker
      document.getElementById('avatar-picker').addEventListener('click', () => document.getElementById('color-modal').classList.remove('hidden'));
      document.getElementById('btn-close-color').addEventListener('click', () => document.getElementById('color-modal').classList.add('hidden'));
      document.querySelectorAll('.color-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const color = btn.dataset.color;
          document.querySelector('.profile-avatar-lg').style.background = color;
          document.getElementById('color-modal').classList.add('hidden');
          try { await API.updateProfile({ avatarColor: color }); profileCache.avatarColor = color; updateHeaderAvatar(); } catch {}
        });
      });

      // Edit profile modal
      document.getElementById('btn-edit-profile').addEventListener('click', () => document.getElementById('edit-profile-modal').classList.remove('hidden'));
      document.getElementById('btn-cancel-profile').addEventListener('click', () => document.getElementById('edit-profile-modal').classList.add('hidden'));
      document.getElementById('profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-save-profile'); btn.disabled = true; btn.textContent = 'กำลังบันทึก...';
        try {
          await API.updateProfile({
            displayName: document.getElementById('pf-name').value.trim(),
            nickname: document.getElementById('pf-nick').value.trim(),
            email: document.getElementById('pf-email').value.trim(),
            phone: document.getElementById('pf-phone').value.trim(),
            birthday: document.getElementById('pf-birthday').value,
            bio: document.getElementById('pf-bio').value.trim()
          });
          showToast('บันทึกสำเร็จ');
          document.getElementById('edit-profile-modal').classList.add('hidden');
          renderProfile(el);
        } catch (err) { showToast(err.message, 'error'); }
        finally { btn.disabled = false; btn.textContent = 'บันทึก'; }
      });

      document.getElementById('btn-go-change-pin').addEventListener('click', () => navigate('settings'));
      document.getElementById('btn-logout-profile').addEventListener('click', Auth.logout);
    } catch (err) {
      el.innerHTML = `<div class="error-page"><p>${mi('error')} ${err.message}</p><button class="btn btn-primary" onclick="App.navigate('profile')">ลองใหม่</button></div>`;
    }
  }

  // ══════════════════════════════════════
  // SETTINGS
  // ══════════════════════════════════════
  function renderSettings(el) {
    el.innerHTML = `
      <div class="settings-page">
        <div class="settings-group">
          <h3>${mi('key', 'mi-sm')} เปลี่ยน PIN</h3>
          <div class="form-group"><input type="password" id="old-pin" class="input-field" placeholder="PIN เดิม" inputmode="numeric" maxlength="6"></div>
          <div class="form-group"><input type="password" id="new-pin" class="input-field" placeholder="PIN ใหม่ (4-6 หลัก)" inputmode="numeric" maxlength="6"></div>
          <button class="btn btn-primary btn-full" id="btn-change-pin">เปลี่ยน PIN</button>
        </div>
        <div class="settings-group">
          <h3>${mi('smartphone', 'mi-sm')} LINE Notify</h3>
          <p class="settings-hint">ลงทะเบียนที่ <a href="https://notify-bot.line.me/" target="_blank" rel="noopener">notify-bot.line.me</a></p>
          <div class="form-group"><input type="text" id="line-token" class="input-field" placeholder="LINE Notify Access Token"></div>
          <button class="btn btn-primary btn-full" id="btn-save-line">บันทึก LINE Token</button>
          <p id="line-status" class="settings-hint"></p>
        </div>
        <div class="settings-group">
          <h3>${mi('label', 'mi-sm')} หมวดหมู่รายจ่าย</h3>
          <div id="cats-expense-list" class="tag-list"></div>
          <div class="form-row"><input type="text" id="new-cat-expense" class="input-field" placeholder="เพิ่มหมวดหมู่"><button class="btn btn-primary" id="btn-add-cat-expense">เพิ่ม</button></div>
        </div>
        <div class="settings-group">
          <h3>${mi('label', 'mi-sm')} หมวดหมู่รายรับ</h3>
          <div id="cats-income-list" class="tag-list"></div>
          <div class="form-row"><input type="text" id="new-cat-income" class="input-field" placeholder="เพิ่มหมวดหมู่"><button class="btn btn-primary" id="btn-add-cat-income">เพิ่ม</button></div>
        </div>
        <div class="settings-group">
          <button class="btn btn-danger btn-full" id="btn-logout-settings">${mi('logout', 'mi-sm')} ออกจากระบบ</button>
        </div>
      </div>`;

    document.getElementById('btn-change-pin').addEventListener('click', async () => {
      const oldPin = document.getElementById('old-pin').value;
      const newPin = document.getElementById('new-pin').value;
      try { await API.changePin(oldPin, newPin); showToast('เปลี่ยน PIN สำเร็จ'); document.getElementById('old-pin').value = ''; document.getElementById('new-pin').value = ''; }
      catch (err) { showToast(err.message, 'error'); }
    });

    const lineStatus = document.getElementById('line-status');
    if (settings?.hasLineToken) lineStatus.innerHTML = mi('check_circle', 'mi-sm') + ' ตั้ง LINE Token แล้ว';
    document.getElementById('btn-save-line').addEventListener('click', async () => {
      const token = document.getElementById('line-token').value.trim();
      if (!token) { showToast('กรุณาใส่ Token', 'error'); return; }
      try { await API.updateSetting('lineToken', token); showToast('บันทึกสำเร็จ'); lineStatus.innerHTML = mi('check_circle', 'mi-sm') + ' ตั้ง LINE Token แล้ว'; document.getElementById('line-token').value = ''; }
      catch (err) { showToast(err.message, 'error'); }
    });

    function renderCatTags(containerId, cats, type) {
      const container = document.getElementById(containerId);
      container.innerHTML = cats.map(c => `<span class="tag">${c} <button class="tag-remove" data-cat="${c}" data-type="${type}">${mi('close', 'mi-sm')}</button></span>`).join('');
      container.querySelectorAll('.tag-remove').forEach(btn => {
        btn.addEventListener('click', async () => {
          const cat = btn.dataset.cat; const t = btn.dataset.type;
          const key = t === 'expense' ? 'categories_expense' : 'categories_income';
          const curr = t === 'expense' ? [...(settings?.categories_expense || [])] : [...(settings?.categories_income || [])];
          const updated = curr.filter(c => c !== cat);
          try { await API.updateSetting(key, updated);
            if (t === 'expense') settings.categories_expense = updated; else settings.categories_income = updated;
            renderCatTags(containerId, updated, t); showToast('ลบสำเร็จ');
          } catch (err) { showToast(err.message, 'error'); }
        });
      });
    }
    renderCatTags('cats-expense-list', settings?.categories_expense || [], 'expense');
    renderCatTags('cats-income-list', settings?.categories_income || [], 'income');

    function bindAddCat(btnId, inputId, type) {
      document.getElementById(btnId).addEventListener('click', async () => {
        const input = document.getElementById(inputId); const val = input.value.trim();
        if (!val) return;
        const key = type === 'expense' ? 'categories_expense' : 'categories_income';
        const curr = type === 'expense' ? [...(settings?.categories_expense || [])] : [...(settings?.categories_income || [])];
        if (curr.includes(val)) { showToast('มีอยู่แล้ว', 'error'); return; }
        curr.push(val);
        try { await API.updateSetting(key, curr);
          if (type === 'expense') settings.categories_expense = curr; else settings.categories_income = curr;
          renderCatTags(type === 'expense' ? 'cats-expense-list' : 'cats-income-list', curr, type);
          input.value = ''; showToast('เพิ่มสำเร็จ');
        } catch (err) { showToast(err.message, 'error'); }
      });
    }
    bindAddCat('btn-add-cat-expense', 'new-cat-expense', 'expense');
    bindAddCat('btn-add-cat-income', 'new-cat-income', 'income');
    document.getElementById('btn-logout-settings').addEventListener('click', Auth.logout);
  }

  return { init, navigate };
})();

// ── Boot ──
document.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  App.init();
});
