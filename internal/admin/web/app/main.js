// Вход в панель управления RF4: авторизация, интерфейс и навигация. Страницы загружаются по мере необходимости.
import { h, $, api, post, icon, getToken, setToken, onAuth, route, render, navigate, toast, errText, parseHash } from './core.js';

// 导航结构即信息架构：按「管理员想做的事」分组，而不是按后端模块。
const NAV = [
  { group: null, items: [['dashboard', 'Обзор', 'home']] },
  { group: 'Игроки', items: [['players', 'Игроки', 'users'], ['accounts', 'Аккаунты', 'users'], ['mail', 'Почта', 'mail']] },
  { group: 'Рыбалка', items: [['rules', 'Правила игры', 'rules'], ['waters', 'Водоёмы и рыба', 'water'], ['bait', 'Предпочтения рыбы', 'bait'], ['hooks', 'Крючки', 'hook'], ['tuning', 'Настройка параметров', 'sliders']] },
  { group: 'Экономика', items: [['shop', 'Магазин', 'store']] },
  { group: 'Система', items: [['audit', 'Журнал действий', 'list'], ['changelog', 'История изменений', 'doc'], ['about', 'О программе', 'info']] },
];
const PAGES = {
  dashboard: () => import('./pages/dashboard.js'),
  players: () => import('./pages/players.js'),
  accounts: () => import('./pages/accounts.js'),
  mail: () => import('./pages/mail.js'),
  rules: () => import('./pages/rules.js'),
  waters: () => import('./pages/waters.js'),
  bait: () => import('./pages/bait.js'),
  hooks: () => import('./pages/hooks.js'),
  tuning: () => import('./pages/tuning.js'),
  shop: () => import('./pages/shop.js'),
  audit: () => import('./pages/audit.js'),
  changelog: () => import('./pages/docs.js').then((m) => ({ default: m.changelog })),
  about: () => import('./pages/docs.js').then((m) => ({ default: m.about })),
};
for (const [name, load] of Object.entries(PAGES)) {
  route(name, { render: async (params) => (await load()).default(params) });
}

let me = null;

function brand() {
  return h('div', { class: 'brand' }, h('div', { class: 'brand-mark' }, icon('logo')), h('div', {}, h('b', { text: 'Панель администратора' }), h('span', { text: 'Локальный сервер RF4' })));
}

function sidebar() {
  const nav = h('nav', { 'aria-label': 'Главная навигация' });
  for (const g of NAV) {
    if (g.group) nav.append(h('div', { class: 'nav-group', text: g.group }));
    for (const [key, label, ic] of g.items) {
      nav.append(h('button', { class: 'nav-item', type: 'button', dataset: { route: key }, onclick: () => navigate(key) }, icon(ic), h('span', { text: label })));
    }
  }
  const name = (me && me.username) || 'admin';
  return h('aside', { class: 'side' }, brand(), nav,
    h('div', { class: 'side-foot' },
      h('div', { class: 'avatar', text: name.slice(0, 1).toUpperCase() }),
      h('div', { class: 'who' }, name, h('small', { text: 'Администратор' })),
      h('button', { class: 'btn ghost icon sm', title: 'Выйти', 'aria-label': 'Выйти', onclick: logout }, icon('logout'))));
}

document.addEventListener('rf4:route', (e) => {
  for (const b of document.querySelectorAll('.nav-item')) b.classList.toggle('on', b.dataset.route === e.detail.name);
});

// ---- 更新提示 ----
function safeURL(u) {
  return typeof u === 'string' && (u.startsWith('https://github.com/') || u.startsWith('https://gh-proxy.com/https://github.com/')) ? u : '';
}
export function updateBanner(u) {
  const slot = $('#updateSlot');
  if (!slot) return;
  if (!u || !u.available) { slot.replaceChildren(); return; }
  const links = [
    [u.download_mirror_url, 'Скачать (ускоренная загрузка)', 'primary'],
    [u.download_url, 'Скачать с GitHub', ''],
    [u.channel === 'preview' ? '' : u.preview_download_mirror, 'Предварительная версия', 'ghost'],
    [u.notes_url, 'Что нового', 'ghost'],
  ].filter(([url]) => safeURL(url)).map(([url, label, kind]) => h('a', { class: 'btn sm ' + kind, href: safeURL(url), target: '_blank', rel: 'noreferrer', text: label }));
  const dismiss = u.forced ? null : h('button', {
    class: 'btn ghost sm', text: 'Пропустить эту версию', onclick: async () => {
      try {
        // launcher owns update dismiss at the root API even when admin is mounted under /admin/.
        const r = await fetch('/api/update/dismiss', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: u.latest_version }) });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        slot.replaceChildren();
      } catch (e) { toast('Не удалось выполнить действие: ' + errText(e), 'bad'); }
    },
  });
  slot.replaceChildren(h('div', { class: 'callout ' + (u.forced ? 'warn' : 'info'), style: { margin: '16px 40px 0', alignItems: 'center', maxWidth: '1520px' } },
    icon(u.forced ? 'alert' : 'info'),
    h('div', { class: 'grow' }, u.forced ? `当前版本过旧，建议尽快升级到 ${u.latest_version}` : `新版本 ${u.latest_version} 可以下载了`),
    h('div', { class: 'row' }, links, dismiss)));
}

// ---- 公告条：内容由维护者以混淆形式内嵌，运行时解码，避免明文出现在源码里 ----
function noticeBar() {
  const K = [114, 70, 52, 35, 50, 48, 50, 54];
  const C = ['lNqYypOJ1a3co7Gu2oSL087G', '0pmi3466lvuoy7K11KrYoKCV', '17+k0sn90J6n2IaPldKczI68', '2obar6yR2pKZ39jR25++1amt', 'lv6ecmPUiJKU87XEjJTdiuh1', 'AxoAAwEDRnbXo7MCAANGcAQb', 'AADRtvN3BREKAQcER38CwLKx', 'AwdBcgIVBwcGAA=='];
  const KEY = 'rf4.n0t1ce.v2';
  try { if (localStorage.getItem(KEY) === '1') return null; } catch (e) {}
  let txt = '';
  try {
    const raw = atob(C.join(''));
    let s = '';
    for (let i = 0; i < raw.length; i++) s += String.fromCharCode(raw.charCodeAt(i) ^ K[i % K.length]);
    try { txt = decodeURIComponent(escape(s)); } catch (e) { txt = s; }
  } catch (e) { return null; }
  if (!txt) return null;
  const p = txt.lastIndexOf('：');
  const msg = p > 0 ? [txt.slice(0, p + 1), h('b', { text: txt.slice(p + 1) })] : [txt];
  const bar = h('div', { class: 'notice-bar' }, h('span', {}, msg),
    h('button', { 'aria-label': 'Закрыть', title: 'Закрыть', onclick: () => { bar.remove(); try { localStorage.setItem(KEY, '1'); } catch (e) {} } }, icon('x', 16)));
  return bar;
}

// ---- 登录 ----
function loginView() {
  const user = h('input', { class: 'input', id: 'lu', autocomplete: 'username', required: true });
  const pass = h('input', { class: 'input', id: 'lp', type: 'password', autocomplete: 'current-password', required: true });
  const submit = h('button', { class: 'btn primary lg', style: { width: '100%' }, type: 'submit', text: 'Войти' });
  const err = h('div', { class: 'callout bad', hidden: true, style: { marginBottom: '14px' } });
  const form = h('form', {
    class: 'card login-card',
    onsubmit: async (e) => {
      e.preventDefault();
      submit.disabled = true;
      err.hidden = true;
      try {
        const d = await post('/api/login', { username: user.value, password: pass.value });
        setToken(d.token);
      } catch (ex) {
        err.hidden = false;
        err.textContent = ex.status === 401 || ex.status === 403 ? 'Неверный логин или пароль.' : errText(ex);
      } finally { submit.disabled = false; }
    },
  },
  h('div', { class: 'brand-mark' }, icon('logo')),
  h('h1', { text: 'Вход в панель администратора' }),
  h('p', { text: 'Управление игроками, рыбалкой, магазином и настройками сервера' }),
  err,
  h('div', { class: 'field' }, h('label', { for: 'lu', text: 'Аккаунты' }), user),
  h('div', { class: 'field' }, h('label', { for: 'lp', text: 'Пароль' }), pass),
  submit,
  h('div', { class: 'hint', html: 'Забыли пароль? Логин и пароль указаны в файле <code>config.yaml</code> в каталоге сервера (<code>admin.username</code> / <code>admin.password</code>). По умолчанию: <code>admin</code> / <code>admin123</code>.' }));
  return h('div', { class: 'login' }, form);
}

async function boot() {
  const app = $('#app');
  if (!getToken()) { app.replaceChildren(loginView()); return; }
  try {
    me = await api('/api/me');
  } catch (e) {
    if (e.status === 401) return;
    app.replaceChildren(h('div', { class: 'login' }, h('div', { class: 'callout bad' }, 'Не удалось подключиться к панели администратора: ' + errText(e))));
    return;
  }
  const notice = noticeBar();
  app.replaceChildren(
    h('div', { class: 'shell' }, sidebar(), h('main', { class: 'main' }, notice || '', h('div', { id: 'updateSlot' }), h('div', { id: 'view' }))));
  updateBanner(me.update);
  render();
}

export function logout() {
  setToken('');
}
onAuth(() => boot());
boot();
// 让页面模块能拿到当前用户
export function currentUser() { return me; }
export { parseHash };
