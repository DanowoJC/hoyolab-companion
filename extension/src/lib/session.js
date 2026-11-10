// Session handling.
//
// The extension reuses the HoYoLAB session of the browser. Some browsers (e.g. Brave)
// do not attach cookies to background requests made by extensions, and code
// redemption runs on *.hoyoverse.com, which does not share cookies with hoyolab.com.
// To make both cases work, a temporary declarativeNetRequest *session* rule attaches
// the HoYoLAB cookies (read on the fly with chrome.cookies) only to requests made by
// this extension (initiator = this extension, not from any tab). Nothing is persisted.

const RULE_ID = 1;

// Cookies needed by HoYoLAB / HoYoverse APIs.
const COOKIE_NAMES = [
  'ltoken_v2', 'ltuid_v2', 'ltmid_v2',
  'cookie_token_v2', 'account_id_v2', 'account_mid_v2',
  'ltoken', 'ltuid', 'cookie_token', 'account_id',
  'mi18nLang',
];

async function readHoyolabCookies() {
  const all = await chrome.cookies.getAll({ domain: 'hoyolab.com' });
  const map = new Map();
  for (const c of all) {
    if (COOKIE_NAMES.includes(c.name) && !map.has(c.name)) map.set(c.name, c.value);
  }
  return map;
}

/** Returns the HoYoLAB account id (ltuid) of the logged-in user, or null if not logged in. */
export async function getLtuid() {
  const cookies = await readHoyolabCookies();
  return cookies.get('ltuid_v2') || cookies.get('ltuid') || null;
}

// Cookies the code-redemption API on *.hoyoverse.com needs.
const REDEEM_COOKIES = ['cookie_token_v2', 'account_id_v2', 'account_mid_v2', 'ltoken_v2', 'ltuid_v2', 'ltmid_v2'];

/**
 * Copies the HoYoLAB session cookies to .hoyoverse.com, exactly as logging in on the
 * official gift-code page would. Code redemption runs on hoyoverse.com, which does not
 * share cookies with hoyolab.com. Returns the number of cookies copied.
 */
export async function syncRedeemCookies() {
  const source = await chrome.cookies.getAll({ domain: 'hoyolab.com' });
  let copied = 0;
  for (const name of REDEEM_COOKIES) {
    const c = source.find((x) => x.name === name);
    if (!c) continue;
    // Never overwrite a session the user created on hoyoverse.com (e.g. on the gift-code page).
    const existing = await chrome.cookies.get({ url: 'https://sg-hk4e-api.hoyoverse.com/', name });
    if (existing) { copied++; continue; }
    const details = {
      url: 'https://hoyoverse.com/',
      domain: '.hoyoverse.com',
      path: '/',
      name,
      value: c.value,
      secure: true,
      httpOnly: c.httpOnly,
      sameSite: 'no_restriction',
    };
    if (c.expirationDate) details.expirationDate = c.expirationDate;
    if (await chrome.cookies.set(details)) copied++;
  }
  return copied;
}

export async function hasRedeemToken() {
  const cookies = await readHoyolabCookies();
  return Boolean(cookies.get('cookie_token_v2') || cookies.get('cookie_token'));
}

/**
 * Installs the session rule that adds the cookies + Referer/Origin to this extension's
 * own requests. Returns false if the user is not logged in to HoYoLAB.
 */
export async function attachSession() {
  const cookies = await readHoyolabCookies();
  if (!cookies.get('ltuid_v2') && !cookies.get('ltuid')) {
    await detachSession();
    return false;
  }
  const cookieHeader = [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');

  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [RULE_ID],
    addRules: [{
      id: RULE_ID,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          { header: 'cookie', operation: 'set', value: cookieHeader },
          { header: 'origin', operation: 'remove' },
          { header: 'referer', operation: 'set', value: 'https://act.hoyolab.com/' },
        ],
      },
      condition: {
        // hoyoverse.com (code redemption) keeps its own session: see syncRedeemCookies().
        requestDomains: ['hoyolab.com'],
        initiatorDomains: [chrome.runtime.id],
        tabIds: [chrome.tabs.TAB_ID_NONE],
        resourceTypes: ['xmlhttprequest', 'other'],
      },
    }],
  });
  return true;
}

export async function detachSession() {
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [RULE_ID] });
}

/** Runs fn with the session attached; always detaches afterwards. */
export async function withSession(fn) {
  const ok = await attachSession();
  try {
    return await fn(ok);
  } finally {
    await detachSession();
  }
}
