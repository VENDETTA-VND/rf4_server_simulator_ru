// Игроки：左边找人，右边看和改这个人的一切。
import {
  h, api, apiList, post, icon, toast, errText, pageHead, section, callout, badge, empty, btn, loading, Form, savebar, setLeaveGuard,
  tabs, searchBox, debounce, confirmDialog, dialog, fmt, timeText, relTime, navigate, segmented, hideSavebar, setPageCleanup, replaceHash,
} from '../core.js';
import { itemIcon } from '../widgets.js';

const TABS = [['profile', 'Обзор'], ['items', 'Инвентарь'], ['keepnet', 'Садок'], ['records', 'Заполнение энциклопедии'], ['skills', 'Навыки'], ['mail', 'Почта']];
const GRADE = ['Не поймана', 'Поймана', 'Зачётная', 'Трофейная', 'Голубая корона'];
const cents = (v) => (Number(v || 0) / 100).toFixed(2).replace(/\.00$/, '');
let QUERY = '';

export default async function players(params) {
  const [uidParam, tabParam] = params;
  const listBox = h('div', { class: 'list' }, loading(4));
  const detail = h('div', {});
  const root = h('div', { class: 'page' },
    pageHead('Игроки', 'Просмотр и изменение уровня персонажа, валюты, инвентаря, садка, энциклопедии и навыков.', btn('Обновить', () => loadList(), 'sm', { icon: 'refresh' })),
    h('div', { class: 'master-detail' },
      h('div', { class: 'card master' },
        h('div', { style: { padding: '12px' } }, searchBox('Поиск по имени или UID', debounce((v) => { QUERY = v; loadList(); }, 250), QUERY)),
        listBox),
      detail));
  let list = [];
  async function loadList() {
    try {
      list = await apiList('/api/players?q=' + encodeURIComponent(QUERY));
      listBox.replaceChildren(...(list.length ? list.map((p) => h('div', {
        class: 'list-item clickable' + (String(p.uid) === String(uidParam) ? ' on' : ''),
        onclick: () => navigate('players', p.uid),
      }, h('div', { class: 'avatar', text: (p.name || '?').slice(0, 1) }),
      h('div', { class: 'grow' }, h('div', { class: 'title', text: p.name }), h('div', { class: 'sub', text: `UID ${p.uid} · ${p.level} ур.` })),
      p.banned ? badge('Заблокирован', 'bad') : p.online ? badge('В сети', 'ok', true) : null)) : [empty(QUERY ? 'Ничего не найдено' : 'Игроков пока нет', QUERY ? 'Попробуйте другой запрос.' : 'Игрок появится здесь после первого входа в игру.')]));
      return list;
    } catch (e) { listBox.replaceChildren(empty('Не удалось загрузить', errText(e))); return []; }
  }
  const loaded = await loadList();
  const timer = setInterval(() => { if (!document.hidden) loadList(); }, 8000);
  setPageCleanup(() => clearInterval(timer));
  if (!uidParam) {
    if (loaded.length) { setTimeout(() => navigate('players', loaded[0].uid), 0); }
    detail.replaceChildren(h('div', { class: 'card' }, empty('Выберите игрока', 'Выберите игрока в списке слева.')));
    return root;
  }
  detail.replaceChildren(h('div', { class: 'card card-pad' }, loading(5)));
  try {
    const p = await api('/api/players/detail?uid=' + encodeURIComponent(uidParam));
    detail.replaceChildren(playerDetail(p, TABS.some(([k]) => k === tabParam) ? tabParam : 'profile'));
  } catch (e) { detail.replaceChildren(h('div', { class: 'card' }, empty('Не удалось загрузить список игроков', errText(e)))); }
  return root;
}

function playerDetail(p, tab) {
  const reload = () => navigate('players', p.uid, current);
  let current = tab;
  let tabDirty = () => false;
  const pane = h('div');
  const show = async (t) => {
    if (t === current && pane.childNodes.length) return false;
    if (tabDirty()) {
      const ok = await confirmDialog({ title: 'Есть несохранённые изменения', desc: 'При переключении вкладки изменения будут потеряны.', confirm: 'Отменить изменения и перейти' });
      if (!ok) return false;
    }
    current = t;
    tabDirty = () => false;
    replaceHash('#players/' + p.uid + '/' + t);
    hideSavebar(); setLeaveGuard(null);
    const builders = { profile, items, keepnet, records, skills, mail };
    pane.replaceChildren(builders[t](p, reload, (fn) => { tabDirty = fn; }));
  };
  const head = h('div', { class: 'row', style: { alignItems: 'flex-start', marginBottom: '6px' } },
    h('div', { class: 'avatar', style: { width: '44px', height: '44px', fontSize: '18px' }, text: (p.name || '?').slice(0, 1) }),
    h('div', { class: 'grow' },
      h('div', { class: 'row' }, h('h2', { style: { fontSize: '19px' }, text: p.name }), p.banned ? badge('Заблокирован', 'bad') : null),
      h('div', { class: 'muted small', text: `UID ${p.uid} · ${p.level} ур. · опыт ${fmt(p.xp)}` })),
    h('div', { class: 'row' },
      btn('Написать письмо', () => navigate('mail', p.uid), 'sm', { icon: 'mail' }),
      btn('Отключение игрока', async () => {
        if (!(await confirmDialog({ title: `Отключить игрока «${p.name}»?`, desc: 'Игрок будет отключён от сервера и сможет сразу войти снова.', confirm: 'Отключение игрока' }))) return;
        try { await post('/api/players/kick', { uid: p.uid }); toast('Игрок отключён'); } catch (e) { toast(errText(e), 'bad'); }
      }, 'sm'),
      btn(p.banned ? 'Снять блокировку' : 'Блокировка игрока', async () => {
        const ban = !p.banned;
        if (!(await confirmDialog({ title: ban ? `Блокировка игрока「${p.name}」？` : `Снять блокировку с игрока «${p.name}»?`, desc: ban ? 'После блокировки игрок не сможет войти в игру.' : 'После снятия блокировки игрок сможет войти как обычно.', confirm: ban ? 'Блокировка игрока' : 'Снять блокировку', danger: ban }))) return;
        try { await post('/api/players/ban', { uid: p.uid, banned: ban }); toast(ban ? 'Заблокирован' : 'Блокировка снята'); reload(); } catch (e) { toast(errText(e), 'bad'); }
      }, p.banned ? 'sm' : 'danger sm')));
  const counts = { items: p.item_count, keepnet: p.keepnet_count, mail: p.mail_count };
  const card = h('div', { class: 'card card-pad' }, head,
    tabs(TABS.map(([k, l]) => [k, l, counts[k]]), tab, show), pane);
  show(tab);
  return card;
}

// ---------- Обзор ----------
function profile(p, reload, setDirty) {
  const form = new Form();
  savebar(form, {
    onSave: async (v) => {
      const body = { uid: p.uid, name: form.value('name'), level: +form.value('level'), xp: +form.value('xp'),
        silver: Math.round(+form.value('silver') * 100), gold: Math.round(+form.value('gold') * 100), bank: Math.round(+form.value('bank') * 100) };
      const m = +memberField.input.value;
      const exp = m === 1 && expInput.value ? Math.floor(new Date(expInput.value).getTime() / 1000) : 0;
      if ('membership' in v || 'membership_exp' in v) {
        if (m === 1 && (!exp || exp <= Date.now() / 1000)) throw new Error('Для временной подписки укажите будущую дату окончания');
        body.membership = m; body.membership_exp = exp;
      }
      await post('/api/players/update', body);
      toast('Изменения сохранены. Игрок увидит их сразу после подключения.');
      setTimeout(reload, 400);
    },
  });
  setLeaveGuard(() => form.isDirty());
  setDirty(() => form.isDirty());
  // Подписка：分段选择 + ОкончаниеВремя
  const memberField = form.field({ key: 'membership', label: 'Подписка', kind: 'string' }, String(p.membership || 0));
  memberField.input = h('input', { type: 'hidden', value: memberField.original });
  const toLocal = (ts) => { if (!ts) return ''; const d = new Date(ts * 1000); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const expField = form.field({ key: 'membership_exp', label: 'Окончание', kind: 'string' }, toLocal(p.membership_exp));
  const expInput = h('input', { type: 'datetime-local', class: 'input', value: expField.original, style: { width: '240px' }, oninput: () => form.refresh() });
  expField.input = expInput;
  const expWrap = h('div', { class: 'row', hidden: String(p.membership) !== '1' }, h('span', { class: 'muted small', text: 'ОкончаниеВремя' }), expInput);
  const seg = segmented([['0', 'Обычная'], ['1', 'Подписка на ограниченный срок'], ['2', 'Постоянная подписка']], String(p.membership || 0), (v) => { memberField.input.value = v; expWrap.hidden = v !== '1'; form.refresh(); });
  const hh = p.happy_hour || {};
  const hhText = hh.enabled === false ? '«Счастливые часы» отключены в разделе «Правила игры».' : !hh.qualified ? 'Бонусы «Счастливых часов» доступны при активной подписке.'
    : hh.unlimited ? 'Постоянная подписка: «Счастливые часы» действуют без ограничений.' : `«Счастливые часы» активны ещё примерно ${Math.ceil((hh.remaining_seconds || 0) / 60)} мин.`;
  return h('div', { class: 'stack', style: { paddingTop: '4px' } },
    h('div', {},
      h('h3', { class: 'small', style: { color: 'var(--muted)', margin: '4px 0 4px' }, text: 'Персонаж' }),
      form.row({ key: 'name', label: 'Имя персонажа', kind: 'string', required: true }, p.name),
      form.row({ key: 'level', label: 'Уровень', kind: 'int', min: 1, max: 58, unit: 'ур.' }, p.level),
      form.row({ key: 'xp', label: 'Опыт', kind: 'int', min: 0, help: 'Уровень и опыт должны соответствовать друг другу, иначе шкала опыта в игре будет отображаться неверно.' }, p.xp)),
    h('div', {},
      h('h3', { class: 'small', style: { color: 'var(--muted)', margin: '8px 0 4px' }, text: 'Валюта' }),
      form.row({ key: 'silver', label: 'Серебро', kind: 'float', min: 0, help: 'Введите значение так, как оно отображается в игре; допускаются два знака после запятой.' }, cents(p.silver)),
      form.row({ key: 'gold', label: 'Золото', kind: 'float', min: 0 }, cents(p.gold)),
      form.row({ key: 'bank', label: 'Банковский счёт', kind: 'float', min: 0 }, cents(p.bank))),
    h('div', {},
      h('h3', { class: 'small', style: { color: 'var(--muted)', margin: '8px 0 10px' }, text: 'Подписка' }),
      h('div', { class: 'stack' }, h('div', { class: 'row' }, seg, expWrap), h('div', { class: 'muted small', text: hhText }))));
}

// ---------- Инвентарь ----------
function items(p, reload) {
  let q = '';
  const body = h('tbody');
  const draw = () => {
    const rows = (p.items || []).filter((x) => !q || `${x.item_id} ${x.name} ${x.guid}`.toLowerCase().includes(q));
    body.replaceChildren(...(rows.length ? rows.map((x) => h('tr', {},
      h('td', {}, h('div', { class: 'row', style: { flexWrap: 'nowrap' } }, itemIcon(x.item_id), h('div', {}, h('b', { text: x.name || x.item_id }), h('span', { class: 'sub mono', text: x.item_id })))),
      h('td', { text: x.container === 'equip' ? 'Экипировано' : x.container === 'bag' ? 'Инвентарь' : (x.container || '') }),
      h('td', { class: 'num', text: fmt(x.qty) }),
      h('td', { class: 'num', text: x.durability === undefined || x.durability === null ? '—' : Number(x.durability) <= 1 ? (Number(x.durability) * 100).toFixed(1) + '%' : String(x.durability) }),
      h('td', { class: 'num' }, btn('Удалить', async () => {
        if (!(await confirmDialog({ title: `Удалить「${x.name || x.item_id}」？`, desc: 'Предмет будет удалён из инвентаря или экипировки игрока. Это действие нельзя отменить.', confirm: 'Удалить', danger: true }))) return;
        try { await post('/api/players/items/delete', { uid: p.uid, guids: [x.guid] }); toast('Удалено. Изменение вступит в силу примерно через 2 секунды.'); setTimeout(reload, 2300); } catch (e) { toast(errText(e), 'bad'); }
      }, 'ghost sm')))) : [h('tr', {}, h('td', { colspan: 5 }, empty(q ? 'Подходящие предметы не найдены' : 'Инвентарь пуст')))]));
  };
  draw();
  return h('div', { class: 'stack' },
    searchBox('Фильтр по названию или ID предмета', (v) => { q = v.toLowerCase(); draw(); }),
    h('div', { class: 'table-wrap', style: { maxHeight: '62vh' } }, h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, h('th', { text: 'Предмет' }), h('th', { text: 'Место' }), h('th', { class: 'num', text: 'Количество' }), h('th', { class: 'num', text: 'Прочность' }), h('th', {}))), body)));
}

// ---------- Садок ----------
function keepnet(p, reload) {
  const rows = p.keepnet || [];
  return h('div', { class: 'stack' },
    h('div', { class: 'row' }, h('span', { class: 'grow muted small', text: `Всего записей о рыбе: ${rows.length}. После удаления статистика и рыбный рынок обновятся.` }), btn('Добавить запись об улове', () => addFish(p, reload), 'primary sm', { icon: 'plus' })),
    rows.length ? h('div', { class: 'table-wrap', style: { maxHeight: '62vh' } }, h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, ['Рыба', 'Вес', 'Категория', 'Место', 'Наживка', 'Время', ''].map((t, i) => h('th', { class: i === 1 ? 'num' : '', text: t })))),
      h('tbody', {}, rows.map((x) => h('tr', {},
        h('td', {}, h('b', { text: x.name_zh || x.species }), h('span', { class: 'sub mono', text: x.species })),
        h('td', { class: 'num', text: fmt(x.weight_g) + ' g' }),
        h('td', {}, badge(GRADE[x.cat] || ('Категория ' + x.cat), x.cat >= 4 ? 'accent' : x.cat >= 3 ? 'warn' : '')),
        h('td', { text: x.keep_level || x.keep_loc || '—' }),
        h('td', { class: 'mono small', text: x.keep_bait || '—' }),
        h('td', { class: 'small muted', text: timeText(x.ts) }),
        h('td', {}, btn('Удалить', async () => {
          if (!(await confirmDialog({ title: 'Удалить эту рыбу из садка?', desc: 'Это действие нельзя отменить.', confirm: 'Удалить', danger: true }))) return;
          try { await post('/api/players/keepnet/delete', { uid: p.uid, guids: [x.echo_guid] }); toast('Удалено. Изменение вступит в силу примерно через 2 секунды.'); setTimeout(reload, 2300); } catch (e) { toast(errText(e), 'bad'); }
        }, 'ghost sm'))))))) : h('div', { class: 'card' }, empty('Садок пуст')));
}
function addFish(p, reload) {
  const form = new Form();
  const results = h('div', { class: 'card', style: { maxHeight: '200px', overflow: 'auto' } });
  const species = form.stacked({ key: 'species', label: 'Вид рыбы', kind: 'string', required: true, placeholder: 'Поиск по названию рыбы, например «карась»', span: true }, '');
  const speciesInput = form.fields.get('species').input;
  const hint = h('div', { class: 'help' });
  speciesInput.addEventListener('input', debounce(async () => {
    const q = speciesInput.value.trim();
    if (!q) { results.replaceChildren(); return; }
    const list = await apiList('/api/fish/pool?limit=30&q=' + encodeURIComponent(q)).catch(() => []);
    results.replaceChildren(list.length ? h('div', { class: 'list' }, list.map((f) => h('div', { class: 'list-item clickable', onclick: () => { speciesInput.value = f.fish_key; hint.textContent = `${f.name_zh}, обычный вес ${fmt(f.min_g)}–${fmt(f.max_g)} г`; results.replaceChildren(); } },
      h('div', { class: 'grow' }, h('div', { class: 'title', text: f.name_zh }), h('div', { class: 'sub mono', text: f.fish_key })), h('span', { class: 'muted small', text: `${fmt(f.min_g)}–${fmt(f.max_g)} g` })))) : empty('Ничего не найдено', 'Попробуйте другое название рыбы или ID.'));
  }, 250));
  dialog({
    title: 'ДобавитьСадок', size: 'lg',
    body: h('div', { class: 'stack' }, species, results, hint, h('div', { class: 'form-grid' },
      form.stacked({ key: 'weight_g', label: 'Вес (г)', kind: 'int', min: 1 }, '500'),
      form.stacked({ key: 'cat', label: 'Категория', kind: 'select', options: [['1', 'Обычная'], ['2', 'Зачётная'], ['3', 'Трофей'], ['4', 'Голубая корона']] }, '1'),
      form.stacked({ key: 'keep_level', label: 'Место (необязательно）', kind: 'string', placeholder: 'Например, level_001_lake' }, ''),
      form.stacked({ key: 'keep_bait', label: 'Использованная наживка (необязательно）', kind: 'string', placeholder: 'Например, worm_01' }, ''))),
    actions: [{ label: 'Отмена', kind: 'ghost' }, {
      label: 'Добавить', kind: 'primary', onClick: async () => {
        if (!form.validate(['species', 'weight_g'])) return true;
        await post('/api/players/keepnet/add', { uid: p.uid, species: form.value('species'), weight_g: +form.value('weight_g'), cat: +form.value('cat'), keep_level: form.value('keep_level'), keep_loc: '', keep_spot: 0, keep_bait: form.value('keep_bait') });
        toast('Добавлено. Изменение вступит в силу примерно через 2 секунды.'); setTimeout(reload, 2300);
      },
    }],
  });
}

// ---------- Заполнение энциклопедии ----------
function records(p, reload, setDirty) {
  const box = h('div', {}, loading(5));
  let data = null, level = '', q = '';
  const changes = new Map();
  setLeaveGuard(() => changes.size > 0);
  setDirty(() => changes.size > 0);
  const saveBtn = btn('Сохранить изменения энциклопедии', async () => {
    saveBtn.disabled = true;
    try {
      const r = await post('/api/players/records', { uid: p.uid, level, changes: [...changes.values()] });
      toast('Сохранено. Резервная копия сохранения: ' + r.backup + '）');
      changes.clear(); await load(level);
    } catch (e) { toast(errText(e), 'bad'); saveBtn.disabled = false; }
  }, 'primary', { disabled: true });
  const sync = () => { saveBtn.disabled = !changes.size; saveBtn.textContent = changes.size ? `Сохранить изменения энциклопедии（${changes.size}）` : 'Сохранить изменения энциклопедии'; };
  async function load(lv) {
    box.replaceChildren(loading(5));
    try { data = await api('/api/players/records?uid=' + p.uid + '&level=' + encodeURIComponent(lv || '')); level = data.level; draw(); }
    catch (e) { box.replaceChildren(empty('Не удалось загрузить', errText(e))); }
  }
  function draw() {
    const mapSel = h('select', { class: 'select', style: { width: '220px' }, onchange: async (e) => {
      if (changes.size && !(await confirmDialog({ title: 'Изменения на этой карте не сохранены', desc: 'При переключении карты несохранённые изменения будут потеряны.', confirm: 'Отменить изменения и перейти' }))) { e.target.value = level; return; }
      changes.clear(); sync(); load(e.target.value);
    } }, data.maps.map((m) => h('option', { value: m.level, text: m.name, selected: m.level === data.level })));
    const tbody = h('tbody');
    const rows = () => tbody.replaceChildren(...data.fish.filter((f) => !q || `${f.name} ${f.fish_key}`.toLowerCase().includes(q)).map((f) => {
      const c = changes.get(f.fish_key) || { fish_key: f.fish_key, grade: f.restored_grade || 0, weight_g: f.restored_weight_g || 0 };
      const sel = h('select', { class: 'select', style: { height: '30px' } }, [0, 1, 2, 3, 4].map((g) => h('option', { value: g, text: g === 0 ? 'Не добавлять' : GRADE[g], selected: +c.grade === g })));
      const w = h('input', { class: 'input num', style: { height: '30px', width: '130px' }, placeholder: 'Автоматически', value: c.weight_g || '' });
      const edit = () => { changes.set(f.fish_key, { fish_key: f.fish_key, grade: +sel.value, weight_g: +w.value || 0 }); sync(); };
      sel.addEventListener('change', () => { w.value = ''; edit(); });
      w.addEventListener('input', edit);
      return h('tr', {}, h('td', {}, h('b', { text: f.name }), h('span', { class: 'sub mono', text: f.fish_key })),
        h('td', {}, badge(GRADE[f.grade] || 'Не поймана', f.grade >= 4 ? 'accent' : f.grade >= 3 ? 'warn' : f.grade > 0 ? 'ok' : '')),
        h('td', { class: 'num', text: f.weight_g ? fmt(f.weight_g) + ' g' : '—' }), h('td', {}, sel), h('td', {}, w));
    }));
    rows();
    box.replaceChildren(h('div', { class: 'stack' },
      callout('info', 'Используется для заполнения энциклопедии. Запись учитывается как улов, но не даёт опыт или валюту и не добавляется в садок. Реальные уловы не перезаписываются. Перед сохранением создаётся резервная копия. Рекомендуется делать это, когда игрок не в сети.'),
      h('div', { class: 'row' }, mapSel, h('div', { class: 'grow' }, searchBox('Фильтр по названию рыбы', (v) => { q = v.toLowerCase(); rows(); })), saveBtn),
      h('div', { class: 'table-wrap', style: { maxHeight: '58vh' } }, h('table', { class: 'table' },
        h('thead', {}, h('tr', {}, h('th', { text: 'Рыба' }), h('th', { text: 'Сейчас' }), h('th', { class: 'num', text: 'Максимальный вес' }), h('th', { text: 'Установить статус' }), h('th', { text: 'Добавленный вес (г)' }))), tbody))));
  }
  load('');
  return box;
}

// ---------- Навыки ----------
function skills(p, reload, setDirty) {
  const list = p.skills || [];
  const avail = Number(p.available_points ?? 0);
  const unsaved = new Set();
  setLeaveGuard(() => unsaved.size > 0);
  setDirty(() => unsaved.size > 0);
  const points = h('input', { class: 'input num', style: { width: '100px' }, value: avail, oninput: () => { unsaved.add('points'); } });
  return h('div', { class: 'stack' },
    h('div', { class: 'card', style: { padding: '14px 16px', background: 'var(--surface-2)' } }, h('div', { class: 'row' },
      h('div', { class: 'grow' }, h('b', { text: 'Нераспределённые очки навыков' }), h('div', { class: 'muted small', text: `Всего получено очков навыков: ${p.skill_total ?? 0}, использовано: ${p.skill_spent ?? 0}.` })),
      points, btn('Сохранить', async () => {
        try { await post('/api/players/skills/points', { uid: p.uid, points: Math.max(0, Math.floor(+points.value || 0)) }); unsaved.delete('points'); toast('Сохранено'); } catch (e) { toast(errText(e), 'bad'); }
      }, 'primary sm'))),
    h('p', { class: 'muted small', text: 'Ниже указана освоенность каждого способа ловли (0–100%).' }),
    h('div', { class: 'grid-2' }, list.map((s) => {
      const v = Number(s.points) || 0;
      const out = h('output', { text: v.toFixed(1) + '%' });
      const range = h('input', { type: 'range', min: 0, max: 100, step: 0.1, value: v, oninput: (e) => { out.textContent = Number(e.target.value).toFixed(1) + '%'; save.hidden = false; unsaved.add(s.skill_id); } });
      const save = btn('Сохранить', async () => {
        try { await post('/api/players/skills/update', { uid: p.uid, skill_id: s.skill_id, points: +range.value }); unsaved.delete(s.skill_id); toast(`Сохранено「${s.name}」`); save.hidden = true; } catch (e) { toast(errText(e), 'bad'); }
      }, 'primary sm', { hidden: true });
      return h('div', { class: 'card', style: { padding: '12px 14px', background: 'var(--surface-2)' } },
        h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { text: s.name }), save),
        h('div', { class: 'range-row', style: { marginTop: '6px' } }, range, out));
    })),
    h('div', {}, btn('Сбросить всё', async () => {
      if (!(await confirmDialog({ title: 'Сбросить освоенность всех способов ловли?', desc: 'Уровень владения всеми способами ловли станет 0%. Это действие нельзя отменить.', confirm: 'Сбросить', danger: true }))) return;
      try { for (const s of list) await post('/api/players/skills/update', { uid: p.uid, skill_id: s.skill_id, points: 0 }); unsaved.clear(); toast('Сброшено'); reload(); } catch (e) { toast(errText(e), 'bad'); }
    }, 'danger sm')));
}

// ---------- Почта ----------
function mail(p, reload) {
  const rows = p.mails || [];
  return h('div', { class: 'stack' },
    h('div', { class: 'row' }, h('span', { class: 'grow muted small', text: 'Здесь можно удалить проблемное письмо, которое игрок не может удалить или получить, а затем отправить его повторно.' }), btn('Написать письмо игроку', () => navigate('mail', p.uid), 'primary sm', { icon: 'mail' })),
    rows.length ? h('div', { class: 'table-wrap', style: { maxHeight: '62vh' } }, h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, h('th', { text: 'Содержание' }), h('th', { text: 'Тип' }), h('th', { text: 'Статус' }), h('th', { text: 'Время' }), h('th', {}))),
      h('tbody', {}, rows.map((m) => h('tr', {},
        h('td', { style: { whiteSpace: 'normal', maxWidth: '420px' }, text: m.text || '(только вложение)' }),
        h('td', { text: m.kind ? 'С вложением' : 'Текст' }),
        h('td', {}, m.read ? badge('Прочитано') : badge('Не прочитано', 'accent')),
        h('td', { class: 'small muted', title: timeText(m.created_ts), text: relTime(m.created_ts) }),
        h('td', {}, btn('Удалить', async () => {
          if (!(await confirmDialog({ title: 'Удалить это письмо?', desc: 'Вложения会一起丢弃，Это действие нельзя отменить.', confirm: 'Удалить', danger: true }))) return;
          try { await post('/api/players/mail/delete', { uid: p.uid, ids: [m.id] }); toast('Удалено'); setTimeout(reload, 300); } catch (e) { toast(errText(e), 'bad'); }
        }, 'ghost sm'))))))) : h('div', { class: 'card' }, empty('Почтовый ящик пуст')));
}
