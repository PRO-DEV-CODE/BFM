// ====================================================
// BFM Auth — Premium Banking Login Screen
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

  // ── Biometric (WebAuthn) ──
  async function isBiometricAvailable() {
    if (!window.PublicKeyCredential) return false;
    try { return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); }
    catch { return false; }
  }

  function isBiometricRegistered() {
    return !!localStorage.getItem('bfm_bio_cred');
  }

  async function registerBiometric(pin) {
    const userId = new Uint8Array(16);
    crypto.getRandomValues(userId);
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: 'THE PRIVATE BANK', id: location.hostname },
        user: { id: userId, name: 'tpb-user', displayName: 'THE PRIVATE BANK User' },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },
          { alg: -257, type: 'public-key' }
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required'
        },
        timeout: 60000
      }
    });
    const credId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
    localStorage.setItem('bfm_bio_cred', credId);
    localStorage.setItem('bfm_bio_pin', btoa(pin));
  }

  async function authenticateBiometric() {
    const credId = localStorage.getItem('bfm_bio_cred');
    if (!credId) throw new Error('ยังไม่ได้ลงทะเบียน');
    const rawId = Uint8Array.from(atob(credId), c => c.charCodeAt(0));
    await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ id: rawId, type: 'public-key', transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60000
      }
    });
    return atob(localStorage.getItem('bfm_bio_pin'));
  }

  function clearBiometric() {
    localStorage.removeItem('bfm_bio_cred');
    localStorage.removeItem('bfm_bio_pin');
  }

  function showBioPrompt(container) {
    return new Promise(resolve => {
      const ov = document.createElement('div');
      ov.className = 'bio-prompt-overlay';
      ov.innerHTML = `
        <div class="bio-prompt-card">
          <div class="bio-prompt-icon">
            <svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="var(--primary)" stroke-width="1.6" stroke-linecap="round">
              <circle cx="24" cy="24" r="20"/>
              <circle cx="24" cy="20" r="5" fill="var(--primary)" stroke="none"/>
              <path d="M12 38c0-6.6 5.4-12 12-12s12 5.4 12 12"/>
            </svg>
          </div>
          <h3 class="bio-prompt-title">เปิดใช้สแกนใบหน้า?</h3>
          <p class="bio-prompt-sub">เข้าสู่ระบบครั้งถัดไปด้วย Face ID ได้ทันที</p>
          <div class="bio-prompt-btns">
            <button class="bio-prompt-btn primary" id="bio-yes">เปิดใช้งาน</button>
            <button class="bio-prompt-btn" id="bio-no">ไว้ทีหลัง</button>
          </div>
        </div>`;
      container.appendChild(ov);
      requestAnimationFrame(() => ov.classList.add('show'));
      ov.querySelector('#bio-yes').onclick = () => { ov.remove(); resolve(true); };
      ov.querySelector('#bio-no').onclick = () => { ov.remove(); resolve(false); };
    });
  }

  function renderPinScreen(isSetup = false) {
    const keyLabels = {
      1:'', 2:'ABC', 3:'DEF', 4:'GHI', 5:'JKL', 6:'MNO',
      7:'PQRS', 8:'TUV', 9:'WXYZ', 0:''
    };
    return `
      <div class="login-screen">
        <!-- Top branding bar -->
        <div class="login-top-bar">
          <div class="login-brand">
            <span class="login-brand-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg></span>
            <span class="login-brand-name">The Private Bank</span>
          </div>
          <span class="login-brand-sub">EQUILIBRIUM</span>
        </div>

        <!-- Fingerprint icon -->
        <div class="login-fp-icon">
          <svg viewBox="0 0 48 48" width="52" height="52" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="1.8" stroke-linecap="round">
            <path d="M24 4C13 4 4 13 4 24s9 20 20 20"/>
            <path d="M44 24c0-11-9-20-20-20"/>
            <path d="M24 12c-6.6 0-12 5.4-12 12 0 3.3 1.3 6.3 3.5 8.5"/>
            <path d="M36 24c0-6.6-5.4-12-12-12"/>
            <path d="M24 18c-3.3 0-6 2.7-6 6 0 3.3 2.7 6 6 6"/>
            <path d="M30 24c0-3.3-2.7-6-6-6"/>
            <path d="M24 22v8"/>
          </svg>
        </div>

        <!-- Welcome Text -->
        <h1 class="login-title">${isSetup ? 'ตั้งรหัส PIN' : 'ยินดีต้อนรับกลับ'}</h1>
        <p class="login-subtitle">${isSetup
          ? 'กรุณาตั้งรหัส PIN เพื่อความปลอดภัย'
          : 'เข้าสู่ระบบด้วยโค้ดเครือข่ายของคุณ'}</p>

        ${!isSetup ? `
        <!-- Biometric Card -->
        <div class="login-bio-card" id="login-bio-card">
          <div class="login-bio-icon-wrap">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" style="color:rgba(255,255,255,0.9)">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/>
              <circle cx="12" cy="10" r="3" fill="currentColor"/>
              <path d="M6 19c0-3.3 2.7-6 6-6s6 2.7 6 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="login-bio-text">แตะเพื่อสแกนใบหน้า</div>
          <div class="login-bio-sub">BIOMETRIC AUTHENTICATION</div>
        </div>
        ` : ''}

        <!-- PIN Entry Card -->
        <div class="login-pin-card" id="login-pin-toggle">
          <div class="login-pin-card-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" style="color:rgba(255,255,255,0.6)">
              <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
              <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
            </svg>
          </div>
          <div class="login-pin-card-info">
            <div class="login-pin-card-title">เข้าสู่ระบบด้วยรหัส PIN</div>
            <div class="login-pin-card-sub">USE SECURE PASSCODE</div>
          </div>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" style="color:rgba(255,255,255,0.3)">
            <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/>
          </svg>
        </div>

        <!-- PIN Panel (hidden by default, shown on tap) -->
        <div class="login-pin-panel ${isSetup ? '' : 'hidden'}" id="login-pin-panel">
          <div class="login-dots" id="pin-dots">
            <span class="login-dot"></span><span class="login-dot"></span>
            <span class="login-dot"></span><span class="login-dot"></span>
            <span class="login-dot"></span><span class="login-dot"></span>
          </div>
          <div id="pin-error" class="login-error hidden"></div>

          <div class="login-numpad">
            ${[1,2,3,4,5,6,7,8,9,'bio',0,'del'].map(k => {
              if (k === 'bio') return '<button class="numpad-key numpad-bio" data-key="bio"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" style="color:rgba(255,255,255,0.5)"><path d="M17.81 4.47c-.08 0-.16-.02-.23-.06C15.66 3.42 14 3 12.01 3c-1.98 0-3.86.47-5.57 1.41-.24.13-.54.04-.68-.2-.13-.24-.04-.55.2-.68C7.82 2.52 9.86 2 12.01 2c2.13 0 3.99.47 6.03 1.52.25.13.34.43.21.67-.09.18-.26.28-.44.28zM3.5 9.72c-.1 0-.2-.03-.29-.09-.23-.16-.28-.47-.12-.7.99-1.4 2.25-2.5 3.75-3.27C9.98 4.04 14 4.03 17.15 5.65c1.5.77 2.76 1.86 3.75 3.25.16.22.11.54-.12.7-.23.16-.54.11-.7-.12-.9-1.26-2.04-2.25-3.39-2.94-2.87-1.47-6.54-1.47-9.4.01-1.36.7-2.5 1.7-3.4 2.96-.08.14-.23.21-.39.21zm6.25 12.07c-.13 0-.26-.05-.35-.15-.87-.87-1.34-1.43-2.01-2.64-.69-1.23-1.05-2.73-1.05-4.34 0-2.97 2.54-5.39 5.66-5.39s5.66 2.42 5.66 5.39c0 .28-.22.5-.5.5s-.5-.22-.5-.5c0-2.42-2.09-4.39-4.66-4.39-2.57 0-4.66 1.97-4.66 4.39 0 1.44.32 2.77.93 3.85.64 1.15 1.08 1.64 1.85 2.42.19.2.19.51 0 .71-.11.1-.24.15-.37.15zm7.17-1.85c-1.19 0-2.24-.3-3.1-.89-1.49-1.01-2.38-2.65-2.38-4.39 0-.28.22-.5.5-.5s.5.22.5.5c0 1.41.72 2.74 1.94 3.56.71.48 1.54.71 2.54.71.24 0 .64-.03 1.04-.1.27-.05.53.13.58.41.05.27-.13.53-.41.58-.57.11-1.07.12-1.21.12zM14.91 22c-.04 0-.09-.01-.13-.02-4.74-1.17-7.44-4.03-7.44-7.91 0-.28.22-.5.5-.5s.5.22.5.5c0 3.32 2.31 5.79 6.58 6.85.27.07.44.35.37.62-.06.22-.26.46-.38.46zm2.68-1.6c-.07 0-.14-.01-.21-.04-.26-.1-.39-.39-.29-.65.42-1.07.63-2.19.63-3.32 0-1.67-1.13-3.01-2.52-3.01-.76 0-1.47.37-1.95 1.02-.18.24-.49.31-.73.14-.24-.18-.31-.49-.14-.73.67-.9 1.7-1.43 2.82-1.43 1.94 0 3.52 1.8 3.52 4.01 0 1.26-.24 2.49-.71 3.66-.08.19-.27.35-.42.35z"/></svg></button>';
              if (k === 'del') return '<button class="numpad-key numpad-del" data-key="del"><svg viewBox="0 0 24 24" width="24" height="24"><path d="M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-3 12.59L17.59 17 14 13.41 10.41 17 9 15.59 12.59 12 9 8.41 10.41 7 14 10.59 17.59 7 19 8.41 15.41 12 19 15.59z" fill="currentColor"/></svg></button>';
              return `<button class="numpad-key" data-key="${k}">
                <span class="numpad-num">${k}</span>
                ${keyLabels[k] ? `<span class="numpad-letters">${keyLabels[k]}</span>` : ''}
              </button>`;
            }).join('')}
          </div>

          ${isSetup ? '<p class="login-hint">จำ PIN นี้ไว้ — ใช้เข้าแอปทุกครั้ง</p>' : ''}
        </div>

        ${!isSetup ? `
        <button class="login-forgot-link" id="login-forgot-btn">ลืมรหัสผ่านหรือมีปัญหาในการเข้าใช้งาน?</button>

        <!-- Bottom actions -->
        <div class="login-bottom-row">
          <span class="login-bottom-item"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg> ภาษาไทย</span>
          <span class="login-bottom-item"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg> ช่วยเหลือ</span>
        </div>
        ` : ''}

        <!-- Bottom Nav -->
        <div class="login-bottom-nav">
          <div class="login-bnav-item" id="bnav-secure">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
            <span>SECURE</span>
          </div>
          <div class="login-bnav-item" id="bnav-entry">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
            <span>ENTRY</span>
          </div>
          <div class="login-bnav-item" id="bnav-help">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg>
            <span>HELP</span>
          </div>
        </div>

        <!-- Help Modal -->
        <div id="login-help-modal" class="login-help-overlay hidden">
          <div class="login-help-card">
            <h3 class="login-help-title">ช่วยเหลือ</h3>
            <div class="login-help-item">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="var(--primary)"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
              <div><strong>ลืม PIN</strong><p>ลบแคชเบราว์เซอร์แล้วตั้ง PIN ใหม่</p></div>
            </div>
            <div class="login-help-item">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="var(--primary)"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
              <div><strong>Face ID ใช้ไม่ได้</strong><p>กดปุ่ม "เข้าสู่ระบบด้วยรหัส PIN" แทน</p></div>
            </div>
            <div class="login-help-item">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="var(--primary)"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
              <div><strong>เชื่อมต่อไม่ได้</strong><p>ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่</p></div>
            </div>
            <button class="login-help-close" id="login-help-close">ปิด</button>
          </div>
        </div>
      </div>`;
  }

  function bindLoginNav(onBio) {
    // Bottom nav: SECURE = show PIN pad
    const secureBtn = document.getElementById('bnav-secure');
    if (secureBtn) {
      secureBtn.addEventListener('click', () => {
        document.querySelectorAll('.login-bnav-item').forEach(i => i.classList.remove('active'));
        secureBtn.classList.add('active');
        const t = document.getElementById('login-pin-toggle');
        if (t) t.click();
      });
    }
    // Bottom nav: ENTRY = biometric
    const entryBtn = document.getElementById('bnav-entry');
    if (entryBtn) {
      entryBtn.addEventListener('click', () => {
        document.querySelectorAll('.login-bnav-item').forEach(i => i.classList.remove('active'));
        entryBtn.classList.add('active');
        const bioCard = document.getElementById('login-bio-card');
        if (bioCard && !bioCard.classList.contains('hidden')) {
          bioCard.click();
        } else if (onBio) {
          onBio();
        } else {
          // No biometric, fallback to PIN
          const t = document.getElementById('login-pin-toggle');
          if (t) t.click();
        }
      });
    }
    // Bottom nav: HELP = show help modal
    const helpBtn = document.getElementById('bnav-help');
    const helpModal = document.getElementById('login-help-modal');
    if (helpBtn && helpModal) {
      helpBtn.addEventListener('click', () => {
        document.querySelectorAll('.login-bnav-item').forEach(i => i.classList.remove('active'));
        helpBtn.classList.add('active');
        helpModal.classList.remove('hidden');
      });
      document.getElementById('login-help-close')?.addEventListener('click', () => {
        helpModal.classList.add('hidden');
      });
      helpModal.addEventListener('click', (e) => { if (e.target === helpModal) helpModal.classList.add('hidden'); });
    }
    // Forgot link
    const forgotBtn = document.getElementById('login-forgot-btn');
    if (forgotBtn && helpModal) {
      forgotBtn.addEventListener('click', () => helpModal.classList.remove('hidden'));
    }
  }

  function bindPinPad(onComplete, onBio) {
    let pin = '';
    const dots = document.querySelectorAll('#pin-dots .login-dot');
    const errorEl = document.getElementById('pin-error');

    // Toggle PIN panel visibility
    const pinToggle = document.getElementById('login-pin-toggle');
    const pinPanel = document.getElementById('login-pin-panel');
    if (pinToggle && pinPanel) {
      pinToggle.addEventListener('click', () => {
        pinPanel.classList.remove('hidden');
        pinToggle.classList.add('hidden');
        const bioCard = document.getElementById('login-bio-card');
        if (bioCard) bioCard.classList.add('hidden');
      });
    }

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
        if (key === 'bio') { if (onBio) onBio(); return; }
        if (pin.length >= 6) return;
        pin += key;
        dots[pin.length - 1]?.classList.add('filled');

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
          if (res.member) { localStorage.setItem('bfm_login_member', JSON.stringify(res.member)); localStorage.setItem('bfm_current_member', res.member.id); }
          setAuthenticated(true);
          onSuccess();
        });
        bindLoginNav();
      } else {
        container.innerHTML = renderPinScreen(false);

        const bioAvail = await isBiometricAvailable();
        const bioReg = isBiometricRegistered();

        // Wire biometric login
        const bioCard = document.getElementById('login-bio-card');
        const doBioLogin = async () => {
          try {
            if (bioCard) bioCard.querySelector('.login-bio-text').textContent = 'กำลังสแกน...';
            const storedPin = await authenticateBiometric();
            const res = await API.verifyPin(storedPin);
            API.setSecret(res.secret);
            if (res.member) { localStorage.setItem('bfm_login_member', JSON.stringify(res.member)); localStorage.setItem('bfm_current_member', res.member.id); }
            setAuthenticated(true);
            onSuccess();
          } catch (e) {
            if (bioCard) bioCard.querySelector('.login-bio-text').textContent = 'สแกนไม่สำเร็จ — ใช้ PIN แทน';
            clearBiometric();
            const t = document.getElementById('login-pin-toggle');
            if (t) t.click();
          }
        };

        if (bioCard) {
          if (bioAvail && bioReg) {
            bioCard.addEventListener('click', doBioLogin);
          } else {
            bioCard.classList.add('hidden');
          }
        }

        bindPinPad(async (pin) => {
          const res = await API.verifyPin(pin);
          API.setSecret(res.secret);
          if (res.member) { localStorage.setItem('bfm_login_member', JSON.stringify(res.member)); localStorage.setItem('bfm_current_member', res.member.id); }
          setAuthenticated(true);
          // Auto-register biometric without asking
          if (bioAvail && !isBiometricRegistered()) {
            try { await registerBiometric(pin); } catch {}
          }
          onSuccess();
        }, bioAvail && bioReg ? doBioLogin : null);
        bindLoginNav(bioAvail && bioReg ? doBioLogin : null);
      }
    } catch (err) {
      container.innerHTML = `
        <div class="login-screen">
          <div class="login-top-bar">
            <div class="login-brand"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg><span class="login-brand-name">THE PRIVATE BANK</span></div>
          </div>
          <div class="login-fp-icon" style="margin-top:3rem">
            <svg viewBox="0 0 24 24" width="52" height="52" fill="none" stroke="rgba(255,200,200,0.7)" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6m0-6l6 6"/>
            </svg>
          </div>
          <h1 class="login-title">เชื่อมต่อไม่ได้</h1>
          <p class="login-subtitle">${err.message}</p>
          <div style="padding:1.5rem;display:flex;flex-direction:column;gap:8px;width:100%;max-width:300px;margin:1rem auto 0">
            <button class="btn btn-primary btn-full" onclick="location.reload()">ลองใหม่</button>
            <button class="btn btn-outline btn-full" style="color:#fff;border-color:rgba(255,255,255,0.3)" onclick="localStorage.removeItem('bfm_api_url');location.reload()">เปลี่ยน URL</button>
          </div>
        </div>`;
    }
  }

  function logout() {
    setAuthenticated(false);
    localStorage.removeItem('bfm_login_member');
    location.reload();
  }

  return { isAuthenticated, startAuthFlow, logout };
})();
