// РыбаНаживка偏好：每种Рыба吃什么、不吃什么，可以按Время轮换。
import { h, api, toast, errText, pageHead, callout, badge, btn, empty, loading, searchBox, debounce, drawer, dialog, confirmDialog, segmented, toggleEl, icon } from '../core.js';

const DIET = [['lure', '拟Наживка'], ['worm', '蠕虫'], ['fish', 'НаживкаРыба'], ['boilie', '煮Наживка'], ['plant', '植物'], ['crustacean', '甲壳类']];
const WILDCARD = [['各类Наживка', '所有Наживка料'], ['拟Наживка', '所有拟Наживка'], ['活Наживка类', '所有活Наживка'], ['НаживкаРыба类', '所有НаживкаРыба']];
let Q = '', LOC = '', FILTER = 'all';

const put = (path, body) => api(path, { method: 'PUT', body: JSON.stringify(body) });

export default async function bait() {
  const areas = await api('/api/fish/areas').catch(() => []);
  const tbody = h('tbody');
  const count = h('span', { class: 'muted small' });
  const banner = h('div');
  let rows = [];
  async function load() {
    tbody.replaceChildren(h('tr', {}, h('td', { colspan: 5 }, loading(5))));
    try {
      const d = await api('/api/bait/prefs?limit=2000&q=' + encodeURIComponent(Q) + '&loc=' + encodeURIComponent(LOC));
      rows = d.rows || [];
      banner.replaceChildren(d.rules_enabled === true ? '' : h('div', { style: { marginBottom: '16px' } }, callout('warn', h('span', {}, '「Рыба会挑Наживка」ПравилаСейчас是关闭的，这里的设置暂时不影响钓Рыба。', h('a', { href: '#rules', text: ' 去打开 →' })))));
      draw();
    } catch (e) { tbody.replaceChildren(h('tr', {}, h('td', { colspan: 5 }, empty('Не удалось загрузить', errText(e))))); }
  }
  function draw() {
    const list = rows.filter((r) => FILTER === 'all' || (FILTER === 'rule' && r.has_rule) || (FILTER === 'none' && !r.has_rule) || (FILTER === 'edited' && r.source === 'override'));
    count.textContent = `${list.length} 种Рыба`;
    tbody.replaceChildren(...(list.length ? list.map((r) => h('tr', { style: { cursor: 'pointer' }, onclick: () => editFish(r, load) },
      h('td', {}, h('b', { text: r.name_zh }), h('span', { class: 'sub', text: (r.locs || []).slice(0, 3).join('、') + ((r.locs || []).length > 3 ? ' 等' : '') })),
      h('td', { style: { whiteSpace: 'normal', maxWidth: '460px' } }, r.has_rule
        ? h('div', { class: 'small' }, chipsInline(r.allow), (r.deny || []).length ? h('div', { class: 'muted', text: '不吃：' + r.deny.join('、') }) : null)
        : h('span', { class: 'muted small', text: '没有设置，按实际钓获数据判断' })),
      h('td', {}, r.diet ? (r.lure_ok ? badge('会', 'ok') : badge('不会')) : h('span', { class: 'muted', text: '—' })),
      h('td', {}, layerBar(r.layer, 120)),
      h('td', {}, r.source === 'override' ? (r.enabled ? badge('改过', 'warn') : badge('改过·已停用')) : h('span', { class: 'muted small', text: '默认' }),
        r.rotation && r.rotation.enabled ? badge('轮换中', 'accent') : null))) : [h('tr', {}, h('td', { colspan: 5 }, empty('没有符合条件的Рыба')))]));
  }
  load();
  const locSel = h('select', { class: 'select', style: { width: '180px' }, onchange: (e) => { LOC = e.target.value; load(); } },
    h('option', { value: '', text: '所有水域' }), (Array.isArray(areas) ? areas : []).map((a) => h('option', { value: a.loc, text: a.loc, selected: a.loc === LOC })));
  return h('div', { class: 'page' },
    pageHead('РыбаНаживка偏好', '每种Рыба爱吃什么、不吃什么。点一种Рыба查看和修改。需要在「Правила игры」里打开「Рыба会挑Наживка」才生效。'),
    banner,
    h('div', { class: 'card card-pad' },
      h('div', { class: 'row', style: { marginBottom: '14px' } },
        h('div', { class: 'grow', style: { maxWidth: '320px' } }, searchBox('ПоискРыба名，如 狗Рыба', debounce((v) => { Q = v; load(); }, 300), Q)),
        locSel,
        segmented([['all', 'Все'], ['rule', '已设置'], ['none', '没设置'], ['edited', '我改过的']], FILTER, (v) => { FILTER = v; draw(); }),
        h('span', { class: 'spacer' }), count),
      h('div', { class: 'table-wrap', style: { maxHeight: 'calc(100vh - 260px)' } }, h('table', { class: 'table' },
        h('thead', {}, h('tr', {}, h('th', { text: 'Рыба' }), h('th', { text: '爱吃' }), h('th', { text: '咬拟Наживка' }), h('th', { text: '活动水层' }), h('th', { text: 'Статус' }))), tbody))));
}

function chipsInline(list) {
  const l = list || [];
  if (!l.length) return h('span', { class: 'muted', text: '—' });
  return h('span', { text: l.slice(0, 6).join('、') + (l.length > 6 ? ` 等 ${l.length} 种` : '') });
}
// 水层条：左水面右水底，色块是活动范围，竖线是最爱的深度
function layerBar(layer, width = 200) {
  if (!layer || !(layer[0] || layer[2])) return h('span', { class: 'muted', text: '—' });
  const [lo, best, hi] = layer;
  return h('div', { title: `活动在 ${(lo * 100).toFixed(0)}%–${(hi * 100).toFixed(0)}% 深度，最爱 ${(best * 100).toFixed(0)}%（0 = 水面，100% = 水底）`, style: { position: 'relative', width: width + 'px', height: '10px', borderRadius: '5px', background: 'var(--surface-4)' } },
    h('div', { style: { position: 'absolute', left: Math.max(0, lo * 100) + '%', width: Math.max(2, (Math.min(1, hi) - Math.max(0, lo)) * 100) + '%', top: 0, bottom: 0, borderRadius: '5px', background: 'var(--accent)', opacity: 0.55 } }),
    h('div', { style: { position: 'absolute', left: `calc(${Math.max(0, Math.min(1, best)) * 100}% - 1px)`, top: '-2px', bottom: '-2px', width: '2px', background: '#fff' } }));
}

function editFish(r, reload) {
  const st = {
    allow: [...(r.allow || [])], deny: [...(r.deny || [])], bottom: [...(r.bottom_only || [])],
    groups: (r.groups || []).map((g) => [...g]), sec: r.rotate_sec || 0, mode: r.rotate_mode || 'soft',
    enabled: r.source === 'override' ? !!r.enabled : true, cond: r.condition && r.condition !== '无' ? r.condition : '',
  };
  const snapshot = () => JSON.stringify(st);
  const initial = snapshot();
  const body = h('div');
  const chipList = (arr) => h('div', { class: 'row', style: { gap: '6px' } }, arr.length ? arr.map((v, i) => h('span', { class: 'badge', style: { paddingRight: '4px' } }, v,
    h('button', { type: 'button', 'aria-label': '移除 ' + v, style: { border: 0, background: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '0 2px', display: 'grid' }, onclick: () => { arr.splice(i, 1); draw(); } }, icon('x', 12))))
    : h('span', { class: 'muted small', text: '（空）' }));
  const bucket = (title, help, arr) => h('div', { style: { padding: '12px 0', borderTop: '1px solid var(--line)' } },
    h('div', { class: 'row', style: { justifyContent: 'space-between', marginBottom: '6px' } }, h('div', {}, h('b', { text: title }), help ? h('div', { class: 'muted small', text: help }) : null),
      btn('添加', () => pickBait(title, (name) => { if (!arr.includes(name)) arr.push(name); draw(); }), 'sm', { icon: 'plus' })),
    chipList(arr));
  function draw() {
    const rot = r.rotation || {};
    body.replaceChildren(...[
      h('h3', { style: { fontSize: '14px', margin: '0 0 2px' }, text: '吃什么' }),
      bucket('爱吃', '这些Наживка可以钓到它。', st.allow),
      bucket('不吃', '用这些Наживка钓不到它。', st.deny),
      bucket('底钓时只吃', '底钓时只认这些Наживка。留空表示不限制。', st.bottom),
      h('h3', { style: { fontSize: '14px', margin: '22px 0 2px' }, text: '定时轮换' }),
      h('p', { class: 'muted small', style: { marginBottom: '8px' }, text: '让它在不同时段爱吃不同的Наживка。至少两组、间隔大于 0 才会轮换。' }),
      rot.enabled ? callout('info', `正在轮换：第 ${rot.active + 1}/${rot.total} 组（${(rot.active_baits || []).join('、')}）`) : null,
      ...st.groups.map((g, i) => h('div', { style: { padding: '10px 0', borderTop: '1px solid var(--line)' } },
        h('div', { class: 'row', style: { justifyContent: 'space-between', marginBottom: '6px' } }, h('b', { class: 'small', text: '第 ' + (i + 1) + ' 组' }),
          h('div', { class: 'row' }, btn('添加', () => pickBait('第 ' + (i + 1) + ' 组', (name) => { if (!g.includes(name)) g.push(name); draw(); }), 'sm', { icon: 'plus' }),
            btn('', () => { st.groups.splice(i, 1); draw(); }, 'ghost icon sm', { icon: 'trash', 'aria-label': 'Удалить这一组' }))),
        chipList(g))),
      h('div', { class: 'row', style: { padding: '8px 0' } }, btn('新增一组', () => { if (st.groups.length >= 20) return toast('最多 20 组', 'bad'); st.groups.push([]); draw(); }, 'ghost sm', { icon: 'plus' })),
      h('div', { class: 'form-grid' },
        h('div', { class: 'field' }, h('label', { text: '多久换一组' }), h('div', { class: 'input-wrap has-unit', style: { '--unit-w': '2em' } },
          h('input', { class: 'input num', value: st.sec ? Math.round(st.sec / 60) : 0, oninput: (e) => { st.sec = Math.max(0, Math.round(Number(e.target.value || 0) * 60)); } }), h('span', { class: 'unit', text: '分钟' })), h('div', { class: 'help', text: '0 表示不轮换。' })),
        h('div', { class: 'field' }, h('span', { class: 'label', text: '轮换方式' }), segmented([['soft', '宽松'], ['strict', '严格']], st.mode, (v) => { st.mode = v; }),
          h('div', { class: 'help', text: '宽松：Другое组的Наживка也能钓到，只是少。严格：只认Текущий режим这组。' }))),
      h('h3', { style: { fontSize: '14px', margin: '22px 0 8px' }, text: 'Другое' }),
      h('div', { class: 'field' }, h('label', { text: '前置条件（可选）' }), h('input', { class: 'input', value: st.cond, placeholder: '例如 海图 120 号区域', oninput: (e) => { st.cond = e.target.value.trim(); } })),
      h('div', { style: { marginTop: '12px' } }, toggleEl({ checked: st.enabled, label: '使用我的设置（关闭则用默认Правила）', onChange: (v) => { st.enabled = v; } })),
      habits(r)].filter(Boolean));
  }
  draw();
  const save = async () => {
    try {
      await put('/api/bait/rules', { fish_zh: r.name_zh, allow: st.allow, deny: st.deny, bottom_only: st.bottom, condition: st.cond,
        groups: st.groups.map((g) => g.filter(Boolean)).filter((g) => g.length), rotate_sec: st.sec, rotate_mode: st.mode, enabled: st.enabled });
      toast('已Сохранить，约 30 秒内生效');
      saved = true; d.close(); reload();
    } catch (e) { toast(errText(e), 'bad'); }
  };
  let saved = false;
  const d = drawer({
    title: r.name_zh, sub: r.fish_key, body,
    foot: [r.source === 'override' ? btn('Восстановить значения по умолчанию', async () => {
      if (!(await confirmDialog({ title: `把「${r.name_zh}」Восстановить значения по умолчанию？`, desc: 'Удалить你的设置，回到内置Правила。', confirm: 'Восстановить значения по умолчанию' }))) return;
      try { await api('/api/bait/rules/reset', { method: 'POST', body: JSON.stringify({ fish_zh: r.name_zh }) }); toast('已Восстановить значения по умолчанию'); saved = true; d.close(); reload(); } catch (e) { toast(errText(e), 'bad'); }
    }, 'ghost') : null, h('span', { class: 'spacer' }), btn('Сохранить', save, 'primary')],
    onClose: () => { if (!saved && snapshot() !== initial) toast('修改没有Сохранить', 'bad'); },
  });
}

// 只读：这条Рыба的习性数据，帮助判断该怎么设置
function habits(r) {
  if (!r.diet && !r.layer) return null;
  const bars = DIET.map(([k, label]) => {
    const v = (r.diet && r.diet[k]) || 0, gate = k === 'lure' ? 0.3 : 0.25, likes = v >= gate;
    return h('div', { class: 'row', style: { flexWrap: 'nowrap', fontSize: '12.5px' } },
      h('span', { class: 'muted', style: { width: '52px' }, text: label }),
      h('div', { style: { flex: 1, height: '8px', borderRadius: '4px', background: 'var(--surface-4)', position: 'relative', overflow: 'hidden' } },
        h('div', { style: { position: 'absolute', inset: '0 auto 0 0', width: Math.min(100, v / 2.2 * 100) + '%', background: likes ? 'var(--ok)' : 'var(--faint)', borderRadius: '4px' } })),
      h('span', { class: likes ? '' : 'muted', style: { width: '56px', textAlign: 'right' }, text: likes ? '喜欢' : '一般' }));
  });
  return h('details', { class: 'advanced', style: { marginTop: '22px' } }, h('summary', {}, '这种Рыба的习性 ', h('small', { text: '（参考数据，只读）' })),
    h('div', { class: 'stack', style: { paddingTop: '12px' } },
      h('div', {}, h('div', { class: 'small text-2', style: { marginBottom: '6px' }, text: r.lure_ok ? '会咬拟Наживка。' : '不咬拟Наживка。' }), h('div', { class: 'stack', style: { gap: '5px' } }, bars)),
      h('div', {}, h('div', { class: 'small text-2', style: { marginBottom: '6px' }, text: '活动水层（左边水面，右边水底，白线是最爱的深度）' }), layerBar(r.layer, 320)),
      (r.baits || []).length ? h('div', { class: 'small muted', text: '实际钓获最多的Наживка：' + r.baits.slice(0, 8).map((b) => b.bait_id).join('、') }) : null,
      r.qual_g ? h('div', { class: 'small muted', text: `Зачётная约 ${r.qual_g} g${r.trophy_g ? `，Трофей约 ${r.trophy_g} g` : ''}。` }) : null));
}

// 选Наживка：先选类别，再搜具体的Наживка
let CATS = null;
function pickBait(target, onPick) {
  let cat = 27, sub = 0, q = '';
  const results = h('div', { class: 'card', style: { maxHeight: '380px', overflow: 'auto' } });
  const subSel = h('select', { class: 'select', style: { width: '220px' }, onchange: (e) => { sub = Number(e.target.value); load(); } });
  const input = h('input', { class: 'input', placeholder: 'ПоискНаживка料名称', oninput: debounce((e) => { q = input.value; load(); }, 250) });
  const fillSub = () => {
    const node = (CATS || []).find((c) => c.key === cat);
    subSel.replaceChildren(h('option', { value: 0, text: 'Все' }), ...((node && node.children) || []).map((s) => h('option', { value: s.sub, text: `${s.label}（${s.count}）` })));
    subSel.disabled = cat <= 0;
  };
  async function load() {
    if (cat === -1) {
      results.replaceChildren(h('div', { class: 'list' }, WILDCARD.map(([name, desc]) => h('div', { class: 'list-item clickable', onclick: () => { close(); onPick(name); } }, h('div', { class: 'grow' }, h('div', { class: 'title', text: name }), h('div', { class: 'sub', text: desc }))))));
      return;
    }
    results.replaceChildren(h('div', { style: { padding: '12px' } }, loading(3)));
    try {
      const d = await api(`/api/bait/items?limit=200&cat=${cat}&sub=${sub}&q=${encodeURIComponent(q)}`);
      const rows = d.rows || [];
      results.replaceChildren(rows.length ? h('div', { class: 'list' }, rows.map((x) => h('div', { class: 'list-item clickable', onclick: () => { close(); onPick(x.name_zh || x.item_id); } },
        h('div', { class: 'grow' }, h('div', { class: 'title', text: x.name_zh || x.item_id }), h('div', { class: 'sub mono', text: x.item_id })), h('span', { class: 'muted small', text: x.sub_label || '' })))) : empty('Ничего не найдено'));
    } catch (e) { results.replaceChildren(empty('Не удалось загрузить', errText(e))); }
  }
  const seg = segmented([['27', 'Наживка料'], ['17', '拟Наживка'], ['-1', '一整类']], '27', (v) => { cat = Number(v); sub = 0; input.hidden = cat === -1; subSel.hidden = cat === -1; fillSub(); load(); });
  const { close } = dialog({ title: `添加到「${target}」`, size: 'lg', body: h('div', { class: 'stack' }, h('div', { class: 'row' }, seg, subSel), input, results) });
  (CATS ? Promise.resolve() : api('/api/bait/categories').then((d) => { CATS = d.categories || []; }).catch(() => { CATS = []; })).then(() => { fillSub(); load(); });
}
