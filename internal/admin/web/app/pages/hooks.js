// Рыба钩：按型号微调Вероятность поклёвки。真实物理数据只读。
import { h, api, post, toast, errText, pageHead, badge, btn, empty, loading, searchBox, debounce, dialog, Form, fmt, callout } from '../core.js';
import { itemIcon } from '../widgets.js';

const FAMILY = [['', 'Все типы крючков'], ['classic', 'Обычный крючок'], ['carp', 'Карповый крючок'], ['treble', 'Тройник'], ['jighead', 'Джиг-головка'], ['offset', 'Офсетный крючок'], ['marine', 'Морской крючок'], ['other', 'Другое']];
const familyName = (f) => (FAMILY.find(([k]) => k === f) || [f, f])[1];
const isDefault = (p) => Number(p.solid_scale) === 1 && Number(p.hold_scale) === 1 && !Number(p.small_fish_floor) && !Number(p.over_capacity_hold_floor);
let Q = '', FAM = '', SIZE = '';

export default async function hooks() {
  const tbody = h('tbody');
  const count = h('span', { class: 'muted small' });
  const sizeSel = h('select', { class: 'select', style: { width: '130px' }, onchange: (e) => { SIZE = e.target.value; load(); } }, h('option', { value: '', text: 'Все размеры' }));
  const famSel = h('select', { class: 'select', style: { width: '140px' }, onchange: (e) => { FAM = e.target.value; load(); } }, FAMILY.map(([k, l]) => h('option', { value: k, text: l, selected: k === FAM })));
  let sizesFilled = false;
  async function load() {
    tbody.replaceChildren(h('tr', {}, h('td', { colspan: 7 }, loading(4))));
    try {
      const d = await api(`/api/hooks/profiles?limit=500&q=${encodeURIComponent(Q)}&size=${encodeURIComponent(SIZE)}&family=${encodeURIComponent(FAM)}`);
      const list = d.profiles || [];
      if (!sizesFilled && list.length) {
        sizesFilled = true;
        for (const s of [...new Set(list.map((p) => p.size))].sort((a, b) => a - b)) sizeSel.append(h('option', { value: s, text: '#' + s }));
      }
      count.textContent = list.length < (d.total || 0) ? `Найдено: ${fmt(d.total)}, показано: ${list.length}` : `${fmt(list.length)} 个型号`;
      tbody.replaceChildren(...(list.length ? list.map((p) => h('tr', {},
        h('td', {}, h('div', { class: 'row', style: { flexWrap: 'nowrap' } }, itemIcon(p.item_id, 32), h('div', {}, h('b', { text: p.name || p.brand || p.item_id }), h('span', { class: 'sub mono', text: p.item_id })))),
        h('td', { text: familyName(p.family) }),
        h('td', { class: 'num', text: '#' + p.size }),
        h('td', { class: 'num', text: Number(p.strength_kg).toFixed(1) + ' kg' }),
        h('td', { class: 'num', text: fmt(Math.round(p.entry_capacity_g)) + ' g' }),
        h('td', {}, isDefault(p) ? h('span', { class: 'muted small', text: '默认' }) : badge(`咬口 ×${Number(p.solid_scale).toFixed(2)} · 保持 ×${Number(p.hold_scale).toFixed(2)}`, 'warn')),
        h('td', { class: 'num' }, btn('调整', () => edit(p, load), 'sm')))) : [h('tr', {}, h('td', { colspan: 7 }, empty('Подходящие крючки не найдены')))]));
    } catch (e) { tbody.replaceChildren(h('tr', {}, h('td', { colspan: 7 }, empty('Не удалось загрузить', errText(e))))); }
  }
  load();
  return h('div', { class: 'page' },
    pageHead('Рыба钩', 'Для разных моделей крючков можно отдельно настроить вероятность поклёвки и надёжность удержания рыбы. Прочность самого крючка не меняется.'),
    h('div', { class: 'card card-pad' },
      h('div', { class: 'row', style: { marginBottom: '14px' } },
        h('div', { class: 'grow', style: { maxWidth: '360px' } }, searchBox('Поиск по модели или бренду, например Simmons', debounce((v) => { Q = v; load(); }, 300), Q)),
        famSel, sizeSel, h('span', { class: 'spacer' }), count),
      h('div', { class: 'table-wrap', style: { maxHeight: 'calc(100vh - 250px)' } }, h('table', { class: 'table' },
        h('thead', {}, h('tr', {}, h('th', { text: 'Рыба钩' }), h('th', { text: 'Тип крючка' }), h('th', { class: 'num', text: 'Размер' }), h('th', { class: 'num', text: 'Прочность' }),
          h('th', { class: 'num', title: 'Размер пасти рыбы, для которой подходит крючок', text: 'Подходящий вес рыбы' }), h('th', { text: '调整' }), h('th', {}))), tbody))));
}

function edit(p, reload) {
  const form = new Form();
  const body = h('div', { class: 'stack' },
    h('dl', { class: 'kv small' },
      h('dt', { text: 'Тип крючка / Размер' }), h('dd', { text: `${familyName(p.family)} · #${p.size}` }),
      h('dt', { text: 'Длина' }), h('dd', { text: Number(p.length_mm).toFixed(2) + ' mm' }),
      h('dt', { text: 'Прочность' }), h('dd', { text: Number(p.strength_kg).toFixed(2) + ' kg' }),
      h('dt', { text: 'Подходящий вес рыбы' }), h('dd', { text: 'Примерно ' + fmt(Math.round(p.entry_capacity_g)) + ' г или меньше' })),
    h('div', {},
      form.row({ key: 'solid_scale', label: 'Вероятность поклёвки', help: '1 — значение по умолчанию. Больше 1 — рыба засекается чаще, меньше 1 — реже.', kind: 'float', min: 0, max: 3, def: '1', unit: '倍' }, p.solid_scale),
      form.row({ key: 'hold_scale', label: 'Надёжность после подсечки', help: '1 — значение по умолчанию. Больше 1 — рыба реже сходит при вываживании.', kind: 'float', min: 0, max: 3, def: '1', unit: '倍' }, p.hold_scale),
      h('details', { class: 'advanced' }, h('summary', {}, 'Дополнительно'), h('div', {},
        form.row({ key: 'small_fish_floor', label: '小Рыба最低咬口', help: 'Рыба远小于钩子时，咬口至少保留这个比例。0–1。', kind: 'float', min: 0, max: 1, def: '0' }, p.small_fish_floor),
        form.row({ key: 'over_capacity_hold_floor', label: '大Рыба最低稳定度', help: 'Рыба超过钩子适合的Вес时，稳定度至少保留这个比例。0–1。', kind: 'float', min: 0, max: 1, def: '0' }, p.over_capacity_hold_floor)))));
  dialog({
    title: p.name || p.item_id, desc: p.item_id, body, size: 'lg',
    actions: [
      { label: 'Восстановить значения по умолчанию', kind: 'ghost', onClick: async () => { await post('/api/hooks/profiles', { item_id: p.item_id, solid_scale: 1, hold_scale: 1, small_fish_floor: 0, over_capacity_hold_floor: 0 }); toast('已Восстановить значения по умолчанию，Примерно 30 秒内生效'); reload(); } },
      { label: 'Отмена', kind: 'ghost' },
      { label: 'Сохранить', kind: 'primary', onClick: async () => {
        const keys = ['solid_scale', 'hold_scale', 'small_fish_floor', 'over_capacity_hold_floor'];
        if (!form.validate(keys)) return true;
        const v = form.values(keys);
        await post('/api/hooks/profiles', { item_id: p.item_id, solid_scale: +v.solid_scale, hold_scale: +v.hold_scale, small_fish_floor: +v.small_fish_floor, over_capacity_hold_floor: +v.over_capacity_hold_floor });
        toast('已Сохранить，Примерно 30 秒内生效'); reload();
      } },
    ],
  });
}
