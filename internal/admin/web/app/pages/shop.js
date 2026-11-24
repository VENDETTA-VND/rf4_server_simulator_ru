// Магазин：直接在表格里改价格和Запас，底部统一Сохранить。
import { h, api, apiList, post, toast, errText, pageHead, badge, btn, empty, loading, Form, savebar, setLeaveGuard, searchBox, debounce, confirmDialog, fmt, navigate, render, toggleEl } from '../core.js';
import { itemIcon } from '../widgets.js';

const money = (c) => (Number(c || 0) / 100).toFixed(2).replace(/\.00$/, '');
let Q = '';
let ONLY_CHANGED = false;

// Магазин ID 前缀 → 店铺Тип。认不出的品牌店保留原 ID。
const STORE_KIND = [
  [/^fishing_?store/, 'Магазин рыболовных товаров'], [/^food_?store/, 'Продуктовый магазин'], [/^tool_store/, 'Магазин инструментов'], [/^workshop/, 'Мастерская'], [/^boatstation/, 'Причал'],
  [/^atm/, 'Банкомат'], [/^admin/, 'Администрация'], [/^monkeycola/, 'Автомат с напитками'], [/^ny_?ba+za+r/i, 'Новогодняя ярмарка'], [/^cafestore/, 'Кафе'],
  [/^bakery/, 'Пекарня'], [/^craft_baits/, 'Наживка料制作'], [/^craft_lures/, '拟Наживка制作'], [/^farmstore/, 'Фермерский магазин'], [/^fishstore/, 'Рыбный магазин'],
  [/^housestore/, 'Магазин домов'], [/^milkstore/, 'Молочный магазин'], [/^sawmill/, 'Лесопилка'], [/^mill/, 'Мельница'], [/^paseka/, 'Пасека'],
  [/^rentbike/, 'Прокат транспорта'], [/^tours/, 'Туристическое агентство'], [/^arbuz/, 'Арбузная лавка'],
];
const storeKind = (id) => (STORE_KIND.find(([re]) => re.test(id)) || [null, ''])[1];
let MAP = '';

export default async function shop(params) {
  const [stores, areas] = await Promise.all([apiList('/api/stores'), api('/api/fish/areas').catch(() => [])]);
  const mapName = Object.fromEntries((Array.isArray(areas) ? areas : areas.areas || []).map((a) => [a.level, a.loc]));
  const storeId = params[0] && stores.some((s) => s.store_id === params[0]) ? params[0] : (stores[0] && stores[0].store_id);
  const cur = stores.find((s) => s.store_id === storeId);
  if (cur) MAP = cur.map_key || '';
  const maps = [...new Set(stores.map((s) => s.map_key || ''))].sort((a, b) => a.localeCompare(b));
  const mapLabel = (k) => mapName[k] || (k ? k.replace(/^level_\d+_/, '') : 'Другое');
  const listBox = h('div', { class: 'list' });
  const drawList = () => listBox.replaceChildren(...stores.filter((s) => (s.map_key || '') === MAP).map((s) => {
    const kind = storeKind(s.store_id);
    return h('div', { class: 'list-item clickable' + (s.store_id === storeId ? ' on' : ''), onclick: () => navigate('shop', s.store_id) },
      h('div', { class: 'grow' }, h('div', { class: 'title', text: kind || s.store_id }), h('div', { class: 'sub', text: (kind ? s.store_id + ' · ' : '') + `${s.item_count} товаров` })),
      s.override_count ? badge(`Изменено: ${s.override_count}`, 'warn') : null);
  }));
  const mapSel = h('select', { class: 'select', onchange: (e) => { MAP = e.target.value; drawList(); } },
    maps.map((k) => h('option', { value: k, text: `${mapLabel(k)}（${stores.filter((s) => (s.map_key || '') === k).length}）`, selected: k === MAP })));
  drawList();
  const side = h('div', { class: 'card master' }, h('div', { style: { padding: '12px' } }, h('div', { class: 'field' }, h('label', { text: 'Карта' }), mapSel)), listBox);
  const main = h('div', {}, loading(6));
  const root = h('div', { class: 'page' },
    pageHead(cur ? `Магазин · ${mapLabel(cur.map_key)} · ${storeKind(cur.store_id) || cur.store_id}` : 'Магазин', 'Изменяйте цены и остатки товаров. После сохранения изменения вступят в силу сразу. Когда запас закончится, он автоматически пополнится до 1000.'),
    h('div', { class: 'master-detail', style: { gridTemplateColumns: '240px minmax(0,1fr)' } }, side, main));
  if (!storeId) { main.replaceChildren(h('div', { class: 'card' }, empty('没有Магазин数据'))); return root; }

  const form = new Form();
  let items = [];
  savebar(form, {
    label: '',
    onSave: async (values) => {
      const touched = new Set(Object.keys(values).map((k) => k.split('|')[0]));
      for (const id of touched) {
        await post('/api/stores/items/update', {
          store_id: storeId, item_id: id,
          silver: Math.round(+form.value(id + '|silver') * 100), gold: Math.round(+form.value(id + '|gold') * 100), stock: Math.floor(+form.value(id + '|stock')),
        });
      }
      toast(`已Сохранить ${touched.size} товаров`);
      setTimeout(render, 200);
    },
  });
  setLeaveGuard(() => form.isDirty());

  const tbody = h('tbody');
  const count = h('span', { class: 'muted small' });
  const cell = (x, field, value, def) => {
    const key = x.item_id + '|' + field;
    let f = form.fields.get(key);
    if (!f) f = form.field({ key, label: field, kind: field === 'stock' ? 'int' : 'float', min: 0 }, value);
    const input = h('input', { class: 'input num', style: { width: '110px' }, value: f.input ? f.input.value : f.original, placeholder: def, oninput: () => form.refresh() });
    f.input = input;
    f.row = input;
    return h('td', {}, input, h('span', { class: 'sub', text: '默认 ' + def }));
  };
  const draw = () => {
    const rows = items.filter((x) => !ONLY_CHANGED || x.has_override);
    count.textContent = `Показано ${rows.length} из ${items.length}`;
    tbody.replaceChildren(...(rows.length ? rows.map((x) => h('tr', {},
      h('td', {}, h('div', { class: 'row', style: { flexWrap: 'nowrap' } }, itemIcon(x.item_id), h('div', {}, h('b', { text: x.name || x.item_id }), h('span', { class: 'sub mono', text: x.item_id })))),
      cell(x, 'silver', money(x.silver), money(x.base_silver)),
      cell(x, 'gold', money(x.gold), money(x.base_gold)),
      cell(x, 'stock', String(x.stock), fmt(x.base_stock)),
      h('td', {}, x.has_override ? h('div', { class: 'row', style: { flexWrap: 'nowrap' } }, badge('已修改', 'warn'), btn('Восстановить значения по умолчанию', async () => {
        if (!(await confirmDialog({ title: `把「${x.name || x.item_id}」Восстановить значения по умолчанию？`, desc: 'Цены и остатки вернутся к исходным игровым значениям.', confirm: '恢复' }))) return;
        try { await post('/api/stores/items/reset', { store_id: storeId, item_id: x.item_id }); toast('Значения по умолчанию восстановлены'); load(); } catch (e) { toast(errText(e), 'bad'); }
      }, 'ghost sm')) : null))) : [h('tr', {}, h('td', { colspan: 5 }, empty(Q || ONLY_CHANGED ? 'Подходящие товары не найдены' : '这个Магазин没有Товар')))]));
  };
  async function load() {
    try {
      items = await apiList('/api/stores/items?limit=1000&store_id=' + encodeURIComponent(storeId) + '&q=' + encodeURIComponent(Q));
      draw();
    } catch (e) { tbody.replaceChildren(h('tr', {}, h('td', { colspan: 5 }, empty('Не удалось загрузить', errText(e))))); }
  }
  main.replaceChildren(h('div', { class: 'card card-pad' },
    h('div', { class: 'row', style: { marginBottom: '14px' } },
      h('div', { class: 'grow', style: { maxWidth: '380px' } }, searchBox('Поиск по названию товара', debounce((v) => {
        if (form.isDirty()) { toast('Сначала сохраните или отмените текущие изменения, затем выполните поиск', 'bad'); return; }
        Q = v; load();
      }, 300), Q)),
      toggleEl({ checked: ONLY_CHANGED, label: 'Только изменённые', onChange: (v) => { ONLY_CHANGED = v; draw(); } }),
      h('span', { class: 'spacer' }), count),
    h('div', { class: 'table-wrap', style: { maxHeight: 'calc(100vh - 260px)' } }, h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, h('th', { text: 'Товар' }), h('th', { text: 'Цена в серебре' }), h('th', { text: 'Цена в золоте' }), h('th', { text: 'Запас' }), h('th', {}))), tbody))));
  await load();
  return root;
}
