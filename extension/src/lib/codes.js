// Automatic redemption of public gift codes.
// Code list: community API https://api.ennead.cc/mihoyo/<game>/codes

import { GAMES, GAME_ORDER } from './games.js';
import { hoyoFetch, baseHeaders, isAuthError, sleep } from './api.js';
import { getState, updateState } from './storage.js';
import { hasRedeemToken } from './session.js';

const REDEEM_INTERVAL_MS = 6000;               // HoYoverse enforces ~5 s between redemptions
const FINAL = {
  0: 'redeemed',
  [-2017]: 'alreadyRedeemed',
  [-2018]: 'alreadyRedeemed',
  [-2001]: 'expired',
  [-2006]: 'limitReached',
  [-2003]: 'invalid',
  [-2011]: 'levelTooLow',
  [-1073]: 'noAccount',
};
const COOLDOWN = -2016;

async function fetchCodeList(game) {
  const res = await fetch(game.codes.source, { cache: 'no-store', credentials: 'omit' });
  if (!res.ok) throw new Error(`Code list: HTTP ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json.active)) throw new Error('Code list: malformed response');
  return json.active
    .filter((c) => typeof c.code === 'string' && c.code.trim())
    .map((c) => ({ code: c.code.trim().toUpperCase(), rewards: Array.isArray(c.rewards) ? c.rewards : [] }));
}

async function redeem(game, role, code, lang) {
  const params = {
    cdkey: code,
    game_biz: game.gameBiz,
    region: role.region,
    uid: role.uid,
    lang: 'en',
    sLangKey: lang,
    t: Date.now(),
  };
  return hoyoFetch(game.codes.redeemUrl, { method: game.codes.method, params, headers: baseHeaders(lang) });
}

/**
 * Redeems every active code not tried before, for every enabled game.
 * Must run with the session attached. Returns { redeemed: [{id, code, rewards}], problems: [...] }.
 */
export async function runCodeRedemption({ settings, account }) {
  const out = { redeemed: [], problems: [] };
  const games = GAME_ORDER.filter((id) => GAMES[id].codes && settings.games[id]?.enabled && settings.games[id]?.codes);
  if (games.length === 0) return out;

  if (!(await hasRedeemToken())) {
    for (const id of games) {
      await updateState((s) => {
        s.codes[id] = { ...(s.codes[id] || { redeemed: {} }), lastRun: Date.now(), lastError: 'noToken' };
      });
    }
    out.problems.push({ id: null, reason: 'noToken' });
    return out;
  }

  for (const id of games) {
    const game = GAMES[id];
    const role = account.roles[id];
    if (!role) {
      await updateState((s) => { s.codes[id] = { ...(s.codes[id] || { redeemed: {} }), lastRun: Date.now(), lastError: 'noAccount' }; });
      continue;
    }

    let list;
    try {
      list = await fetchCodeList(game);
    } catch (e) {
      await updateState((s) => { s.codes[id] = { ...(s.codes[id] || { redeemed: {} }), lastRun: Date.now(), lastError: e.message }; });
      continue;
    }

    const state = await getState();
    const tried = state.codes[id]?.redeemed || {};
    const pending = list.filter((c) => !tried[c.code] || tried[c.code].status === 'retry');

    let lastError = null;
    for (const { code, rewards } of pending) {
      let json;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          json = await redeem(game, role, code, settings.apiLang);
        } catch (e) {
          json = { retcode: null, message: e.message };
        }
        await sleep(REDEEM_INTERVAL_MS);
        if (json.retcode !== COOLDOWN) break;
      }

      if (isAuthError(json)) { lastError = 'auth'; break; }

      const attempts = (tried[code]?.attempts || 0) + 1;
      let status = FINAL[json.retcode] ?? 'retry';
      if (status === 'retry') {
        lastError = json.message || `retcode ${json.retcode}`;
        if (attempts >= 3) status = 'failed';   // give up after 3 runs
      }
      const entry = { status, message: json.message || '', at: Date.now(), rewards, attempts };
      await updateState((s) => {
        s.codes[id] = s.codes[id] || { redeemed: {} };
        s.codes[id].redeemed = s.codes[id].redeemed || {};
        s.codes[id].redeemed[code] = entry;
      });
      if (status === 'redeemed') out.redeemed.push({ id, code, rewards });
    }

    await updateState((s) => {
      s.codes[id] = { ...(s.codes[id] || { redeemed: {} }), lastRun: Date.now(), lastError };
    });
    if (lastError) out.problems.push({ id, reason: lastError });
  }
  return out;
}
