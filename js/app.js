// ====================================================
// BFM App — Banking UI Controller (Material Icons)
// ====================================================

const App = (() => {
  let currentTab = 'home';
  let settings = null;
  let profileCache = null;
  let membersCache = [];
  let currentMember = null; // { id, name, avatarColor, role }
  let loginMember = null;  // The member who logged in (for permissions)

  function isAdmin() { return loginMember && loginMember.role === 'admin'; }

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
    const iconName = type === 'error' ? 'error' : 'notifications_active';
    const badgeIcon = type === 'error' ? 'close' : 'check';
    toast.innerHTML = `
      <div class="toast-icon"><span class="mi">${iconName}</span></div>
      <div class="toast-body">${msg}</div>
      <div class="toast-badge"><span class="mi" style="font-size:0.85rem">${badgeIcon}</span></div>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 2800);
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

  // ── Image Compress Helper ──
  function compressImage(file, maxSize = 200, quality = 0.8) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let w = img.width, h = img.height;
          if (w > h) { if (w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize; } }
          else { if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize; } }
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => reject(new Error('ไม่สามารถอ่านรูปภาพได้'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์ได้'));
      reader.readAsDataURL(file);
    });
  }

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
        API.getProfile().then(p => { profileCache = p; updateHeaderAvatar(); }).catch(() => {}),
        loadMembers()
      ]);
      checkNotifications();
    });
  }

  async function loadMembers() {
    try {
      membersCache = await API.getMembers() || [];
      localStorage.setItem('bfm_members', JSON.stringify(membersCache));
    } catch {
      try { membersCache = JSON.parse(localStorage.getItem('bfm_members') || '[]'); } catch { membersCache = []; }
    }
    // Restore login member (who authenticated)
    try { loginMember = JSON.parse(localStorage.getItem('bfm_login_member') || 'null'); } catch { loginMember = null; }
    // Restore current member
    const saved = localStorage.getItem('bfm_current_member');
    if (saved) {
      currentMember = membersCache.find(m => m.id === saved) || membersCache[0] || null;
    } else {
      currentMember = membersCache[0] || null;
    }
    updateHeaderMember();
  }

  function setCurrentMember(member) {
    currentMember = member;
    if (member) localStorage.setItem('bfm_current_member', member.id);
    else localStorage.removeItem('bfm_current_member');
    updateHeaderMember();
    API.clearCache();
  }

  function updateHeaderMember() {
    const el = document.getElementById('header-member-name');
    const av = document.getElementById('header-avatar');
    if (el) el.textContent = currentMember ? currentMember.name : 'ครอบครัว';
    const photo = localStorage.getItem('bfm_profile_photo');
    if (av && photo) {
      av.style.background = 'none';
      av.innerHTML = `<img src="${photo}" class="header-avatar-img">`;
    } else if (av && currentMember && currentMember.avatarColor) {
      av.style.background = currentMember.avatarColor;
      av.textContent = '';
      av.innerHTML = `<span style="font-size:0.85rem;font-weight:700;color:#fff">${currentMember.name.charAt(0).toUpperCase()}</span>`;
    } else if (av) {
      av.style.background = profileCache?.avatarColor || '#1a3a6b';
      av.innerHTML = mi('person');
    }
  }

  function updateHeaderAvatar() {
    updateHeaderMember();
  }

  function renderShell() {
    return `
      <div class="app-shell">
        <header class="app-header">
          <div class="header-left" id="header-member-switch">
            <div class="header-avatar" id="header-avatar">${mi('person')}</div>
            <div class="header-member-info">
              <span class="header-title">THE PRIVATE BANK</span>
              <span class="header-member-name" id="header-member-name">ครอบครัว</span>
            </div>
            <span class="mi mi-sm" style="color:var(--text-muted);margin-left:2px">expand_more</span>
          </div>
          <div class="header-right">
            <button class="header-notif-btn" id="btn-notif-bell" title="แจ้งเตือน">
              <span class="header-notif-ring">
                ${mi('notifications')}
              </span>
              <span class="header-notif-badge hidden" id="bell-badge">0</span>
            </button>
          </div>
        </header>
        <div id="member-dropdown" class="member-dropdown hidden"></div>
        <div id="notif-panel" class="notif-panel hidden"></div>
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

    // Notification bell
    const bellBtn = document.getElementById('btn-notif-bell');
    const notifPanel = document.getElementById('notif-panel');
    bellBtn.addEventListener('click', () => {
      const open = !notifPanel.classList.contains('hidden');
      if (open) { notifPanel.classList.add('hidden'); return; }
      renderNotifPanel();
      notifPanel.classList.remove('hidden');
    });
    document.addEventListener('click', (e) => {
      if (!bellBtn.contains(e.target) && !notifPanel.contains(e.target)) {
        notifPanel.classList.add('hidden');
      }
    });

    // Member switcher dropdown
    const switchBtn = document.getElementById('header-member-switch');
    const dropdown = document.getElementById('member-dropdown');
    switchBtn.addEventListener('click', () => {
      const open = !dropdown.classList.contains('hidden');
      if (open) { dropdown.classList.add('hidden'); return; }
      renderMemberDropdown();
      dropdown.classList.remove('hidden');
    });
    document.addEventListener('click', (e) => {
      if (!switchBtn.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    });
  }

  function renderMemberDropdown() {
    const dropdown = document.getElementById('member-dropdown');
    const items = membersCache.map(m => {
      const active = currentMember && currentMember.id === m.id;
      return `<div class="member-dd-item ${active ? 'active' : ''}" data-mid="${m.id}">
        <div class="member-dd-avatar" style="background:${m.avatarColor}">${m.name.charAt(0).toUpperCase()}</div>
        <div class="member-dd-name">${m.name}</div>
        ${active ? mi('check_circle', 'mi-sm') : ''}
      </div>`;
    }).join('');

    dropdown.innerHTML = `
      <div class="member-dd-header">สมาชิกครอบครัว</div>
      ${items || '<div class="member-dd-empty">ยังไม่มีสมาชิก</div>'}
      ${isAdmin() ? `<div class="member-dd-divider"></div>
      <div class="member-dd-item member-dd-manage" id="dd-manage-members">
        ${mi('group_add', 'mi-sm')}
        <div class="member-dd-name">จัดการสมาชิก</div>
      </div>` : ''}`;

    dropdown.querySelectorAll('.member-dd-item[data-mid]').forEach(el => {
      el.addEventListener('click', () => {
        const m = membersCache.find(x => x.id === el.dataset.mid);
        if (m) { setCurrentMember(m); navigate(currentTab); }
        dropdown.classList.add('hidden');
      });
    });
    document.getElementById('dd-manage-members')?.addEventListener('click', () => {
      dropdown.classList.add('hidden');
      navigate('members');
    });
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
      case 'members': renderMembers(main); break;
    }
  }

  let notifCache = [];

  async function checkNotifications() {
    try {
      const upcoming = await API.getUpcomingReminders(7);
      notifCache = upcoming || [];
      updateBellBadge();
    } catch { notifCache = []; }
  }

  function updateBellBadge() {
    const badge = document.getElementById('bell-badge');
    if (!badge) return;
    if (notifCache.length > 0) {
      badge.textContent = notifCache.length > 9 ? '9+' : notifCache.length;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  function renderNotifPanel() {
    const panel = document.getElementById('notif-panel');
    if (!notifCache.length) {
      panel.innerHTML = `
        <div class="notif-panel-header">
          <span class="notif-panel-title">${mi('notifications', 'mi-sm')} การแจ้งเตือน</span>
        </div>
        <div class="notif-panel-empty">
          ${mi('notifications_off', 'mi-xl')}
          <p>ไม่มีการแจ้งเตือน</p>
        </div>`;
      return;
    }

    const items = notifCache.map(r => {
      const urgent = r.daysLeft === 0;
      const warn = r.daysLeft <= 2;
      const iconClass = urgent ? 'notif-i-urgent' : (warn ? 'notif-i-warn' : 'notif-i-normal');
      const dueText = urgent ? 'ครบกำหนดวันนี้!' : `อีก ${r.daysLeft} วัน`;
      return `
        <div class="notif-item ${urgent ? 'urgent' : ''}" data-rid="${r.id}">
          <div class="notif-i-icon ${iconClass}">
            ${mi(urgent ? 'error' : 'schedule', 'mi-sm')}
          </div>
          <div class="notif-i-info">
            <div class="notif-i-name">${r.name}</div>
            <div class="notif-i-due">${dueText} · ${formatDate(r.dueDate)}</div>
          </div>
          <div class="notif-i-amount">฿${formatMoney(r.amount)}</div>
        </div>`;
    }).join('');

    panel.innerHTML = `
      <div class="notif-panel-header">
        <span class="notif-panel-title">${mi('notifications', 'mi-sm')} การแจ้งเตือน</span>
        <span class="notif-panel-count">${notifCache.length} รายการ</span>
      </div>
      <div class="notif-panel-list">${items}</div>
      <div class="notif-panel-footer">
        <button class="notif-panel-link" id="notif-go-reminders">${mi('settings', 'mi-sm')} จัดการแจ้งเตือน</button>
      </div>`;

    panel.querySelector('#notif-go-reminders')?.addEventListener('click', () => {
      panel.classList.add('hidden');
      navigate('reminders');
    });
    panel.querySelectorAll('.notif-item').forEach(el => {
      el.addEventListener('click', () => {
        panel.classList.add('hidden');
        navigate('reminders');
      });
    });
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
                  <span class="txn-meta">${t.category}${t.createdBy ? ' • ' + t.createdBy : ''} • ${formatDate(t.date)}</span>
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
          description: document.getElementById('txn-desc').value,
          createdBy: currentMember ? currentMember.name : ''
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
          ${items.map(t => {
            const del = canDelete(t);
            return `
            <div class="hist-txn-row" data-id="${t.id}">
              <div class="hist-txn-icon" style="background:${getCatColor(t.category)}15;color:${getCatColor(t.category)}">
                ${getCatIcon(t.category)}
              </div>
              <div class="hist-txn-info">
                <span class="hist-txn-name">${t.description || t.category}</span>
                <span class="hist-txn-meta">${t.category}${t.createdBy ? ' · ' + t.createdBy : ''} · ${formatDate(t.date)}</span>
              </div>
              <div class="hist-txn-amount ${t.type}">${t.type === 'income' ? '+' : '-'}฿${formatMoney(t.amount)}</div>
            </div>`;
          }).join('')}
        </div>`;
      }
      container.innerHTML = html;

      // Swipe-to-action on each row
      container.querySelectorAll('.hist-txn-row').forEach(row => {
        let startX = 0, currentX = 0, swiping = false;
        row.addEventListener('touchstart', e => {
          if (e.target.closest('.hist-del-btn')) return;
          startX = e.touches[0].clientX; swiping = true;
        }, { passive: true });
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
        row.addEventListener('click', (e) => {
          if (e.target.closest('.hist-del-btn') || e.target.closest('.hist-row-actions')) return;
          if (Math.abs(currentX) < 10) {
            const txn = allTxns.find(t => t.id === row.dataset.id);
            if (txn) renderAddTransaction(document.getElementById('main-content'), txn);
          }
        });
      });
    }

    function canDelete(txn) {
      if (isAdmin()) return true;
      if (!loginMember) return true;  // no member system = allow all
      return txn.createdBy === loginMember.name;
    }

    function showRowActions(row) {
      if (row.querySelector('.hist-row-actions')) return;
      const txn = allTxns.find(t => t.id === row.dataset.id);
      const actions = document.createElement('div');
      actions.className = 'hist-row-actions';
      const showDel = txn && canDelete(txn);
      actions.innerHTML = `
        <button class="hist-act-btn edit">${mi('edit', 'mi-sm')}</button>
        ${showDel ? `<button class="hist-act-btn delete">${mi('delete', 'mi-sm')}</button>` : ''}`;
      row.appendChild(actions);
      actions.querySelector('.edit').addEventListener('click', (e) => {
        e.stopPropagation();
        if (txn) renderAddTransaction(document.getElementById('main-content'), txn);
      });
      if (showDel) {
        actions.querySelector('.delete').addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm('ลบรายการนี้?')) return;
          try { await API.deleteTransaction(row.dataset.id); showToast('ลบสำเร็จ'); loadTransactions(); }
          catch (err) { showToast(err.message, 'error'); }
        });
      }
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
      const remCats = ['ค่ารถ','ค่าบ้าน/เช่า','ค่าน้ำ/ไฟ/เน็ต','ค่าบัตรเครดิต','พรบ./ประกัน','ค่าโทรศัพท์','ค่าเดินทาง','การศึกษา','สุขภาพ','สมาชิก/Subscription','อื่นๆ'];
      const catOptions = remCats.map(c => `<option value="${c}" ${editData?.category === c ? 'selected' : ''}>${c}</option>`).join('');
      const notifyDaysOpts = [1,2,3,5,7,14,30].map(d => `<option value="${d}" ${(editData?.notifyDaysBefore ?? 3) == d ? 'selected' : ''}>${d} วัน</option>`).join('');
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
            <div class="form-group"><label>หมวดหมู่</label><select id="rem-cat" class="input-field">${catOptions}</select></div>
            <div class="form-group"><label>แจ้งเตือนก่อนกี่วัน</label><select id="rem-notify-days" class="input-field">${notifyDaysOpts}</select></div>
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
    const monthNames = ['','มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

    el.innerHTML = `<div class="sum-page">
      <div id="summary-content"></div>
      <div id="yearly-section"></div>
    </div>`;
    const content = document.getElementById('summary-content');
    let currentMonthVal = month;

    function getMonthLabel(mv) {
      const [y, m] = mv.split('-');
      return monthNames[parseInt(m)] + ' ' + y;
    }

    function changeMonth(dir) {
      const d = new Date(currentMonthVal + '-01');
      d.setMonth(d.getMonth() + dir);
      currentMonthVal = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      loadSummary();
      loadYearly();
    }

    async function loadSummary() {
      showLoading(content);
      try {
        const data = await API.getMonthlySummary(currentMonthVal);
        const balance = data.balance || 0;
        const totalInc = data.totalIncome || 0;
        const totalExp = data.totalExpense || 0;
        const balClass = balance >= 0 ? 'positive' : 'negative';
        const saveRate = totalInc > 0 ? Math.round((balance / totalInc) * 100) : 0;

        // Category breakdown sorted + with icons
        const cats = (data.categoryBreakdown || []).map((c, i) => {
          const pct = totalExp > 0 ? ((c.amount / totalExp) * 100).toFixed(1) : '0.0';
          return { ...c, pct, rank: i + 1 };
        });

        content.innerHTML = `
          <!-- Month Navigation -->
          <div class="sum-month-nav">
            <button class="sum-month-btn" id="sum-prev">${mi('chevron_left')}</button>
            <div class="sum-month-label">${getMonthLabel(currentMonthVal)}</div>
            <button class="sum-month-btn" id="sum-next">${mi('chevron_right')}</button>
          </div>

          <!-- Hero Balance Card -->
          <div class="sum-hero">
            <div class="sum-hero-top">
              <div class="sum-hero-label">ยอมคงเหลือประจำเดือน</div>
              <div class="sum-hero-amount ${balClass}">${balance >= 0 ? '+' : ''}฿${formatMoney(Math.abs(balance))}</div>
              ${totalInc > 0 ? `<div class="sum-hero-rate ${balClass}">
                ${mi(balance >= 0 ? 'trending_up' : 'trending_down', 'mi-sm')}
                <span>ออมได้ ${saveRate}% ของรายรับ</span>
              </div>` : ''}
            </div>
          </div>

          <!-- Income / Expense Cards -->
          <div class="sum-ie-row">
            <div class="sum-ie-card income">
              <div class="sum-ie-icon-wrap income">${mi('south_west')}</div>
              <div class="sum-ie-info">
                <div class="sum-ie-label">รายรับ</div>
                <div class="sum-ie-value income">+฿${formatMoney(totalInc)}</div>
              </div>
            </div>
            <div class="sum-ie-card expense">
              <div class="sum-ie-icon-wrap expense">${mi('north_east')}</div>
              <div class="sum-ie-info">
                <div class="sum-ie-label">รายจ่าย</div>
                <div class="sum-ie-value expense">-฿${formatMoney(totalExp)}</div>
              </div>
            </div>
          </div>

          <!-- Donut Breakdown -->
          <div class="sum-breakdown-card">
            <div class="sum-breakdown-header">
              <div>
                <div class="sum-breakdown-title">${mi('donut_large', 'mi-sm')} สัดส่วนรายจ่าย</div>
                <div class="sum-breakdown-sub">แยกตามหมวดหมู่</div>
              </div>
            </div>
            <div id="category-donut"></div>
          </div>

          <!-- Category Ranking -->
          ${cats.length ? `
          <div class="sum-ranking-card">
            <div class="sum-ranking-title">${mi('leaderboard', 'mi-sm')} อันดับรายจ่าย</div>
            <div class="sum-ranking-list">
              ${cats.map(c => `
                <div class="sum-rank-item">
                  <div class="sum-rank-num">${c.rank}</div>
                  <div class="sum-rank-icon" style="background:${getCatColor(c.category)}20;color:${getCatColor(c.category)}">
                    ${mi(getCatIconName(c.category), 'mi-sm')}
                  </div>
                  <div class="sum-rank-info">
                    <div class="sum-rank-name">${c.category}</div>
                    <div class="sum-rank-bar-track">
                      <div class="sum-rank-bar-fill" style="width:${c.pct}%;background:${getCatColor(c.category)}"></div>
                    </div>
                  </div>
                  <div class="sum-rank-right">
                    <div class="sum-rank-amount">฿${formatMoney(c.amount)}</div>
                    <div class="sum-rank-pct">${c.pct}%</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>` : ''}
        `;

        Charts.donutChart(document.getElementById('category-donut'), data.categoryBreakdown, {
          size: 200, strokeWidth: 30,
          centerLabel: totalExp > 0 ? '฿' + formatMoney(totalExp) : '฿0',
          centerSub: 'TOTAL EXPENSE'
        });

        document.getElementById('sum-prev').addEventListener('click', () => changeMonth(-1));
        document.getElementById('sum-next').addEventListener('click', () => changeMonth(1));
      } catch (err) {
        content.innerHTML = `<div class="error-page"><p>${mi('error')} ${err.message}</p></div>`;
      }
    }

    async function loadYearly() {
      const yearlyEl = document.getElementById('yearly-section');
      try {
        const yearVal = currentMonthVal.split('-')[0];
        const yearlyData = await API.getYearlySummary(yearVal);
        const totalYearInc = yearlyData.reduce((s, d) => s + (d.totalIncome || 0), 0);
        const totalYearExp = yearlyData.reduce((s, d) => s + (d.totalExpense || 0), 0);
        yearlyEl.innerHTML = `
          <div class="sum-yearly-card">
            <div class="sum-yearly-header">
              <div class="sum-yearly-title">${mi('bar_chart', 'mi-sm')} ภาพรวมปี ${yearVal}</div>
              <div class="sum-yearly-totals">
                <span class="sum-yt income">+฿${formatMoney(totalYearInc)}</span>
                <span class="sum-yt expense">-฿${formatMoney(totalYearExp)}</span>
              </div>
            </div>
            <div id="yearly-chart"></div>
          </div>`;
        Charts.barChart(document.getElementById('yearly-chart'), yearlyData);
      } catch {}
    }

    loadSummary();
    loadYearly();
  }

  // ══════════════════════════════════════
  // MEMBERS MANAGEMENT
  // ══════════════════════════════════════
  async function renderMembers(el) {
    showLoading(el);
    try {
      let members;
      try {
        members = await API.getMembers() || [];
        localStorage.setItem('bfm_members', JSON.stringify(members));
      } catch {
        try { members = JSON.parse(localStorage.getItem('bfm_members') || '[]'); } catch { members = []; }
      }
      membersCache = members;

      el.innerHTML = `
        <div class="members-page">
          <div class="members-header">
            <div>
              <h2 class="members-title">${mi('group', 'mi-sm')} สมาชิกครอบครัว</h2>
              <p class="members-sub">ข้อมูลทั้งหมดใช้ร่วมกัน · เพิ่มสมาชิกเพื่อแยกรายการ</p>
            </div>
          </div>

          <div class="members-list" id="members-list">
            ${members.map(m => `
              <div class="member-card" data-mid="${m.id}">
                <div class="member-avatar" style="background:${m.avatarColor}">${m.name.charAt(0).toUpperCase()}</div>
                <div class="member-info">
                  <div class="member-name">${m.name}</div>
                  <div class="member-role">${m.role === 'admin' ? 'ผู้ดูแล' : 'สมาชิก'}${m.hasPin ? ' · 🔑 มี PIN' : ''}</div>
                </div>
                <div class="member-actions">
                  <button class="btn-icon member-edit" data-mid="${m.id}">${mi('edit', 'mi-sm')}</button>
                  <button class="btn-icon member-del" data-mid="${m.id}">${mi('delete', 'mi-sm')}</button>
                </div>
              </div>
            `).join('') || '<p class="no-data">ยังไม่มีสมาชิก</p>'}
          </div>

          <button class="btn btn-primary btn-full" id="btn-add-member" style="margin-top:16px">
            ${mi('person_add', 'mi-sm')} เพิ่มสมาชิกใหม่
          </button>
        </div>

        <div id="member-form-modal" class="form-overlay hidden">
          <div class="form-modal">
            <h3 id="member-form-title">${mi('person_add', 'mi-sm')} เพิ่มสมาชิก</h3>
            <form id="member-form" class="form">
              <input type="hidden" id="mf-id">
              <div class="form-group"><label>ชื่อสมาชิก</label><input type="text" id="mf-name" class="input-field" required maxlength="30"></div>
              <div class="form-group">
                <label>สีประจำตัว</label>
                <div class="color-grid">${
                  ['#1a3a6b','#3b82f6','#6366f1','#8b5cf6','#ec4899','#ef4444',
                   '#f59e0b','#f97316','#22c55e','#06b6d4','#14b8a6','#64748b'].map(c =>
                    `<button type="button" class="color-btn mf-color-btn" data-color="${c}" style="background:${c}"></button>`
                  ).join('')}
                </div>
                <input type="hidden" id="mf-color" value="#1a3a6b">
              </div>
              <div class="form-group">
                <label>บทบาท</label>
                <select id="mf-role" class="input-field">
                  <option value="member">สมาชิก</option>
                  <option value="admin">ผู้ดูแล</option>
                </select>
              </div>
              <div class="form-group">
                <label>PIN เข้าใช้งาน (4-6 หลัก)</label>
                <input type="password" id="mf-pin" class="input-field" inputmode="numeric" maxlength="6" minlength="4" placeholder="ปล่อยว่างถ้าไม่เปลี่ยน">
              </div>
              <div class="form-buttons">
                <button type="button" class="btn btn-outline" id="btn-cancel-member">ยกเลิก</button>
                <button type="submit" class="btn btn-primary" id="btn-save-member">บันทึก</button>
              </div>
            </form>
          </div>
        </div>`;

      // Bind color picker
      el.querySelectorAll('.mf-color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          el.querySelectorAll('.mf-color-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          document.getElementById('mf-color').value = btn.dataset.color;
        });
      });
      // Default select first color
      el.querySelector('.mf-color-btn')?.classList.add('selected');

      function openForm(member = null) {
        const modal = document.getElementById('member-form-modal');
        document.getElementById('member-form-title').innerHTML = member
          ? mi('edit', 'mi-sm') + ' แก้ไขสมาชิก'
          : mi('person_add', 'mi-sm') + ' เพิ่มสมาชิก';
        document.getElementById('mf-id').value = member ? member.id : '';
        document.getElementById('mf-name').value = member ? member.name : '';
        document.getElementById('mf-color').value = member ? member.avatarColor : '#1a3a6b';
        document.getElementById('mf-role').value = member ? member.role : 'member';
        document.getElementById('mf-pin').value = '';
        el.querySelectorAll('.mf-color-btn').forEach(b => {
          b.classList.toggle('selected', b.dataset.color === (member ? member.avatarColor : '#1a3a6b'));
        });
        modal.classList.remove('hidden');
      }

      document.getElementById('btn-add-member').addEventListener('click', () => openForm());
      document.getElementById('btn-cancel-member').addEventListener('click', () =>
        document.getElementById('member-form-modal').classList.add('hidden'));

      // Edit / Delete buttons
      el.querySelectorAll('.member-edit').forEach(btn => {
        btn.addEventListener('click', () => {
          const m = members.find(x => x.id === btn.dataset.mid);
          if (m) openForm(m);
        });
      });
      el.querySelectorAll('.member-del').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('ลบสมาชิกนี้?')) return;
          try {
            await API.deleteMember(btn.dataset.mid);
            showToast('ลบสำเร็จ');
            if (currentMember && currentMember.id === btn.dataset.mid) setCurrentMember(null);
            await loadMembers();
            renderMembers(el);
          } catch (err) { showToast('ลบไม่สำเร็จ: ' + err.message, 'error'); }
        });
      });

      // Form submit
      document.getElementById('member-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('mf-id').value;
        const name = document.getElementById('mf-name').value.trim();
        const avatarColor = document.getElementById('mf-color').value;
        const role = document.getElementById('mf-role').value;
        const pin = document.getElementById('mf-pin').value.trim();
        if (!name) { showToast('กรุณาใส่ชื่อ', 'error'); return; }
        if (pin && (pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin))) { showToast('PIN ต้อง 4-6 หลัก (ตัวเลขเท่านั้น)', 'error'); return; }
        const btn = document.getElementById('btn-save-member');
        btn.disabled = true; btn.textContent = 'กำลังบันทึก...';
        try {
          if (id) {
            const upd = { id, name, avatarColor, role };
            if (pin) upd.pin = pin;
            await API.updateMember(upd);
            showToast('แก้ไขสำเร็จ');
          } else {
            const add = { name, avatarColor, role };
            if (pin) add.pin = pin;
            await API.addMember(add);
            showToast('เพิ่มสมาชิกสำเร็จ');
          }
          document.getElementById('member-form-modal').classList.add('hidden');
          await loadMembers();
          renderMembers(el);
        } catch (err) { showToast(err.message, 'error'); }
        finally { btn.disabled = false; btn.textContent = 'บันทึก'; }
      });

    } catch (err) {
      el.innerHTML = `<div class="error-page"><p>${mi('error')} ${err.message}</p><button class="btn btn-primary" onclick="App.navigate('members')">ลองใหม่</button></div>`;
    }
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
      const photo = profile.profilePhoto || localStorage.getItem('bfm_profile_photo') || '';
      if (photo) localStorage.setItem('bfm_profile_photo', photo);

      const avatarContent = photo
        ? `<img src="${photo}" class="profile-photo-img">`
        : `<span class="profile-initial">${initials}</span>`;

      el.innerHTML = `
        <div class="profile-page">
          <div class="profile-card">
            <div class="profile-avatar-lg" id="avatar-picker" style="background:${photo ? 'none' : avatarColor}">
              ${avatarContent}
              <div class="profile-avatar-edit">${mi('photo_camera', 'mi-sm')}</div>
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
                <div class="notif-pref-desc">${settings?.hasLineToken && settings?.hasLineGroupId ? mi('check_circle', 'mi-sm') + ' เชื่อมต่อแล้ว' : 'ยังไม่ได้เชื่อมต่อ'}</div>
              </div>
              <button class="btn-sm" onclick="App.navigate('settings')">ตั้งค่า</button>
            </div>
          </div>

          <div class="profile-section">
            <h3>จัดการ</h3>
            <div style="display:flex;flex-direction:column;gap:8px">
              <button class="btn btn-outline btn-full" onclick="App.navigate('members')">${mi('group', 'mi-sm')} สมาชิกครอบครัว</button>
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
            <h3>${mi('account_circle', 'mi-sm')} เปลี่ยนรูปโปรไฟล์</h3>
            <div class="avatar-options">
              <button type="button" class="btn btn-primary btn-full" id="btn-upload-photo" style="margin-bottom:8px">${mi('photo_camera', 'mi-sm')} อัพโหลดรูปภาพ</button>
              <input type="file" id="photo-input" accept="image/*" style="display:none">
              ${photo ? `<button type="button" class="btn btn-danger btn-full" id="btn-remove-photo" style="margin-bottom:12px">${mi('delete', 'mi-sm')} ลบรูปภาพ</button>` : ''}
            </div>
            <div style="font-size:0.82rem;font-weight:600;color:var(--text-secondary);margin-bottom:10px">หรือเลือกสี</div>
            <div class="color-grid">${
              ['#1a3a6b','#2d5aa0','#3b82f6','#6366f1','#8b5cf6','#a855f7',
               '#ec4899','#ef4444','#f59e0b','#f97316','#22c55e','#06b6d4',
               '#14b8a6','#64748b','#334155','#0f172a'].map(c =>
                `<button type="button" class="color-btn" data-color="${c}" style="background:${c}"></button>`
              ).join('')}
            </div>
            <button class="btn btn-outline btn-full" id="btn-close-color" style="margin-top:12px">ปิด</button>
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

      // Avatar picker (photo + color)
      document.getElementById('avatar-picker').addEventListener('click', () => document.getElementById('color-modal').classList.remove('hidden'));
      document.getElementById('btn-close-color').addEventListener('click', () => document.getElementById('color-modal').classList.add('hidden'));

      // Photo upload
      document.getElementById('btn-upload-photo').addEventListener('click', () => document.getElementById('photo-input').click());
      document.getElementById('photo-input').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const dataUrl = await compressImage(file, 200, 0.8);
          localStorage.setItem('bfm_profile_photo', dataUrl);
          document.querySelector('.profile-avatar-lg').style.background = 'none';
          document.querySelector('.profile-avatar-lg').querySelector('.profile-initial, .profile-photo-img, .mi')?.remove();
          const img = document.createElement('img');
          img.className = 'profile-photo-img';
          img.src = dataUrl;
          document.querySelector('.profile-avatar-lg').prepend(img);
          document.getElementById('color-modal').classList.add('hidden');
          updateHeaderAvatar();
          showToast('อัพโหลดรูปสำเร็จ');
          try { await API.updateProfile({ profilePhoto: dataUrl }); profileCache.profilePhoto = dataUrl; } catch {}
        } catch (err) { showToast('ไม่สามารถอัพโหลดรูปได้', 'error'); }
        e.target.value = '';
      });

      // Remove photo
      const removeBtn = document.getElementById('btn-remove-photo');
      if (removeBtn) {
        removeBtn.addEventListener('click', async () => {
          localStorage.removeItem('bfm_profile_photo');
          document.getElementById('color-modal').classList.add('hidden');
          try { await API.updateProfile({ profilePhoto: '' }); profileCache.profilePhoto = ''; } catch {}
          updateHeaderAvatar();
          renderProfile(el);
          showToast('ลบรูปสำเร็จ');
        });
      }

      document.querySelectorAll('.color-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const color = btn.dataset.color;
          localStorage.removeItem('bfm_profile_photo');
          document.querySelector('.profile-avatar-lg').style.background = color;
          const oldImg = document.querySelector('.profile-avatar-lg .profile-photo-img');
          if (oldImg) { oldImg.remove(); const sp = document.createElement('span'); sp.className = 'profile-initial'; sp.textContent = initials; document.querySelector('.profile-avatar-lg').prepend(sp); }
          document.getElementById('color-modal').classList.add('hidden');
          try { await API.updateProfile({ avatarColor: color, profilePhoto: '' }); profileCache.avatarColor = color; profileCache.profilePhoto = ''; updateHeaderAvatar(); } catch {}
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
          <div style="display:flex;flex-direction:column;gap:12px">
            <div class="form-group"><label>PIN เดิม</label><input type="password" id="old-pin" class="input-field" placeholder="กรอก PIN เดิม" inputmode="numeric" maxlength="6"></div>
            <div class="form-group"><label>PIN ใหม่</label><input type="password" id="new-pin" class="input-field" placeholder="PIN ใหม่ (4-6 หลัก)" inputmode="numeric" maxlength="6"></div>
          </div>
          <button class="btn btn-primary btn-full" id="btn-change-pin" style="margin-top:12px">เปลี่ยน PIN</button>
        </div>
        <div class="settings-group">
          <h3>${mi('smartphone', 'mi-sm')} LINE Messaging API</h3>
          <div style="display:flex;flex-direction:column;gap:12px">
            <div class="form-group"><label>Group ID</label><input type="text" id="line-group-id" class="input-field" placeholder="LINE Group ID"></div>
            <div class="form-group"><label>Channel Access Token</label><input type="text" id="line-token" class="input-field" placeholder="LINE Channel Access Token"></div>
          </div>
          <button class="btn btn-primary btn-full" id="btn-save-line" style="margin-top:12px">${mi('save', 'mi-sm')} บันทึก LINE</button>
          <p id="line-status" class="settings-hint"></p>
          <div id="line-saved-info" class="settings-hint" style="margin-top:4px"></div>
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
    const lineSavedInfo = document.getElementById('line-saved-info');
    function showLineSaved(gid, tok) {
      const parts = [];
      if (gid) parts.push('Group: ' + gid.substring(0, 6) + '...' + gid.slice(-4));
      if (tok) parts.push('Token: ' + tok.substring(0, 8) + '...' + tok.slice(-4));
      lineSavedInfo.textContent = parts.join(' \u00b7 ');
    }
    if (settings?.hasLineToken && settings?.hasLineGroupId) {
      lineStatus.innerHTML = mi('check_circle', 'mi-sm') + ' เชื่อมต่อ LINE แล้ว';
    } else if (settings?.hasLineToken || settings?.hasLineGroupId) {
      lineStatus.innerHTML = mi('warning', 'mi-sm') + ' กรุณาใส่ทั้ง Group ID และ Token';
    }
    document.getElementById('btn-save-line').addEventListener('click', async () => {
      const groupId = document.getElementById('line-group-id').value.trim();
      const token = document.getElementById('line-token').value.trim();
      if (!groupId && !token) { showToast('กรุณาใส่ข้อมูล', 'error'); return; }
      try {
        if (groupId) await API.updateSetting('lineGroupId', groupId);
        if (token) await API.updateSetting('lineToken', token);
        showToast('บันทึกสำเร็จ');
        lineStatus.innerHTML = mi('check_circle', 'mi-sm') + ' เชื่อมต่อ LINE แล้ว';
        showLineSaved(groupId || 'คงเดิม', token || 'คงเดิม');
        document.getElementById('line-group-id').value = '';
        document.getElementById('line-token').value = '';
      } catch (err) { showToast(err.message, 'error'); }
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
