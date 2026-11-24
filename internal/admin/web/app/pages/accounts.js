import { h, apiList, post, icon, toast, errText, pageHead, btn, empty, searchBox, debounce, dialog, setPageCleanup } from '../core.js';

export default async function accounts() {
  const listBox = h('div', { class: 'list' }, h('div', { class: 'empty' }, 'Загрузка…'));
  const root = h('div', { class: 'page' },
    pageHead('Аккаунты', 'Редактирование логинов и паролей игровых аккаунтов. Пароли не отображаются — администратор задаёт новый пароль при необходимости.',
      btn('Обновить', () => load(), 'sm', { icon: 'refresh' })),
    h('div', { class: 'card master', style: { maxWidth: '100%', position: 'static', maxHeight: 'none' } },
      h('div', { class: 'row', style: { padding: '12px', borderBottom: '1px solid var(--line)' } },
        h('div', { class: 'grow' }, searchBox('Поиск по логину или UID', debounce((v) => { query = v; load(); }, 250))),
        h('span', { class: 'muted small', text: 'Пароли хранятся только как bcrypt-хеш.' })), listBox));
  let query = '';
  async function load() {
    try {
      const rows = await apiList('/api/accounts?q=' + encodeURIComponent(query));
      listBox.replaceChildren(rows.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
        h('thead', {}, h('tr', {}, h('th', { text: 'Логин' }), h('th', { text: 'UID' }), h('th', { text: 'Создан' }), h('th', {}))),
        h('tbody', {}, rows.map((a) => h('tr', {},
          h('td', {}, h('b', { text: a.username })),
          h('td', { class: 'mono', text: String(a.uid) }),
          h('td', { class: 'muted small', text: a.created_ts ? new Date(Number(a.created_ts) * 1000).toLocaleString('ru-RU', { hour12: false }) : '—' }),
          h('td', { style: { textAlign: 'right' } }, btn('Редактировать', () => editAccount(a), 'sm', { icon: 'edit' }))
        ))))) : empty(query ? 'Аккаунты не найдены' : 'Аккаунтов пока нет', query ? 'Проверьте логин или UID.' : 'После регистрации игрока аккаунт появится здесь.'));
    } catch (e) { listBox.replaceChildren(empty('Ошибка загрузки', errText(e))); }
  }
  const refresh = () => load();
  window.addEventListener('rf4:accounts-refresh', refresh);
  setPageCleanup(() => window.removeEventListener('rf4:accounts-refresh', refresh));
  await load();
  return root;
}

function editAccount(a) {
  const username = h('input', { class: 'input', value: a.username, autocomplete: 'username' });
  const password = h('input', { class: 'input', type: 'password', placeholder: 'Оставьте пустым, чтобы не менять', autocomplete: 'new-password' });
  const password2 = h('input', { class: 'input', type: 'password', placeholder: 'Повторите новый пароль', autocomplete: 'new-password' });
  const error = h('div', { class: 'callout bad', hidden: true });
  dialog({
    title: 'Редактировать аккаунт',
    desc: `UID ${a.uid} · старый пароль увидеть нельзя`,
    size: 'lg',
    body: h('div', { class: 'stack' }, error,
      h('div', { class: 'callout info' }, icon('info'), h('div', { class: 'grow' }, 'Изменение пароля заменяет текущий пароль. Сам пароль сервер никогда не возвращает и не показывает.')),
      h('div', { class: 'form-grid' },
        h('div', { class: 'field' }, h('label', { text: 'Логин' }), username),
        h('div', { class: 'field' }, h('label', { text: 'UID' }), h('input', { class: 'input', value: String(a.uid), disabled: true })),
        h('div', { class: 'field' }, h('label', { text: 'Новый пароль' }), password),
        h('div', { class: 'field' }, h('label', { text: 'Повтор нового пароля' }), password2)),
      h('div', { class: 'help', text: 'Логин: 3–32 латинских символа, цифры, _ или -. Пароль: 8–128 символов.' })),
    actions: [
      { label: 'Отмена', kind: 'ghost' },
      { label: 'Сохранить', kind: 'primary', onClick: async () => {
        error.hidden = true;
        const u = username.value.trim(), p = password.value;
        if (!/^[A-Za-z0-9_-]{3,32}$/.test(u)) { error.hidden = false; error.textContent = 'Некорректный логин.'; return true; }
        if (p && (p.length < 8 || p.length > 128)) { error.hidden = false; error.textContent = 'Новый пароль должен содержать 8–128 символов.'; return true; }
        if (p !== password2.value) { error.hidden = false; error.textContent = 'Пароли не совпадают.'; return true; }
        await post('/api/accounts/update', { uid: a.uid, username: u, password: p });
        toast(p ? 'Логин и пароль сохранены.' : 'Логин сохранён.');
        window.dispatchEvent(new CustomEvent('rf4:accounts-refresh'));
      } }
    ],
    onClose: () => {}
  });
}

window.addEventListener('rf4:accounts-refresh', () => {
  // Небольшая задержка даёт модальному окну завершить сохранение перед перерисовкой.
  const event = new CustomEvent('rf4:route');
  document.dispatchEvent(event);
});