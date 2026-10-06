/*
 * ============================================================
 *  НАСТРОЙКИ ПОРТАЛА
 * ============================================================
 *  Это единственный файл, который нужно править, чтобы
 *  добавить, изменить или удалить приложение.
 *
 *  Поля приложения:
 *    name        — название (обязательно)
 *    description — короткое описание
 *    url         — адрес приложения (обязательно)
 *    icon        — иконка: chart, phone, file, signpost, database, radio,
 *                  sliders, monitor, book, grid, globe, translate, map,
 *                  coins, code, cpu, factory, truck, users, calendar,
 *                  shield, flask, box, wrench, activity, gauge, sparkles
 *    color       — цвет иконки: blue, gold, green, violet, red, teal,
 *                  orange, slate
 *    status      — необязательно: "new" (Новое), "beta" (Бета),
 *                  "dev" (В разработке), "offline" (Недоступно)
 *    tags        — необязательно: слова для поиска, например ["отчёт", "1С"]
 *    newTab      — false, если открывать в этой же вкладке (по умолчанию в новой)
 *
 *  Адреса со значением "#" — заглушки, замените их на реальные.
 * ============================================================
 */
window.PORTAL_CONFIG = {
  title: "Портал ГМЗ-1",
  subtitle: "Все приложения завода в одном месте",

  sections: [
    {
      id: "my",
      title: "Мои разработки",
      description: "Новые приложения и сервисы",
      icon: "sparkles",
      apps: [
        {
          name: "Пример приложения 1",
          description: "Замените на свою разработку в js/config.js",
          url: "#",
          icon: "gauge",
          color: "gold",
          status: "new",
        },
        {
          name: "Пример приложения 2",
          description: "Мониторинг, отчёты, учёт — что угодно",
          url: "#",
          icon: "activity",
          color: "violet",
          status: "beta",
        },
        {
          name: "Пример приложения 3",
          description: "Пока в разработке",
          url: "#",
          icon: "code",
          color: "teal",
          status: "dev",
        },
      ],
    },
    {
      id: "gmz",
      title: "Приложения ГМЗ-1",
      description: "Внутренние сервисы завода",
      icon: "factory",
      apps: [
        {
          name: "Отчёты «АВ»",
          description: "Отчёты бухгалтерии, ГСМ, путёвки",
          url: "#",
          icon: "chart",
          color: "blue",
          tags: ["бухгалтерия", "гсм", "путевки"],
        },
        {
          name: "Справочник",
          description: "Телефонный справочник РУ «ГМЗ-1»",
          url: "#",
          icon: "phone",
          color: "green",
          tags: ["телефон", "контакты"],
        },
        {
          name: "ОоСТ",
          description: "Отчёт о состоянии трекера",
          url: "#",
          icon: "file",
          color: "orange",
          tags: ["трекер"],
        },
      ],
    },
    {
      id: "ngmk",
      title: "Приложения НГМК",
      description: "Сервисы комбината",
      icon: "globe",
      apps: [
        {
          name: "Qatnovlar",
          description: "Kon texnikalari ishini kuzatish",
          url: "#",
          icon: "signpost",
          color: "blue",
          tags: ["техника", "рейсы"],
        },
        {
          name: "УЭБ",
          description: "Универсальная электронная база",
          url: "#",
          icon: "database",
          color: "violet",
        },
        {
          name: "WiaLon",
          description: "ИС «Контроль ГСМ»",
          url: "#",
          icon: "radio",
          color: "teal",
          tags: ["гсм", "gps", "транспорт"],
        },
        {
          name: "Видеостена",
          description: "Информационная система «TTS»",
          url: "#",
          icon: "monitor",
          color: "slate",
        },
        {
          name: "Библиотека",
          description: "Настольная литература специалистов НГМК",
          url: "#",
          icon: "book",
          color: "gold",
          tags: ["книги", "документы"],
        },
        {
          name: "Портал НГМК",
          description: "Портал АО «НГМК»",
          url: "#",
          icon: "grid",
          color: "red",
        },
      ],
    },
  ],

  // Быстрые ссылки (внешние сайты)
  links: [
    { name: "Google Переводчик", url: "https://translate.google.com", icon: "translate" },
    { name: "Yandex Переводчик", url: "https://translate.yandex.ru", icon: "translate" },
    { name: "Google Карты", url: "https://maps.google.com", icon: "map" },
    { name: "Цена золота", url: "https://www.kitco.com/charts/livegold.html", icon: "coins" },
  ],
};
