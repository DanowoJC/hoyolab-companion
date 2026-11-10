// Real-time notes (Battle Chronicle): energy, daily tasks and Serenitea Pot currency.
// Read-only: these requests never change anything on the account.

import { GAMES, GAME_ORDER } from './games.js';
import { hoyoFetch, baseHeaders, generateDS, isAuthError, ApiError } from './api.js';
import { updateState } from './storage.js';

// retcodes meaning "Real-Time Notes / Battle Chronicle data is not available"
const DISABLED_RETCODES = new Set([10102, 10104, 1009, -501000]);

const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
const fullAt = (secondsLeft, now) => {
  const s = num(secondsLeft);
  return s === null ? null : now + s * 1000;
};

function normalize(gameId, d, now) {
  switch (gameId) {
    case 'genshin':
      return {
        energy: { current: num(d.current_resin), max: num(d.max_resin), fullAt: fullAt(d.resin_recovery_time, now), regenSec: 480 },
        dailies: {
          current: num(d.daily_task?.finished_num ?? d.finished_task_num),
          max: num(d.daily_task?.total_num ?? d.total_task_num),
          bonusClaimed: Boolean(d.daily_task?.is_extra_task_reward_received ?? d.is_extra_task_reward_received),
        },
        realm: { current: num(d.current_home_coin), max: num(d.max_home_coin), fullAt: fullAt(d.home_coin_recovery_time, now) },
      };
    case 'starrail':
      return {
        energy: {
          current: num(d.current_stamina), max: num(d.max_stamina), fullAt: fullAt(d.stamina_recover_time, now),
          regenSec: 360, reserve: num(d.current_reserve_stamina),
        },
        dailies: { current: num(d.current_train_score), max: num(d.max_train_score) },
      };
    case 'zzz':
      return {
        energy: { current: num(d.energy?.progress?.current), max: num(d.energy?.progress?.max), fullAt: fullAt(d.energy?.restore, now), regenSec: 360 },
        dailies: { current: num(d.vitality?.current), max: num(d.vitality?.max) },
      };
    default:
      return null;
  }
}

async function fetchNotes(game, role, lang) {
  const json = await hoyoFetch(game.notes.url, {
    params: { server: role.region, role_id: role.uid },
    headers: { ...baseHeaders(lang), DS: generateDS() },
  });
  if (isAuthError(json)) throw new ApiError(json.message || 'Not logged in', { retcode: json.retcode, kind: 'auth' });
  if (DISABLED_RETCODES.has(json.retcode)) {
    throw new ApiError(json.message || 'Real-Time Notes are disabled', { retcode: json.retcode, kind: 'disabled' });
  }
  if (json.retcode !== 0 || !json.data) throw new ApiError(json.message || `retcode ${json.retcode}`, { retcode: json.retcode });
  return normalize(game.id, json.data, Date.now());
}

/** Refreshes notes for every enabled game that supports them. Must run with the session attached. */
export async function refreshNotes({ settings, account }) {
  for (const id of GAME_ORDER) {
    const game = GAMES[id];
    if (!game.notes || !settings.games[id]?.enabled) continue;
    const role = account.roles[id];
    if (!role) {
      await updateState((s) => { s.notes[id] = { data: null, error: { kind: 'noAccount' }, fetchedAt: Date.now() }; });
      continue;
    }
    try {
      const data = await fetchNotes(game, role, settings.apiLang);
      await updateState((s) => { s.notes[id] = { data, error: null, fetchedAt: Date.now() }; });
    } catch (e) {
      const error = { kind: e.kind || 'error', message: e.message, retcode: e.retcode ?? null };
      await updateState((s) => {
        // Keep the last good data so the panel still shows something.
        s.notes[id] = { data: s.notes[id]?.data ?? null, error, fetchedAt: Date.now() };
      });
    }
  }
}
