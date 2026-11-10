import { GAMES, GAME_ORDER } from '../lib/games.js';
import { t, applyI18n, send } from '../ui/i18n.js';

const $ = (sel, root = document) => root.querySelector(sel);
let settings;
let state;
let savedTimer;

function flashSaved() {
  const s = $('#saved');
  s.hidden = false;
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => { s.hidden = true; }, 1500);
}

async function save() {
  await send({ type: 'saveSettings', settings });
  flashSaved();
}

function renderAccount() {
  const box = $('#account-info');
  if (state.authError || !state.account) {
    box.textContent = t('notLoggedIn');
    box.className = 'muted';
  } else {
    box.textContent = t('optAccountLoggedIn', [state.account.ltuid]);
    box.className = '';
  }
}

function renderGames() {
  const list = $('#games');
  list.replaceChildren();
  const tpl = $('#tpl-game');

  for (const id of GAME_ORDER) {
    const game = GAMES[id];
    const cfg = settings.games[id];
    const row = tpl.content.firstElementChild.cloneNode(true);
    applyI18n(row);

    $('.dot', row).style.background = game.color;
    $('.game-name', row).textContent = game.name;
    const role = state.account?.roles?.[id];
    $('.role', row).textContent = role
      ? `${t('optCharacter')}: ${role.nickname} · UID ${role.uid} · Lv. ${role.level}`
      : game.gameId && state.account ? t('optNoCharacter') : '';
    if (!game.codes) $('.codes-opt', row).remove();
    row.classList.toggle('off', !cfg.enabled);

    row.querySelectorAll('input[data-k]').forEach((input) => {
      const k = input.dataset.k;
      input.checked = Boolean(cfg[k]);
      input.addEventListener('change', async () => {
        cfg[k] = input.checked;
        row.classList.toggle('off', !cfg.enabled);
        await save();
      });
    });
    list.append(row);
  }
}

async function load() {
  const res = await send({ type: 'getAll' });
  settings = res.settings;
  state = res.state;
  renderAccount();
  renderGames();
  $('#notify').checked = settings.notifyErrors;
  $('#lang').value = settings.apiLang;
}

applyI18n();
$('#version').textContent = `v${chrome.runtime.getManifest().version}`;

$('#notify').addEventListener('change', async (e) => { settings.notifyErrors = e.target.checked; await save(); });
$('#lang').addEventListener('change', async (e) => { settings.apiLang = e.target.value; await save(); });

$('#btn-account').addEventListener('click', async (e) => {
  e.currentTarget.disabled = true;
  await send({ type: 'refreshAccount' });
  e.currentTarget.disabled = false;
  await load();
});

$('#btn-reset').addEventListener('click', async () => {
  if (!confirm(t('optResetConfirm'))) return;
  await send({ type: 'resetData' });
  await load();
});

await load();
// Discover linked characters on first open (e.g. right after install).
if (!state.account) {
  await send({ type: 'refreshAccount' });
  await load();
}
