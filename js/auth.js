// ====================================================
// BFM Auth — PIN Lock Screen
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

  function renderSetupUrl() {
    return `
      <div class="auth-screen">
        <div class="auth-card">
          <div class="auth-logo">💰</div>
          <h1>BFM</h1>
          <p class="auth-subtitle">จัดการรายรับรายจ่าย</p>
          <div class="auth-form">
            <label for="api-url-input">Google Apps Script URL</label>
            <input type="url" id="api-url-input" placeholder="https://script.google.com/macros/s/xxx/exec"
                   class="input-field" autocomplete="off">
            <p class="auth-hint">วาง URL ของ Apps Script Web App ที่ deploy แล้ว</p>
            <button id="btn-save-url" class="btn btn-primary btn-full">บันทึก</button>
          </div>
          <div id="url-error" class="error-msg hidden"></div>
        </div>
      </div>`;
  }

  function renderPinScreen(isSetup = false) {
    return `
      <div class="auth-screen">
        <div class="auth-card">
          <div class="auth-logo">💰</div>
          <h1>BFM</h1>
          <p class="auth-subtitle">${isSetup ? 'ตั้ง PIN (อย่างน้อย 4 หลัก)' : 'ใส่ PIN เพื่อเข้าใช้งาน'}</p>
          <div class="pin-dots" id="pin-dots">
            <span class="dot"></span><span class="dot"></span>
            <span class="dot"></span><span class="dot"></span>
            <span class="dot"></span><span class="dot"></span>
          </div>
          <div id="pin-error" class="error-msg hidden"></div>
          <div class="pin-pad">
            ${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k =>
              k === '' ? '<button class="pin-key empty" disabled></button>' :
              k === '⌫' ? '<button class="pin-key pin-del" data-key="del">⌫</button>' :
              `<button class="pin-key" data-key="${k}">${k}</button>`
            ).join('')}
          </div>
          ${isSetup ? '<p class="auth-hint">จำ PIN นี้ไว้ — ใช้เข้าแอปทุกครั้ง</p>' : ''}
        </div>
      </div>`;
  }

  function bindPinPad(onComplete) {
    let pin = '';
    const dots = document.querySelectorAll('#pin-dots .dot');
    const errorEl = document.getElementById('pin-error');

    document.querySelectorAll('.pin-key').forEach(btn => {
      btn.addEventListener('click', async () => {
        const key = btn.dataset.key;
        if (key === 'del') {
          if (pin.length > 0) {
            pin = pin.slice(0, -1);
            dots[pin.length]?.classList.remove('filled');
          }
          return;
        }
        if (pin.length >= 6) return;
        pin += key;
        dots[pin.length - 1]?.classList.add('filled');

        if (pin.length >= 4) {
          // Auto-submit after small delay
          setTimeout(async () => {
            try {
              errorEl.classList.add('hidden');
              await onComplete(pin);
            } catch (err) {
              errorEl.textContent = err.message;
              errorEl.classList.remove('hidden');
              // Reset
              pin = '';
              dots.forEach(d => d.classList.remove('filled'));
            }
          }, 200);
        }
      });
    });
  }

  async function startAuthFlow(container, onSuccess) {
    // Step 1: Check if API URL is configured
    if (!API.isConfigured()) {
      container.innerHTML = renderSetupUrl();
      const btnSave = document.getElementById('btn-save-url');
      const urlInput = document.getElementById('api-url-input');
      const urlError = document.getElementById('url-error');

      btnSave.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) {
          urlError.textContent = 'กรุณาใส่ URL';
          urlError.classList.remove('hidden');
          return;
        }
        btnSave.disabled = true;
        btnSave.textContent = 'กำลังตรวจสอบ...';
        try {
          API.setBaseUrl(url);
          await API.ping();
          // Init sheets if needed
          await API.init();
          startAuthFlow(container, onSuccess); // Re-run
        } catch (err) {
          urlError.textContent = 'ไม่สามารถเชื่อมต่อได้: ' + err.message;
          urlError.classList.remove('hidden');
          btnSave.disabled = false;
          btnSave.textContent = 'บันทึก';
        }
      });
      return;
    }

    // Step 2: Check if already authenticated this session
    if (isAuthenticated() && API.getSecret()) {
      onSuccess();
      return;
    }

    // Step 3: Check if PIN exists
    try {
      const result = await API.checkPinExists();
      if (!result.exists) {
        // Setup new PIN
        container.innerHTML = renderPinScreen(true);
        bindPinPad(async (pin) => {
          const res = await API.setInitialPin(pin);
          API.setSecret(res.secret);
          setAuthenticated(true);
          onSuccess();
        });
      } else {
        // Verify PIN
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
        <div class="auth-screen">
          <div class="auth-card">
            <div class="auth-logo">⚠️</div>
            <h1>เชื่อมต่อไม่ได้</h1>
            <p class="auth-subtitle">${err.message}</p>
            <button class="btn btn-primary btn-full" onclick="location.reload()">ลองใหม่</button>
            <button class="btn btn-outline btn-full" style="margin-top:8px" onclick="localStorage.removeItem('bfm_api_url');location.reload()">เปลี่ยน URL</button>
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
