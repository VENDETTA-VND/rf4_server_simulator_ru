// Правила игры：决定钓Рыба「玩起来是什么感觉」。数值微调在「数值调整」页。
import { h, api, post, icon, toast, errText, pageHead, section, callout, badge, Form, savebar, setLeaveGuard, confirmDialog, render } from '../core.js';

const STYLES = [
  ['realistic', 'Реалистичный клёв', 'Рыба клюёт с учётом повадок, погоды, места и наживки. Изучайте точки ловли и подбирайте подходящую наживку для более реалистичной рыбалки.', 'Все шесть правил ниже включены, кроме «Счастливых часов».'],
  ['legacy', 'Полностью случайный режим', 'Любая рыба может клюнуть на любую наживку. Полностью случайный режим для непринуждённой игры.', 'Все шесть правил ниже выключены, кроме «Счастливых часов».'],
];
export const RULE_SWITCHES = [
  ['bite_gate_enabled', 'Подходящая наживка', 'Рыба, которая не питается искусственными приманками (например, вьюн или карповые), на них не клюёт. При неверно выбранном горизонте поклёвок почти не будет.', '0'],
  ['fish_ecology_enabled', 'Повадки рыб', 'Для 252 видов рыб клёв зависит от повадок, глубины, времени суток, сезона, погоды, рельефа дна и проводки искусственной приманки.', '0'],
  ['fish_weather_enabled', 'Погода и температура воды', 'Температура и погода влияют на активность рыбы. При донной и поплавочной ловле рыба может периодически пробовать наживку.', '0'],
  ['fish_distribution_enabled', 'Распределение стай', 'Каждый вид рыбы встречается в определённых зонах карты. Распределение обновляется каждые 4 игровых часа.', '0'],
  ['fish_bait_rules_enabled', 'Рыба выбирает наживку', 'Список возможной добычи зависит от наживки на крючке. Предпочтения видов настраиваются в разделе «Предпочтения рыб по наживкам».', '0'],
  ['happy_hour_enabled', 'Счастливые часы', 'При активной подписке во время рыбалки: опыт +50%, частота поклёвок +10%, шанс роста навыка +25%. Ограничения по времени в день нет.', '1'],
];
const SPAWN = [
  ['grade_ratio', 'Распределение по категориям', 'Задайте доли четырёх категорий улова: незачётная, зачётная, трофейная и с голубой короной.'],
  ['fish_hunt', 'Четыре стадии клёва', 'Для пресноводной ловли качество улова проходит четыре стадии: обычная ловля → сбор рыбы → активный клёв → крупная рыба. Также применяется к морской и спиннинговой ловле.'],
  ['two_stage', 'Обычный режим / прикормка', 'Для донной и поплавочной ловли доступны два этапа — обычный и после прикормки. Для морской и спиннинговой ловли сохраняются четыре этапа.'],
];
const GRADES = [['below', 'Незачётная', '#7f8b9a'], ['qualified', 'Зачётная', '#4cb3d4'], ['trophy', 'Трофей', '#e0a743'], ['super', 'Голубая корона', '#9d7cf0']];
const GRADE_SETS = {
  grade_ratio: [{ prefix: 'grade_pct_', title: 'Доли четырёх категорий', defs: [3, 87.5, 9, 0.5] }],
  two_stage: [
    { prefix: 'two_stage_daily_', title: 'Обычный режим (без прикормки)', defs: [10, 86.5, 3, 0.5] },
    { prefix: 'two_stage_baited_', title: 'После прикормки', defs: [1, 92, 6, 1] },
  ],
};
const OTHER = [
  ['condition_health_enabled', 'Голод и холод уменьшают здоровье', 'После отключения здоровье всегда будет полным, а лекарства не будут расходоваться.', '1'],
  ['condition_fishing_pause_enabled', 'Энергия не восстанавливается во время рыбалки', 'Пока снасть находится в воде, энергия не восстанавливается. После выматывания снасти восстановление продолжится. При отключении этого параметра энергия восстанавливается постоянно.', '1'],
  ['hook_nibble_enabled', 'Рыба пробует наживку перед поклёвкой', 'Перед поклёвкой рыба несколько раз пробует наживку. Если подсечь слишком рано, поклёвка будет пустой. При отключении первая подсечка не считается пробой наживки.', '0'],
  ['bite_pace_enabled', 'Скорость клёва зависит от наживки', 'После включения скорость клёва зависит от наживки и техники проводки. Для донной и поплавочной ловли учитывается соответствие наживки, для спиннинга и морской ловли — также правильность проводки. При полном соответствии поклёвка происходит за 1,5–6 секунд. Параметр меняет только темп клёва, но не состав улова.', '0'],
];

export default async function rules() {
  const [t, mode] = await Promise.all([api('/api/tunables'), api('/api/fish/bite_mode').catch(() => ({}))]);
  const val = (k, d) => (t[k] === undefined || t[k] === '' ? d : t[k]);
  const form = new Form();
  savebar(form, {
    onSave: async (values) => {
      for (const [key, value] of Object.entries(values)) await post('/api/tunables', { key, value: String(value) });
      toast('Сохранено. Вступит в силу примерно через 30 секунд.');
      render();
    },
  });
  setLeaveGuard(() => form.isDirty());

  // Стиль игры
  const cur = mode.mode || 'legacy';
  const styleCards = h('div', { class: 'grid-2' }, STYLES.map(([m, title, desc, note]) => {
    const on = cur === m;
    return h('button', {
      type: 'button', class: 'card', style: { textAlign: 'left', padding: '18px 20px', cursor: on ? 'default' : 'pointer', borderColor: on ? 'var(--accent)' : '', background: on ? 'var(--accent-soft)' : '' },
      onclick: async () => {
        if (on) return;
        const ok = await confirmDialog({ title: `Переключить на «${title}»?`, desc: `${note}. Вступит в силу примерно через 30 секунд.`, confirm: 'Переключить' });
        if (!ok) return;
        try { await post('/api/fish/bite_mode', { mode: m }); toast(`Переключено на «${title}»`); render(); } catch (e) { toast(errText(e), 'bad'); }
      },
    }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { style: { fontSize: '15px' }, text: title }), on ? badge('Текущий режим', 'accent') : null),
    h('p', { class: 'text-2 small', style: { marginTop: '6px' }, text: desc }));
  }));

  // Режим появления рыбы
  const spawnMode = val('grade_ratio_enabled', '1') === '1' ? 'grade_ratio' : val('two_stage_hunt_enabled', '0') === '1' ? 'two_stage' : val('fish_hunt_enabled', '0') === '1' ? 'fish_hunt' : '';
  const spawnCards = h('div', { class: 'grid-3' }, SPAWN.map(([m, title, desc]) => {
    const on = spawnMode === m;
    return h('button', {
      type: 'button', class: 'card', style: { textAlign: 'left', padding: '16px 18px', cursor: on ? 'default' : 'pointer', borderColor: on ? 'var(--accent)' : '', background: on ? 'var(--accent-soft)' : '' },
      onclick: async () => {
        if (on) return;
        if (form.isDirty() && !(await confirmDialog({ title: 'Есть несохранённые изменения', desc: 'Переключение режима появления рыбы перезагрузит страницу, а несохранённые изменения будут потеряны.', confirm: 'Продолжить' }))) return;
        try { await post('/api/fish/spawn_mode', { mode: m }); toast(`Переключено на «${title}»，约 30 秒内生效`); render(); } catch (e) { toast(errText(e), 'bad'); }
      },
    }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { text: title }), on ? badge('Текущий режим', 'accent') : null),
    h('p', { class: 'muted small', style: { marginTop: '6px' }, text: desc }));
  }));
  const gradeEditors = (GRADE_SETS[spawnMode] || []).map((set) => gradeEditor(form, set, t, spawnMode === 'grade_ratio'));

  return h('div', { class: 'page' },
    pageHead('Правила игры', 'Определяет характер рыбалки. Числовые параметры (скорость клёва, множитель опыта и другие) настраиваются в разделе «Настройка параметров».'),
    section({
      title: 'Стиль игры', desc: 'Переключение набора из шести правил одним нажатием.',
      actions: cur === 'mixed' ? badge('Пользовательский набор', 'warn') : null,
      body: h('div', { class: 'stack' }, styleCards, cur === 'mixed' ? callout('info', 'Некоторые правила изменены вручную и не соответствуют готовому профилю. Выбор любого профиля выше перезапишет их.') : null),
    }),
    section({ title: 'Правила', desc: 'Каждое правило можно включать отдельно. Изменения вступают в силу примерно через 30 секунд.', body: h('div', {}, RULE_SWITCHES.map(([k, l, d, def]) => form.row({ key: k, label: l, help: d, kind: 'bool', def }, val(k, def)))) }),
    section({
      title: 'Режим появления рыбы', desc: 'Определяет долю ценной рыбы (трофеи и рыба с голубой короной) в улове. Выберите один из трёх режимов.',
      body: h('div', { class: 'stack' }, spawnCards, ...gradeEditors,
        spawnMode === 'fish_hunt' ? callout('info', 'Четыре стадии клёва按Игроки打窝、聚Рыба的进度自动推进，没有需要手动设置的比例。') : null,
        !spawnMode ? callout('warn', '还没有选择Режим появления рыбы，目前按旧版Правила出Рыба。') : null),
    }),
    section({ title: 'Другое', body: h('div', {},
      OTHER.map(([k, l, d, def]) => form.row({ key: k, label: l, help: d, kind: 'bool', def }, val(k, def))),
      form.row({ key: 'hook_spawn_match_strength', label: 'Рыба钩大小影响出Рыба', help: '0 表示不影响；1 表示大钩更容易钓到大Рыба、小钩更容易钓到小Рыба；2 更明显。选「Распределение по категориям」时不起作用。', kind: 'float', min: 0, max: 2, def: '0' }, val('hook_spawn_match_strength', '0'))) }));
}

// Доли четырёх категорий编辑：输入相对权重，实时显示换算后的百分比
function gradeEditor(form, set, t, interactive) {
  const bar = h('div', { style: { display: 'flex', height: '10px', borderRadius: '6px', overflow: 'hidden', background: 'var(--surface-4)' } });
  const legend = h('div', { class: 'row small', style: { gap: '16px' } });
  const fields = GRADES.map(([g, label], i) => {
    const key = set.prefix + g;
    return { key, label, f: form.field({ key, label, kind: 'float', min: 0, max: 100 }, t[key] ?? String(set.defs[i])) };
  });
  const track = h('div', { class: interactive ? 'grade-ratio-track' : null }, bar);
  const hint = h('span', { class: 'muted small' });
  const readWeights = () => fields.map(({ key }) => Math.max(0, Number(form.value(key)) || 0));
  const handles = interactive ? GRADES.slice(1).map((_, i) =>
    ratioHandle(i, fields, readWeights, track, () => form.refresh())) : [];
  track.append(...handles);
  const update = () => {
    const nums = readWeights();
    const sum = nums.reduce((a, b) => a + b, 0) || 1;
    const valid = !interactive || fields.every(({ key }) => {
      const raw = form.value(key), n = Number(raw);
      return raw !== '' && Number.isFinite(n) && n >= 0 && n <= 100;
    });
    let cumulative = 0;
    handles.forEach((handle, i) => {
      cumulative += nums[i] / sum * 100;
      track.style.setProperty('--boundary-' + i, cumulative + '%');
      const pair = nums[i] + nums[i + 1];
      const min = Math.max(0, pair - 100), max = Math.min(100, pair);
      handle.disabled = !valid || min >= max;
      handle.setAttribute('aria-valuemin', min);
      handle.setAttribute('aria-valuemax', max);
      handle.setAttribute('aria-valuenow', nums[i]);
      handle.setAttribute('aria-valuetext', GRADES[i][1] + ' ' + (nums[i] / sum * 100).toFixed(1) + '%');
    });
    hint.textContent = !interactive ? 'Введите относительные значения — они автоматически преобразуются в проценты' :
      nums.every(n => n === 0) ? 'Суммарный вес равен 0. Сначала задайте вес хотя бы одной категории' : 'Можно ввести веса или перетащить разделители';
    bar.replaceChildren(...nums.map((n, i) => h('div', { style: { width: (n / sum * 100) + '%', background: GRADES[i][2] } })));
    legend.replaceChildren(...nums.map((n, i) => h('span', {}, h('span', { style: { display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px', background: GRADES[i][2], marginRight: '6px' } }),
      GRADES[i][1] + ' ', h('b', { text: (n / sum * 100).toFixed(1) + '%' }))));
  };
  const inputs = h('div', { class: 'grid-4' }, fields.map(({ label, f }) => {
    f.input = h('input', { class: 'input num', inputmode: 'decimal', value: f.original, oninput: () => { form.refresh(); if (!interactive) update(); } });
    f.errEl = h('div', { class: 'help', style: { color: '#f08a97' }, hidden: true });
    f.row = h('div', { class: 'field' }, h('label', { text: label }), f.input, f.errEl);
    return f.row;
  }));
  if (interactive) {
    // Form.reset() also calls refresh when the user discards a drag.
    const updateSavebar = form.onChange;
    form.onChange = () => { updateSavebar(form); update(); };
  }
  update();
  return h('div', { class: 'card', style: { padding: '16px 18px', background: 'var(--surface-2)' } },
    h('div', { class: 'row', style: { justifyContent: 'space-between', marginBottom: '10px' } }, h('b', { text: set.title }), hint),
    inputs, h('div', { style: { margin: interactive ? '22px 0 16px' : '14px 0 8px' } }, track), legend);
}

// Each gesture uses the starting weights so rounding never accumulates across moves.
function ratioHandle(i, fields, readWeights, track, refresh) {
  const label = GRADES[i][1] + ' / ' + GRADES[i + 1][1];
  const handle = h('button', { type: 'button', class: 'grade-ratio-handle', role: 'slider',
    'aria-label': label, title: label + '（拖动或按左右方向键调整）' });
  function transfer(weights, delta) {
    const left = weights[i], pair = left + weights[i + 1];
    const next = Math.max(0, pair - 100, Math.min(100, pair, left + delta));
    fields[i].f.input.value = Number(next.toPrecision(15));
    fields[i + 1].f.input.value = Number((pair - next).toPrecision(15));
    refresh();
  }
  let drag;
  handle.onpointerdown = e => {
    if (!e.isPrimary || e.button !== 0 || drag) return;
    drag = { id: e.pointerId, x: e.clientX, width: track.getBoundingClientRect().width, weights: readWeights() };
    handle.setPointerCapture(e.pointerId);
  };
  handle.onpointermove = e => {
    if (drag?.id !== e.pointerId || !drag.width) return;
    const total = drag.weights.reduce((a, b) => a + b, 0);
    const tenths = Math.round((e.clientX - drag.x) / drag.width * 1000);
    transfer(drag.weights, total * tenths / 1000);
  };
  handle.onlostpointercapture = () => { drag = null; };
  handle.onkeydown = e => {
    const weights = readWeights();
    const step = weights.reduce((a, b) => a + b, 0) / 100;
    const deltas = { ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step,
      Home: -weights[i], End: weights[i + 1] };
    if (!Object.hasOwn(deltas, e.key)) return;
    e.preventDefault();
    transfer(weights, deltas[e.key]);
  };
  return handle;
}
