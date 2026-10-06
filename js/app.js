(function () {
  "use strict";

  var cfg = window.PORTAL_CONFIG || { sections: [], links: [] };
  var ICONS = window.PORTAL_ICONS || {};
  var FAV_KEY = "portal-favorites";
  var THEME_KEY = "portal-theme";

  var STATUS = {
    new: "Новое",
    beta: "Бета",
    dev: "В разработке",
    offline: "Недоступно",
  };

  // ---------- утилиты ----------
  function icon(name) {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("class", "i");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = ICONS[name] || ICONS.link;
    return svg;
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === undefined || v === null || v === false) return;
        if (k === "text") node.textContent = v;
        else if (k === "class") node.className = v;
        else node.setAttribute(k, v);
      });
    }
    (children || []).forEach(function (c) {
      if (c) node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  function storageGet(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* хранилище недоступно */ }
  }

  function slug(s) {
    return String(s).toLowerCase().replace(/\s+/g, "-");
  }

  function norm(s) {
    return String(s || "").toLowerCase().replace(/ё/g, "е");
  }

  // Подсветка совпадения в тексте
  function highlight(text, query) {
    var frag = document.createDocumentFragment();
    if (!query) { frag.appendChild(document.createTextNode(text)); return frag; }
    var idx = norm(text).indexOf(query);
    if (idx === -1) { frag.appendChild(document.createTextNode(text)); return frag; }
    frag.appendChild(document.createTextNode(text.slice(0, idx)));
    frag.appendChild(el("mark", { text: text.slice(idx, idx + query.length) }));
    frag.appendChild(document.createTextNode(text.slice(idx + query.length)));
    return frag;
  }

  // ---------- данные ----------
  var sections = (cfg.sections || []).map(function (s) {
    return {
      id: s.id || slug(s.title),
      title: s.title,
      description: s.description,
      icon: s.icon,
      apps: (s.apps || []).map(function (a) {
        var app = Object.assign({}, a);
        app.key = (s.id || slug(s.title)) + ":" + (a.id || slug(a.name));
        app.haystack = norm([a.name, a.description, (a.tags || []).join(" "), s.title].join(" "));
        return app;
      }),
    };
  });

  var allApps = [];
  sections.forEach(function (s) { allApps = allApps.concat(s.apps); });

  var state = {
    query: "",
    category: "all",
    favs: storageGet(FAV_KEY, []).filter(function (k) {
      return allApps.some(function (a) { return a.key === k; });
    }),
  };

  // ---------- рендер ----------
  var $content = document.getElementById("content");
  var $chips = document.getElementById("chips");
  var $sidebar = document.getElementById("sidebar");
  var $search = document.getElementById("search");

  function isFav(app) { return state.favs.indexOf(app.key) !== -1; }

  function toggleFav(app) {
    if (isFav(app)) state.favs = state.favs.filter(function (k) { return k !== app.key; });
    else state.favs.push(app.key);
    storageSet(FAV_KEY, state.favs);
    if (state.category === "fav" && !state.favs.length) state.category = "all";
    render();
  }

  function matches(app) {
    return !state.query || app.haystack.indexOf(state.query) !== -1;
  }

  function renderCard(app) {
    var offline = app.status === "offline";
    var disabled = offline || !app.url || app.url === "#";
    var title = el("div", { class: "card-title" }, [highlight(app.name, state.query)]);
    if (app.status && STATUS[app.status]) {
      title.appendChild(el("span", { class: "badge badge--" + app.status, text: STATUS[app.status] }));
    }

    var body = el("div", { class: "card-body" }, [title]);
    if (app.description) body.appendChild(el("p", { class: "card-desc" }, [highlight(app.description, state.query)]));

    var newTab = app.newTab !== false;
    var link = el("a", {
      class: "card-link",
      href: disabled ? null : app.url,
      target: !disabled && newTab ? "_blank" : null,
      rel: !disabled && newTab ? "noopener" : null,
      title: offline ? "Приложение временно недоступно" : disabled ? "Адрес ещё не указан" : app.url,
      "aria-disabled": disabled ? "true" : null,
    }, [
      el("div", { class: "card-icon", "data-color": app.color || "blue" }, [icon(app.icon)]),
      body,
      el("span", { class: "card-go" }, [icon("external")]),
    ]);

    var fav = el("button", {
      class: "fav",
      type: "button",
      "aria-pressed": isFav(app) ? "true" : "false",
      "aria-label": isFav(app) ? "Убрать из избранного" : "Добавить в избранное",
      title: isFav(app) ? "Убрать из избранного" : "В избранное",
    }, [icon("star")]);
    fav.addEventListener("click", function () { toggleFav(app); });

    return el("article", { class: "card" + (offline ? " card--offline" : "") + (disabled ? " card--nolink" : "") }, [link, fav]);
  }

  function renderSection(title, desc, iconName, apps, extraClass) {
    var head = el("div", { class: "section-head" }, [
      el("h2", { class: "section-title" }, [icon(iconName), title]),
      desc ? el("span", { class: "section-desc", text: desc }) : null,
      el("span", { class: "section-line" }),
    ]);
    var grid = el("div", { class: "grid" }, apps.map(renderCard));
    return el("section", { class: "section" + (extraClass ? " " + extraClass : "") }, [head, grid]);
  }

  function renderChips() {
    $chips.innerHTML = "";
    var items = [{ id: "all", title: "Все", count: allApps.length }];
    if (state.favs.length) items.push({ id: "fav", title: "Избранное", icon: "star", count: state.favs.length });
    sections.forEach(function (s) { items.push({ id: s.id, title: s.title, icon: s.icon, count: s.apps.length }); });

    items.forEach(function (it) {
      var chip = el("button", {
        class: "chip",
        type: "button",
        "aria-pressed": state.category === it.id ? "true" : "false",
      }, [it.icon ? icon(it.icon) : null, it.title, el("span", { class: "count", text: String(it.count) })]);
      chip.addEventListener("click", function () {
        state.category = it.id;
        render();
      });
      $chips.appendChild(chip);
    });
  }

  function renderContent() {
    $content.innerHTML = "";
    var shown = 0;

    var favApps = allApps.filter(function (a) { return isFav(a) && matches(a); });
    if ((state.category === "all" && !state.query) || state.category === "fav") {
      if (favApps.length) {
        $content.appendChild(renderSection("Избранное", null, "star", favApps));
        shown += favApps.length;
      }
    }

    if (state.category !== "fav") {
      sections.forEach(function (s, i) {
        if (state.category !== "all" && state.category !== s.id) return;
        var apps = s.apps.filter(matches);
        if (!apps.length) return;
        shown += apps.length;
        $content.appendChild(renderSection(s.title, s.description, s.icon, apps, i === 0 ? "section--featured" : null));
      });
    }

    if (!shown) {
      $content.appendChild(el("div", { class: "empty" }, [
        el("div", { class: "empty-icon" }, [icon("search")]),
        el("strong", { text: "Ничего не найдено" }),
        el("span", { text: state.query ? "Попробуйте изменить запрос или выбрать «Все»." : "В этом разделе пока нет приложений." }),
      ]));
    }
  }

  function renderSidebar() {
    $sidebar.innerHTML = "";

    if (cfg.links && cfg.links.length) {
      var list = el("ul", { class: "links" }, cfg.links.map(function (l) {
        return el("li", null, [
          el("a", { class: "link", href: l.url, target: "_blank", rel: "noopener" }, [
            icon(l.icon), l.name, el("span", { class: "link-go" }, [icon("external")]),
          ]),
        ]);
      }));
      $sidebar.appendChild(el("div", { class: "panel" }, [el("h3", { class: "panel-title", text: "Полезные ссылки" }), list]));
    }

    var stats = el("div", { class: "stats" }, sections.slice(0, 4).map(function (s) {
      return el("div", { class: "stat" }, [
        el("div", { class: "stat-value", text: String(s.apps.length) }),
        el("div", { class: "stat-label", text: s.title }),
      ]);
    }).concat([
      el("div", { class: "stat" }, [
        el("div", { class: "stat-value", text: String(state.favs.length) }),
        el("div", { class: "stat-label", text: "В избранном" }),
      ]),
    ]));
    $sidebar.appendChild(el("div", { class: "panel" }, [el("h3", { class: "panel-title", text: "Сводка" }), stats]));
  }

  function render() {
    renderChips();
    renderContent();
    renderSidebar();
  }

  // ---------- шапка: заголовок, часы, приветствие, тема ----------
  function initHeader() {
    if (cfg.title) {
      document.title = cfg.title;
      document.getElementById("portal-title").textContent = cfg.title;
    }
    document.getElementById("portal-subtitle").textContent = cfg.subtitle || "";
    document.getElementById("search-icon").appendChild(icon("search"));
    document.getElementById("footer-text").textContent =
      (cfg.title || "Портал") + " · " + new Date().getFullYear();

    var $time = document.getElementById("clock-time");
    var $date = document.getElementById("clock-date");
    var $greet = document.getElementById("greeting");
    function tick() {
      var d = new Date();
      $time.textContent = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
      $date.textContent = d.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
      var h = d.getHours();
      $greet.textContent = h < 5 ? "Доброй ночи" : h < 12 ? "Доброе утро" : h < 18 ? "Добрый день" : "Добрый вечер";
    }
    tick();
    setInterval(tick, 15000);

    var $theme = document.getElementById("theme-toggle");
    function paintThemeBtn() {
      var dark = document.documentElement.getAttribute("data-theme") === "dark";
      $theme.innerHTML = "";
      $theme.appendChild(icon(dark ? "sun" : "moon"));
      $theme.title = dark ? "Светлая тема" : "Тёмная тема";
    }
    $theme.addEventListener("click", function () {
      var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ignore */ }
      paintThemeBtn();
    });
    paintThemeBtn();
  }

  // ---------- поиск и горячие клавиши ----------
  function initSearch() {
    $search.addEventListener("input", function () {
      state.query = norm($search.value.trim());
      renderContent();
    });

    $search.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        // Enter — открыть первое найденное приложение
        var first = $content.querySelector(".card-link[href]");
        if (first) first.click();
      } else if (e.key === "Escape") {
        $search.value = "";
        state.query = "";
        renderContent();
        $search.blur();
      }
    });

    document.addEventListener("keydown", function (e) {
      var tag = (document.activeElement && document.activeElement.tagName) || "";
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        $search.focus();
      }
    });
  }

  initHeader();
  initSearch();
  render();
})();
