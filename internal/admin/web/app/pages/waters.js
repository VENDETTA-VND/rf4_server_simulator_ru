// Водоёмы и виды рыб：每个水域出哪些Рыба、各占多少、咬钩快慢。
import { zonesEditor } from './zones.js';
import {
  h, api, apiList, post, toast, errText, pageHead, section, callout, badge, btn, empty, loading, searchBox, debounce, dialog,
  confirmDialog, navigate, Form, savebar, setLeaveGuard, render, tabs, webURL, fmt,
} from '../core.js';

const ORDER = ['克马羚诺也湖', '埃尔克湖', '惟有诺克河', '旧奥斯特罗格湖', '白河', '廓里湖', '梅德韦杰湖', '沃尔霍夫河', '北顿涅茨河', '苏拉河', '拉多加湖', '琥珀湖', '拉多加湖群岛', '阿赫图巴河', '铜湖', '下通古斯卡河', '亚马河', '挪威海'];

export function fishIcon(key, w = 64) {
  const img = h('img', { src: webURL('/icons/fish/' + encodeURIComponent(String(key || '').toLowerCase().replace(/\./g, '_')) + '.png'), alt: '', loading: 'lazy', style: { width: w + 'px', height: (w / 2) + 'px', objectFit: 'contain', flex: 'none' } });
  img.onerror = () => { img.style.display = 'none'; };
  return img;
}

export default async function waters(params) {
  const [areas, zonesData] = await Promise.all([api('/api/fish/areas'), api('/api/fish/zones').catch(() => ({ zones: [] }))]);
  const list = (Array.isArray(areas) ? areas : []).slice().sort((a, b) => {
    const ia = ORDER.indexOf(a.loc), ib = ORDER.indexOf(b.loc);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  const zones = zonesData.zones || [];
  const loc = params[0] && list.some((a) => a.loc === params[0]) ? params[0] : (list[0] && list[0].loc);
  const tab = params[1] === 'zones' ? 'zones' : 'fish';
  const side = h('div', { class: 'card master' }, h('div', { class: 'list' }, list.map((a) => {
    const n = zones.filter((z) => z.loc === a.loc).length;
    return h('div', { class: 'list-item clickable' + (a.loc === loc ? ' on' : ''), onclick: () => navigate('waters', a.loc, tab) },
      h('div', { class: 'grow' }, h('div', { class: 'title', text: a.loc }), h('div', { class: 'sub', text: `${a.fish_count}  видов рыб` + (n ? ` · ${n} зон обитания стай` : '') })),
      a.map_kind === 'sea' ? badge('Морская карта') : null);
  })));
  const main = h('div', {}, h('div', { class: 'card card-pad' }, loading(6)));
  const root = h('div', { class: 'page' },
    pageHead('Водоёмы и виды рыб', 'Какие виды рыб встречаются в каждом водоёме, их доля и скорость клёва.'),
    h('div', { class: 'master-detail', style: { gridTemplateColumns: '240px minmax(0,1fr)' } }, side, main));
  if (!loc) { main.replaceChildren(h('div', { class: 'card' }, empty('Нет данных о водоёмах'))); return root; }
  const tabBar = tabs([['fish', 'Виды рыб'], ['zones', 'Зоны обитания стай', zones.filter((z) => z.loc === loc).length]], tab, (t) => navigate('waters', loc, t));
  if (tab === 'zones') {
    // 画地图需要空间：收起左侧水域列表，改用标题栏的下拉选择
    const cfg = await api('/api/fish/config?loc=' + encodeURIComponent(loc)).catch(() => ({ fish: [] }));
    const area = list.find((a) => a.loc === loc);
    const picker = h('select', { class: 'select', style: { width: '220px' }, 'aria-label': 'Выбрать водоём', onchange: (e) => navigate('waters', e.target.value, 'zones') },
      list.map((a) => h('option', { value: a.loc, text: a.loc + (a.map_kind === 'sea' ? '（Морская карта）' : ''), selected: a.loc === loc })));
    return h('div', { class: 'page' },
      pageHead('Водоёмы и виды рыб', 'Выделите на карте зону и укажите, какие виды рыб в ней встречаются.', picker),
      h('div', { class: 'card card-pad' }, tabBar,
        zonesEditor({ area, zones: zones.filter((z) => z.loc === loc), roster: cfg.fish || [] })));
  }
  try {
    const [cfg, prefs] = await Promise.all([
      api('/api/fish/config?loc=' + encodeURIComponent(loc)),
      api('/api/bait/prefs?limit=2000&loc=' + encodeURIComponent(loc)).catch(() => ({ rows: [] })),
    ]);
    const baitByKey = Object.fromEntries((prefs.rows || []).map((r) => [r.fish_key, r]));
    main.replaceChildren(h('div', { class: 'card card-pad' }, h('h2', { style: { fontSize: '17px', marginBottom: '10px' }, text: loc }), tabBar, fishView(cfg, baitByKey)));
  } catch (e) { main.replaceChildren(h('div', { class: 'card' }, empty('Не удалось загрузить', errText(e)))); }
  return root;
}

// ---------- Виды рыб名册 ----------
// Предпочитаемая наживка：静态Правила来自РыбаНаживка偏好；轮换只认名册行里后端给的 bait_groups / bait_rotate_sec
function baitCell(row, pref) {
  const allow = (pref && pref.allow) || [];
  const groups = (row.bait_groups || []).filter((g) => g && g.length);
  const rotating = groups.length > 1 && Number(row.bait_rotate_sec) > 0;
  return h('td', { style: { whiteSpace: 'normal', maxWidth: '320px' } },
    allow.length ? h('div', { class: 'small text-2', text: allow.slice(0, 5).join('、') + (allow.length > 5 ? ` 等 ${allow.length} 种` : '') }) : h('span', { class: 'muted small', text: 'Не настроено' }),
    rotating ? h('div', { style: { marginTop: '4px' } }, badge(`Ротация: ${groups.length} групп · каждые ${Math.round(row.bait_rotate_sec / 60)} мин.${row.bait_rotate_mode === 'strict' ? ' · строгий режим' : ''}`, 'accent')) : null);
}

function fishView(cfg, baitByKey = {}) {
  const fish = cfg.fish.map((f) => ({ ...f }));
  const s = cfg.setting || {};
  const form = new Form();
  let dirtyRows = false;
  const isDirty = () => form.isDirty() || dirtyRows;
  const bar = savebar(form, {
    onSave: async () => {
      const setting = { ...s,
        bite_probability: +form.value('bite_probability'), bite_delay_fixed: +form.value('bite_delay_fixed'), bite_delay_scale: +form.value('bite_delay_scale'),
        bite_delay_max: +form.value('bite_delay_max'), bite_delay_lure_max: +form.value('bite_delay_lure_max') };
      await post('/api/fish/config', { area: cfg.area, setting, fish });
      dirtyRows = false;
      toast('Сохранено и вступило в силу');
      setTimeout(render, 200);
    },
  });
  // Виды рыб表的改动不经过 Form 字段，手动把它算进「未Сохранить」
  const origDirty = form.dirtyKeys.bind(form);
  form.dirtyKeys = () => { const k = origDirty(); return dirtyRows && !k.length ? ['_fish'] : k; };
  const origValues = form.values.bind(form);
  form.values = (keys) => origValues((keys || []).filter((k) => k !== '_fish'));
  const origReset = form.reset.bind(form);
  form.reset = () => { dirtyRows = false; origReset(); render(); };
  setLeaveGuard(isDirty);
  const touch = () => { dirtyRows = true; form.refresh(); };

  let q = '';
  const tbody = h('tbody');
  const total = () => fish.filter((f) => f.enabled && Number(f.weight) > 0).reduce((n, f) => n + Number(f.weight), 0) || 1;
  const draw = () => {
    const sum = total();
    const rows = fish.filter((f) => !q || `${f.fish_key} ${f.name_zh}`.toLowerCase().includes(q));
    tbody.replaceChildren(...(rows.length ? rows.map((f) => {
      const on = h('input', { type: 'checkbox', 'aria-label': 'Включить ' + f.name_zh, onchange: (e) => { f.enabled = e.target.checked; touch(); draw(); } });
      on.checked = !!f.enabled;
      const w = h('input', { class: 'input num', style: { width: '90px', height: '30px' }, value: f.weight, onchange: (e) => { const n = Number(e.target.value); f.weight = e.target.value.trim() !== '' && Number.isFinite(n) ? n : f.base_weight; f.has_override = true; touch(); draw(); } });
      const pct = f.enabled && Number(f.weight) > 0 ? (Number(f.weight) / sum * 100) : 0;
      return h('tr', { style: { opacity: f.enabled ? 1 : 0.5 } },
        h('td', {}, h('label', { class: 'toggle' }, on, h('span', { class: 'track' }))),
        h('td', {}, h('div', { class: 'row', style: { flexWrap: 'nowrap' } }, fishIcon(f.fish_key), h('div', {}, h('b', { text: f.name_zh }), h('span', { class: 'sub mono', text: f.fish_key })))),
        baitCell(f, baitByKey[f.fish_key]),
        h('td', {}, w, h('span', { class: 'sub', text: 'По умолчанию: ' + f.base_weight })),
        h('td', { style: { width: '220px' } }, h('div', { class: 'row', style: { flexWrap: 'nowrap' } },
          h('div', { style: { flex: 1, height: '6px', borderRadius: '3px', background: 'var(--surface-4)', overflow: 'hidden' } }, h('div', { style: { width: Math.min(100, pct * 3) + '%', height: '100%', background: 'var(--accent)' } })),
          h('span', { class: 'small', style: { width: '52px', textAlign: 'right' }, text: pct ? pct.toFixed(1) + '%' : '—' }))),
        h('td', {}, f.has_override ? badge('Изменено', 'warn') : h('span', { class: 'muted small', text: 'По умолчанию' })));
    }) : [h('tr', {}, h('td', { colspan: 6 }, empty('Подходящие виды рыб не найдены')))]));
  };
  draw();

  const params = h('div', {},
    form.row({ key: 'bite_probability', label: 'Вероятность поклёвки при забросе', help: '1 означает, что рыба клюнет при каждом забросе.', kind: 'float', min: 0, max: 1, def: '1' }, s.bite_probability),
    form.row({ key: 'bite_delay_scale', label: 'Скорость клёва', help: '0,5 — вдвое быстрее, 2 — вдвое медленнее.', kind: 'float', min: 0, unit: '×', def: '1' }, s.bite_delay_scale),
    form.row({ key: 'bite_delay_max', label: 'Максимальное ожидание', help: 'При обычной ловле поклёвка гарантированно произойдёт за это время.', kind: 'float', min: 1, unit: 'сек.', def: '20' }, s.bite_delay_max),
    form.row({ key: 'bite_delay_lure_max', label: 'Максимальное ожидание при спиннинговой ловле', kind: 'float', min: 0.1, unit: 'сек.', def: '6' }, s.bite_delay_lure_max),
    form.row({ key: 'bite_delay_fixed', label: 'Фиксированное время до поклёвки', help: '0 — случайное время; при заданном значении поклёвка будет происходить через указанный интервал.', kind: 'float', min: 0, unit: 'сек.', def: '0' }, s.bite_delay_fixed));

  return h('div', { class: 'stack' },
    h('details', { class: 'advanced', style: { borderTop: 0, marginTop: '-6px' } }, h('summary', {}, 'Скорость клёва в этом водоёме ', h('small', { text: `(Сейчас: ${Number(s.bite_delay_fixed) > 0 ? 'фиксировано ' + s.bite_delay_fixed + ' сек.' : 'максимум ' + s.bite_delay_max + ' сек.'}）` })), params),
    h('div', { class: 'row' },
      h('div', { class: 'grow', style: { maxWidth: '300px' } }, searchBox('Фильтр по названию рыбы', (v) => { q = v.toLowerCase(); draw(); })),
      btn(q ? 'Включить найденные' : 'Включить все', () => { fish.forEach((f) => { if (!q || `${f.fish_key} ${f.name_zh}`.toLowerCase().includes(q)) f.enabled = true; }); touch(); draw(); }, 'ghost sm'),
      btn(q ? 'Отключить найденные' : 'Отключить все', () => { fish.forEach((f) => { if (!q || `${f.fish_key} ${f.name_zh}`.toLowerCase().includes(q)) f.enabled = false; }); touch(); draw(); }, 'ghost sm'),
      h('span', { class: 'spacer' }),
      btn('Добавить вид рыбы', () => addFish(fish, () => { touch(); draw(); }), 'sm', { icon: 'plus' }),
      btn('Восстановить значения по умолчанию', async () => {
        if (!(await confirmDialog({ title: `Восстановить настройки «${cfg.area}» по умолчанию?`, desc: 'Все изменения водоёма будут сброшены к стандартному списку видов рыб и их долям.', confirm: 'Восстановить значения по умолчанию', danger: true }))) return;
        try { await post('/api/fish/config/reset', { area: cfg.area }); toast('Настройки по умолчанию восстановлены'); dirtyRows = false; render(); } catch (e) { toast(errText(e), 'bad'); }
      }, 'ghost sm')),
    h('p', { class: 'muted small', text: 'Весовой коэффициент определяет частоту появления вида: чем он выше, тем чаще встречается рыба. Процент справа показывает её долю. Если отключить вид или установить коэффициент 0, здесь он появляться не будет.' }),
    h('div', { class: 'table-wrap', style: { maxHeight: 'calc(100vh - 360px)' } }, h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, h('th', { text: 'Появление' }), h('th', { text: 'Рыба' }), h('th', { text: 'Предпочитаемая наживка' }), h('th', { text: 'Весовой коэффициент' }), h('th', { text: 'Доля' }), h('th', {}))), tbody)));
}

function addFish(fish, done) {
  const results = h('div', { class: 'card', style: { maxHeight: '400px', overflow: 'auto' } }, empty('Введите название рыбы для поиска'));
  const search = debounce(async (q) => {
    const list = await apiList('/api/fish/pool?limit=80&q=' + encodeURIComponent(q)).catch(() => []);
    results.replaceChildren(list.length ? h('div', { class: 'list' }, list.map((x) => {
      const has = fish.some((f) => f.fish_key === x.fish_key);
      return h('div', { class: 'list-item' + (has ? '' : ' clickable'), style: { opacity: has ? 0.5 : 1 }, onclick: has ? null : () => {
        fish.push({ fish_key: x.fish_key, name_zh: x.name_zh, base_weight: 0, weight: 1, enabled: true, has_override: true });
        close(); done(); toast(`Добавлен вид «${x.name_zh}». Не забудьте сохранить изменения.`);
      } }, fishIcon(x.fish_key), h('div', { class: 'grow' }, h('div', { class: 'title', text: x.name_zh }), h('div', { class: 'sub mono', text: x.fish_key })),
      has ? badge('Уже в списке') : h('span', { class: 'muted small', text: `${fmt(x.min_g)}–${fmt(x.max_g)} g` }));
    })) : empty('Ничего не найдено'));
  }, 250);
  const { close } = dialog({ title: 'Добавить вид рыбы', size: 'lg', body: h('div', { class: 'stack' }, searchBox('Введите название рыбы для поиска', search), results) });
}
