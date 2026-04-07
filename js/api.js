// ====================================================
// BFM API Client — เชื่อมต่อ Google Apps Script Web App
// ====================================================

const API = (() => {
  // ⚠️ ใส่ URL ของ Apps Script Web App ที่ deploy แล้วที่นี่
  let BASE_URL = localStorage.getItem('bfm_api_url') || '';
  let SECRET = sessionStorage.getItem('bfm_secret') || '';

  function setBaseUrl(url) {
    BASE_URL = url.replace(/\/+$/, '');
    localStorage.setItem('bfm_api_url', BASE_URL);
  }

  function setSecret(s) {
    SECRET = s;
    sessionStorage.setItem('bfm_secret', s);
  }

  function getSecret() {
    return SECRET;
  }

  function isConfigured() {
    return !!BASE_URL;
  }

  async function call(action, params = {}) {
    if (!BASE_URL) throw new Error('กรุณาตั้งค่า API URL ก่อน');

    const body = { action, ...params };
    // Add secret to non-open actions
    const openActions = ['verifyPin', 'setInitialPin', 'ping', 'init', 'checkPinExists'];
    if (!openActions.includes(action) && SECRET) {
      body.secret = SECRET;
    }

    try {
      const response = await fetch(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(body),
        redirect: 'follow'
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('ไม่สามารถอ่านข้อมูลจากเซิร์ฟเวอร์ได้');
      }

      if (!data.success) {
        throw new Error(data.error || 'เกิดข้อผิดพลาด');
      }
      return data.data;
    } catch (err) {
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        throw new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบอินเทอร์เน็ต');
      }
      throw err;
    }
  }

  // ── Auth ──
  const checkPinExists = () => call('checkPinExists');
  const setInitialPin = (pin) => call('setInitialPin', { pin });
  const verifyPin = (pin) => call('verifyPin', { pin });
  const changePin = (oldPin, newPin) => call('changePin', { oldPin, newPin });

  // ── Transactions ──
  const addTransaction = (data) => call('addTransaction', data);
  const getTransactions = (month) => call('getTransactions', { month });
  const editTransaction = (data) => call('editTransaction', data);
  const deleteTransaction = (id) => call('deleteTransaction', { id });

  // ── Reminders ──
  const addReminder = (data) => call('addReminder', data);
  const getReminders = () => call('getReminders');
  const updateReminder = (data) => call('updateReminder', data);
  const deleteReminder = (id) => call('deleteReminder', { id });
  const toggleReminder = (id) => call('toggleReminder', { id });
  const getUpcomingReminders = (days = 7) => call('getUpcomingReminders', { days });

  // ── Summary ──
  const getMonthlySummary = (month) => call('getMonthlySummary', { month });
  const getYearlySummary = (year) => call('getYearlySummary', { year });

  // ── Settings ──
  const getSettings = () => call('getSettings');
  const updateSetting = (key, value) => call('updateSetting', { key, value });

  // ── Init ──
  const ping = () => call('ping');
  const init = () => call('init');

  return {
    setBaseUrl, setSecret, getSecret, isConfigured, call,
    checkPinExists, setInitialPin, verifyPin, changePin,
    addTransaction, getTransactions, editTransaction, deleteTransaction,
    addReminder, getReminders, updateReminder, deleteReminder, toggleReminder, getUpcomingReminders,
    getMonthlySummary, getYearlySummary,
    getSettings, updateSetting,
    ping, init
  };
})();
