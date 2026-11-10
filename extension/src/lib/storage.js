// Thin wrapper around chrome.storage.local with defaults.

import { DEFAULT_SETTINGS, GAME_ORDER } from './games.js';

const DEFAULT_STATE = {
  account: null,   // { ltuid, roles: { [game]: { uid, region, nickname, level } }, fetchedAt }
  checkin: {},     // { [game]: { day, status, total, award, message, at } }
  notes: {},       // { [game]: { data, fetchedAt, error } }
  codes: {},       // { [game]: { redeemed: { [CODE]: { status, message, at, rewards } }, lastRun, lastError } }
};

function mergeSettings(saved) {
  const s = structuredClone(DEFAULT_SETTINGS);
  if (!saved) return s;
  for (const g of GAME_ORDER) s.games[g] = { ...s.games[g], ...(saved.games?.[g] || {}) };
  if (typeof saved.notifyErrors === 'boolean') s.notifyErrors = saved.notifyErrors;
  if (typeof saved.apiLang === 'string') s.apiLang = saved.apiLang;
  return s;
}

export async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return mergeSettings(settings);
}

export async function saveSettings(settings) {
  await chrome.storage.local.set({ settings: mergeSettings(settings) });
}

export async function getState() {
  const { state } = await chrome.storage.local.get('state');
  return { ...structuredClone(DEFAULT_STATE), ...(state || {}) };
}

// Serialize writes so concurrent tasks do not overwrite each other.
let queue = Promise.resolve();
export function updateState(mutator) {
  const run = queue.then(async () => {
    const state = await getState();
    await mutator(state);
    await chrome.storage.local.set({ state });
    return state;
  });
  queue = run.catch(() => {});
  return run;
}

export async function resetState() {
  await chrome.storage.local.set({ state: structuredClone(DEFAULT_STATE) });
}

/** Current HoYoLAB day (server time, UTC+8) as YYYY-MM-DD. */
export function serverDay(now = Date.now()) {
  return new Date(now + 8 * 3600 * 1000).toISOString().slice(0, 10);
}
