// ====================================================
// BFM Auth — Premium Banking PIN Lock Screen
// ====================================================

const Auth = (() => {
  let authenticated = false;

  function isAuthenticated() {
    return authenticated || sessionStorage.getItem('bfm_auth') === 'true';
  }

  function setAuthenticated(val) {
    authenticated = val;
    if (val) {
      sessionStorage.setItem('bfm_auth', 'true');
    } else {
      sessionStorage.removeItem('bfm_auth');
      sessionStorage.removeItem('bfm_secret');
    }
  }

  function renderPinScreen(isSetup = false) {
    const keyLabels = {
      1:'', 2:'ABC', 3:'DEF', 4:'GHI', 5:'JKL', 6:'MNO',
      7:'PQRS', 8:'TUV', 9:'WXYZ', 0:''
    };
    return `
      <div class="login-screen">
        <!-- Top branding -->
        <div class="login-header">
          <div class="login-brand">
            <span class="login-brand-icon">🔒</span>
            <span class="login-brand-name">BFM</span>
          </div>
        </div>

        <!-- Avatar / Shield icon -->
        <div class="login-avatar">
          <div class="login-avatar-ring">
            <svg viewBox="0 0 56 56" class="login-shield-icon">
              <path d="M28 6 L46 14 L46 28 C46 39 38 48 28 52 C18 48 10 39 10 28 L10 14 Z"
                    fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
              <circle cx="28" cy="24" r="5" fill="currentColor"/>
              <path d="M18 40 C18 33 22 30 28 30 C34 30 38 33 38 40" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
          </div>
        </div>

        <!-- Welcome Text -->
        <h1 class="login-title">${isSetup ? 'ตั้งรหัส PIN' : 'ยินดีต้อนรับ'}</h1>
        <p class="login-subtitle">${isSetup
          ? 'กรุณาตั้งรหัส PIN เพื่อความปลอดภัย'
          : 'กรุณาใส่รหัส PIN เพื่อเข้าสู่ระบบของคุณ'}</p>
        <p class="login-subtitle-en">${isSetup
          ? 'Set your PIN for security'
          : 'Please enter your PIN to continue'}</p>

        <!-- PIN Dots -->
        <div class="login-dots" id="pin-dots">
          <span class="login-dot"></span><span class="login-dot"></span>
          <span class="login-dot"></span><span class="login-dot"></span>
          <span class="login-dot"></span><span class="login-dot"></span>
        </div>
        <div id="pin-error" class="login-error hidden"></div>

        <!-- Number Pad -->
        <div class="login-numpad">
          ${[1,2,3,4,5,6,7,8,9,'bio',0,'del'].map(k => {
            if (k === 'bio') return '<button class="numpad-key numpad-bio" data-key="bio"><span class="numpad-bio-icon">🔐</span></button>';
            if (k === 'del') return '<button class="numpad-key numpad-del" data-key="del"><svg viewBox="0 0 24 24" width="24" height="24"><path d="M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-3 12.59L17.59 17 14 13.41 10.41 17 9 15.59 12.59 12 9 8.41 10.41 7 14 10.59 17.59 7 19 8.41 15.41 12 19 15.59z" fill="currentColor"/></svg></button>';
            return `<button class="numpad-key" data-key="${k}">
              <span class="numpad-num">${k}</span>
              ${keyLabels[k] ? `<span class="numpad-letters">${keyLabels[k]}</span>` : ''}
            </button>`;
          }).join('')}
        </div>

        ${isSetup ? '<p class="login-hint">จำ PIN นี้ไว้ — ใช้เข้าแอปทุกครั้ง</p>' : `
          <button class="login-forgot-btn">ลืมรหัส PIN? / FORGOT PIN?</button>
        `}

        <!-- Footer -->
        <div class="login-footer">
          <span class="login-footer-text">SECURED BY BFM</span>
        </div>
      </div>`;
  }

  function bindPinPad(onComplete) {
    let pin = '';
    const dots = document.querySelectorAll('#pin-dots .login-dot');
    const errorEl = document.getElementById('pin-error');

    document.querySelectorAll('.numpad-key').forEach(btn => {
      btn.addEventListener('click', async () => {
        const key = btn.dataset.key;
        if (key === 'del') {
          if (pin.length > 0) {
            pin = pin.slice(0, -1);
            dots[pin.length]?.classList.remove('filled');
          }
          return;
        }
        if (key === 'bio') return; // Future: biometric
        if (pin.length >= 6) return;
        pin += key;
        dots[pin.length - 1]?.classList.add('filled');

        // Haptic-like feedback
        btn.classList.add('pressed');
        setTimeout(() => btn.classList.remove('pressed'), 150);

        if (pin.length >= 4) {
          setTimeout(async () => {
            try {
              errorEl.classList.add('hidden');
              await onComplete(pin);
            } catch (err) {
              errorEl.textContent = err.message;
              errorEl.classList.remove('hidden');
              // Shake animation
              const dotsWrap = document.getElementById('pin-dots');
              dotsWrap.classList.add('shake');
              setTimeout(() => dotsWrap.classList.remove('shake'), 500);
              pin = '';
              dots.forEach(d => d.classList.remove('filled'));
            }
          }, 200);
        }
      });
    });
  }

  async function startAuthFlow(container, onSuccess) {
    if (isAuthenticated() && API.getSecret()) {
      onSuccess();
      return;
    }

    try {
      const result = await API.checkPinExists();
      if (!result.exists) {
        container.innerHTML = renderPinScreen(true);
        bindPinPad(async (pin) => {
          const res = await API.setInitialPin(pin);
          API.setSecret(res.secret);
          setAuthenticated(true);
          onSuccess();
        });
      } else {
        container.innerHTML = renderPinScreen(false);
        bindPinPad(async (pin) => {
          const res = await API.verifyPin(pin);
          API.setSecret(res.secret);
          setAuthenticated(true);
          onSuccess();
        });
      }
    } catch (err) {
      container.innerHTML = `
        <div class="login-screen">
          <div class="login-header">
            <div class="login-brand"><span class="login-brand-icon">🔒</span><span class="login-brand-name">BFM</span></div>
          </div>
          <div class="login-avatar"><div class="login-avatar-ring"><span style="font-size:2rem">⚠️</span></div></div>
          <h1 class="login-title">เชื่อมต่อไม่ได้</h1>
          <p class="login-subtitle">${err.message}</p>
          <div style="padding:1.5rem;display:flex;flex-direction:column;gap:8px;width:100%;max-width:300px;margin:0 auto">
            <button class="btn btn-primary btn-full" onclick="location.reload()">ลองใหม่</button>
            <button class="btn btn-outline btn-full" onclick="localStorage.removeItem('bfm_api_url');location.reload()">เปลี่ยน URL</button>
          </div>
        </div>`;
    }
  }

  function logout() {
    setAuthenticated(false);
    location.reload();
  }

  return { isAuthenticated, startAuthFlow, logout };
})();
