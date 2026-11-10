import { GAMES, GAME_ORDER } from '../lib/games.js';
import { t, applyI18n, ago, duration, send } from '../ui/i18n.js';

const NOTES_MAX_AGE = 5 * 60 * 1000;
const $ = (sel, root = document) => root.querySelector(sel);

let data = null;          // { settings, state, today }
let notesLoading = false;

// ---------------------------------------------------------------- rendering helpers

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Live value of a regenerating resource, estimated from the time it will be full. */
function liveValue(r, fetchedAt) {
  if (r.current === null || r.max === null) return r.current;
  if (r.fullAt && r.regenSec) {
    const left = r.fullAt - Date.now();
    if (left <= 0) return Math.max(r.current, r.max);
    return Math.min(r.max, Math.max(r.current, r.max - Math.ceil(left / 1000 / r.regenSec)));
  }
  return r.current;
}

function meter({ label, current, max, sub, state }) {
  const m = el('div', `meter ${state || ''}`);
  const head = el('div', 'meter-head');
  head.append(el('span', 'meter-label', label), el('span', 'meter-value', `${current ?? '–'} / ${max ?? '–'}`));
  const bar = el('div', 'bar');
  const fill = el('span');
  fill.style.width = max ? `${Math.min(100, ((current || 0) / max) * 100)}%` : '0%';
  bar.append(fill);
  m.append(head, bar);
  if (sub) m.append(el('div', 'meter-sub muted', sub));
  return m;
}

function fullSub(fullAt, current, max) {
  if (current !== null && max !== null && current >= max) return t('full');
  if (!fullAt) return '';
  const left = fullAt - Date.now();
  if (left <= 0) return t('full');
  const at = new Date(fullAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${t('fullIn', [duration(left)])} · ${at}`;
}

const ENERGY_LABEL = { genshin: 'resin', starrail: 'trailblazePower', zzz: 'battery' };
const DAILIES_LABEL = { genshin: 'commissions', starrail: 'dailyTraining', zzz: 'engagement' };

// ---------------------------------------------------------------- sections

function renderCheckin(card, id) {
  const { state, today, settings } = data;
  const c = state.checkin[id];
  const icon = $('.status-icon', card);
  const text = $('.status-text', card);
  const reward = $('.reward', card);
  reward.replaceChildren();

  if (!settings.games[id].checkin) {
    $('.checkin', card).hidden = true;
    return;
  }

  const set = (cls, sym, msg) => { icon.className = `status-icon ${cls}`; icon.textContent = sym; text.textContent = msg; };

  if (!c || c.day !== today) set('idle', '…', t('statusPending'));
  else if (c.status === 'done') set('ok', '✓', t('statusDone'));
  else if (c.status === 'captcha') set('warn', '!', t('statusCaptcha'));
  else if (c.status === 'auth') set('err', '!', t('statusAuth'));
  else if (c.status === 'network') set('warn', '↻', t('statusNetwork'));
  else if (c.status === 'noAccount') set('idle', '–', t('statusNoAccount'));
  else set('err', '×', t('statusError', [c.message || '?']));

  if (c?.day === today && c.status === 'captcha') {
    const a = el('a', 'btn small', t('checkInNow'));
    a.href = GAMES[id].checkin.page;
    a.target = '_blank';
    reward.append(a);
    return;
  }

  if (c?.day === today && c.total) reward.append(el('span', '', t('dayOfMonth', [String(c.total)])));
  if (c?.day === today && c.award) {
    reward.append(el('span', '', '·'), el('span', '', t('todayReward')));
    if (c.award.icon) {
      const img = el('img');
      img.src = c.award.icon;
      img.alt = '';
      img.onerror = () => img.remove();
      reward.append(img);
    }
    reward.append(el('span', '', `${c.award.name} ×${c.award.count}`));
  }
}

function renderNotes(card, id) {
  const box = $('.notes', card);
  box.replaceChildren();
  if (!GAMES[id].notes) return;

  const n = data.state.notes[id];
  if (n?.error?.kind === 'noAccount') return;

  if (!n?.data) {
    if (n?.error) {
      const msg = n.error.kind === 'disabled' ? t('notesDisabled') : t('notesError', [n.error.message || '?']);
      box.append(el('div', 'note-msg err', msg));
    } else {
      box.append(el('div', 'note-msg muted', t('notesLoading')));
    }
    return;
  }

  const d = n.data;
  const energy = { ...d.energy, current: liveValue(d.energy, n.fetchedAt) };
  const eSub = [fullSub(energy.fullAt, energy.current, energy.max)];
  if (energy.reserve) eSub.push(t('reserve', [String(energy.reserve)]));
  box.append(meter({
    label: t(ENERGY_LABEL[id]),
    current: energy.current,
    max: energy.max,
    sub: eSub.filter(Boolean).join(' · '),
    state: energy.current >= energy.max ? 'full' : '',
  }));

  const dl = d.dailies;
  const done = dl.current !== null && dl.max !== null && dl.current >= dl.max;
  let dSub = '';
  if (id === 'genshin') dSub = dl.bonusClaimed ? t('bonusClaimed') : t('bonusPending');
  box.append(meter({ label: t(DAILIES_LABEL[id]), current: dl.current, max: dl.max, sub: dSub, state: done ? 'done' : '' }));

  if (d.realm && d.realm.max) {
    box.append(meter({
      label: t('realmCurrency'),
      current: d.realm.current,
      max: d.realm.max,
      sub: fullSub(d.realm.fullAt, d.realm.current, d.realm.max),
      state: d.realm.current >= d.realm.max ? 'full' : '',
    }));
  }

  const upd = el('div', 'updated muted', t('updated', [ago(n.fetchedAt)]));
  if (n.error) {
    upd.textContent += ` · ${n.error.kind === 'disabled' ? t('notesDisabled') : t('notesError', [n.error.message || '?'])}`;
  }
  box.append(upd);
}

function renderCodes(card, id) {
  const box = $('.codes', card);
  const cfg = data.settings.games[id];
  if (!GAMES[id].codes || !cfg.codes) { box.hidden = true; return; }
  box.hidden = false;
  box.replaceChildren();

  const c = data.state.codes[id];
  if (!c?.lastRun) {
    box.append(el('div', '', `${t('codes')}: ${t('codesNever')}`));
    return;
  }
  const needsLogin = c.lastError === 'noToken' || c.lastError === 'redeemLogin';
  if (c.lastError === 'noAccount') {
    box.hidden = true;
    return;
  }

  const redeemed = Object.entries(c.redeemed || {})
    .filter(([, v]) => v.status === 'redeemed')
    .sort((a, b) => b[1].at - a[1].at);

  const details = el('details');
  const summary = el('summary', '', `${t('codes')}: ${t('codesSummary', [String(redeemed.length), ago(c.lastRun)])}`);
  details.append(summary);
  if (redeemed.length) {
    const ul = el('ul');
    for (const [code, v] of redeemed.slice(0, 8)) {
      const li = el('li');
      li.append(el('code', '', code));
      if (v.rewards?.length) li.append(document.createTextNode(` — ${v.rewards.join(', ')}`));
      ul.append(li);
    }
    details.append(ul);
  }
  box.append(details);
  if (needsLogin) {
    const row = el('div', 'code-login');
    const a = el('a', 'btn small', t('codesLoginBtn'));
    a.href = GAMES[id].codes.giftPage;
    a.target = '_blank';
    row.append(el('span', '', t('codesNoToken')), a);
    box.append(row);
  } else if (c.lastError) {
    box.append(el('div', '', t('statusError', [c.lastError])));
  }
}

function render() {
  const { settings, state } = data;
  $('#auth-banner').hidden = !state.authError;

  const main = $('#games');
  main.replaceChildren();
  const enabled = GAME_ORDER.filter((id) => settings.games[id]?.enabled);
  if (!enabled.length) {
    main.append(el('div', 'empty muted', t('noGames')));
    return;
  }

  const tpl = $('#tpl-game');
  for (const id of enabled) {
    const game = GAMES[id];
    const card = tpl.content.firstElementChild.cloneNode(true);
    $('.dot', card).style.background = game.color;
    $('.game-name', card).textContent = game.name;
    const role = state.account?.roles?.[id];
    $('.role', card).textContent = role ? `${role.nickname} · UID ${role.uid} · Lv. ${role.level}` : '';
    renderCheckin(card, id);
    renderNotes(card, id);
    renderCodes(card, id);
    main.append(card);
  }
}

// ---------------------------------------------------------------- data flow

async function load() {
  data = await send({ type: 'getAll' });
  render();
}

async function refreshNotes(force = false) {
  const { settings, state } = data;
  const needs = GAME_ORDER.some((id) => GAMES[id].notes && settings.games[id]?.enabled
    && (force || !state.notes[id]?.fetchedAt || Date.now() - state.notes[id].fetchedAt > NOTES_MAX_AGE));
  if (!needs || notesLoading) return;
  notesLoading = true;
  $('#btn-refresh').classList.add('spin');
  try {
    await send({ type: 'refreshNotes' });
  } finally {
    notesLoading = false;
    $('#btn-refresh').classList.remove('spin');
    await load();
  }
}

async function busy(btn, msg) {
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = t('working');
  try {
    await send(msg);
  } finally {
    btn.disabled = false;
    btn.textContent = label;
    await load();
  }
}

// ---------------------------------------------------------------- init

applyI18n();
$('#btn-settings').addEventListener('click', () => chrome.runtime.openOptionsPage());
$('#btn-refresh').addEventListener('click', () => refreshNotes(true));
$('#btn-checkin').addEventListener('click', (e) => busy(e.currentTarget, { type: 'checkInNow' }));
$('#btn-redeem').addEventListener('click', (e) => busy(e.currentTarget, { type: 'redeemNow' }));

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.state || changes.settings)) load();
});

await load();
refreshNotes();
setInterval(render, 30 * 1000); // keep estimated resin and timers fresh while open
