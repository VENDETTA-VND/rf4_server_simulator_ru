// 后端动作代码 → 管理员看得懂的中文。
export const AUDIT_LABELS = {
  login: 'Вход в панель', tunable: 'Изменение параметров', player_update: '修改Персонаж', grant_item: '发放Предмет', item_delete: 'УдалитьПредмет',
  keepnet_add: 'ДобавитьСадок', keepnet_delete: '移出Садок', mail_send: 'Отправить邮件', mail_delete: 'Удалить邮件',
  skill_points: '修改Навыки点', skill_proficiency: '修改Навыки熟练度', kick: 'Отключение игрока', ban: 'Блокировка игрока',
  shop_override: 'Изменение товара', shop_override_reset: 'Сброс товара', fish_config: '修改水域Рыба种', fish_config_reset: 'Сброс настроек водоёма',
  fish_zone_save: 'СохранитьРыба群区域', fish_zone_delete: 'УдалитьРыба群区域', bite_mode: 'ПереключитьСтиль игры', spawn_mode: 'Переключить出Рыба方式',
  hook_profile: '调整Рыба钩', bait_rule_save: '修改РыбаНаживка偏好', bait_rule_reset: 'РыбаНаживка偏好Восстановить значения по умолчанию', skill_gain_mode: 'ПереключитьНавыки升ур.概率',
};
export const auditLabel = (a) => AUDIT_LABELS[a] || a || '—';
