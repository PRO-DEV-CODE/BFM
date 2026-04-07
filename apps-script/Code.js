// ====================================================
// BFM — Backend API (Google Apps Script Web App)
// Google Sheets ID: 1VAyM_uq20rdnMXVBlw20GrkBy6XA8GedcDE0ictGRnY
// ====================================================

const SHEET_ID = '1VAyM_uq20rdnMXVBlw20GrkBy6XA8GedcDE0ictGRnY';

// ── Sheet Names ──
const SH_TRANSACTIONS = 'Transactions';
const SH_REMINDERS = 'Reminders';
const SH_SETTINGS = 'Settings';
const SH_SUMMARY = 'MonthlySummary';
const SH_PROFILE = 'Profile';

// ── Default Categories ──
const DEFAULT_EXPENSE_CATS = JSON.stringify([
  'อาหาร','ค่าเดินทาง','ค่าบัตรเครดิต','พรบ./ประกัน',
  'ค่าน้ำ/ไฟ/เน็ต','ช้อปปิ้ง','สุขภาพ','การศึกษา','อื่นๆ'
]);
const DEFAULT_INCOME_CATS = JSON.stringify([
  'เงินเดือน','งานเสริม','ลงทุน','อื่นๆ'
]);

// ── Helpers ──
function getSpreadsheet() {
  return SpreadsheetApp.openById(SHEET_ID);
}

function getOrCreateSheet(name, headers) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers && headers.length) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    }
  }
  return sheet;
}

function uuid() {
  return Utilities.getUuid();
}

function jsonOk(data) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: true, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonErr(msg) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: false, error: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}

function sha256(text) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text);
  return raw.map(function(b) {
    return ('0' + ((b < 0 ? b + 256 : b).toString(16))).slice(-2);
  }).join('');
}

// ── Initialization ──
function initSheets() {
  getOrCreateSheet(SH_TRANSACTIONS,
    ['id','date','type','category','amount','description','created']);
  getOrCreateSheet(SH_REMINDERS,
    ['id','name','dueDate','amount','frequency','category','notifyDaysBefore','lastNotified','active']);
  getOrCreateSheet(SH_SETTINGS, ['key','value']);
  getOrCreateSheet(SH_SUMMARY,
    ['yearMonth','totalIncome','totalExpense','balance','topCategory']);
  getOrCreateSheet(SH_PROFILE,
    ['key','value']);

  // Seed default settings if empty
  const settingsSheet = getSpreadsheet().getSheetByName(SH_SETTINGS);
  const data = settingsSheet.getDataRange().getValues();
  const keys = data.map(function(r) { return r[0]; });

  if (keys.indexOf('pin') === -1) {
    settingsSheet.appendRow(['pin', '']);
  }
  if (keys.indexOf('lineToken') === -1) {
    settingsSheet.appendRow(['lineToken', '']);
  }
  if (keys.indexOf('categories_expense') === -1) {
    settingsSheet.appendRow(['categories_expense', DEFAULT_EXPENSE_CATS]);
  }
  if (keys.indexOf('categories_income') === -1) {
    settingsSheet.appendRow(['categories_income', DEFAULT_INCOME_CATS]);
  }
  if (keys.indexOf('apiSecret') === -1) {
    settingsSheet.appendRow(['apiSecret', uuid()]);
  }
}

// ── Router ──
function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    var p = e.parameter || {};
    var action = p.action || '';

    // Parse POST body (supports both application/json and text/plain)
    if (e.postData && e.postData.contents) {
      try {
        var body = JSON.parse(e.postData.contents);
        for (var k in body) {
          if (body.hasOwnProperty(k)) p[k] = body[k];
        }
      } catch(parseErr) { /* ignore non-JSON body */ }
      // Re-read action from POST body
      action = p.action || action || '';
    }

    // No action = health check (no auth needed)
    if (!action) {
      return jsonOk({ status: 'BFM API is running', version: '1.0' });
    }

    // API secret check (skip for open actions)
    var openActions = ['verifyPin','setInitialPin','ping','init','checkPinExists'];
    if (openActions.indexOf(action) === -1) {
      var secret = getSetting('apiSecret');
      if (secret && p.secret !== secret) {
        return jsonErr('Unauthorized');
      }
    }

    switch (action) {
      // -- Auth --
      case 'ping':              return jsonOk({ pong: true });
      case 'init':              initSheets(); return jsonOk('initialized');
      case 'checkPinExists':    return jsonOk({ exists: !!getSetting('pin') });
      case 'setInitialPin':     return setInitialPin(p.pin);
      case 'verifyPin':         return verifyPin(p.pin);

      // -- Transactions --
      case 'addTransaction':    return addTransaction(p);
      case 'getTransactions':   return getTransactions(p.month);
      case 'editTransaction':   return editTransaction(p);
      case 'deleteTransaction': return deleteTransaction(p.id);

      // -- Reminders --
      case 'addReminder':       return addReminder(p);
      case 'getReminders':      return getReminders();
      case 'updateReminder':    return updateReminder(p);
      case 'deleteReminder':    return deleteReminder(p.id);
      case 'toggleReminder':    return toggleReminder(p.id);

      // -- Summary --
      case 'getMonthlySummary': return getMonthlySummary(p.month);
      case 'getYearlySummary':  return getYearlySummary(p.year);

      // -- Settings --
      case 'getSettings':       return getSettingsApi();
      case 'updateSetting':     return updateSettingApi(p.key, p.value);
      case 'changePin':         return changePin(p.oldPin, p.newPin);

      // -- Notifications --
      case 'getUpcomingReminders': return getUpcomingReminders(Number(p.days) || 7);

      // -- Profile --
      case 'getProfile':       return getProfileApi();
      case 'updateProfile':    return updateProfileApi(p);

      default:
        return jsonErr('Unknown action: ' + action);
    }
  } catch (err) {
    return jsonErr(err.toString());
  }
}

// ══════════════════════════════════════
// AUTH
// ══════════════════════════════════════
function setInitialPin(pin) {
  if (!pin || pin.length < 4) return jsonErr('PIN ต้องมีอย่างน้อย 4 หลัก');
  var current = getSetting('pin');
  if (current) return jsonErr('PIN ถูกตั้งไว้แล้ว');
  setSetting('pin', sha256(String(pin)));
  // Return the api secret so frontend can store it
  var secret = getSetting('apiSecret');
  return jsonOk({ secret: secret });
}

function verifyPin(pin) {
  if (!pin) return jsonErr('กรุณาใส่ PIN');
  var stored = getSetting('pin');
  if (!stored) return jsonErr('ยังไม่ได้ตั้ง PIN');
  if (sha256(String(pin)) !== stored) return jsonErr('PIN ไม่ถูกต้อง');
  var secret = getSetting('apiSecret');
  return jsonOk({ secret: secret });
}

function changePin(oldPin, newPin) {
  if (!oldPin || !newPin) return jsonErr('กรุณาใส่ PIN เก่าและใหม่');
  if (newPin.length < 4) return jsonErr('PIN ใหม่ต้องมีอย่างน้อย 4 หลัก');
  var stored = getSetting('pin');
  if (sha256(String(oldPin)) !== stored) return jsonErr('PIN เก่าไม่ถูกต้อง');
  setSetting('pin', sha256(String(newPin)));
  return jsonOk('เปลี่ยน PIN สำเร็จ');
}

// ══════════════════════════════════════
// SETTINGS helpers
// ══════════════════════════════════════
function getSetting(key) {
  var sheet = getSpreadsheet().getSheetByName(SH_SETTINGS);
  if (!sheet) return null;
  var data = sheet.getDataRange().getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === key) return data[i][1];
  }
  return null;
}

function setSetting(key, value) {
  var sheet = getSpreadsheet().getSheetByName(SH_SETTINGS);
  var data = sheet.getDataRange().getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}

function getSettingsApi() {
  var cats_exp = getSetting('categories_expense') || DEFAULT_EXPENSE_CATS;
  var cats_inc = getSetting('categories_income') || DEFAULT_INCOME_CATS;
  var lineToken = getSetting('lineToken') || '';
  return jsonOk({
    categories_expense: JSON.parse(cats_exp),
    categories_income: JSON.parse(cats_inc),
    hasLineToken: !!lineToken
  });
}

function updateSettingApi(key, value) {
  // Only allow specific keys to be updated
  var allowed = ['lineToken', 'categories_expense', 'categories_income'];
  if (allowed.indexOf(key) === -1) return jsonErr('ไม่อนุญาตให้แก้ไข setting นี้');
  if (key === 'categories_expense' || key === 'categories_income') {
    value = JSON.stringify(value);
  }
  setSetting(key, value);
  return jsonOk('บันทึกสำเร็จ');
}

// ══════════════════════════════════════
// TRANSACTIONS
// ══════════════════════════════════════
function addTransaction(p) {
  var sheet = getSpreadsheet().getSheetByName(SH_TRANSACTIONS);
  var id = uuid();
  var now = new Date().toISOString();
  sheet.appendRow([
    id,
    p.date || Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd'),
    p.type || 'expense',
    p.category || 'อื่นๆ',
    Number(p.amount) || 0,
    p.description || '',
    now
  ]);
  return jsonOk({ id: id });
}

function getTransactions(month) {
  var sheet = getSpreadsheet().getSheetByName(SH_TRANSACTIONS);
  var data = sheet.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    var dateStr = r[1];
    if (dateStr instanceof Date) {
      dateStr = Utilities.formatDate(dateStr, 'Asia/Bangkok', 'yyyy-MM-dd');
    }
    // Filter by month (YYYY-MM) if provided
    if (month && dateStr.substring(0, 7) !== month) continue;
    rows.push({
      id: r[0],
      date: dateStr,
      type: r[2],
      category: r[3],
      amount: Number(r[4]),
      description: r[5],
      created: r[6]
    });
  }
  // Sort by date descending
  rows.sort(function(a, b) { return b.date.localeCompare(a.date); });
  return jsonOk(rows);
}

function editTransaction(p) {
  var sheet = getSpreadsheet().getSheetByName(SH_TRANSACTIONS);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === p.id) {
      var row = i + 1;
      if (p.date) sheet.getRange(row, 2).setValue(p.date);
      if (p.type) sheet.getRange(row, 3).setValue(p.type);
      if (p.category) sheet.getRange(row, 4).setValue(p.category);
      if (p.amount !== undefined) sheet.getRange(row, 5).setValue(Number(p.amount));
      if (p.description !== undefined) sheet.getRange(row, 6).setValue(p.description);
      return jsonOk('แก้ไขสำเร็จ');
    }
  }
  return jsonErr('ไม่พบรายการ');
}

function deleteTransaction(id) {
  var sheet = getSpreadsheet().getSheetByName(SH_TRANSACTIONS);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1);
      return jsonOk('ลบสำเร็จ');
    }
  }
  return jsonErr('ไม่พบรายการ');
}

// ══════════════════════════════════════
// REMINDERS
// ══════════════════════════════════════
function addReminder(p) {
  var sheet = getSpreadsheet().getSheetByName(SH_REMINDERS);
  var id = uuid();
  sheet.appendRow([
    id,
    p.name || '',
    p.dueDate || '',
    Number(p.amount) || 0,
    p.frequency || 'once',
    p.category || 'อื่นๆ',
    Number(p.notifyDaysBefore) || 3,
    '',
    'TRUE'
  ]);
  return jsonOk({ id: id });
}

function getReminders() {
  var sheet = getSpreadsheet().getSheetByName(SH_REMINDERS);
  var data = sheet.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    var dueDate = r[2];
    if (dueDate instanceof Date) {
      dueDate = Utilities.formatDate(dueDate, 'Asia/Bangkok', 'yyyy-MM-dd');
    }
    rows.push({
      id: r[0],
      name: r[1],
      dueDate: dueDate,
      amount: Number(r[3]),
      frequency: r[4],
      category: r[5],
      notifyDaysBefore: Number(r[6]),
      lastNotified: r[7],
      active: String(r[8]).toUpperCase() === 'TRUE'
    });
  }
  return jsonOk(rows);
}

function updateReminder(p) {
  var sheet = getSpreadsheet().getSheetByName(SH_REMINDERS);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === p.id) {
      var row = i + 1;
      if (p.name !== undefined) sheet.getRange(row, 2).setValue(p.name);
      if (p.dueDate !== undefined) sheet.getRange(row, 3).setValue(p.dueDate);
      if (p.amount !== undefined) sheet.getRange(row, 4).setValue(Number(p.amount));
      if (p.frequency !== undefined) sheet.getRange(row, 5).setValue(p.frequency);
      if (p.category !== undefined) sheet.getRange(row, 6).setValue(p.category);
      if (p.notifyDaysBefore !== undefined) sheet.getRange(row, 7).setValue(Number(p.notifyDaysBefore));
      return jsonOk('แก้ไขสำเร็จ');
    }
  }
  return jsonErr('ไม่พบรายการ');
}

function deleteReminder(id) {
  var sheet = getSpreadsheet().getSheetByName(SH_REMINDERS);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1);
      return jsonOk('ลบสำเร็จ');
    }
  }
  return jsonErr('ไม่พบรายการ');
}

function toggleReminder(id) {
  var sheet = getSpreadsheet().getSheetByName(SH_REMINDERS);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      var current = String(data[i][8]).toUpperCase() === 'TRUE';
      sheet.getRange(i + 1, 9).setValue(current ? 'FALSE' : 'TRUE');
      return jsonOk({ active: !current });
    }
  }
  return jsonErr('ไม่พบรายการ');
}

function getUpcomingReminders(days) {
  var sheet = getSpreadsheet().getSheetByName(SH_REMINDERS);
  var data = sheet.getDataRange().getValues();
  var today = new Date();
  today.setHours(0,0,0,0);
  var futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + days);

  var upcoming = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (String(r[8]).toUpperCase() !== 'TRUE') continue;
    var dueDate = r[2];
    if (dueDate instanceof Date) {
      // ok
    } else {
      dueDate = new Date(dueDate);
    }
    if (isNaN(dueDate.getTime())) continue;
    dueDate.setHours(0,0,0,0);

    if (dueDate >= today && dueDate <= futureDate) {
      upcoming.push({
        id: r[0],
        name: r[1],
        dueDate: Utilities.formatDate(dueDate, 'Asia/Bangkok', 'yyyy-MM-dd'),
        amount: Number(r[3]),
        frequency: r[4],
        category: r[5],
        daysLeft: Math.ceil((dueDate - today) / 86400000)
      });
    }
  }
  upcoming.sort(function(a, b) { return a.daysLeft - b.daysLeft; });
  return jsonOk(upcoming);
}

// ══════════════════════════════════════
// MONTHLY SUMMARY
// ══════════════════════════════════════
function getMonthlySummary(month) {
  if (!month) {
    month = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM');
  }
  var sheet = getSpreadsheet().getSheetByName(SH_TRANSACTIONS);
  var data = sheet.getDataRange().getValues();

  var totalIncome = 0, totalExpense = 0;
  var catTotals = {};

  for (var i = 1; i < data.length; i++) {
    var dateStr = data[i][1];
    if (dateStr instanceof Date) {
      dateStr = Utilities.formatDate(dateStr, 'Asia/Bangkok', 'yyyy-MM-dd');
    }
    if (dateStr.substring(0, 7) !== month) continue;

    var type = data[i][2];
    var cat = data[i][3];
    var amt = Number(data[i][4]);

    if (type === 'income') {
      totalIncome += amt;
    } else {
      totalExpense += amt;
      catTotals[cat] = (catTotals[cat] || 0) + amt;
    }
  }

  // Top category
  var topCat = '', topAmt = 0;
  for (var c in catTotals) {
    if (catTotals[c] > topAmt) {
      topCat = c;
      topAmt = catTotals[c];
    }
  }

  // Category breakdown
  var categories = [];
  for (var c in catTotals) {
    categories.push({ category: c, amount: catTotals[c] });
  }
  categories.sort(function(a, b) { return b.amount - a.amount; });

  return jsonOk({
    month: month,
    totalIncome: totalIncome,
    totalExpense: totalExpense,
    balance: totalIncome - totalExpense,
    topCategory: topCat,
    categoryBreakdown: categories
  });
}

function getYearlySummary(year) {
  if (!year) {
    year = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy');
  }
  var months = [];
  for (var m = 1; m <= 12; m++) {
    var mm = (m < 10 ? '0' : '') + m;
    var monthKey = year + '-' + mm;
    // Inline mini-summary
    var sheet = getSpreadsheet().getSheetByName(SH_TRANSACTIONS);
    var data = sheet.getDataRange().getValues();
    var inc = 0, exp = 0;
    for (var i = 1; i < data.length; i++) {
      var dateStr = data[i][1];
      if (dateStr instanceof Date) {
        dateStr = Utilities.formatDate(dateStr, 'Asia/Bangkok', 'yyyy-MM-dd');
      }
      if (dateStr.substring(0, 7) !== monthKey) continue;
      if (data[i][2] === 'income') inc += Number(data[i][4]);
      else exp += Number(data[i][4]);
    }
    months.push({
      month: monthKey,
      totalIncome: inc,
      totalExpense: exp,
      balance: inc - exp
    });
  }
  return jsonOk(months);
}

// ══════════════════════════════════════
// LINE NOTIFY
// ══════════════════════════════════════
function sendLineNotify(message) {
  var token = getSetting('lineToken');
  if (!token) {
    Logger.log('LINE Token not set');
    return false;
  }
  var url = 'https://notify-api.line.me/api/notify';
  var options = {
    method: 'post',
    headers: { 'Authorization': 'Bearer ' + token },
    payload: { message: message },
    muteHttpExceptions: true
  };
  var response = UrlFetchApp.fetch(url, options);
  Logger.log('LINE Notify response: ' + response.getContentText());
  return response.getResponseCode() === 200;
}

// ══════════════════════════════════════
// SCHEDULED REMINDER CHECK (Time Trigger)
// ══════════════════════════════════════
function checkReminders() {
  var sheet = getSpreadsheet().getSheetByName(SH_REMINDERS);
  if (!sheet) return;
  var data = sheet.getDataRange().getValues();
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var todayStr = Utilities.formatDate(today, 'Asia/Bangkok', 'yyyy-MM-dd');

  var notifications = [];

  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (String(r[8]).toUpperCase() !== 'TRUE') continue;

    var dueDate = r[2];
    if (dueDate instanceof Date) {
      // ok
    } else {
      dueDate = new Date(dueDate);
    }
    if (isNaN(dueDate.getTime())) continue;
    dueDate.setHours(0, 0, 0, 0);

    var notifyDays = Number(r[6]) || 3;
    var diffDays = Math.ceil((dueDate - today) / 86400000);

    // Check if already notified today
    var lastNotified = r[7];
    if (lastNotified instanceof Date) {
      lastNotified = Utilities.formatDate(lastNotified, 'Asia/Bangkok', 'yyyy-MM-dd');
    }
    if (lastNotified === todayStr) continue;

    // Should notify? Within notifyDays range and not past
    if (diffDays >= 0 && diffDays <= notifyDays) {
      var name = r[1];
      var amount = Number(r[3]);
      var msg = '';
      if (diffDays === 0) {
        msg = '\n🔴 ครบกำหนดวันนี้!\n' + name + '\nจำนวน ' + amount.toLocaleString() + ' บาท';
      } else {
        msg = '\n⚠️ แจ้งเตือนการชำระ\n' + name + '\nครบกำหนดอีก ' + diffDays + ' วัน (' +
              Utilities.formatDate(dueDate, 'Asia/Bangkok', 'dd/MM/yyyy') + ')\nจำนวน ' +
              amount.toLocaleString() + ' บาท';
      }
      notifications.push(msg);
      // Update lastNotified
      sheet.getRange(i + 1, 8).setValue(todayStr);

      // If frequency is monthly/yearly, auto-create next reminder
      if (diffDays === 0) {
        autoRenewReminder(sheet, i + 1, r);
      }
    }
  }

  if (notifications.length > 0) {
    var fullMsg = '\n📋 BFM แจ้งเตือน' + notifications.join('\n─────────');
    sendLineNotify(fullMsg);
  }
}

function autoRenewReminder(sheet, rowNum, rowData) {
  var freq = rowData[4];
  var dueDate = rowData[2];
  if (dueDate instanceof Date) {
    // ok
  } else {
    dueDate = new Date(dueDate);
  }

  var newDate = new Date(dueDate);
  if (freq === 'monthly') {
    newDate.setMonth(newDate.getMonth() + 1);
  } else if (freq === 'yearly') {
    newDate.setFullYear(newDate.getFullYear() + 1);
  } else {
    // once — deactivate
    sheet.getRange(rowNum, 9).setValue('FALSE');
    return;
  }
  // Update due date for recurring
  sheet.getRange(rowNum, 3).setValue(
    Utilities.formatDate(newDate, 'Asia/Bangkok', 'yyyy-MM-dd')
  );
}

// ── Setup Daily Trigger ──
function setupDailyTrigger() {
  // Remove existing triggers for checkReminders
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'checkReminders') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  // Create new daily trigger at 8:00 AM
  ScriptApp.newTrigger('checkReminders')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();
}

// ══════════════════════════════════════
// PROFILE
// ══════════════════════════════════════
function getProfileApi() {
  var sheet = getSpreadsheet().getSheetByName(SH_PROFILE);
  if (!sheet) return jsonOk({});
  var data = sheet.getDataRange().getValues();
  var profile = {};
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) profile[data[i][0]] = data[i][1];
  }
  return jsonOk(profile);
}

function updateProfileApi(p) {
  var sheet = getOrCreateSheet(SH_PROFILE, ['key', 'value']);
  var allowed = ['displayName', 'nickname', 'email', 'phone', 'birthday', 'avatarEmoji', 'bio'];
  var data = sheet.getDataRange().getValues();
  var keys = data.map(function(r) { return r[0]; });
  var updated = [];
  for (var k = 0; k < allowed.length; k++) {
    var key = allowed[k];
    if (p[key] === undefined) continue;
    var idx = keys.indexOf(key);
    if (idx >= 0) {
      sheet.getRange(idx + 1, 2).setValue(p[key]);
    } else {
      sheet.appendRow([key, p[key]]);
    }
    updated.push(key);
  }
  return jsonOk({ updated: updated });
}
