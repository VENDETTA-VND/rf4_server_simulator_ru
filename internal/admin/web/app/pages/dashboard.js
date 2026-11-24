import { h, api, apiList, fmt, relTime, timeText, icon, navigate, section, badge, empty, pageHead, btn, render, setPageCleanup } from '../core.js';
import { auditLabel } from '../labels.js';
import { updateBanner } from '../main.js';

const SHORTCUTS = [
  ['players', 'users', 'Найти игрока', 'Изменить уровень, валюту, инвентарь или навыки'],
  ['mail', 'mail', 'Отправить письмо', 'Отправить игроку сообщение или предметы'],
  ['rules', 'rules', 'Настроить правила игры', 'Выбрать реалистичный или случайный режим рыбалки'],
  ['waters', 'water', 'Настроить виды рыб в водоёмах', 'Какая рыба водится в каждом водоёме'],
  ['shop', 'store', 'Настроить магазин', 'Изменить цены и запасы товаров'],
];
const RULES = [
  ['fish_bait_rules_enabled', 'Рыба выбирает наживку'], ['fish_distribution_enabled', 'Распределение рыбы'], ['fish_weather_enabled', 'Погода и температура воды'],
  ['fish_ecology_enabled', 'Повадки рыб'], ['bite_gate_enabled', 'Подходящая наживка'], ['happy_hour_enabled', 'Счастливые часы'],
];

export default async function dashboard() {
  const [d, audits, tuns, mode] = await Promise.all([
    api('/api/dashboard'), apiList('/api/audit?limit=8').catch(() => []), api('/api/tunables').catch(() => ({})),
    api('/api/fish/bite_mode').catch(() => ({})),
  ]);
  updateBanner(d.update);
  const timer = setInterval(() => { if (!document.hidden) render(); }, 8000);
  setPageCleanup(() => clearInterval(timer));
  const stats = [
    ['Сейчас в игре', d.sessions, 'Активные игровые подключения'],
    ['Персонажи', d.players, 'Созданные персонажи'],
    ['Предметы', d.items, 'Предметы в инвентарях и экипировке'],
    ['Изменения в панели', d.audits, 'Всего записей о действиях'],
  ];
  const modeName = { realistic: 'Реалистичный клёв', legacy: 'Полный случайный режим (старый)', mixed: 'Пользовательский' }[mode.mode] || 'Неизвестно';
  const ruleOn = (k) => (tuns[k] === undefined ? k === 'happy_hour_enabled' : tuns[k] === '1');

  return h('div', { class: 'page' },
    pageHead('Обзор', 'Состояние сервера и быстрый доступ к основным функциям.', btn('Обновить', () => render(), 'sm', { icon: 'refresh' })),
    h('div', { class: 'grid-4', style: { marginBottom: '16px' } },
      stats.map(([k, v, s]) => h('div', { class: 'card stat' }, h('div', { class: 'k', text: k }), h('div', { class: 'v', text: fmt(v) }), h('div', { class: 's', text: s })))),
    h('div', { class: 'grid-2', style: { gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', alignItems: 'start' } },
      section({
        title: 'Быстрые действия',
        body: h('div', { class: 'grid-2', style: { gap: '10px' } }, SHORTCUTS.map(([r, ic, t, d2]) => h('button', {
          class: 'card', type: 'button', onclick: () => navigate(r),
          style: { display: 'flex', gap: '12px', alignItems: 'center', padding: '14px', textAlign: 'left', background: 'var(--surface-2)', cursor: 'pointer' },
        }, h('span', { style: { width: '34px', height: '34px', borderRadius: '8px', display: 'grid', placeItems: 'center', background: 'var(--accent-soft)', color: 'var(--accent)', flex: 'none' } }, icon(ic, 17)),
        h('span', {}, h('b', { style: { display: 'block', fontWeight: 600 }, text: t }), h('span', { class: 'muted small', text: d2 }))))),
      }),
      section({
        title: 'Текущий режим игры',
        actions: btn('Настроить', () => navigate('rules'), 'sm'),
        body: h('div', {},
          h('div', { class: 'row', style: { marginBottom: '10px' } }, h('span', { class: 'muted small', text: 'Стиль игры' }), badge(modeName, 'accent')),
          h('div', { class: 'list' }, RULES.map(([k, n]) => h('div', { class: 'row', style: { justifyContent: 'space-between', padding: '7px 0', borderTop: '1px solid var(--line)' } },
            h('span', { text: n }), ruleOn(k) ? badge('Включено', 'ok', true) : badge('Выключено', '', true))))),
      })),
    section({
      title: 'Последние изменения',
      actions: btn('Все записи', () => navigate('audit'), 'sm'),
      body: audits.length ? h('div', { class: 'list' }, audits.map((e) => {
        const ts = e.TS ?? e.ts, target = (e.Target ?? e.target) || '';
        return h('div', { class: 'row', style: { padding: '9px 0', borderTop: '1px solid var(--line)', flexWrap: 'nowrap' } },
          h('span', { class: 'muted small nowrap', style: { width: '90px' }, title: timeText(ts), text: relTime(ts) }),
          h('b', { style: { fontWeight: 600 }, text: auditLabel(e.Action ?? e.action) }),
          h('span', { class: 'muted small grow', style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, text: target }),
          h('span', { class: 'muted small', text: e.Admin ?? e.admin ?? '' }));
      })) : empty('Записей пока нет', 'Все изменения, выполненные в панели, будут отображаться здесь.'),
    }));
}
