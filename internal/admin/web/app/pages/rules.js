// Правила игры：决定钓Рыба「玩起来是什么感觉」。数值微调在「数值调整」页。
import { h, api, post, icon, toast, errText, pageHead, section, callout, badge, Form, savebar, setLeaveGuard, confirmDialog, render } from '../core.js';

const STYLES = [
  ['realistic', '真实Рыба汛', 'Рыба按习性、天气、Место和Наживка料决定咬不咬。要研究钓点、选对Наживка，更接近真实钓Рыба。', 'Все шесть правил ниже включены, кроме «Счастливых часов».'],
  ['legacy', 'Полностью случайный режим', '任何Рыба都可能咬任何Наживка，出Рыба完Полностью случайный режим。轻松，适合随便玩玩。', 'Все шесть правил ниже выключены, кроме «Счастливых часов».'],
];
export const RULE_SWITCHES = [
  ['bite_gate_enabled', 'Наживка要对口', '拟Наживка不会钓到不吃拟Наживка的Рыба（如泥鳅、鲤科Рыба）；钓层不对时几乎不咬。', '0'],
  ['fish_ecology_enabled', 'Рыба种习性', '252 种Рыба各按习性决定咬不咬：水层、昼夜、季节、天气、水底环境、拟Наживка动作都有影响。', '0'],
  ['fish_weather_enabled', 'Погода и температура воды', '游戏里的气温和天气会影响Рыба口；底钓、浮钓时Рыба会断断续续地试口。', '0'],
  ['fish_distribution_enabled', 'Рыба群分布', '每种Рыба只在地图的特定区域出没，每 4 个游戏小时重新分布一次。', '0'],
  ['fish_bait_rules_enabled', 'Рыба会挑Наживка', '根据钩上挂的Наживка决定会来哪些Рыба。每种Рыба爱吃什么在「РыбаНаживка偏好」里设置。', '0'],
  ['happy_hour_enabled', 'Счастливые часы', 'ПодпискаВ сети钓Рыба时：经验 +50%、Рыба口 +10%、熟练度提升机会 +25%，没有每日时长限制。', '1'],
];
const SPAWN = [
  ['grade_ratio', '按比例出Рыба', '直接设定未Зачётная、Зачётная、Трофей、Голубая корона四档Рыба各占多少。最直观。'],
  ['fish_hunt', 'Рыба猎四阶段', '淡水按「日常 → 聚Рыба → 发窝 → 巨物」四个阶段逐步出好Рыба，海钓和路亚同样适用。'],
  ['two_stage', 'Обычный режим / прикормка', '底钓、浮钓只有「日常」和「После прикормки」两档，各自设定比例。海钓、路亚仍按四阶段。'],
];
const GRADES = [['below', '未Зачётная', '#7f8b9a'], ['qualified', 'Зачётная', '#4cb3d4'], ['trophy', 'Трофей', '#e0a743'], ['super', 'Голубая корона', '#9d7cf0']];
const GRADE_SETS = {
  grade_ratio: [{ prefix: 'grade_pct_', title: 'Доли четырёх категорий', defs: [3, 87.5, 9, 0.5] }],
  two_stage: [
    { prefix: 'two_stage_daily_', title: 'Обычный режим (без прикормки)', defs: [10, 86.5, 3, 0.5] },
    { prefix: 'two_stage_baited_', title: 'После прикормки', defs: [1, 92, 6, 1] },
  ],
};
const OTHER = [
  ['condition_health_enabled', 'Голод и холод уменьшают здоровье', '关闭后生命值始终是满的，药品也不会消耗。', '1'],
  ['condition_fishing_pause_enabled', '钓Рыба时精力不恢复', '竿在水里时精力暂停恢复，收竿后再恢复。关闭则一直正常恢复。', '1'],
  ['hook_nibble_enabled', 'Рыба会先嘬Наживка', 'Рыба咬钩前先轻嘬几下，抬竿太早会钓空。关闭后第一次抬竿不会判嘬Наживка。', '0'],
  ['bite_pace_enabled', 'Наживка效控速', '开启后来Рыба快慢由Наживка与动作共同决定：底钓/浮钓看Наживка对不对口；路亚/海钓铁板还看收线动作对不对口——Наживка与动作都对口时 1.5~6 秒内来Рыба，动作不对口像差Наживка一样长Время才有Рыба。只控节奏，不改出什么Рыба。', '0'],
];

export default async function rules() {
  const [t, mode] = await Promise.all([api('/api/tunables'), api('/api/fish/bite_mode').catch(() => ({}))]);
  const val = (k, d) => (t[k] === undefined || t[k] === '' ? d : t[k]);
  const form = new Form();
  savebar(form, {
    onSave: async (values) => {
      for (const [key, value] of Object.entries(values)) await post('/api/tunables', { key, value: String(value) });
      toast('已Сохранить，约 30 秒内生效');
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
        const ok = await confirmDialog({ title: `Переключить到「${title}」？`, desc: `${note}。约 30 秒内生效。`, confirm: 'Переключить' });
        if (!ok) return;
        try { await post('/api/fish/bite_mode', { mode: m }); toast(`已Переключить到「${title}」`); render(); } catch (e) { toast(errText(e), 'bad'); }
      },
    }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { style: { fontSize: '15px' }, text: title }), on ? badge('Текущий режим', 'accent') : null),
    h('p', { class: 'text-2 small', style: { marginTop: '6px' }, text: desc }));
  }));

  // 出Рыба方式
  const spawnMode = val('grade_ratio_enabled', '1') === '1' ? 'grade_ratio' : val('two_stage_hunt_enabled', '0') === '1' ? 'two_stage' : val('fish_hunt_enabled', '0') === '1' ? 'fish_hunt' : '';
  const spawnCards = h('div', { class: 'grid-3' }, SPAWN.map(([m, title, desc]) => {
    const on = spawnMode === m;
    return h('button', {
      type: 'button', class: 'card', style: { textAlign: 'left', padding: '16px 18px', cursor: on ? 'default' : 'pointer', borderColor: on ? 'var(--accent)' : '', background: on ? 'var(--accent-soft)' : '' },
      onclick: async () => {
        if (on) return;
        if (form.isDirty() && !(await confirmDialog({ title: 'Есть несохранённые изменения', desc: 'Переключить出Рыба方式会Обновить页面，没Сохранить的修改会丢失。', confirm: '继续Переключить' }))) return;
        try { await post('/api/fish/spawn_mode', { mode: m }); toast(`已Переключить到「${title}」，约 30 秒内生效`); render(); } catch (e) { toast(errText(e), 'bad'); }
      },
    }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { text: title }), on ? badge('Текущий режим', 'accent') : null),
    h('p', { class: 'muted small', style: { marginTop: '6px' }, text: desc }));
  }));
  const gradeEditors = (GRADE_SETS[spawnMode] || []).map((set) => gradeEditor(form, set, t, spawnMode === 'grade_ratio'));

  return h('div', { class: 'page' },
    pageHead('Правила игры', '决定钓Рыба玩起来是什么感觉。具体数字（咬钩快慢、经验倍率等）在「数值调整」里改。'),
    section({
      title: 'Стиль игры', desc: 'Переключение набора из шести правил одним нажатием.',
      actions: cur === 'mixed' ? badge('Пользовательский набор', 'warn') : null,
      body: h('div', { class: 'stack' }, styleCards, cur === 'mixed' ? callout('info', '下面的Правила被单独改过，不属于任何一种预设。选择上面任一风格会整体覆盖。') : null),
    }),
    section({ title: 'Правила', desc: 'Каждое правило можно включать отдельно. Изменения вступают в силу примерно через 30 секунд.', body: h('div', {}, RULE_SWITCHES.map(([k, l, d, def]) => form.row({ key: k, label: l, help: d, kind: 'bool', def }, val(k, def)))) }),
    section({
      title: '出Рыба方式', desc: '决定钓到的Рыба里，好Рыба（Трофей、Голубая корона）占多少。三选一，点卡片Переключить。',
      body: h('div', { class: 'stack' }, spawnCards, ...gradeEditors,
        spawnMode === 'fish_hunt' ? callout('info', 'Рыба猎四阶段按Игроки打窝、聚Рыба的进度自动推进，没有需要手动设置的比例。') : null,
        !spawnMode ? callout('warn', '还没有选择出Рыба方式，目前按旧版Правила出Рыба。') : null),
    }),
    section({ title: 'Другое', body: h('div', {},
      OTHER.map(([k, l, d, def]) => form.row({ key: k, label: l, help: d, kind: 'bool', def }, val(k, def))),
      form.row({ key: 'hook_spawn_match_strength', label: 'Рыба钩大小影响出Рыба', help: '0 表示不影响；1 表示大钩更容易钓到大Рыба、小钩更容易钓到小Рыба；2 更明显。选「按比例出Рыба」时不起作用。', kind: 'float', min: 0, max: 2, def: '0' }, val('hook_spawn_match_strength', '0'))) }));
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
    hint.textContent = !interactive ? '填相对Количество，会自动换算成百分比' :
      nums.every(n => n === 0) ? '总权重为 0，请先输入一档权重' : '可输入权重，也可拖动分界线调整';
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
