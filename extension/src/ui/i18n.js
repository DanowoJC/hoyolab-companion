export const t = (key, subs) => chrome.i18n.getMessage(key, subs) || key;

export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
    el.setAttribute('aria-label', el.title);
  });
  document.documentElement.lang = chrome.i18n.getUILanguage();
}

export function ago(ts) {
  if (!ts) return '';
  const min = Math.floor((Date.now() - ts) / 60000);
  if (min < 1) return t('justNow');
  if (min < 60) return t('minutesAgo', [String(min)]);
  return t('hoursAgo', [String(Math.floor(min / 60))]);
}

export function duration(ms) {
  const totalMin = Math.max(0, Math.ceil(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

export const send = (msg) => chrome.runtime.sendMessage(msg);
