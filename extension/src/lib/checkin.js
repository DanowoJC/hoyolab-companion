// Daily check-in for every enabled game.

import { GAMES, GAME_ORDER } from './games.js';
import { hoyoFetch, baseHeaders, isAuthError, ApiError } from './api.js';
import { getState, updateState, serverDay } from './storage.js';

// retcodes meaning "no character for this game on the account"
const NO_ACCOUNT_RETCODES = new Set([-10002, -10001, 10102]);

function headersFor(game, lang) {
  const h = baseHeaders(lang);
  if (game.checkin.signGame) h['x-rpc-signgame'] = game.checkin.signGame;
  return h;
}

async function getAwards(game, lang) {
  try {
    const json = await hoyoFetch(`${game.checkin.base}/home`, {
      params: { lang, act_id: game.checkin.actId },
      headers: headersFor(game, lang),
    });
    return json.retcode === 0 && Array.isArray(json.data?.awards) ? json.data.awards : [];
  } catch {
    return [];
  }
}

function pickAward(awards, index) {
  const a = awards[index];
  return a ? { name: a.name, count: a.cnt, icon: a.icon } : null;
}

async function checkInGame(game, lang) {
  const base = game.checkin.base;
  const params = { lang, act_id: game.checkin.actId };
  const headers = headersFor(game, lang);

  const info = await hoyoFetch(`${base}/info`, { params, headers });
  if (isAuthError(info)) return { status: 'auth', message: info.message };
  if (NO_ACCOUNT_RETCODES.has(info.retcode)) return { status: 'noAccount', message: info.message };
  if (info.retcode !== 0) return { status: 'error', message: info.message || `retcode ${info.retcode}` };

  const total = info.data?.total_sign_day ?? 0;
  const awards = await getAwards(game, lang);

  if (info.data?.is_sign) {
    return { status: 'done', total, award: pickAward(awards, total - 1), signedNow: false };
  }

  const sign = await hoyoFetch(`${base}/sign`, {
    method: 'POST',
    params: { lang },
    body: { act_id: game.checkin.actId },
    headers,
  });

  if (sign.retcode === -5003) return { status: 'done', total, award: pickAward(awards, total - 1), signedNow: false };
  if (isAuthError(sign)) return { status: 'auth', message: sign.message };
  if (NO_ACCOUNT_RETCODES.has(sign.retcode)) return { status: 'noAccount', message: sign.message };
  if (sign.retcode !== 0) return { status: 'error', message: sign.message || `retcode ${sign.retcode}` };
  if (sign.data?.gt_result?.is_risk) return { status: 'captcha', total, award: pickAward(awards, total) };

  return { status: 'done', total: total + 1, award: pickAward(awards, total), signedNow: true };
}

/**
 * Runs the check-in for all enabled games that are not done today.
 * Must be called with the session attached. Returns the list of results of this run.
 */
export async function runCheckIns({ settings, account, force = false }) {
  const today = serverDay();
  const state = await getState();
  const results = [];

  for (const id of GAME_ORDER) {
    const game = GAMES[id];
    const cfg = settings.games[id];
    if (!cfg?.enabled || !cfg.checkin) continue;

    const prev = state.checkin[id];
    if (!force && prev?.day === today && (prev.status === 'done' || prev.status === 'noAccount')) continue;

    // Games with a record card: skip if the account has no character for it.
    if (game.gameId && account && !account.roles[id]) {
      const r = { day: today, status: 'noAccount', at: Date.now() };
      await updateState((s) => { s.checkin[id] = r; });
      continue;
    }

    let r;
    try {
      r = await checkInGame(game, settings.apiLang);
    } catch (e) {
      r = { status: e instanceof ApiError && e.kind === 'network' ? 'network' : 'error', message: e.message };
    }
    const entry = { day: today, at: Date.now(), ...r };
    await updateState((s) => { s.checkin[id] = entry; });
    results.push({ id, ...entry });
  }
  return results;
}
