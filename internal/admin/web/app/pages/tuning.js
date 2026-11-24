// Настройка параметров：所有可调数字按主题分组。开关类玩法在「Правила игры」页。
import { h, api, post, toast, errText, pageHead, section, callout, badge, btn, Form, savebar, setLeaveGuard, replaceHash, render, confirmDialog, segmented, empty, icon } from '../core.js';
import { itemIcon, pickItem } from '../widgets.js';

// [key, 标签, 说明, 默认值, Тип, 单位, 最小, 最大]
const G = {
  bite: {
    title: 'Поклёвка', desc: 'Как часто рыба клюёт.',
    main: [
      ['bite_probability', 'Вероятность поклёвки при каждом забросе', '1 — поклёвка при каждом забросе; 0,5 — половина забросов будет без поклёвки.', 1, 'float', '', 0, 1],
      ['bite_delay_scale', 'Скорость поклёвки', 'Общее ускорение или замедление. 0,5 — вдвое быстрее, 2 — вдвое медленнее.', 1, 'float', '×'],
      ['bite_delay_max', 'Максимальное ожидание', 'За это время гарантированно произойдёт поклёвка (кроме спиннинга).При включённом правиле «Скорость клёва зависит от наживки» параметр не действует: для донной и поплавочной ловли диапазон ожидания задаётся ниже для подходящей и неподходящей наживки, а для морской ловли — в дополнительных настройках.', 20, 'float', 'сек.'],
      ['bite_delay_lure_max', 'спиннинговой ловлиМаксимальное ожидание', 'Максимальное время ожидания при спиннинговой ловле. При включённом правиле ограничивает только подходящую наживку и правильную проводку. Для частично и неподходящей наживки используются диапазоны ниже.', 6, 'float', 'сек.'],
      ['pace_good_min', 'подходящая наживкаМинимальное время ожидания（Скорость клёва зависит от наживки）', '对口Наживка的等待区间下限сек.。需在「Правила игры」里开启「Скорость клёва зависит от наживки」。', 6, 'float', 'сек.', 0, 600],
      ['pace_good_max', 'подходящая наживкаМаксимальное время ожидания（Скорость клёва зависит от наживки）', '对口Наживка的等待区间上限сек.；подходящая наживка在 下限~上限 сек.内随机来Рыба。', 60, 'float', 'сек.', 0, 600],
      ['pace_bad_min', 'неподходящая наживкаМинимальное время ожидания（Скорость клёва зависит от наживки）', '不对口Наживка的等待区间下限сек.。', 20, 'float', 'сек.', 0, 600],
      ['pace_bad_max', 'неподходящая наживкаМаксимальное время ожидания（Скорость клёва зависит от наживки）', '不对口Наживка的等待区间上限сек.；неподходящая наживка同时受低Вероятность поклёвки（见Дополнительно）压制，表现为偶发慢口。', 60, 'float', 'сек.', 0, 600],
      ['pace_lure_min', 'спиннинговой ловли好档Минимальное время ожидания（Скорость клёва зависит от наживки）', 'Наживка与动作都对口时спиннинговой ловлициклов的Минимальное время ожиданиясек.。默认 1.5 对齐原版收线短窗，拉大可能导致Рыба在收线之后才到，一般别动。', 1.5, 'float', 'сек.', 0, 600],
      ['pace_lure_max', 'спиннинговой ловли好档Максимальное время ожидания（Скорость клёва зависит от наживки）', 'Наживка与动作都对口时спиннинговой ловлициклов的Максимальное время ожиданиясек.；好档在此区间内必来Рыба（Вероятность поклёвки见Дополнительно）。', 6, 'float', 'сек.', 0, 600],
      ['pace_lure_mid_min', 'спиннинговой ловли中档Минимальное время ожидания（Скорость клёва зависит от наживки）', 'Наживка或动作一般时спиннинговой ловлициклов的Минимальное время ожиданиясек.，默认与底钓частично подходящая наживка同区间；动作变好会立即重排进好档短窗。', 10, 'float', 'сек.', 0, 600],
      ['pace_lure_mid_max', 'спиннинговой ловли中档Максимальное время ожидания（Скорость клёва зависит от наживки）', 'Наживка或动作一般时спиннинговой ловлициклов的Максимальное время ожиданиясек.，不受上面「спиннинговой ловлиМаксимальное ожидание」约束。', 60, 'float', 'сек.', 0, 600],
      ['pace_lure_bad_min', 'спиннинговой ловли差档Минимальное время ожидания（Скорость клёва зависит от наживки）', 'неподходящая наживка或明显不对口的动作下спиннинговой ловлициклов的Минимальное время ожиданиясек.，默认与底钓неподходящая наживка同区间。', 20, 'float', 'сек.', 0, 600],
      ['pace_lure_bad_max', 'спиннинговой ловли差档Максимальное время ожидания（Скорость клёва зависит от наживки）', 'неподходящая наживка或明显不对口的动作下спиннинговой ловлициклов的Максимальное время ожиданиясек.，不受「спиннинговой ловлиМаксимальное ожидание」约束。', 60, 'float', 'сек.', 0, 600],
    ],
    adv: [
      ['bite_delay_fixed', 'Фиксированное время до поклёвки', '0 — случайное время; при заданном значении поклёвка будет происходить через указанный интервал.', 0, 'float', 'сек.'],
      ['bite_empty_retry_scale', 'Задержка повторной попытки без поклёвки', 'Множитель времени ожидания следующего цикла, если в текущем цикле подходящая рыба не найдена. 0,25 — быстрая повторная попытка.', 1, 'float', '×'],
      ['bite_gate_pity_rounds', 'Гарантия поклёвки после пустых забросов', 'После указанного числа пустых циклов условия ослабляются, чтобы гарантировать поклёвку. 0 — выключено.', 0, 'int', 'циклов'],
      ['pace_score_good', 'Порог подходящей наживки (зависимость клёва от наживки)', 'Наживка считается подходящей, если её оценка соответствия этому водоёму достигает указанного значения.', 0.75, 'float', '', 0, 1],
      ['pace_score_mid', 'частично Порог подходящей наживки (зависимость клёва от наживки)', 'При достижении этого значения наживка считается частично подходящей, ниже — неподходящей. Для наживки без данных используется оценка 0,30.', 0.45, 'float', '', 0, 1],
      ['pace_mid_min', 'частично подходящая наживкаМинимальное время ожидания（Скорость клёва зависит от наживки）', 'Минимальное время ожидания для частично подходящей наживки, в секундах.', 10, 'float', 'сек.', 0, 600],
      ['pace_mid_max', 'частично подходящая наживкаМаксимальное время ожидания（Скорость клёва зависит от наживки）', 'Максимальное время ожидания для частично подходящей наживки, в секундах.', 60, 'float', 'сек.', 0, 600],
      ['pace_factor_mid', 'частично подходящая наживка分布乘数（Скорость клёва зависит от наживки）', '在区间内微调частично подходящая наживка等待分布的×数，1.6 把样本整体拉慢 60%。一般不用动，直接改上面的等待区间即可。', 1.6, 'float', '×'],
      ['pace_factor_bad', 'неподходящая наживка分布乘数（Скорость клёва зависит от наживки）', '在区间内微调неподходящая наживка等待分布的×数。一般不用动。', 3, 'float', '×'],
      ['pace_prob_good', 'подходящая наживкаВероятность поклёвки·底钓（Скорость клёва зависит от наживки）', 'донной/поплавочной ловлиВероятность поклёвки в каждом цикле，1 表示подходящая наживка每циклов必有口。', 1, 'float', '', 0, 1],
      ['pace_prob_mid', 'частично подходящая наживкаВероятность поклёвки·底钓（Скорость клёва зависит от наживки）', '', 0.5, 'float', '', 0, 1],
      ['pace_prob_bad', 'неподходящая наживкаВероятность поклёвки·底钓（Скорость клёва зависит от наживки）', '0.12 表示неподходящая наживка大部分циклов次空等，一分钟内大概率无口。', 0.12, 'float', '', 0, 1],
      ['pace_lure_prob_good', '好档Вероятность поклёвки·спиннинговой ловли（Скорость клёва зависит от наживки）', 'Наживка与动作都对口时Вероятность поклёвки в каждом цикле，1 表示好档窗口（1.5~6 сек.）内必来Рыба。', 1, 'float', '', 0, 1],
      ['pace_lure_prob_mid', '中档Вероятность поклёвки·спиннинговой ловли（Скорость клёва зависит от наживки）', '', 0.5, 'float', '', 0, 1],
      ['pace_lure_prob_bad', '差档Вероятность поклёвки·спиннинговой ловли（Скорость клёва зависит от наживки）', '0.12 表示差档大部分циклов次空等，表现与底钓неподходящая наживка一致。', 0.12, 'float', '', 0, 1],
      ['pace_marine_min', 'морской ловлиМинимальное время ожидания·pace', '海底钓族（非спиннинговой ловли）在 pace 模式下的Минимальное время ожиданиясек.；морской ловли窗不分Категория。', 3, 'float', 'сек.', 0, 600],
      ['pace_marine_max', 'морской ловлиМаксимальное время ожидания·pace', '海底钓族（非спиннинговой ловли）在 pace 模式下的Максимальное время ожиданиясек.。', 30, 'float', 'сек.', 0, 600],
      ['pace_groundbait_floor', 'Минимум ожидания после прикормки', '满窝时底层杆等待压向这个сек.数；死窝不加速，спиннинговой ловли豁免。', 3, 'float', 'сек.', 0, 600],
      ['pace_groundbait_gain', 'Сила сокращения ожидания от прикормки', 'Чем выше значение, тем сильнее сокращается ожидание. Коэффициент зависит от силы настройки, состояния прикормки и вероятности перекорма.', 0.62, 'float', '', 0, 1],
      ['pace_groundbait_min_factor', 'Нижний предел сокращения ожидания', 'При полной прикормке ожидание может сократиться до указанной доли исходного времени. 0,35 означает 35%.', 0.35, 'float', '', 0, 1],
    ],
  },
  bait: {
    title: 'Наживка и соответствие предпочтениям рыбы', desc: 'Привлекательность наживки для рыбы и параметры правила соответствия наживки.',
    main: [
      ['bait_pref_scale', 'Влияние наживки', '0 — рыба полностью игнорирует наживку; 1 — стандартное влияние.', 1, 'float', '×'],
      ['bait_pref_weight_shift', 'подходящая наживка钓大Рыба', 'Чем выше значение, тем сильнее подходящая наживка привлекает крупную рыбу.', 1, 'float', '×'],
    ],
    adv: [
      ['bite_gate_lure_diet_min', 'Порог для искусственной приманки', 'Если склонность рыбы атаковать искусственные приманки ниже этого значения, она не будет на них клевать. Требуется включить правило «Наживка должна соответствовать предпочтениям».', 0.3, 'float', '', 0, 1],
      ['bite_gate_diet_min', 'Порог для натуральной наживки', 'Натуральная наживка считается предпочитаемой, если оценка предпочтения рыбы достигает этого значения. Требуется включить правило соответствия наживки.', 0.25, 'float', '', 0, 1],
      ['bite_gate_diet_floor', '勉强吃的概率', 'Во сколько раз снижается вероятность поклёвки, если есть только одно подтверждение того, что рыба ест эту наживку.', 0.05, 'float', '', 0, 1],
      ['bite_gate_layer_floor', '钓层不对时的概率', 'Во сколько раз снижается вероятность поклёвки, если наживка находится вне привычного для рыбы горизонта. 0 означает отсутствие поклёвок.', 0.01, 'float', '', 0, 1],
    ],
  },
  fish: {
    title: 'Рыба', desc: 'Размер рыбы и сложность вываживания.',
    main: [
      ['fish_weight_scale', 'Вес рыбы', 'Общий множитель веса рыбы на всех водоёмах. 2 означает удвоение веса.', 1, 'float', '×'],
      ['fight_power_scale', 'Сила сопротивления рыбы', 'Чем ниже значение, тем легче вываживать рыбу и тем меньше риск обрыва лески. 1 — исходное значение.', 1, 'float', '×'],
      ['fish_weight_cap', 'Ограничить вес рыбы нагрузкой снастей', 'Если включено, вес рыбы не будет превышать допустимую нагрузку снастей.', 0, 'bool'],
    ],
    adv: [
      ['fish_pull_ln_slope', 'Дополнительная сила тяги крупной рыбы', 'Чем больше вес рыбы, тем быстрее растёт сила её сопротивления. Ориентир по официальным данным — 0,3–0,4.', 0.35, 'float'],
      ['fish_pull_fallback_k', 'Сила тяги для неизученных видов рыб', 'Базовая сила тяги на каждый килограмм веса для видов рыб без измеренных данных.', 17.5, 'float', 'N/kg'],
      ['fish_initial_stamina_ratio', 'Выносливость неизученных видов рыб', 'Чем выше значение, тем медленнее рыба устаёт. Влияет только на пресноводные виды без измеренных данных.', 0.5628, 'float', '', 0, 1],
    ],
  },
  wear: {
    title: 'Износ снастей', desc: '搏Рыба时渔线циклов、Рыба竿和前导的损耗速度。默认值对齐官服实测，一般不需要改。',
    main: [
      ['electric_locked_multiplier', '电动циклов锁циклов力量', '电动циклов锁циклов时能承受的力量×数。', 3, 'float', '×'],
      ['electric_motor_kg_per_power', 'Коэффициент мощности электродвигателя', 'Сколько килограммов нагрузки соответствует одной единице мощности двигателя.', 1, 'float'],
    ],
    adv: [
      ['reel_slip_wear', 'Износ фрикциона при проскальзывании', 'Коэффициент износа фрикционных дисков, когда рыба тянет сильнее установленного усилия и леска проскальзывает.', 0.0001, 'float', '', 1e-12, 1],
      ['reel_slip_calibration_seconds', 'Расчёт износа при проскальзывании', 'Чем выше значение, тем меньше износ за одинаковое время проскальзывания. Значение 41,7 соответствует официальной игре.', 41.7, 'float', 'сек.', 0.01, 3600],
      ['reel_slip_deadband_ratio', 'Порог определения проскальзывания', '拉力不超过泄力的这个×数时，不算打滑。', 1.05, 'float', '×', 1, 10],
      ['wear_stress_oil_per_s', 'Смазка', '每сек.受力扣多少寿命。0 表示不磨损。', 0.0004, 'float', '%/сек.', 0, 0.01],
      ['wear_stress_gear_per_s', '主齿циклов', '', 0.0004, 'float', '%/сек.', 0, 0.01],
      ['wear_stress_bearing_per_s', 'Подшипник', '', 0.00012, 'float', '%/сек.', 0, 0.01],
      ['wear_stress_spool_per_s', 'Шпуля', '', 0.00012, 'float', '%/сек.', 0, 0.01],
      ['wear_stress_guides_per_s', 'Пропускные кольца', '', 0.0004, 'float', '%/сек.', 0, 0.01],
      ['wear_stress_rodblank_per_s', 'Бланк удилища', '', 0.00003, 'float', '%/сек.', 0, 0.01],
      ['wear_leader_per_stress_sec', 'Поводок', '', 0.00005, 'float', '%/сек.', 0, 0.01],
      ['reel_load_tick_seconds', 'Начальный интервал учёта нагрузки', '第一次受力上报没有上一次Время时，按这个сек.数计算。', 1.9, 'float', 'сек.', 0.01, 600],
      ['reel_load_max_tick_seconds', 'Максимальный интервал учёта нагрузки', '两次受力上报之间最多算多少сек.，防止延迟上报一次扣太多。', 5, 'float', 'сек.', 0.01, 600],
    ],
  },
  reward: {
    title: 'Опыт и награды', desc: 'Опыт, выпадение предметов, наборы и развитие навыков.',
    main: [
      ['xp_gain', '经验×率', '1.5 表示多拿 50% 经验。', 1, 'float', '×'],
      ['release_xp_ratio', 'Опыт за отпускание рыбы', 'Доля опыта за отпускание рыбы относительно опыта за помещение её в садок. 0,5 — половина.', 0.5, 'float', '', 0, 1],
    ],
    groups: [
      ['Карточки за пойманную рыбу', 'Проверка выпадения карточки выполняется после каждого пойманного экземпляра.', [
        ['card_drop_normal', 'Обычная рыба', '0.001 表示 0.1%。', 0.001, 'float', '', 0, 1],
        ['card_drop_star', 'ТрофейнаяРыба', '', 0.5, 'float', '', 0, 1],
        ['card_drop_blue', 'Голубая коронаРыба', '', 0.8, 'float', '', 0, 1],
        ['card_drop_rare_scale', 'Множитель выпадения для редкой рыбы', 'Вероятность выпадения карточки для редкой и очень редкой рыбы дополнительно умножается на этот коэффициент.', 0.25, 'float', '', 0, 1],
      ]],
      ['Наборы за пойманную рыбу', 'При поимке рыбы с заданной вероятностью выдаётся набор. Награды сразу попадают в инвентарь.', [
        ['loot_box_enabled', 'Включить наборы за рыбалку', '', 0, 'bool'],
        ['loot_box_chance', '开礼包的概率', 'Вероятность получить набор за каждую пойманную рыбу. 0,05 означает 5%.', 0.05, 'float', '', 0, 1],
        ['loot_box_trophy_guarantee', 'Гарантированный набор за трофей', 'При поимке трофейной рыбы или рыбы с голубой короной набор выдаётся гарантированно.', 1, 'bool'],
      ]],
    ],
  },
  chat: {
    title: 'Уведомления в чате', desc: 'Сообщения, отображаемые в чате во время рыбалки.',
    main: [
      ['fish_escape_taunt', 'Шутливое сообщение при сходе рыбы', 'Если выключено, отображается стандартное сообщение игры «Рыба сорвалась».', 1, 'bool'],
      ['fish_hooked_chat', 'Показывать вид и вес рыбы при поклёвке', 'При подсечке только игроку показываются номер удилища, вид и вес рыбы.', 0, 'bool'],
    ],
  },
};
const CATS = [['bite', 'Поклёвка'], ['bait', 'Наживка и соответствие предпочтениям рыбы'], ['fish', 'Рыба'], ['wear', 'Износ снастей'], ['reward', 'Опыт и награды'], ['chat', 'Уведомления в чате'], ['event', 'Временные события']];
const SKILL_GAIN_KEYS = [
  ['skill_gain_pct_1', 'Поплавочная ловля', 'Навык поплавочной ловли на маховые и болонские удилища.'],
  ['skill_gain_pct_2', 'Спиннинговая ловля', 'Навык спиннинговой ловли на безынерционные и мультипликаторные снасти.'],
  ['skill_gain_pct_3', '底钓', 'Навык донной ловли фидерными и карповыми удилищами.'],
  ['skill_gain_pct_11', 'Морская ловля', 'Навык морской ловли с лодки и других морских снастей.'],
  ['skill_gain_pct_4', 'Изготовление наживки', 'Общий навык сбора и изготовления натуральной наживки.'],
  ['skill_gain_pct_5', 'Приготовление прикормки', 'Навык смешивания прикормки и приготовления прикормочных смесей.'],
  ['skill_gain_pct_6', 'Кулинария', 'Кулинария制作熟练度。'],
  ['skill_gain_pct_8', 'Изготовление искусственных приманок', 'Навык изготовления искусственных приманок для спиннинговой ловли.'],
];
const SKILL_GAIN_MODES = [['native', 'Стандартная вероятность'], ['fixed100', '100%'], ['custom', 'Настраиваемая']];
let CAT = 'bite';

function skillGainModeOf(t) {
  const saved = String(t.skill_gain_mode ?? '');
  if (SKILL_GAIN_MODES.some(([mode]) => mode === saved)) return saved;
  const values = SKILL_GAIN_KEYS.map(([key]) => Number(t[key] ?? 0) || 0);
  if (values.every((v) => v === 0)) return 'native';
  if (values.every((v) => v === 100)) return 'fixed100';
  return 'custom';
}

function skillGainSection(form, t, val) {
  const mode = skillGainModeOf(t);
  const pick = async (next) => {
    if (next === mode) return;
    if (form.isDirty() && !(await confirmDialog({ title: 'Есть несохранённые изменения', desc: 'Переключение режима вероятности роста навыков отменит несохранённые изменения.', confirm: 'Отменить изменения и перейти' }))) return;
    try {
      await post('/api/skill_gain_mode', { mode: next });
      toast('Вероятность роста навыков已Переключить，约 30 сек.内生效');
      render();
    } catch (e) { toast(errText(e), 'bad'); }
  };
  const buttons = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Режим вероятности роста навыков' }, SKILL_GAIN_MODES.map(([key, label]) => h('button', {
    type: 'button', role: 'radio', 'aria-checked': String(key === mode), class: key === mode ? 'on' : '', onclick: () => pick(key),
  }, label)));
  const fields = mode === 'custom' ? h('div', { class: 'stack', style: { marginTop: '14px' } }, SKILL_GAIN_KEYS.map(([key, label, help]) =>
    form.row({ key, label, help, kind: 'float', min: 0, max: 100, unit: '%', def: 0 }, val(key, 0)))) : null;
  return section({
    title: 'Вероятность роста навыков', desc: '一键ПереключитьВсеНавыки：Стандартная вероятность、Все100%，或逐项Настраиваемая。0=原版公式，100=必定增长。',
    actions: buttons,
    body: h('div', {}, h('p', { class: 'muted small', text: '100%模式会让每次符合条件的钓获、挖Наживка或制作都获得熟练度；固定百分比模式不叠加Счастливые часы对Стандартная вероятность的修正。' }), fields),
  });
}

export default async function tuning(params) {
  if (params[0] && CATS.some(([k]) => k === params[0])) CAT = params[0];
  const t = await api('/api/tunables');
  const val = (k, d) => (t[k] === undefined || t[k] === '' ? String(d) : t[k]);
  const form = new Form();
  savebar(form, {
    onSave: async (values) => {
      for (const [key, value] of Object.entries(values)) await post('/api/tunables', { key, value: String(value) });
      toast(CAT === 'event' ? 'Сохранено. Чтобы увидеть изменения, игрокам нужно полностью выйти из игры и войти снова.' : '已Сохранить，约 30 сек.内生效');
      render();
    },
  });
  setLeaveGuard(() => form.isDirty());
  const spec = ([key, label, help, def, kind, unit, min, max]) => ({ key, label, help, def: kind === 'bool' ? String(def) : def, kind, unit, min, max });
  const rows = (list) => list.map((d) => form.row(spec(d), val(d[0], d[3])));
  const sub = h('nav', { class: 'subnav' }, CATS.map(([k, l]) => h('button', {
    type: 'button', class: k === CAT ? 'on' : '',
    onclick: async () => {
      if (k === CAT) return;
      if (form.isDirty() && !(await confirmDialog({ title: 'Есть несохранённые изменения', desc: 'Переключить分类会放弃这些修改。', confirm: 'Отменить изменения и перейти' }))) return;
      CAT = k; replaceHash('#tuning/' + k); render();
    },
  }, l)));

  // Скорость клёва зависит от наживки未开启时不渲染 pace_* 行：这些参数只在开关打开后才参与计算，
  // 关闭时Все走 legacy/中性通路。
  const paceOn = String(t.bite_pace_enabled ?? '0') === '1';
  const paceVisible = (d) => paceOn || !d[0].startsWith('pace_');
  let body;
  if (CAT === 'event') body = eventView(form, t, val);
  else {
    const g = G[CAT];
    const advRows = (g.adv || []).filter(paceVisible);
    body = h('div', {},
      section({
        title: g.title, desc: g.desc,
        body: h('div', {},
          rows(g.main.filter(paceVisible)),
          CAT === 'bite' && !paceOn ? h('p', { class: 'muted small', text: 'Правило «Скорость клёва зависит от наживки» выключено (переключатель находится в разделе «Правила игры → Другое»). При включении здесь появятся настройки времени ожидания для разных типов наживки и спиннинга. Пока правило выключено, эти параметры не используются.' }) : null,
          advRows.length ? h('details', { class: 'advanced' }, h('summary', {}, 'Дополнительно ', h('small', { text: `(${advRows.length} параметров, обычно менять не требуется)` })), h('div', {}, rows(advRows))) : null),
      }),
      (g.groups || []).map(([title, desc, list]) => section({ title, desc, body: h('div', {}, rows(list)) })),
      CAT === 'reward' ? skillGainSection(form, t, val) : null);
  }
  return h('div', { class: 'page' },
    pageHead('Настройка параметров', 'Настройка механики рыбалки, опыта и наград. Для каждого параметра указано значение по умолчанию, чтобы его можно было восстановить.'),
    h('div', { class: 'subnav-layout' }, sub, body));
}

// ---------- Временные события ----------
const BRANCHES = [
  ['2024 新年', [[9, 'MMXXIV'], [10, 'MMXXIV EXTRA']]], ['7 周年', [[11, 'VII'], [12, 'VII EXTRA']]],
  ['2025 新年', [[13, 'MMXXV'], [14, '2025 EXTRA']]], ['8 周年', [[15, 'VIII'], [16, 'VIII EXTRA']]],
  ['2026 新年', [[17, 'MMXXVI'], [18, '2026 特别奖']]], ['9 周年', [[19, 'IX'], [20, 'IX EXTRA']]],
];
const BRANCH_NAME = Object.fromEntries(BRANCHES.flatMap(([y, list]) => list.map(([id, n]) => [id, y + ' · ' + n])));
const DEFAULT_BRANCHES = '9,10,11,12,13,14,15,16,17,18,19,20';
const stageCount = (b) => ([14, 18].includes(Number(b)) ? 10 : 7);

function eventView(form, t, val) {
  const ny = val('event_newyear_enabled', 1) === '1', an = val('event_anniversary_enabled', 0) === '1';
  const which = ny ? 'newyear' : an ? 'anniversary' : 'off';
  const mode = segmented([['off', '不开启'], ['newyear', '新年活动'], ['anniversary', '周年活动']], which, async (v) => {
    try {
      if (v === 'off') { await post('/api/tunables', { key: 'event_newyear_enabled', value: '0' }); await post('/api/tunables', { key: 'event_anniversary_enabled', value: '0' }); }
      else await post('/api/tunables', { key: v === 'newyear' ? 'event_newyear_enabled' : 'event_anniversary_enabled', value: '1' });
      toast('已Переключить。Игроки需要完全退出游戏再登录。');
      render();
    } catch (e) { toast(errText(e), 'bad'); }
  });

  // 分支：用勾选代替手填逗号列表
  const branchField = form.field({ key: 'event_branches', label: 'Ветви события', kind: 'string' }, val('event_branches', DEFAULT_BRANCHES));
  const chosen = new Set(String(branchField.original).split(',').map((x) => Number(x.trim())).filter(Boolean));
  branchField.input = h('input', { type: 'hidden', value: branchField.original });
  const syncBranches = () => { branchField.input.value = [...chosen].sort((a, b) => a - b).join(','); form.refresh(); };
  const branchGrid = h('div', { class: 'grid-3', style: { gap: '10px' } }, BRANCHES.map(([year, list]) => h('div', { class: 'card', style: { padding: '12px 14px', background: 'var(--surface-2)' } },
    h('b', { class: 'small', text: year }),
    list.map(([id, name]) => {
      const box = h('input', { type: 'checkbox', onchange: (e) => { e.target.checked ? chosen.add(id) : chosen.delete(id); syncBranches(); } });
      box.checked = chosen.has(id);
      return h('label', { class: 'row small', style: { marginTop: '6px', cursor: 'pointer' } }, box, name);
    }))));
  branchField.row = h('div', {}, branchGrid, branchField.input);

  // Время окончания：本地Время选择，存 UTC сек.
  const endField = form.field({ key: 'event_anniversary_end_unix', label: 'Время окончания', kind: 'string' }, val('event_anniversary_end_unix', 1825632000));
  const toLocal = (ts) => { const d = new Date(Number(ts) * 1000); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const picker = h('input', { type: 'datetime-local', class: 'input', value: toLocal(endField.original), style: { width: '260px' } });
  endField.input = h('input', { type: 'hidden', value: endField.original });
  picker.addEventListener('change', () => { const ts = Math.floor(new Date(picker.value).getTime() / 1000); if (ts > 0) { endField.input.value = String(ts); form.refresh(); } });
  endField.row = h('div', { class: 'setting' },
    h('div', {}, h('div', { class: 's-label', text: '活动Время окончания' }), h('div', { class: 's-help', text: 'Момент окончания обратного отсчёта для новогоднего и юбилейного события. Время отображается в часовом поясе вашего компьютера.' })),
    h('div', { class: 's-control' }, picker, endField.input));

  return h('div', {},
    callout('info', 'Настройки события применяются только при повторном входе игрока. После изменений нужно полностью выйти из игры и войти снова.'),
    h('div', { style: { height: '16px' } }),
    section({ title: 'Текущий режим活动', desc: 'Одновременно может быть активно только одно событие. Нажмите, чтобы переключить режим.', body: mode }),
    section({ title: 'Ветви события', desc: 'Выберите, какие цепочки заданий будут показаны в панели события. Если ничего не выбрано, задания события не выдаются.', body: branchField.row }),
    section({ title: 'Время', body: endField.row }),
    giftsSection(t, [...chosen], which !== 'off'));
}

// 阶段奖励：按分支、阶段配置额外奖励Предмет
function giftsSection(t, branches, active) {
  let data = {};
  try { data = JSON.parse(t.event_stage_gifts || '{}') || {}; } catch (e) { data = {}; }
  const names = {};
  let branch = branches.includes(13) ? 13 : branches[0];
  let stage = 1;
  let dirty = false;
  const box = h('div');
  const saveBtn = btn('Сохранить награды этапов', async () => {
    for (const [b, stages] of Object.entries(data)) for (const [s, gifts] of Object.entries(stages)) {
      if (!gifts.length) delete data[b][s];
    }
    for (const b of Object.keys(data)) if (!Object.keys(data[b]).length) delete data[b];
    try {
      await post('/api/tunables', { key: 'event_stage_gifts', value: Object.keys(data).length ? JSON.stringify(data, null, 2) : '' });
      dirty = false;
      toast('Сохранено. Чтобы увидеть изменения, игрокам нужно перезапустить игру и войти снова.');
      draw();
    } catch (e) { toast(errText(e), 'bad'); }
  }, 'primary');
  const gifts = () => ((data[branch] || {})[stage] || []);
  const setGifts = (list) => { data[branch] = data[branch] || {}; data[branch][stage] = list; dirty = true; draw(); };
  const hydrate = async () => {
    const ids = new Set();
    for (const st of Object.values(data)) for (const list of Object.values(st)) for (const g of list) if (!names[g.item]) ids.add(g.item);
    for (const id of ids) {
      try { const r = await api('/api/catalog/items?limit=5&q=' + encodeURIComponent(id)); const hit = r.find((x) => x.item_id === id); names[id] = hit ? hit.name : id; } catch (e) { names[id] = id; }
    }
    if (ids.size) draw();
  };
  function draw() {
    if (!active || !branches.length) {
      box.replaceChildren(empty(!active ? 'Событие ещё не включено' : '还没有选择Ветви события', !active ? 'Сначала выберите выше новогоднее или юбилейное событие.' : 'Сначала выберите хотя бы одну ветвь выше и сохраните настройки.'));
      return;
    }
    const branchSel = h('select', { class: 'select', style: { width: '240px' }, onchange: (e) => { branch = Number(e.target.value); stage = 1; draw(); } },
      branches.map((b) => h('option', { value: b, text: BRANCH_NAME[b] || b, selected: b === branch })));
    const stageTabs = h('div', { class: 'seg' }, Array.from({ length: stageCount(branch) }, (_, i) => {
      const n = i + 1, count = ((data[branch] || {})[n] || []).length;
      return h('button', { type: 'button', class: n === stage ? 'on' : '', onclick: () => { stage = n; draw(); } }, 'Этап ' + n, count ? h('span', { class: 'muted', text: ' · ' + count }) : null);
    }));
    const list = gifts();
    const rows = list.length ? h('div', { class: 'card' }, h('div', { class: 'list' }, list.map((g, i) => h('div', { class: 'list-item' },
      itemIcon(g.item), h('div', { class: 'grow' }, h('div', { class: 'title', text: names[g.item] || g.item }), h('div', { class: 'sub mono', text: g.item })),
      h('label', { class: 'row small muted' }, 'Количество', h('input', { class: 'input num', style: { width: '72px', height: '30px' }, value: g.qty, oninput: (e) => { g.qty = Math.max(1, Math.min(99, Math.round(Number(e.target.value) || 1))); dirty = true; } })),
      btn('', () => setGifts(list.filter((_, j) => j !== i)), 'ghost icon sm', { icon: 'trash', 'aria-label': '移除' })))))
      : empty('Для этого этапа нет дополнительных наград', 'При завершении этапа будут выданы только стандартные игровые награды.');
    box.replaceChildren(h('div', { class: 'stack' },
      h('div', { class: 'row' }, branchSel, h('div', { style: { overflowX: 'auto', maxWidth: '100%' } }, stageTabs)),
      rows,
      h('div', { class: 'row' }, btn('Добавить предмет', () => pickItem({ title: 'Выбрать предмет награды', completeOnly: true, onPick: (x) => { names[x.item_id] = x.name; setGifts([...list, { item: x.item_id, qty: 1 }]); } }), '', { icon: 'plus' }),
        h('span', { class: 'spacer' }), saveBtn)));
  }
  draw();
  hydrate();
  return section({ title: '阶段奖励', desc: 'Предметы, которые дополнительно выдаются при завершении этапа события.', body: box });
}
