// ====================================================
// BFM App — Main Controller & Routing
// ====================================================

const App = (() => {
  let currentTab = 'dashboard';
  let settings = null;

  // ── Format Helpers ──
  function formatMoney(n) {
    return Number(n || 0).toLocaleString('th-TH');
  }

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
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  async function init() {
    const app = document.getElementById('app');

    // Auth flow
    Auth.startAuthFlow(app, async () => {
      // Authenticated — render main UI
      app.innerHTML = renderShell();
      bindNav();
      try {
        settings = await API.getSettings();
      } catch { settings = {}; }
      navigate('dashboard');
      checkNotifications();
    });
  }

  function renderShell() {
    return `
      <div class="app-shell">
        <header class="app-header">
          <h1 id="page-title">BFM</h1>
          <button class="btn-icon" id="btn-logout" title="ออกจากระบบ">🔒</button>
        </header>
        <div id="notification-bar" class="notification-bar hidden"></div>
        <main id="main-content" class="main-content"></main>
        <nav class="bottom-nav">
          <button class="nav-btn active" data-tab="dashboard">
            <span class="nav-icon">🏠</span><span class="nav-label">หน้าหลัก</span>
          </button>
          <button class="nav-btn" data-tab="add">
            <span class="nav-icon">➕</span><span class="nav-label">เพิ่ม</span>
          </button>
          <button class="nav-btn" data-tab="transactions">
            <span class="nav-icon">📋</span><span class="nav-label">รายการ</span>
          </button>
          <button class="nav-btn" data-tab="reminders">
            <span class="nav-icon">🔔</span><span class="nav-label">แจ้งเตือน</span>
          </button>
          <button class="nav-btn" data-tab="summary">
            <span class="nav-icon">📊</span><span class="nav-label">สรุป</span>
          </button>
          <button class="nav-btn" data-tab="settings">
            <span class="nav-icon">⚙️</span><span class="nav-label">ตั้งค่า</span>
          </button>
        </nav>
      </div>`;
  }

  function bindNav() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => navigate(btn.dataset.tab));
    });
    document.getElementById('btn-logout').addEventListener('click', Auth.logout);
  }

  function navigate(tab) {
    currentTab = tab;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));

    const titles = {
      dashboard: 'BFM', add: 'เพิ่มรายการ', transactions: 'รายการทั้งหมด',
      reminders: 'แจ้งเตือน', summary: 'สรุปรายเดือน', settings: 'ตั้งค่า'
    };
    document.getElementById('page-title').textContent = titles[tab] || 'BFM';

    const main = document.getElementById('main-content');
    switch (tab) {
      case 'dashboard': renderDashboard(main); break;
      case 'add': renderAddTransaction(main); break;
      case 'transactions': renderTransactions(main); break;
      case 'reminders': renderReminders(main); break;
      case 'summary': renderSummary(main); break;
      case 'settings': renderSettings(main); break;
    }
  }

  // ── Notifications Banner ──
  async function checkNotifications() {
    try {
      const upcoming = await API.getUpcomingReminders(7);
      if (upcoming && upcoming.length > 0) {
        const bar = document.getElementById('notification-bar');
        const msgs = upcoming.map(r =>
          `⚠️ ${r.name} — ครบกำหนด${r.daysLeft === 0 ? 'วันนี้!' : 'อีก ' + r.daysLeft + ' วัน'} (${formatMoney(r.amount)} ฿)`
        );
        bar.innerHTML = msgs.join('<br>') + `<button class="notif-close" onclick="this.parentElement.classList.add('hidden')">✕</button>`;
        bar.classList.remove('hidden');
      }
    } catch {}
  }

  // ══════════════════════════════════════
  // DASHBOARD
  // ══════════════════════════════════════
  async function renderDashboard(el) {
    showLoading(el);
    try {
      const month = getCurrentMonth();
      const [summaryData, transactions, upcoming] = await Promise.all([
        API.getMonthlySummary(month),
        API.getTransactions(month),
        API.getUpcomingReminders(7)
      ]);

      const recent = (transactions || []).slice(0, 5);
      const upcomingList = upcoming || [];

      el.innerHTML = `
        <div class="dashboard">
          <div class="summary-cards">
            <div class="card card-income">
              <div class="card-label">รายรับเดือนนี้</div>
              <div class="card-value">+${formatMoney(summaryData.totalIncome)}</div>
            </div>
            <div class="card card-expense">
              <div class="card-label">รายจ่ายเดือนนี้</div>
              <div class="card-value">-${formatMoney(summaryData.totalExpense)}</div>
            </div>
            <div class="card card-balance ${summaryData.balance >= 0 ? 'positive' : 'negative'}">
              <div class="card-label">คงเหลือ</div>
              <div class="card-value">${summaryData.balance >= 0 ? '+' : ''}${formatMoney(summaryData.balance)}</div>
            </div>
          </div>

          ${upcomingList.length ? `
          <div class="section">
            <h3 class="section-title">🔔 การชำระที่ใกล้ถึง</h3>
            <div class="reminder-list">
              ${upcomingList.map(r => `
                <div class="reminder-item ${r.daysLeft === 0 ? 'urgent' : r.daysLeft <= 2 ? 'warning' : ''}">
                  <div class="reminder-info">
                    <span class="reminder-name">${r.name}</span>
                    <span class="reminder-due">${r.daysLeft === 0 ? 'วันนี้!' : 'อีก ' + r.daysLeft + ' วัน'}</span>
                  </div>
                  <span class="reminder-amount">${formatMoney(r.amount)} ฿</span>
                </div>
              `).join('')}
            </div>
          </div>` : ''}

          <div class="section">
            <h3 class="section-title">📋 รายการล่าสุด</h3>
            ${recent.length ? `
              <div class="transaction-list">
                ${recent.map(t => `
                  <div class="transaction-item">
                    <div class="txn-left">
                      <span class="txn-cat">${t.category}</span>
                      <span class="txn-desc">${t.description || '-'}</span>
                    </div>
                    <div class="txn-right">
                      <span class="txn-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${formatMoney(t.amount)}</span>
                      <span class="txn-date">${formatDate(t.date)}</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : '<p class="no-data">ยังไม่มีรายการเดือนนี้</p>'}
          </div>
        </div>`;
    } catch (err) {
      el.innerHTML = `<div class="error-page"><p>⚠️ ${err.message}</p><button class="btn btn-primary" onclick="App.navigate('dashboard')">ลองใหม่</button></div>`;
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

    el.innerHTML = `
      <div class="form-page">
        <div class="type-toggle">
          <button class="toggle-btn ${type === 'expense' ? 'active' : ''}" data-type="expense">รายจ่าย</button>
          <button class="toggle-btn ${type === 'income' ? 'active' : ''}" data-type="income">รายรับ</button>
        </div>
        <form id="txn-form" class="form">
          <input type="hidden" id="txn-id" value="${editData?.id || ''}">
          <input type="hidden" id="txn-type" value="${type}">

          <div class="form-group">
            <label>จำนวนเงิน (บาท)</label>
            <input type="number" id="txn-amount" class="input-field input-amount" placeholder="0"
                   value="${editData?.amount || ''}" inputmode="decimal" step="0.01" required>
          </div>

          <div class="form-group">
            <label>หมวดหมู่</label>
            <div class="category-grid" id="category-grid">
              ${cats.map(c => `<button type="button" class="cat-btn ${editData?.category === c ? 'active' : ''}" data-cat="${c}">${c}</button>`).join('')}
            </div>
            <input type="hidden" id="txn-category" value="${editData?.category || ''}">
          </div>

          <div class="form-group">
            <label>วันที่</label>
            <input type="date" id="txn-date" class="input-field" value="${editData?.date || getToday()}">
          </div>

          <div class="form-group">
            <label>รายละเอียด (ไม่บังคับ)</label>
            <input type="text" id="txn-desc" class="input-field" placeholder="เช่น ข้าวมันไก่"
                   value="${editData?.description || ''}">
          </div>

          <button type="submit" class="btn btn-primary btn-full" id="btn-save-txn">
            ${isEdit ? '💾 บันทึกการแก้ไข' : '✅ บันทึกรายการ'}
          </button>
        </form>
      </div>`;

    // Bind type toggle
    el.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.type;
        document.getElementById('txn-type').value = t;
        el.querySelectorAll('.toggle-btn').forEach(b => b.classList.toggle('active', b.dataset.type === t));
        const newCats = t === 'income' ? cats_inc : cats_exp;
        const grid = document.getElementById('category-grid');
        grid.innerHTML = newCats.map(c => `<button type="button" class="cat-btn" data-cat="${c}">${c}</button>`).join('');
        document.getElementById('txn-category').value = '';
        bindCatButtons();
      });
    });

    function bindCatButtons() {
      el.querySelectorAll('.cat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          el.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          document.getElementById('txn-category').value = btn.dataset.cat;
        });
      });
    }
    bindCatButtons();

    // Form submit
    document.getElementById('txn-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const amount = document.getElementById('txn-amount').value;
      const category = document.getElementById('txn-category').value;
      if (!amount || Number(amount) <= 0) { showToast('กรุณาใส่จำนวนเงิน', 'error'); return; }
      if (!category) { showToast('กรุณาเลือกหมวดหมู่', 'error'); return; }

      const btn = document.getElementById('btn-save-txn');
      btn.disabled = true;
      btn.textContent = 'กำลังบันทึก...';

      try {
        const data = {
          type: document.getElementById('txn-type').value,
          amount: Number(amount),
          category,
          date: document.getElementById('txn-date').value,
          description: document.getElementById('txn-desc').value
        };

        if (isEdit) {
          data.id = editData.id;
          await API.editTransaction(data);
          showToast('แก้ไขสำเร็จ');
          navigate('transactions');
        } else {
          await API.addTransaction(data);
          showToast('บันทึกสำเร็จ');
          // Reset form
          document.getElementById('txn-amount').value = '';
          document.getElementById('txn-desc').value = '';
          document.getElementById('txn-category').value = '';
          el.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
        }
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = isEdit ? '💾 บันทึกการแก้ไข' : '✅ บันทึกรายการ';
      }
    });
  }

  // ══════════════════════════════════════
  // TRANSACTIONS LIST
  // ══════════════════════════════════════
  async function renderTransactions(el) {
    const month = getCurrentMonth();
    el.innerHTML = `
      <div class="transactions-page">
        <div class="month-picker">
          <button class="btn-icon" id="month-prev">◀</button>
          <input type="month" id="month-select" value="${month}" class="input-field input-month">
          <button class="btn-icon" id="month-next">▶</button>
        </div>
        <div id="txn-list-container"></div>
      </div>`;

    const monthInput = document.getElementById('month-select');
    const container = document.getElementById('txn-list-container');

    async function loadTransactions() {
      showLoading(container);
      try {
        const txns = await API.getTransactions(monthInput.value);
        if (!txns || !txns.length) {
          container.innerHTML = '<p class="no-data">ไม่มีรายการในเดือนนี้</p>';
          return;
        }

        const totalInc = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const totalExp = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

        container.innerHTML = `
          <div class="txn-month-summary">
            <span class="income">+${formatMoney(totalInc)}</span>
            <span class="expense">-${formatMoney(totalExp)}</span>
            <span class="balance ${totalInc - totalExp >= 0 ? 'positive' : 'negative'}">${formatMoney(totalInc - totalExp)}</span>
          </div>
          <div class="transaction-list">
            ${txns.map(t => `
              <div class="transaction-item" data-id="${t.id}">
                <div class="txn-left">
                  <span class="txn-cat">${t.category}</span>
                  <span class="txn-desc">${t.description || '-'}</span>
                </div>
                <div class="txn-right">
                  <span class="txn-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${formatMoney(t.amount)}</span>
                  <span class="txn-date">${formatDate(t.date)}</span>
                </div>
                <div class="txn-actions">
                  <button class="btn-sm btn-edit" data-id="${t.id}" title="แก้ไข">✏️</button>
                  <button class="btn-sm btn-delete" data-id="${t.id}" title="ลบ">🗑️</button>
                </div>
              </div>
            `).join('')}
          </div>`;

        // Bind edit/delete
        container.querySelectorAll('.btn-edit').forEach(btn => {
          btn.addEventListener('click', async () => {
            const txn = txns.find(t => t.id === btn.dataset.id);
            if (txn) renderAddTransaction(document.getElementById('main-content'), txn);
          });
        });
        container.querySelectorAll('.btn-delete').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (!confirm('ลบรายการนี้?')) return;
            try {
              await API.deleteTransaction(btn.dataset.id);
              showToast('ลบสำเร็จ');
              loadTransactions();
            } catch (err) { showToast(err.message, 'error'); }
          });
        });
      } catch (err) {
        container.innerHTML = `<div class="error-page"><p>⚠️ ${err.message}</p></div>`;
      }
    }

    monthInput.addEventListener('change', loadTransactions);
    document.getElementById('month-prev').addEventListener('click', () => {
      const d = new Date(monthInput.value + '-01');
      d.setMonth(d.getMonth() - 1);
      monthInput.value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      loadTransactions();
    });
    document.getElementById('month-next').addEventListener('click', () => {
      const d = new Date(monthInput.value + '-01');
      d.setMonth(d.getMonth() + 1);
      monthInput.value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      loadTransactions();
    });

    loadTransactions();
  }

  // ══════════════════════════════════════
  // REMINDERS
  // ══════════════════════════════════════
  async function renderReminders(el) {
    el.innerHTML = `
      <div class="reminders-page">
        <button class="btn btn-primary btn-full" id="btn-add-reminder">➕ เพิ่มรายการแจ้งเตือน</button>
        <div id="reminder-list-container"></div>
        <div id="reminder-form-container" class="hidden"></div>
      </div>`;

    const listContainer = document.getElementById('reminder-list-container');
    const formContainer = document.getElementById('reminder-form-container');

    async function loadReminders() {
      showLoading(listContainer);
      try {
        const reminders = await API.getReminders();
        if (!reminders || !reminders.length) {
          listContainer.innerHTML = '<p class="no-data">ยังไม่มีรายการแจ้งเตือน</p>';
          return;
        }
        listContainer.innerHTML = reminders.map(r => `
          <div class="reminder-card ${r.active ? '' : 'inactive'}">
            <div class="reminder-header">
              <span class="reminder-name">${r.name}</span>
              <label class="switch">
                <input type="checkbox" ${r.active ? 'checked' : ''} data-id="${r.id}" class="toggle-active">
                <span class="slider"></span>
              </label>
            </div>
            <div class="reminder-details">
              <span>📅 ${formatDate(r.dueDate)}</span>
              <span>💰 ${formatMoney(r.amount)} ฿</span>
              <span>🔁 ${r.frequency === 'monthly' ? 'รายเดือน' : r.frequency === 'yearly' ? 'รายปี' : 'ครั้งเดียว'}</span>
              <span>🔔 แจ้งก่อน ${r.notifyDaysBefore} วัน</span>
            </div>
            <div class="reminder-actions">
              <button class="btn-sm btn-edit" data-id="${r.id}">✏️ แก้ไข</button>
              <button class="btn-sm btn-delete" data-id="${r.id}">🗑️ ลบ</button>
            </div>
          </div>
        `).join('');

        // Bind toggle
        listContainer.querySelectorAll('.toggle-active').forEach(chk => {
          chk.addEventListener('change', async () => {
            try {
              await API.toggleReminder(chk.dataset.id);
              loadReminders();
            } catch (err) { showToast(err.message, 'error'); }
          });
        });

        // Bind delete
        listContainer.querySelectorAll('.btn-delete').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (!confirm('ลบรายการแจ้งเตือนนี้?')) return;
            try {
              await API.deleteReminder(btn.dataset.id);
              showToast('ลบสำเร็จ');
              loadReminders();
            } catch (err) { showToast(err.message, 'error'); }
          });
        });

        // Bind edit
        listContainer.querySelectorAll('.btn-edit').forEach(btn => {
          btn.addEventListener('click', () => {
            const r = reminders.find(x => x.id === btn.dataset.id);
            if (r) showReminderForm(r);
          });
        });
      } catch (err) {
        listContainer.innerHTML = `<div class="error-page"><p>⚠️ ${err.message}</p></div>`;
      }
    }

    function showReminderForm(editData = null) {
      const isEdit = !!editData;
      formContainer.classList.remove('hidden');
      formContainer.innerHTML = `
        <div class="form-overlay">
          <div class="form-modal">
            <h3>${isEdit ? '✏️ แก้ไขแจ้งเตือน' : '➕ เพิ่มแจ้งเตือน'}</h3>
            <form id="reminder-form" class="form">
              <div class="form-group">
                <label>ชื่อรายการ</label>
                <input type="text" id="rem-name" class="input-field" placeholder="เช่น ค่าบัตรเครดิต SCB"
                       value="${editData?.name || ''}" required>
              </div>
              <div class="form-group">
                <label>วันครบกำหนด</label>
                <input type="date" id="rem-due" class="input-field" value="${editData?.dueDate || ''}" required>
              </div>
              <div class="form-group">
                <label>จำนวนเงิน (บาท)</label>
                <input type="number" id="rem-amount" class="input-field" placeholder="0"
                       value="${editData?.amount || ''}" inputmode="decimal" step="0.01">
              </div>
              <div class="form-group">
                <label>ความถี่</label>
                <select id="rem-freq" class="input-field">
                  <option value="once" ${editData?.frequency === 'once' ? 'selected' : ''}>ครั้งเดียว</option>
                  <option value="monthly" ${editData?.frequency === 'monthly' ? 'selected' : ''}>รายเดือน</option>
                  <option value="yearly" ${editData?.frequency === 'yearly' ? 'selected' : ''}>รายปี</option>
                </select>
              </div>
              <div class="form-group">
                <label>หมวดหมู่</label>
                <input type="text" id="rem-cat" class="input-field" placeholder="เช่น บัตรเครดิต"
                       value="${editData?.category || ''}">
              </div>
              <div class="form-group">
                <label>แจ้งเตือนก่อนกี่วัน</label>
                <input type="number" id="rem-notify-days" class="input-field" min="0" max="30"
                       value="${editData?.notifyDaysBefore ?? 3}">
              </div>
              <div class="form-buttons">
                <button type="button" class="btn btn-outline" id="btn-cancel-rem">ยกเลิก</button>
                <button type="submit" class="btn btn-primary" id="btn-save-rem">${isEdit ? 'บันทึก' : 'เพิ่ม'}</button>
              </div>
            </form>
          </div>
        </div>`;

      document.getElementById('btn-cancel-rem').addEventListener('click', () => {
        formContainer.classList.add('hidden');
        formContainer.innerHTML = '';
      });

      document.getElementById('reminder-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-save-rem');
        btn.disabled = true;
        try {
          const data = {
            name: document.getElementById('rem-name').value,
            dueDate: document.getElementById('rem-due').value,
            amount: Number(document.getElementById('rem-amount').value) || 0,
            frequency: document.getElementById('rem-freq').value,
            category: document.getElementById('rem-cat').value || 'อื่นๆ',
            notifyDaysBefore: Number(document.getElementById('rem-notify-days').value) || 3
          };

          if (isEdit) {
            data.id = editData.id;
            await API.updateReminder(data);
            showToast('แก้ไขสำเร็จ');
          } else {
            await API.addReminder(data);
            showToast('เพิ่มสำเร็จ');
          }
          formContainer.classList.add('hidden');
          formContainer.innerHTML = '';
          loadReminders();
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          btn.disabled = false;
        }
      });
    }

    document.getElementById('btn-add-reminder').addEventListener('click', () => showReminderForm());
    loadReminders();
  }

  // ══════════════════════════════════════
  // MONTHLY SUMMARY
  // ══════════════════════════════════════
  async function renderSummary(el) {
    const month = getCurrentMonth();
    const year = new Date().getFullYear().toString();

    el.innerHTML = `
      <div class="summary-page">
        <div class="month-picker">
          <button class="btn-icon" id="sum-month-prev">◀</button>
          <input type="month" id="sum-month-select" value="${month}" class="input-field input-month">
          <button class="btn-icon" id="sum-month-next">▶</button>
        </div>
        <div id="summary-content"></div>
        <h3 class="section-title" style="margin-top:1.5rem">📊 ภาพรวมปี ${year}</h3>
        <div id="yearly-chart"></div>
      </div>`;

    const monthInput = document.getElementById('sum-month-select');
    const content = document.getElementById('summary-content');

    async function loadSummary() {
      showLoading(content);
      try {
        const data = await API.getMonthlySummary(monthInput.value);
        content.innerHTML = `
          <div class="summary-cards">
            <div class="card card-income">
              <div class="card-label">รายรับ</div>
              <div class="card-value">+${formatMoney(data.totalIncome)}</div>
            </div>
            <div class="card card-expense">
              <div class="card-label">รายจ่าย</div>
              <div class="card-value">-${formatMoney(data.totalExpense)}</div>
            </div>
            <div class="card card-balance ${data.balance >= 0 ? 'positive' : 'negative'}">
              <div class="card-label">คงเหลือ</div>
              <div class="card-value">${data.balance >= 0 ? '+' : ''}${formatMoney(data.balance)}</div>
            </div>
          </div>
          ${data.topCategory ? `<p class="top-cat">💸 จ่ายมากสุด: <strong>${data.topCategory}</strong></p>` : ''}
          <h3 class="section-title">📈 รายจ่ายตามหมวดหมู่</h3>
          <div id="category-pie"></div>`;

        Charts.pieChart(document.getElementById('category-pie'), data.categoryBreakdown);
      } catch (err) {
        content.innerHTML = `<div class="error-page"><p>⚠️ ${err.message}</p></div>`;
      }
    }

    // Yearly chart
    async function loadYearly() {
      const yearlyEl = document.getElementById('yearly-chart');
      try {
        const yearVal = monthInput.value.split('-')[0];
        const yearlyData = await API.getYearlySummary(yearVal);
        Charts.barChart(yearlyEl, yearlyData);
      } catch {}
    }

    monthInput.addEventListener('change', () => { loadSummary(); loadYearly(); });
    document.getElementById('sum-month-prev').addEventListener('click', () => {
      const d = new Date(monthInput.value + '-01');
      d.setMonth(d.getMonth() - 1);
      monthInput.value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      loadSummary(); loadYearly();
    });
    document.getElementById('sum-month-next').addEventListener('click', () => {
      const d = new Date(monthInput.value + '-01');
      d.setMonth(d.getMonth() + 1);
      monthInput.value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      loadSummary(); loadYearly();
    });

    loadSummary();
    loadYearly();
  }

  // ══════════════════════════════════════
  // SETTINGS
  // ══════════════════════════════════════
  function renderSettings(el) {
    el.innerHTML = `
      <div class="settings-page">
        <div class="settings-group">
          <h3>🔑 เปลี่ยน PIN</h3>
          <div class="form-group">
            <input type="password" id="old-pin" class="input-field" placeholder="PIN เดิม" inputmode="numeric" maxlength="6">
          </div>
          <div class="form-group">
            <input type="password" id="new-pin" class="input-field" placeholder="PIN ใหม่ (4-6 หลัก)" inputmode="numeric" maxlength="6">
          </div>
          <button class="btn btn-primary btn-full" id="btn-change-pin">เปลี่ยน PIN</button>
        </div>

        <div class="settings-group">
          <h3>📱 LINE Notify</h3>
          <p class="settings-hint">ลงทะเบียนที่ <a href="https://notify-bot.line.me/" target="_blank" rel="noopener">notify-bot.line.me</a> เพื่อรับ Token</p>
          <div class="form-group">
            <input type="text" id="line-token" class="input-field" placeholder="LINE Notify Access Token">
          </div>
          <button class="btn btn-primary btn-full" id="btn-save-line">บันทึก LINE Token</button>
          <p id="line-status" class="settings-hint"></p>
        </div>

        <div class="settings-group">
          <h3>🏷️ จัดการหมวดหมู่รายจ่าย</h3>
          <div id="cats-expense-list" class="tag-list"></div>
          <div class="form-row">
            <input type="text" id="new-cat-expense" class="input-field" placeholder="เพิ่มหมวดหมู่ใหม่">
            <button class="btn btn-primary" id="btn-add-cat-expense">เพิ่ม</button>
          </div>
        </div>

        <div class="settings-group">
          <h3>🏷️ จัดการหมวดหมู่รายรับ</h3>
          <div id="cats-income-list" class="tag-list"></div>
          <div class="form-row">
            <input type="text" id="new-cat-income" class="input-field" placeholder="เพิ่มหมวดหมู่ใหม่">
            <button class="btn btn-primary" id="btn-add-cat-income">เพิ่ม</button>
          </div>
        </div>

        <div class="settings-group">
          <h3>🔗 API URL</h3>
          <p class="settings-hint current-url">${localStorage.getItem('bfm_api_url') || 'ยังไม่ได้ตั้งค่า'}</p>
          <button class="btn btn-outline btn-full" id="btn-reset-url">เปลี่ยน URL</button>
        </div>

        <div class="settings-group">
          <button class="btn btn-danger btn-full" id="btn-logout-settings">🔒 ออกจากระบบ</button>
        </div>
      </div>`;

    // PIN change
    document.getElementById('btn-change-pin').addEventListener('click', async () => {
      const oldPin = document.getElementById('old-pin').value;
      const newPin = document.getElementById('new-pin').value;
      try {
        await API.changePin(oldPin, newPin);
        showToast('เปลี่ยน PIN สำเร็จ');
        document.getElementById('old-pin').value = '';
        document.getElementById('new-pin').value = '';
      } catch (err) { showToast(err.message, 'error'); }
    });

    // LINE Token
    const lineStatus = document.getElementById('line-status');
    if (settings?.hasLineToken) {
      lineStatus.textContent = '✅ ตั้ง LINE Token แล้ว';
    }
    document.getElementById('btn-save-line').addEventListener('click', async () => {
      const token = document.getElementById('line-token').value.trim();
      if (!token) { showToast('กรุณาใส่ Token', 'error'); return; }
      try {
        await API.updateSetting('lineToken', token);
        showToast('บันทึก LINE Token สำเร็จ');
        lineStatus.textContent = '✅ ตั้ง LINE Token แล้ว';
        document.getElementById('line-token').value = '';
      } catch (err) { showToast(err.message, 'error'); }
    });

    // Categories
    function renderCatTags(containerId, cats, type) {
      const container = document.getElementById(containerId);
      container.innerHTML = cats.map(c =>
        `<span class="tag">${c} <button class="tag-remove" data-cat="${c}" data-type="${type}">✕</button></span>`
      ).join('');
      container.querySelectorAll('.tag-remove').forEach(btn => {
        btn.addEventListener('click', async () => {
          const cat = btn.dataset.cat;
          const t = btn.dataset.type;
          const key = t === 'expense' ? 'categories_expense' : 'categories_income';
          const currentCats = t === 'expense' ? [...(settings?.categories_expense || [])] : [...(settings?.categories_income || [])];
          const updated = currentCats.filter(c => c !== cat);
          try {
            await API.updateSetting(key, updated);
            if (t === 'expense') settings.categories_expense = updated;
            else settings.categories_income = updated;
            renderCatTags(containerId, updated, t);
            showToast('ลบหมวดหมู่สำเร็จ');
          } catch (err) { showToast(err.message, 'error'); }
        });
      });
    }

    renderCatTags('cats-expense-list', settings?.categories_expense || [], 'expense');
    renderCatTags('cats-income-list', settings?.categories_income || [], 'income');

    // Add category
    function bindAddCat(btnId, inputId, type) {
      document.getElementById(btnId).addEventListener('click', async () => {
        const input = document.getElementById(inputId);
        const val = input.value.trim();
        if (!val) return;
        const key = type === 'expense' ? 'categories_expense' : 'categories_income';
        const currentCats = type === 'expense' ? [...(settings?.categories_expense || [])] : [...(settings?.categories_income || [])];
        if (currentCats.includes(val)) { showToast('หมวดหมู่นี้มีอยู่แล้ว', 'error'); return; }
        currentCats.push(val);
        try {
          await API.updateSetting(key, currentCats);
          if (type === 'expense') settings.categories_expense = currentCats;
          else settings.categories_income = currentCats;
          renderCatTags(type === 'expense' ? 'cats-expense-list' : 'cats-income-list', currentCats, type);
          input.value = '';
          showToast('เพิ่มหมวดหมู่สำเร็จ');
        } catch (err) { showToast(err.message, 'error'); }
      });
    }
    bindAddCat('btn-add-cat-expense', 'new-cat-expense', 'expense');
    bindAddCat('btn-add-cat-income', 'new-cat-income', 'income');

    // Reset URL
    document.getElementById('btn-reset-url').addEventListener('click', () => {
      if (confirm('ต้องการเปลี่ยน API URL?')) {
        localStorage.removeItem('bfm_api_url');
        location.reload();
      }
    });

    // Logout
    document.getElementById('btn-logout-settings').addEventListener('click', Auth.logout);
  }

  return { init, navigate };
})();

// ── Boot ──
document.addEventListener('DOMContentLoaded', () => {
  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  App.init();
});
