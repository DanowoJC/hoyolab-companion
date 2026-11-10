// Discovers which game characters are linked to the logged-in HoYoLAB account.

import { GAMES } from './games.js';
import { hoyoFetch, baseHeaders, generateDS, ApiError, isAuthError } from './api.js';
import { getLtuid } from './session.js';
import { getState, updateState } from './storage.js';

const CARD_URL = 'https://bbs-api-os.hoyolab.com/game_record/card/wapi/getGameRecordCard';
const ROLES_URL = 'https://api-account-os.hoyolab.com/account/binding/api/getUserGameRolesByCookie';
const ACCOUNT_TTL = 12 * 3600 * 1000;

async function fromRecordCard(ltuid, lang) {
  const json = await hoyoFetch(CARD_URL, {
    params: { uid: ltuid },
    headers: { ...baseHeaders(lang), DS: generateDS() },
  });
  if (isAuthError(json)) throw new ApiError('Not logged in to HoYoLAB', { retcode: json.retcode, kind: 'auth' });
  if (json.retcode !== 0 || !Array.isArray(json.data?.list)) return null;

  const roles = {};
  for (const game of Object.values(GAMES)) {
    if (!game.gameId) continue;
    const r = json.data.list.find((x) => x.game_id === game.gameId);
    if (r) roles[game.id] = { uid: r.game_role_id, region: r.region, nickname: r.nickname, level: r.level };
  }
  return roles;
}

async function fromBinding(lang) {
  const roles = {};
  for (const game of Object.values(GAMES)) {
    if (!game.gameId) continue;
    try {
      const json = await hoyoFetch(ROLES_URL, { params: { game_biz: game.gameBiz }, headers: baseHeaders(lang) });
      const r = json.retcode === 0 && json.data?.list?.[0];
      if (r) roles[game.id] = { uid: r.game_uid, region: r.region, nickname: r.nickname, level: r.level };
    } catch { /* ignore, best effort */ }
  }
  return roles;
}

/**
 * Returns { ltuid, roles } for the current session. Cached for 12 h unless force=true
 * or the logged-in account changed. Must be called with the session attached.
 */
export async function getAccount({ force = false, lang = 'en-us' } = {}) {
  const ltuid = await getLtuid();
  if (!ltuid) throw new ApiError('Not logged in to HoYoLAB', { kind: 'auth' });

  const state = await getState();
  const cached = state.account;
  if (!force && cached && cached.ltuid === ltuid && Date.now() - cached.fetchedAt < ACCOUNT_TTL) return cached;

  let roles = await fromRecordCard(ltuid, lang);
  if (!roles || Object.keys(roles).length === 0) roles = await fromBinding(lang);

  const account = { ltuid, roles: roles || {}, fetchedAt: Date.now() };
  await updateState((s) => {
    if (s.account && s.account.ltuid !== ltuid) {
      // Different account logged in: forget per-account data.
      s.checkin = {};
      s.notes = {};
      s.codes = {};
    }
    s.account = account;
  });
  return account;
}
