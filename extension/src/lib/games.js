// Static configuration for every supported game.
// Only public, non-secret identifiers live here (event IDs, endpoints, game codes).

export const GAMES = {
  genshin: {
    id: 'genshin',
    name: 'Genshin Impact',
    short: 'GI',
    color: '#4a90e2',
    gameId: 2,            // id used by the HoYoLAB game record card
    gameBiz: 'hk4e_global',
    checkin: {
      base: 'https://sg-hk4e-api.hoyolab.com/event/sol',
      actId: 'e202102251931481',
      signGame: 'hk4e',
      page: 'https://act.hoyolab.com/ys/event/signin-sea-v3/index.html?act_id=e202102251931481',
    },
    notes: {
      url: 'https://bbs-api-os.hoyolab.com/game_record/genshin/api/dailyNote',
      energyName: 'Original Resin',
      energyKey: 'resin',
      dailiesKey: 'commissions',
    },
    codes: {
      source: 'https://api.ennead.cc/mihoyo/genshin/codes',
      redeemUrl: 'https://sg-hk4e-api.hoyoverse.com/common/apicdkey/api/webExchangeCdkey',
      giftPage: 'https://genshin.hoyoverse.com/gift',
      method: 'GET',
    },
    realm: true,
  },

  starrail: {
    id: 'starrail',
    name: 'Honkai: Star Rail',
    short: 'HSR',
    color: '#b05bd6',
    gameId: 6,
    gameBiz: 'hkrpg_global',
    checkin: {
      base: 'https://sg-public-api.hoyolab.com/event/luna/os',
      actId: 'e202303301540311',
      signGame: 'hkrpg',
      page: 'https://act.hoyolab.com/bbs/event/signin/hkrpg/index.html?act_id=e202303301540311',
    },
    notes: {
      url: 'https://bbs-api-os.hoyolab.com/game_record/hkrpg/api/note',
      energyKey: 'trailblazePower',
      dailiesKey: 'dailyTraining',
    },
    codes: {
      source: 'https://api.ennead.cc/mihoyo/starrail/codes',
      redeemUrl: 'https://sg-hkrpg-api.hoyoverse.com/common/apicdkey/api/webExchangeCdkeyRisk',
      giftPage: 'https://hsr.hoyoverse.com/gift',
      method: 'POST',
    },
  },

  zzz: {
    id: 'zzz',
    name: 'Zenless Zone Zero',
    short: 'ZZZ',
    color: '#f2a900',
    gameId: 8,
    gameBiz: 'nap_global',
    checkin: {
      base: 'https://sg-public-api.hoyolab.com/event/luna/zzz/os',
      actId: 'e202406031448091',
      signGame: 'zzz',
      page: 'https://act.hoyolab.com/bbs/event/signin/zzz/e202406031448091.html?act_id=e202406031448091',
    },
    notes: {
      url: 'https://sg-act-nap-api.hoyolab.com/event/game_record_zzz/api/zzz/note',
      energyKey: 'battery',
      dailiesKey: 'engagement',
    },
    codes: {
      source: 'https://api.ennead.cc/mihoyo/zenless/codes',
      redeemUrl: 'https://public-operation-nap.hoyoverse.com/common/apicdkey/api/webExchangeCdkey',
      giftPage: 'https://zenless.hoyoverse.com/redemption',
      method: 'GET',
    },
  },

  honkai3: {
    id: 'honkai3',
    name: 'Honkai Impact 3rd',
    short: 'HI3',
    color: '#e05a6b',
    gameId: 1,
    gameBiz: 'bh3_global',
    checkin: {
      base: 'https://sg-public-api.hoyolab.com/event/mani',
      actId: 'e202110291205111',
      signGame: null,
      page: 'https://act.hoyolab.com/bbs/event/signin-bh3/index.html?act_id=e202110291205111',
    },
  },

  tot: {
    id: 'tot',
    name: 'Tears of Themis',
    short: 'ToT',
    color: '#7a8fd6',
    gameId: null,         // Tears of Themis has no game record card
    gameBiz: 'nxx_global',
    checkin: {
      base: 'https://sg-public-api.hoyolab.com/event/luna/os',
      actId: 'e202202281857121',
      signGame: null,
      page: 'https://act.hoyolab.com/bbs/event/signin/nxx/index.html?act_id=e202202281857121',
    },
  },
};

export const GAME_ORDER = ['genshin', 'starrail', 'zzz', 'honkai3', 'tot'];

export const DEFAULT_SETTINGS = {
  games: {
    genshin: { enabled: true, checkin: true, codes: true },
    starrail: { enabled: true, checkin: true, codes: true },
    zzz: { enabled: true, checkin: true, codes: true },
    honkai3: { enabled: true, checkin: true },
    tot: { enabled: true, checkin: true },
  },
  notifyErrors: false,     // desktop notification when a check-in or redemption needs attention
  apiLang: 'en-us',        // language of texts returned by HoYoLAB (reward names, messages)
};
