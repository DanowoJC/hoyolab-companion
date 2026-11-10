// Service worker: schedules check-ins and code redemption, and serves the popup/options pages.

import { GAMES, GAME_ORDER } from './lib/games.js';
import { withSession } from './lib/session.js';
import { getAccount } from './lib/account.js';
import { runCheckIns } from './lib/checkin.js';
import { refreshNotes } from './lib/notes.js';
import { runCodeRedemption } from './lib/codes.js';
import { getSettings, saveSettings, getState, updateState, resetState, serverDay } from './lib/storage.js';

const ALARM_HOURLY = 'hourly';
const ALARM_RESET = 'daily-reset';
const ALARM_CODES = 'codes';
const CODES_EVERY_MIN = 180;

// ---------------------------------------------------------------- scheduling

function nextResetTime() {
  // HoYoLAB resets at 00:00 UTC+8 = 16:00 UTC. Run 2-12 min later.
  const now = new Date();
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 16, 0, 0));
  if (reset.getTime() <= now.getTime()) reset.setUTCDate(reset.getUTCDate() + 1);
  return reset.getTime() + (2 + Math.random() * 10) * 60 * 1000;
}

async function ensureAlarms() {
  const alarms = await chrome.alarms.getAll();
  const names = new Set(alarms.map((a) => a.name));
  if (!names.has(ALARM_HOURLY)) chrome.alarms.create(ALARM_HOURLY, { delayInMinutes: 1, periodInMinutes: 60 });
  if (!names.has(ALARM_CODES)) chrome.alarms.create(ALARM_CODES, { delayInMinutes: 3, periodInMinutes: CODES_EVERY_MIN });
  if (!names.has(ALARM_RESET)) chrome.alarms.create(ALARM_RESET, { when: nextResetTime() });
}

chrome.runtime.onInstalled.addListener(async (details) => {
  await ensureAlarms();
  if (details.reason === 'install') chrome.runtime.openOptionsPage();
  runTask('checkin');
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureAlarms();
  runTask('checkin');
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_RESET) {
    chrome.alarms.create(ALARM_RESET, { when: nextResetTime() });
    await runTask('checkin');
  } else if (alarm.name === ALARM_HOURLY) {
    await runTask('checkin');
  } else if (alarm.name === ALARM_CODES) {
    await runTask('codes');
  }
});

// ---------------------------------------------------------------- tasks

// One task at a time: they share the temporary session rule.
let chain = Promise.resolve();
function runTask(kind, opts = {}) {
  const run = chain.then(() => doTask(kind, opts));
  chain = run.catch(() => {});
  return run;
}

async function doTask(kind, { force = false } = {}) {
  const settings = await getSettings();
  try {
    return await withSession(async (loggedIn) => {
      if (!loggedIn) {
        await updateState((s) => { s.authError = true; });
        return { ok: false, error: 'auth' };
      }
      const account = await getAccount({ force: kind === 'account', lang: settings.apiLang });
      await updateState((s) => { s.authError = false; });

      if (kind === 'checkin') {
        const results = await runCheckIns({ settings, account, force });
        await notifyCheckInProblems(settings, results);
        return { ok: true, results };
      }
      if (kind === 'notes') {
        await refreshNotes({ settings, account });
        return { ok: true };
      }
      if (kind === 'codes') {
        const res = await runCodeRedemption({ settings, account });
        return { ok: true, ...res };
      }
      return { ok: true };
    });
  } catch (e) {
    if (e.kind === 'auth') await updateState((s) => { s.authError = true; });
    return { ok: false, error: e.message };
  } finally {
    await updateBadge();
  }
}

// ---------------------------------------------------------------- badge & notifications

const PROBLEM = new Set(['auth', 'captcha', 'error', 'network']);

async function updateBadge() {
  const [settings, state] = await Promise.all([getSettings(), getState()]);
  const today = serverDay();
  let problems = 0;
  for (const id of GAME_ORDER) {
    const cfg = settings.games[id];
    const c = state.checkin[id];
    if (cfg?.enabled && cfg.checkin && c?.day === today && PROBLEM.has(c.status)) problems++;
  }
  const text = state.authError ? '!' : problems ? String(problems) : '';
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color: '#d93025' });
}

async function notifyCheckInProblems(settings, results) {
  if (!settings.notifyErrors) return;
  const msg = chrome.i18n.getMessage;
  for (const r of results) {
    if (!['auth', 'captcha', 'error'].includes(r.status)) continue;
    const text = r.status === 'captcha' ? msg('notifCaptcha')
      : r.status === 'auth' ? msg('notifAuth')
      : msg('notifError', [r.message || '']);
    chrome.notifications.create(`checkin-${r.id}-${Date.now()}`, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: `${GAMES[r.id].name} – ${msg('checkIn')}`,
      message: text,
    });
  }
}

chrome.notifications.onClicked.addListener((id) => {
  const game = id.split('-')[1];
  if (GAMES[game]) chrome.tabs.create({ url: GAMES[game].checkin.page });
});

// ---------------------------------------------------------------- messages from UI

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    switch (msg?.type) {
      case 'getAll':
        return { settings: await getSettings(), state: await getState(), today: serverDay() };
      case 'checkInNow':
        return runTask('checkin', { force: true });
      case 'refreshNotes':
        return runTask('notes');
      case 'redeemNow':
        return runTask('codes');
      case 'refreshAccount':
        return runTask('account');
      case 'saveSettings':
        await saveSettings(msg.settings);
        await updateBadge();
        return { ok: true };
      case 'resetData':
        await resetState();
        await updateBadge();
        return { ok: true };
      default:
        return { ok: false, error: 'unknown message' };
    }
  })().then(sendResponse, (e) => sendResponse({ ok: false, error: e.message }));
  return true; // async response
});
