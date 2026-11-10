// ==UserScript==
// @name         Genshin Impact – HoYoLAB Daily Check-in
// @namespace    https://github.com/JasdanJC/hoyolab-daily-auto-checkin
// @version      1.1.0
// @author       JasdanJC
// @description  Automatically claims the Genshin Impact daily check-in reward on HoYoLAB once per day, in the background, while you browse any website.
// @homepageURL  https://github.com/JasdanJC/hoyolab-daily-auto-checkin
// @supportURL   https://github.com/JasdanJC/hoyolab-daily-auto-checkin/issues
// @updateURL    https://raw.githubusercontent.com/JasdanJC/hoyolab-daily-auto-checkin/main/genshin-checkin.user.js
// @downloadURL  https://raw.githubusercontent.com/JasdanJC/hoyolab-daily-auto-checkin/main/genshin-checkin.user.js
// @match        *://*/*
// @noframes
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_notification
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
// @connect      sg-hk4e-api.hoyolab.com
// ==/UserScript==

(function () {
  'use strict';

  // ---- Configuration ------------------------------------------------------
  const ACT_ID = 'e202102251931481'; // Genshin Impact daily check-in event (HoYoLAB global)
  const API = 'https://sg-hk4e-api.hoyolab.com/event/sol';
  const PAGE = `https://act.hoyolab.com/ys/event/signin-sea-v3/index.html?act_id=${ACT_ID}`;
  const LANG = 'en-us';             // language of the messages returned by HoYoLAB
  const LOCK_MS = 5 * 60 * 1000;    // prevents several tabs from checking in at the same time
  const RETRY_MS = 30 * 60 * 1000;  // after an error, wait 30 min before retrying
  const NOTIFY_ON_SUCCESS = true;   // set to false to disable the success notification

  // ---- Helpers ------------------------------------------------------------

  // Current day in server time (UTC+8): the check-in resets at 00:00 UTC+8.
  function serverDay() {
    return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  }

  function notify(text, openPageOnClick = false) {
    GM_notification({
      title: 'Genshin – Daily Check-in',
      text,
      onclick: openPageOnClick ? () => GM_openInTab(PAGE, { active: true }) : undefined,
    });
  }

  function request(method, path, body) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method,
        url: `${API}/${path}`,
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Content-Type': 'application/json;charset=UTF-8',
          'Origin': 'https://act.hoyolab.com',
          'Referer': 'https://act.hoyolab.com/',
          'x-rpc-signgame': 'hk4e',
        },
        data: body ? JSON.stringify(body) : undefined,
        timeout: 15000,
        onload: (r) => {
          try {
            resolve(typeof r.response === 'object' && r.response !== null
              ? r.response
              : JSON.parse(r.responseText));
          } catch {
            reject(new Error(`Invalid response (HTTP ${r.status})`));
          }
        },
        onerror: () => reject(new Error('Network error')),
        ontimeout: () => reject(new Error('Request timed out')),
      });
    });
  }

  function markDone(day) {
    GM_setValue('doneDay', day);
    GM_setValue('lastFail', 0);
  }

  function markFail() {
    GM_setValue('lastFail', Date.now());
  }

  // ---- Main logic ---------------------------------------------------------

  async function checkIn({ manual = false } = {}) {
    const today = serverDay();

    if (!manual) {
      if (GM_getValue('doneDay') === today) return;                          // already done today
      if (Date.now() - GM_getValue('lastAttempt', 0) < LOCK_MS) return;      // another tab is on it
      if (Date.now() - GM_getValue('lastFail', 0) < RETRY_MS) return;        // back off after an error
    }
    GM_setValue('lastAttempt', Date.now());

    try {
      // 1) Get today's check-in status
      const info = await request('GET', `info?lang=${LANG}&act_id=${ACT_ID}`);
      if (info.retcode === -100) {
        markFail();
        notify('You are not logged in to HoYoLAB. Click to open the page and log in.', true);
        return;
      }
      if (info.retcode !== 0) throw new Error(info.message || `retcode ${info.retcode}`);

      if (info.data && info.data.is_sign) {
        markDone(today);
        if (manual) notify(`Already checked in today (${info.data.total_sign_day} days this month).`);
        return;
      }

      // 2) Check in
      const sign = await request('POST', `sign?lang=${LANG}`, { act_id: ACT_ID });

      if (sign.retcode === -5003) { // "already checked in today"
        markDone(today);
        if (manual) notify('Already checked in today.');
        return;
      }
      if (sign.retcode !== 0) throw new Error(sign.message || `retcode ${sign.retcode}`);

      // HoYoLAB sometimes requires a captcha. It is not automated: it must be solved by hand.
      if (sign.data && sign.data.gt_result && sign.data.gt_result.is_risk) {
        markFail();
        notify('HoYoLAB requires a verification (captcha). Click to check in manually.', true);
        return;
      }

      markDone(today);
      const days = ((info.data && info.data.total_sign_day) || 0) + 1;
      if (manual || NOTIFY_ON_SUCCESS) notify(`Check-in complete! ${days} days this month.`);
    } catch (err) {
      markFail();
      console.warn('[Genshin check-in]', err);
      notify(`Check-in failed: ${err.message}. Click to check in manually.`, true);
    }
  }

  // ---- Extension menu -----------------------------------------------------
  GM_registerMenuCommand('Check in now', () => checkIn({ manual: true }));
  GM_registerMenuCommand('Open check-in page', () => GM_openInTab(PAGE, { active: true }));

  checkIn();
})();
