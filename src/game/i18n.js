// Tiny i18n table: Russian primary, English fallback. Lang: ?lang= > Telegram user language > 'ru'.
const T = {
  ru: {
    level: 'Ур.', points: 'Moon Points', today: 'сегодня', quests: 'Задания', chapter: 'Глава 1', daily: 'Ежедневные',
    chapterTitle: 'База Альфа', dailySoon: 'Ежедневные задания появятся на этапе 2.', dailySoon2: 'Кристаллы уже обновляются каждый день — собирайте их!',
    done: 'Выполнено', active: 'Текущее', locked: 'Закрыто', close: 'Закрыть', m: 'м',
    questDone: 'Задание выполнено!', levelUp: 'Новый уровень!', capHit: 'Дневной лимит ⭐ достигнут', capPart: 'лимит дня',
    chapterDone: 'Глава 1 пройдена!', chapterDoneSub: 'Скоро: Глава 2', crystalToast: 'Кристалл', tapToClose: 'нажмите, чтобы закрыть',
    activate: 'Активировать', scan: 'Сканировать', useJet: 'Используйте JET, чтобы забраться наверх', holdZone: 'Оставайтесь в зоне…',
    q_canyon_t: 'Посадочный каньон', q_canyon_d: 'Дойдите до посадочной площадки в каньоне.',
    q_crystals_t: 'Золотые кристаллы', q_crystals_d: 'Соберите золотые кристаллы на дне каньона.',
    q_reactor_t: 'Пульт реактора', q_reactor_d: 'Вернитесь на базу и активируйте пульт реактора.',
    q_dish_t: 'Антенна связи', q_dish_d: 'Просканируйте большую антенну базы.',
    q_launch_t: 'Стартовый комплекс', q_launch_d: 'Посетите стартовую площадку ракеты.',
    q_ledge_t: 'Смотровой уступ', q_ledge_d: 'Запрыгните на смотровой уступ с помощью джетпака.',
    q_home_t: 'Домой, на базу', q_home_d: 'Вернитесь на посадочную площадку базы.',
  },
  en: {
    level: 'Lv', points: 'Moon Points', today: 'today', quests: 'Quests', chapter: 'Chapter 1', daily: 'Daily',
    chapterTitle: 'Base Alpha', dailySoon: 'Daily quests arrive in stage 2.', dailySoon2: 'Crystals already respawn every day — go collect them!',
    done: 'Done', active: 'Active', locked: 'Locked', close: 'Close', m: 'm',
    questDone: 'Quest complete!', levelUp: 'Level up!', capHit: 'Daily ⭐ limit reached', capPart: 'daily limit',
    chapterDone: 'Chapter 1 complete!', chapterDoneSub: 'Coming soon: Chapter 2', crystalToast: 'Crystal', tapToClose: 'tap to close',
    activate: 'Activate', scan: 'Scan', useJet: 'Use JET to get up there', holdZone: 'Stay in the zone…',
    q_canyon_t: 'Landing Canyon', q_canyon_d: 'Walk to the landing pad in the canyon.',
    q_crystals_t: 'Gold Crystals', q_crystals_d: 'Collect gold crystals on the canyon floor.',
    q_reactor_t: 'Reactor Console', q_reactor_d: 'Head back to base and activate the reactor console.',
    q_dish_t: 'Comms Dish', q_dish_d: 'Scan the base’s big dish antenna.',
    q_launch_t: 'Launch Complex', q_launch_d: 'Visit the rocket launch pad.',
    q_ledge_t: 'Lookout Ledge', q_ledge_d: 'Jetpack up onto the lookout ledge.',
    q_home_t: 'Back to Base', q_home_d: 'Return to the base landing pad.',
  },
};
export function pickLang(Q) {
  const q = Q.get('lang'); if (q && T[q]) return q;
  const tg = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code; if (tg && T[tg.slice(0, 2)]) return tg.slice(0, 2);
  return 'ru';
}
export function makeT(lang) { return (k) => (T[lang] && T[lang][k]) ?? T.en[k] ?? k; }
