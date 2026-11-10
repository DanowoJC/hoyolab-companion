// ==UserScript==
// @name         Genshin Impact – Registro diario HoYoLAB
// @namespace    https://github.com/JasdanJC/hoyolab-daily-auto-checkin
// @version      1.0.0
// @author       JasdanJC
// @homepageURL  https://github.com/JasdanJC/hoyolab-daily-auto-checkin
// @supportURL   https://github.com/JasdanJC/hoyolab-daily-auto-checkin/issues
// @updateURL    https://raw.githubusercontent.com/JasdanJC/hoyolab-daily-auto-checkin/main/genshin-checkin.user.js
// @downloadURL  https://raw.githubusercontent.com/JasdanJC/hoyolab-daily-auto-checkin/main/genshin-checkin.user.js
// @description  Reclama la recompensa diaria de Genshin Impact en HoYoLAB una vez al día, en segundo plano, mientras navegas por cualquier web.
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

  // ---- Configuración ------------------------------------------------------
  const ACT_ID = 'e202102251931481'; // evento de registro diario de Genshin (HoYoLAB global)
  const API = 'https://sg-hk4e-api.hoyolab.com/event/sol';
  const PAGE = `https://act.hoyolab.com/ys/event/signin-sea-v3/index.html?act_id=${ACT_ID}`;
  const LANG = 'es-es';
  const LOCK_MS = 5 * 60 * 1000;    // evita que varias pestañas lo intenten a la vez
  const RETRY_MS = 30 * 60 * 1000;  // tras un error, no reintenta hasta pasados 30 min
  const NOTIFY_ON_SUCCESS = true;   // pon false si no quieres aviso al completar el registro

  // ---- Utilidades ---------------------------------------------------------

  // Día actual en hora del servidor (UTC+8): el registro se reinicia a las 00:00 UTC+8.
  function serverDay() {
    return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  }

  function notify(text, openPageOnClick = false) {
    GM_notification({
      title: 'Genshin – Registro diario',
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
            reject(new Error(`Respuesta no válida (HTTP ${r.status})`));
          }
        },
        onerror: () => reject(new Error('Error de red')),
        ontimeout: () => reject(new Error('Tiempo de espera agotado')),
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

  // ---- Lógica principal ---------------------------------------------------

  async function checkIn({ manual = false } = {}) {
    const today = serverDay();

    if (!manual) {
      if (GM_getValue('doneDay') === today) return;                          // ya hecho hoy
      if (Date.now() - GM_getValue('lastAttempt', 0) < LOCK_MS) return;      // otra pestaña en curso
      if (Date.now() - GM_getValue('lastFail', 0) < RETRY_MS) return;        // esperar tras un error
    }
    GM_setValue('lastAttempt', Date.now());

    try {
      // 1) Consultar estado de hoy
      const info = await request('GET', `info?lang=${LANG}&act_id=${ACT_ID}`);
      if (info.retcode === -100) {
        markFail();
        notify('No has iniciado sesión en HoYoLAB. Haz clic para abrir la página e iniciar sesión.', true);
        return;
      }
      if (info.retcode !== 0) throw new Error(info.message || `retcode ${info.retcode}`);

      if (info.data && info.data.is_sign) {
        markDone(today);
        if (manual) notify(`Ya habías hecho el registro hoy (${info.data.total_sign_day} días este mes).`);
        return;
      }

      // 2) Hacer el registro
      const sign = await request('POST', `sign?lang=${LANG}`, { act_id: ACT_ID });

      if (sign.retcode === -5003) { // "ya registrado hoy"
        markDone(today);
        if (manual) notify('Ya habías hecho el registro hoy.');
        return;
      }
      if (sign.retcode !== 0) throw new Error(sign.message || `retcode ${sign.retcode}`);

      // HoYoLAB a veces pide un captcha. No se automatiza: hay que hacerlo a mano.
      if (sign.data && sign.data.gt_result && sign.data.gt_result.is_risk) {
        markFail();
        notify('HoYoLAB pide una verificación (captcha). Haz clic para hacer el registro a mano.', true);
        return;
      }

      markDone(today);
      const days = ((info.data && info.data.total_sign_day) || 0) + 1;
      if (manual || NOTIFY_ON_SUCCESS) notify(`¡Registro completado! Llevas ${days} días este mes.`);
    } catch (err) {
      markFail();
      console.warn('[Genshin check-in]', err);
      notify(`No se pudo hacer el registro: ${err.message}. Haz clic para hacerlo a mano.`, true);
    }
  }

  // ---- Menú de Violentmonkey ----------------------------------------------
  GM_registerMenuCommand('Hacer registro ahora', () => checkIn({ manual: true }));
  GM_registerMenuCommand('Abrir página de registro', () => GM_openInTab(PAGE, { active: true }));

  checkIn();
})();
