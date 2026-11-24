// Написать письмо：选人 → 写Содержание → 加Вложения → Отправить。右边实时ПредпросмотрИгроки看到的样子。
import { h, api, apiList, post, toast, errText, pageHead, section, btn, empty, debounce, searchBox, icon, badge, setLeaveGuard, confirmDialog } from '../core.js';
import { itemIcon, pickItem } from '../widgets.js';

const TEMPLATES = [
  ['Компенсация', '服务器Компенсация', '因为最近服务器的问题给你带来了不便，特此Компенсация，请查收Вложения。'],
  ['Награда за событие', 'Награда за событие', 'Спасибо за участие в событии! Награда приложена к письму.'],
  ['Приветствие', 'Приветствие来钓Рыба', 'Приветствие来到我们的服务器！祝你钓到大Рыба。'],
];

export default async function mail(params) {
  let to = null;
  const attach = [];
  if (params[0]) {
    try { const p = await api('/api/players/detail?uid=' + encodeURIComponent(params[0])); to = { uid: p.uid, name: p.name, level: p.level }; } catch (e) {}
  }
  const text = h('textarea', { class: 'textarea', rows: 9, placeholder: '写给Игроки的话。可以只发Вложения、不写Содержание。', oninput: () => preview() });
  setLeaveGuard(() => !!(text.value.trim() || attach.length));

  // 收件人
  const toBox = h('div');
  const drawTo = () => {
    if (to) {
      toBox.replaceChildren(h('div', { class: 'row card', style: { padding: '10px 12px', background: 'var(--surface-2)' } },
        h('div', { class: 'avatar', text: (to.name || '?').slice(0, 1) }),
        h('div', { class: 'grow' }, h('b', { text: to.name }), h('div', { class: 'muted small', text: `UID ${to.uid}` + (to.level ? ` · ${to.level} ур.` : '') })),
        btn('Выбрать другого', () => { to = null; drawTo(); preview(); }, 'ghost sm')));
      return;
    }
    const results = h('div', { class: 'card', hidden: true, style: { marginTop: '6px', maxHeight: '240px', overflow: 'auto' } });
    const search = searchBox('输入ИгрокиИмя персонажа或 UID', debounce(async (q) => {
      if (!q.trim()) { results.hidden = true; return; }
      const list = await apiList('/api/players?q=' + encodeURIComponent(q.trim())).catch(() => []);
      results.hidden = false;
      results.replaceChildren(list.length ? h('div', { class: 'list' }, list.slice(0, 20).map((p) => h('div', {
        class: 'list-item clickable', onclick: () => { to = { uid: p.uid, name: p.name, level: p.level }; drawTo(); preview(); },
      }, h('div', { class: 'avatar', text: (p.name || '?').slice(0, 1) }), h('div', { class: 'grow' }, h('div', { class: 'title', text: p.name }), h('div', { class: 'sub', text: `UID ${p.uid} · ${p.level} ур.` })), p.online ? badge('В сети', 'ok', true) : null))) : empty('Ничего не найдено'));
    }, 250));
    toBox.replaceChildren(search, results);
  };
  drawTo();

  // Вложения
  const attachBox = h('div');
  const drawAttach = () => {
    attachBox.replaceChildren(attach.length ? h('div', { class: 'card' }, h('div', { class: 'list' }, attach.map((a, i) => h('div', { class: 'list-item' },
      itemIcon(a.item_id), h('div', { class: 'grow' }, h('div', { class: 'title', text: a.name }), h('div', { class: 'sub mono', text: a.item_id })),
      h('label', { class: 'row small muted' }, 'Количество', h('input', { class: 'input num', style: { width: '80px', height: '30px' }, value: a.qty, oninput: (e) => { a.qty = Math.max(1, Math.floor(+e.target.value || 1)); preview(); } })),
      btn('', () => { attach.splice(i, 1); drawAttach(); preview(); }, 'ghost icon sm', { icon: 'x', 'aria-label': '移除' }))))) : h('div', { class: 'muted small', text: '没有Вложения。' }));
  };
  drawAttach();

  // Предпросмотр
  const pv = h('div');
  function preview() {
    const lines = text.value.trim();
    pv.replaceChildren(h('div', { class: 'card', style: { padding: '18px', background: 'var(--surface-2)' } },
      h('div', { class: 'muted small', text: 'Получатель:' + (to ? `${to.name}（UID ${to.uid}）` : 'Не выбран') }),
      h('div', { style: { margin: '12px 0', whiteSpace: 'pre-wrap', minHeight: '60px', color: lines ? 'var(--text)' : 'var(--faint)' }, text: lines || '(без текста)' }),
      attach.length ? h('div', { class: 'row', style: { gap: '10px', borderTop: '1px solid var(--line)', paddingTop: '12px' } }, attach.map((a) => h('div', { class: 'row', style: { gap: '6px' } }, itemIcon(a.item_id, 28), h('span', { class: 'small', text: `${a.name} ×${a.qty}` })))) : null));
  }
  preview();

  const send = btn('Отправить', async () => {
    if (!to) { toast('Сначала выберите получателя', 'bad'); return; }
    if (!text.value.trim() && !attach.length) { toast('Нельзя отправить пустое письмо без текста и вложений', 'bad'); return; }
    if (!(await confirmDialog({ title: `发给「${to.name}」？`, desc: attach.length ? `附带 ${attach.length} 种Предмет。Отправленное письмо нельзя отозвать.` : 'Отправленное письмо нельзя отозвать.', confirm: 'Отправить' }))) return;
    send.disabled = true;
    try {
      await post('/api/mail/send', { uid: to.uid, text: text.value.trim(), items: attach.map((a) => ({ item_id: a.item_id, qty: a.qty })) });
      toast('已Отправить，约 2 秒内送达');
      text.value = ''; attach.length = 0; drawAttach(); preview();
    } catch (e) { toast('Отправить失败：' + errText(e), 'bad'); }
    finally { send.disabled = false; }
  }, 'primary lg', { icon: 'mail' });

  return h('div', { class: 'page' },
    pageHead('Написать письмо', '给一个Игроки发消息，可以附带Предмет。Игроки在游戏的Почта里领取。'),
    h('div', { class: 'grid-2', style: { gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', alignItems: 'start' } },
      h('div', {},
        section({ title: 'Кому', body: toBox }),
        section({
          title: 'Текст письма',
          actions: h('div', { class: 'row' }, h('span', { class: 'muted small', text: 'Шаблон' }), TEMPLATES.map(([label, title, body]) => btn(label, () => { text.value = title + '\n\n' + body; preview(); }, 'ghost sm'))),
          body: text,
        }),
        section({ title: 'Вложения', desc: 'Предмет会和邮件一起送达，Игроки领取后进Инвентарь。', actions: btn('添加Предмет', () => pickItem({ title: '添加Вложения', onPick: (x) => { if (!attach.some((a) => a.item_id === x.item_id)) attach.push({ ...x, qty: 1 }); drawAttach(); preview(); } }), 'sm', { icon: 'plus' }), body: attachBox })),
      h('div', { style: { position: 'sticky', top: '20px' } },
        section({ title: 'Предпросмотр', desc: 'Игроки收到的Содержание。', body: pv }),
        h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, send))));
}
