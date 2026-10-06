(function () {
  "use strict";

  var cfg = window.PORTAL_CONFIG || { sections: [], links: [] };
  var ICONS = window.PORTAL_ICONS || {};
  var KEYS = { fav: "portal-favorites", recent: "portal-recent", theme: "portal-theme", variant: "portal-variant" };
  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var root = document.documentElement;

  var STATUS = { new: "Новое", beta: "Бета", dev: "В разработке", offline: "Недоступно" };
  var VARIANTS = [
    { id: "a", name: "Классика", desc: "Боковое меню и большие карточки" },
    { id: "b", name: "Плитки", desc: "Квадратные кнопки по центру" },
    { id: "c", name: "Мозаика", desc: "Цветные плитки разного размера" },
    { id: "d", name: "Панель", desc: "Часы слева, кнопки справа" },
  ];
  var CHECK_LABEL = { checking: "Проверка…", online: "В сети", offline: "Нет ответа", none: "Адрес не указан" };

  // ================= утилиты =================
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
        else if (k === "style") node.style.cssText = v;
        else node.setAttribute(k, v);
      });
    }
    (children || []).forEach(function (c) {
      if (c !== null && c !== undefined && c !== false) {
        node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
      }
    });
    return node;
  }

  function load(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* хранилище недоступно */ }
  }

  function slug(s) { return String(s).toLowerCase().replace(/\s+/g, "-"); }
  function norm(s) { return String(s || "").toLowerCase().replace(/ё/g, "е"); }

  function highlight(text, q) {
    var frag = document.createDocumentFragment();
    var i = q ? norm(text).indexOf(q) : -1;
    if (i === -1) { frag.appendChild(document.createTextNode(text)); return frag; }
    frag.appendChild(document.createTextNode(text.slice(0, i)));
    frag.appendChild(el("mark", { text: text.slice(i, i + q.length) }));
    frag.appendChild(document.createTextNode(text.slice(i + q.length)));
    return frag;
  }

  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  // ================= данные =================
  var sections = (cfg.sections || []).map(function (s) {
    var sid = s.id || slug(s.title);
    return {
      id: sid,
      title: s.title,
      description: s.description,
      icon: s.icon || "grid",
      featured: !!s.featured,
      apps: (s.apps || []).map(function (a) {
        var app = Object.assign({}, a);
        app.key = sid + ":" + (a.id || slug(a.name));
        app.section = s.title;
        app.color = a.color || "blue";
        app.hasUrl = !!a.url && a.url !== "#";
        app.haystack = norm([a.name, a.description, (a.tags || []).join(" "), s.title].join(" "));
        return app;
      }),
    };
  });

  var allApps = [];
  sections.forEach(function (s) { allApps = allApps.concat(s.apps); });
  var byKey = {};
  allApps.forEach(function (a) { byKey[a.key] = a; });

  var state = {
    favs: load(KEYS.fav, []).filter(function (k) { return byKey[k]; }),
    recent: load(KEYS.recent, []).filter(function (r) { return r && byKey[r.key]; }),
    status: {}, // key -> checking | online | offline | none
  };

  // ================= действия =================
  function isFav(app) { return state.favs.indexOf(app.key) !== -1; }

  function toggleFav(app) {
    var on = !isFav(app);
    if (on) state.favs.push(app.key);
    else state.favs = state.favs.filter(function (k) { return k !== app.key; });
    save(KEYS.fav, state.favs);
    toast(on ? "«" + app.name + "» в избранном" : "«" + app.name + "» убрано из избранного", "star");
    renderAll();
  }

  function remember(app) {
    state.recent = [{ key: app.key, t: Date.now() }].concat(
      state.recent.filter(function (r) { return r.key !== app.key; })
    ).slice(0, 8);
    save(KEYS.recent, state.recent);
    // перерисуем позже, чтобы не мешать переходу по ссылке
    setTimeout(renderRecent, 300);
  }

  function openApp(app) {
    if (!app.hasUrl) { toast("Адрес для «" + app.name + "» ещё не указан", "link"); return; }
    remember(app);
    if (app.newTab === false) window.location.href = app.url;
    else window.open(app.url, "_blank", "noopener");
  }

  function copyLink(app) {
    if (!app.hasUrl) { toast("Адрес ещё не указан", "link"); return; }
    var url = new URL(app.url, window.location.href).href;
    var done = function () { toast("Ссылка скопирована", "check"); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(done, function () { fallbackCopy(url); done(); });
    } else { fallbackCopy(url); done(); }
  }
  function fallbackCopy(text) {
    var ta = el("textarea", { style: "position:fixed;opacity:0" });
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) { /* ignore */ }
    ta.remove();
  }

  // ================= уведомления =================
  var $toasts = document.getElementById("toasts");
  function toast(msg, ic) {
    var t = el("div", { class: "toast" }, [icon(ic || "check"), msg]);
    $toasts.appendChild(t);
    while ($toasts.children.length > 3) $toasts.firstChild.remove();
    setTimeout(function () {
      t.classList.add("out");
      setTimeout(function () { t.remove(); }, 260);
    }, 2200);
  }

  // ================= проверка доступности =================
  function checkOne(app) {
    if (!app.hasUrl) { setStatus(app.key, "none"); return Promise.resolve(); }
    if (cfg.checkStatus === false || app.check === false) return Promise.resolve();
    setStatus(app.key, "checking");
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 6000);
    return fetch(app.url, { mode: "no-cors", cache: "no-store", signal: ctrl ? ctrl.signal : undefined })
      .then(function () { setStatus(app.key, "online"); })
      .catch(function () { setStatus(app.key, "offline"); })
      .then(function () { clearTimeout(timer); });
  }

  var $recheck = document.getElementById("recheck-btn");
  function checkAll(manual) {
    $recheck.classList.add("spinning");
    var jobs = allApps.map(checkOne);
    renderStats();
    return Promise.all(jobs).then(function () {
      $recheck.classList.remove("spinning");
      renderStats();
      if (manual) {
        var c = countStatus();
        toast("Проверено: в сети " + c.online + " из " + c.total, "refresh");
      }
    });
  }

  function countStatus() {
    var online = 0, total = 0, pending = 0;
    allApps.forEach(function (a) {
      var s = state.status[a.key];
      if (s === "online" || s === "offline") total++;
      if (s === "online") online++;
      if (s === "checking") pending++;
    });
    return { online: online, total: total, pending: pending };
  }

  function setStatus(key, s) {
    state.status[key] = s;
    var nodes = document.querySelectorAll('.status[data-key="' + key.replace(/"/g, '\\"') + '"]');
    Array.prototype.forEach.call(nodes, function (n) { paintStatus(n, s); });
  }

  function paintStatus(node, s) {
    node.setAttribute("data-state", s || "");
    node.lastChild.textContent = CHECK_LABEL[s] || "";
  }

  // ================= карточка =================
  function renderCard(app, opts) {
    opts = opts || {};
    var featured = !!opts.featured;
    var offline = app.status === "offline";

    var title = el("div", { class: "card-title" }, [app.name]);
    if (app.status && STATUS[app.status]) {
      title.appendChild(el("span", { class: "badge badge--" + app.status, text: STATUS[app.status] }));
    }

    var status = el("span", { class: "status", "data-key": app.key }, [el("span", { class: "dot" }), el("span")]);
    paintStatus(status, state.status[app.key] || (app.hasUrl ? "" : "none"));

    var link = el("a", {
      class: "card-link",
      href: app.hasUrl ? app.url : null,
      target: app.hasUrl && app.newTab !== false ? "_blank" : null,
      rel: app.hasUrl && app.newTab !== false ? "noopener" : null,
      role: app.hasUrl ? null : "link",
      tabindex: app.hasUrl ? null : "0",
      "aria-label": app.name + (app.description ? " — " + app.description : ""),
    }, [
      el("div", { class: "card-top" }, [
        el("div", { class: "card-icon" }, [icon(app.icon)]),
      ]),
      el("div", { class: "card-body" }, [
        title,
        app.description ? el("p", { class: "card-desc", text: app.description }) : null,
      ]),
      el("div", { class: "card-foot" }, [
        status,
        el("span", { class: "card-open" }, ["Открыть", icon("arrow")]),
      ]),
    ]);

    link.addEventListener("click", function (e) {
      if (!app.hasUrl) { e.preventDefault(); openApp(app); return; }
      remember(app);
    });
    link.addEventListener("auxclick", function (e) { if (e.button === 1 && app.hasUrl) remember(app); });
    link.addEventListener("keydown", function (e) {
      if (!app.hasUrl && e.key === "Enter") openApp(app);
    });

    var fav = el("button", {
      class: "act fav",
      type: "button",
      "aria-pressed": isFav(app) ? "true" : "false",
      "aria-label": isFav(app) ? "Убрать из избранного" : "Добавить в избранное",
      title: isFav(app) ? "Убрать из избранного" : "В избранное",
    }, [icon("star")]);
    fav.addEventListener("click", function () {
      fav.classList.add("pop");
      setTimeout(function () { toggleFav(app); }, 180);
    });

    var copy = el("button", { class: "act", type: "button", title: "Скопировать ссылку", "aria-label": "Скопировать ссылку" }, [icon("copy")]);
    copy.addEventListener("click", function () { copyLink(app); });

    var card = el("article", {
      class: "card" + (offline ? " card--offline" : "") + (app.hasUrl ? "" : " card--nolink"),
      "data-color": app.color,
      style: "--i:" + (opts.index || 0),
    }, [
      el("div", { class: "card-wash" }),
      el("div", { class: "card-art" }, [icon(app.icon)]),
      link,
      el("div", { class: "card-actions" }, [copy, fav]),
      opts.hotkey ? el("span", { class: "hotkey", title: "Клавиша " + opts.hotkey, text: String(opts.hotkey) }) : null,
    ]);

    attachTilt(card, featured ? 4 : 6);
    return card;
  }

  // 3D-наклон и подсветка за курсором
  function attachTilt(card, max) {
    if (REDUCED) return;
    card.addEventListener("pointermove", function (e) {
      var r = card.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width;
      var y = (e.clientY - r.top) / r.height;
      card.style.setProperty("--mx", (x * 100).toFixed(1) + "%");
      card.style.setProperty("--my", (y * 100).toFixed(1) + "%");
      if (e.pointerType === "mouse") {
        card.classList.add("is-tilting");
        card.style.setProperty("--rx", ((0.5 - y) * max).toFixed(2) + "deg");
        card.style.setProperty("--ry", ((x - 0.5) * max).toFixed(2) + "deg");
      }
    });
    card.addEventListener("pointerleave", function () {
      card.classList.remove("is-tilting");
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
    });
  }

  // ================= разделы =================
  var $content = document.getElementById("content");

  function renderSection(id, title, desc, ic, apps, opts) {
    opts = opts || {};
    var head = el("div", { class: "section-head" }, [
      el("span", { class: "section-icon" }, [icon(ic)]),
      el("h2", { class: "section-title", text: title }),
      desc ? el("span", { class: "section-desc", text: desc }) : null,
      el("span", { class: "section-count", text: apps.length + " " + plural(apps.length, "приложение", "приложения", "приложений") }),
    ]);
    var grid = el("div", { class: "grid" + (opts.featured ? " grid--featured" : "") }, apps.map(function (a, i) {
      return renderCard(a, { featured: opts.featured, index: i, hotkey: opts.hotkeys && i < 9 ? i + 1 : null });
    }));
    return el("section", { class: "section", id: "s-" + id, "data-nav": id }, [head, grid]);
  }

  function renderContent() {
    $content.innerHTML = "";
    var favApps = state.favs.map(function (k) { return byKey[k]; });
    if (favApps.length) {
      $content.appendChild(renderSection("fav", "Избранное", "Клавиши 1–9 открывают приложения", "star", favApps, { hotkeys: true }));
    }
    sections.forEach(function (s) {
      if (!s.apps.length) return;
      $content.appendChild(renderSection(s.id, s.title, s.description, s.icon, s.apps, { featured: s.featured }));
    });
    if (!allApps.length) {
      $content.appendChild(el("div", { class: "empty", text: "Добавьте приложения в файл js/config.js" }));
    }
    observeSections();
  }

  // ================= меню =================
  var $nav = document.getElementById("nav");
  var activeNav = "top";

  function navItems() {
    var items = [{ id: "top", title: "Главная", icon: "home" }];
    if (state.favs.length) items.push({ id: "fav", title: "Избранное", icon: "star", count: state.favs.length });
    sections.forEach(function (s) { items.push({ id: s.id, title: s.title, icon: s.icon, count: s.apps.length }); });
    return items;
  }

  var $tabs = document.getElementById("tabs");

  function renderNav() {
    $nav.innerHTML = "";
    $tabs.innerHTML = "";
    navItems().forEach(function (it) {
      $nav.appendChild(navLink(it, "nav-item"));
      $tabs.appendChild(navLink(it, "tab"));
    });
  }

  function navLink(it, cls) {
      var a = el("a", {
        class: cls + (activeNav === it.id ? " active" : ""),
        href: it.id === "top" ? "#" : "#s-" + it.id,
        "data-id": it.id,
      }, [icon(it.icon), it.title, it.count !== undefined ? el("span", { class: "nav-count", text: String(it.count) }) : null]);
      a.addEventListener("click", function (e) {
        e.preventDefault();
        closeMenu();
        if (it.id === "top") window.scrollTo({ top: 0, behavior: REDUCED ? "auto" : "smooth" });
        else {
          var target = document.getElementById("s-" + it.id);
          if (target) target.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" });
        }
        setActiveNav(it.id);
      });
      return a;
  }

  function setActiveNav(id) {
    activeNav = id;
    [$nav, $tabs].forEach(function (box) {
      Array.prototype.forEach.call(box.children, function (n) {
        var on = n.getAttribute("data-id") === id;
        n.classList.toggle("active", on);
        if (on && box === $tabs && box.scrollWidth > box.clientWidth) {
          box.scrollTo({ left: n.offsetLeft - 16, behavior: REDUCED ? "auto" : "smooth" });
        }
      });
    });
  }

  // подсветка текущего раздела при прокрутке
  function observeSections() {
    window.removeEventListener("scroll", onScrollSpy);
    window.addEventListener("scroll", onScrollSpy, { passive: true });
  }
  var spyTick = false;
  function onScrollSpy() {
    if (spyTick) return;
    spyTick = true;
    requestAnimationFrame(function () {
      spyTick = false;
      var current = "top";
      var secs = $content.querySelectorAll(".section");
      Array.prototype.forEach.call(secs, function (s) {
        if (s.getBoundingClientRect().top < window.innerHeight * 0.35) current = s.getAttribute("data-nav");
      });
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4 && secs.length) {
        current = secs[secs.length - 1].getAttribute("data-nav");
      }
      if (current !== activeNav) setActiveNav(current);
    });
  }

  function renderSideLinks() {
    var $links = document.getElementById("side-links");
    $links.innerHTML = "";
    (cfg.links || []).forEach(function (l) {
      $links.appendChild(el("li", null, [
        el("a", { class: "side-link", href: l.url, target: "_blank", rel: "noopener" }, [
          icon(l.icon), l.name, el("span", { class: "go" }, [icon("external")]),
        ]),
      ]));
    });
    $links.parentElement.hidden = !(cfg.links && cfg.links.length);

    var $row = document.getElementById("links-list");
    $row.innerHTML = "";
    (cfg.links || []).forEach(function (l) {
      $row.appendChild(el("a", { class: "link-pill", href: l.url, target: "_blank", rel: "noopener" }, [
        icon(l.icon), l.name, el("span", { class: "go" }, [icon("external")]),
      ]));
    });
    document.getElementById("links-row").hidden = !(cfg.links && cfg.links.length);
  }

  // мобильное меню
  function closeMenu() { document.body.classList.remove("menu-open"); }
  document.getElementById("menu-btn").appendChild(icon("menu"));
  document.getElementById("menu-btn").addEventListener("click", function () {
    document.body.classList.toggle("menu-open");
  });
  document.getElementById("scrim").addEventListener("click", closeMenu);

  // ================= статистика =================
  var $stats = document.getElementById("stats");
  var statValues = {};

  function renderStats() {
    var featured = sections.filter(function (s) { return s.featured; })[0];
    var c = countStatus();
    var items = [
      { id: "all", label: "Всего приложений", value: allApps.length, icon: "grid", color: "blue", pct: 100, go: "top" },
      { id: "online", label: c.pending ? "Проверка связи…" : c.total ? "В сети из " + c.total : "Адреса не указаны", value: c.online, icon: "activity", color: "green",
        pct: c.total ? (c.online / c.total) * 100 : 0, action: function () { checkAll(true); } },
      { id: "mine", label: featured ? featured.title : "Разделов", value: featured ? featured.apps.length : sections.length,
        icon: featured ? featured.icon : "box", color: "gold", pct: featured ? (featured.apps.length / Math.max(allApps.length, 1)) * 100 : 100,
        go: featured ? featured.id : "top" },
      { id: "fav", label: "В избранном", value: state.favs.length, icon: "star", color: "violet",
        pct: (state.favs.length / Math.max(allApps.length, 1)) * 100, go: state.favs.length ? "fav" : null },
    ];

    if (!$stats.children.length) {
      items.forEach(function (it) {
        var b = el("button", { class: "stat", type: "button", "data-color": it.color, "data-id": it.id }, [
          el("span", { class: "stat-icon" }, [icon(it.icon)]),
          el("span", null, [el("div", { class: "stat-value", text: "0" }), el("div", { class: "stat-label" })]),
          el("span", { class: "stat-bar", style: "width:0" }),
        ]);
        $stats.appendChild(b);
      });
    }

    items.forEach(function (it, i) {
      var b = $stats.children[i];
      b.querySelector(".stat-label").textContent = it.label;
      b.onclick = function () {
        if (it.action) return it.action();
        if (!it.go) return toast("Нажмите ☆ на карточке, чтобы добавить в избранное", "star");
        var link = $nav.querySelector('[data-id="' + it.go + '"]');
        if (link) link.click();
      };
      countUp(b.querySelector(".stat-value"), statValues[it.id] || 0, it.value);
      statValues[it.id] = it.value;
      requestAnimationFrame(function () { b.querySelector(".stat-bar").style.width = Math.round(it.pct) + "%"; });
    });
  }

  function countUp(node, from, to) {
    if (REDUCED || from === to) { node.textContent = String(to); return; }
    var start = performance.now(), dur = 700;
    (function step(now) {
      var p = Math.min(1, (now - start) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      node.textContent = String(Math.round(from + (to - from) * e));
      if (p < 1) requestAnimationFrame(step);
    })(start);
  }

  // ================= недавние =================
  function renderRecent() {
    var $wrap = document.getElementById("recent");
    var $list = document.getElementById("recent-list");
    $list.innerHTML = "";
    state.recent.slice(0, 6).forEach(function (r) {
      var app = byKey[r.key];
      var pill = el("a", {
        class: "recent-pill",
        href: app.url,
        target: app.newTab !== false ? "_blank" : null,
        rel: "noopener",
        "data-color": app.color,
        title: app.description || app.name,
      }, [el("span", { class: "mini-icon" }, [icon(app.icon)]), app.name]);
      pill.addEventListener("click", function () { remember(app); });
      $list.appendChild(pill);
    });
    $wrap.hidden = !state.recent.length;
  }

  // ================= командная строка =================
  var $palette = document.getElementById("palette");
  var $pInput = document.getElementById("palette-search");
  var $pList = document.getElementById("palette-list");
  var pItems = [];
  var pActive = 0;
  var lastFocus = null;

  function commands() {
    var dark = root.getAttribute("data-theme") === "dark";
    var current = root.getAttribute("data-variant");
    return [
      { kind: "cmd", name: dark ? "Светлая тема" : "Тёмная тема", desc: "Сменить оформление", icon: dark ? "sun" : "moon", run: toggleTheme },
      { kind: "cmd", name: "Проверить доступность", desc: "Опросить все приложения", icon: "refresh", run: function () { checkAll(true); } },
    ].concat(VARIANTS.filter(function (v) { return v.id !== current; }).map(function (v) {
      return { kind: "cmd", name: "Вариант " + v.id.toUpperCase() + ": " + v.name, desc: v.desc, icon: "grid", run: function () { setVariant(v.id); } };
    }));
  }

  function score(hay, name, q) {
    var n = norm(name);
    if (n.indexOf(q) === 0) return 3;
    if (n.indexOf(q) !== -1) return 2;
    if (hay.indexOf(q) !== -1) return 1;
    // все слова запроса встречаются
    var words = q.split(/\s+/).filter(Boolean);
    if (words.length > 1 && words.every(function (w) { return hay.indexOf(w) !== -1; })) return 0.5;
    return 0;
  }

  function buildPalette(q) {
    var groups = [];
    if (!q) {
      var rec = state.recent.slice(0, 4).map(function (r) { return { kind: "app", app: byKey[r.key] }; });
      if (rec.length) groups.push({ title: "Недавние", items: rec });
      groups.push({ title: "Приложения", items: allApps.map(function (a) { return { kind: "app", app: a }; }) });
      groups.push({ title: "Команды", items: commands() });
    } else {
      var apps = allApps
        .map(function (a) { return { kind: "app", app: a, s: score(a.haystack, a.name, q) }; })
        .filter(function (x) { return x.s > 0; })
        .sort(function (x, y) { return y.s - x.s; });
      var links = (cfg.links || [])
        .map(function (l) { return { kind: "link", link: l, s: score(norm(l.name), l.name, q) }; })
        .filter(function (x) { return x.s > 0; });
      var cmds = commands()
        .map(function (c) { c.s = score(norm(c.name + " " + c.desc), c.name, q); return c; })
        .filter(function (c) { return c.s > 0; })
        .sort(function (x, y) { return y.s - x.s; });
      if (apps.length) groups.push({ title: "Приложения", items: apps });
      if (links.length) groups.push({ title: "Ссылки", items: links });
      if (cmds.length) groups.push({ title: "Команды", items: cmds });
      // группа с самым точным совпадением — первой
      groups.forEach(function (g, i) { g.best = g.items[0].s; g.order = i; });
      groups.sort(function (x, y) { return y.best - x.best || x.order - y.order; });
    }
    return groups;
  }

  function renderPalette() {
    var q = norm($pInput.value.trim());
    var groups = buildPalette(q);
    $pList.innerHTML = "";
    pItems = [];
    groups.forEach(function (g) {
      $pList.appendChild(el("div", { class: "pl-group", text: g.title }));
      g.items.forEach(function (it) {
        var idx = pItems.length;
        var row;
        if (it.kind === "app") {
          var a = it.app;
          row = el("button", { class: "pl-item", type: "button", role: "option", "data-color": a.color }, [
            el("span", { class: "mini-icon" }, [icon(a.icon)]),
            el("span", { class: "pl-text" }, [
              el("span", { class: "pl-name" }, [highlight(a.name, q)]),
              a.description ? el("span", { class: "pl-desc" }, [highlight(a.description, q)]) : null,
            ]),
            el("span", { class: "pl-meta", text: a.section }),
            el("span", { class: "pl-enter" }, [icon("arrow")]),
          ]);
          it.run = function () { openApp(a); };
        } else if (it.kind === "link") {
          row = el("button", { class: "pl-item", type: "button", role: "option" }, [
            el("span", { class: "mini-icon plain" }, [icon(it.link.icon)]),
            el("span", { class: "pl-text" }, [el("span", { class: "pl-name" }, [highlight(it.link.name, q)])]),
            el("span", { class: "pl-meta", text: "Внешняя ссылка" }),
            el("span", { class: "pl-enter" }, [icon("external")]),
          ]);
          it.run = function () { window.open(it.link.url, "_blank", "noopener"); };
        } else {
          row = el("button", { class: "pl-item", type: "button", role: "option" }, [
            el("span", { class: "mini-icon plain" }, [icon(it.icon)]),
            el("span", { class: "pl-text" }, [el("span", { class: "pl-name", text: it.name }), el("span", { class: "pl-desc", text: it.desc })]),
            el("span", { class: "pl-meta", text: "Команда" }),
            el("span", { class: "pl-enter" }, [icon("arrow")]),
          ]);
        }
        row.addEventListener("mousemove", function () { if (pActive !== idx) setPActive(idx, false); });
        row.addEventListener("click", function () { runPItem(idx); });
        it.node = row;
        pItems.push(it);
        $pList.appendChild(row);
      });
    });
    if (!pItems.length) {
      $pList.appendChild(el("div", { class: "pl-empty" }, ["Ничего не найдено по запросу «" + $pInput.value.trim() + "»"]));
    }
    setPActive(0, true);
  }

  function setPActive(i, scroll) {
    if (!pItems.length) return;
    pActive = (i + pItems.length) % pItems.length;
    pItems.forEach(function (it, j) {
      it.node.classList.toggle("active", j === pActive);
      it.node.setAttribute("aria-selected", j === pActive ? "true" : "false");
    });
    if (scroll) pItems[pActive].node.scrollIntoView({ block: "nearest" });
  }

  function runPItem(i) {
    var it = pItems[i];
    if (!it) return;
    closePalette();
    it.run();
  }

  function openPalette() {
    lastFocus = document.activeElement;
    $palette.hidden = false;
    document.body.style.overflow = "hidden";
    $pInput.value = "";
    renderPalette();
    $pInput.focus();
  }

  function closePalette() {
    if ($palette.hidden) return;
    $palette.hidden = true;
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  $pInput.addEventListener("input", renderPalette);
  $pInput.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown") { e.preventDefault(); setPActive(pActive + 1, true); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setPActive(pActive - 1, true); }
    else if (e.key === "Enter") { e.preventDefault(); runPItem(pActive); }
    else if (e.key === "Escape") { e.preventDefault(); closePalette(); }
  });
  $palette.addEventListener("click", function (e) {
    if (e.target.hasAttribute("data-close")) closePalette();
  });

  document.getElementById("cmdk-icon").appendChild(icon("search"));
  document.getElementById("palette-icon").appendChild(icon("search"));
  document.getElementById("cmdk-btn").addEventListener("click", openPalette);

  // ================= горячие клавиши =================
  document.addEventListener("keydown", function (e) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || "");
    if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K" || e.code === "KeyK")) {
      e.preventDefault();
      if ($palette.hidden) openPalette(); else closePalette();
      return;
    }
    if (typing || !$palette.hidden || e.ctrlKey || e.metaKey || e.altKey) {
      if (e.key === "Escape") closeMenu();
      return;
    }
    if (e.key === "/") { e.preventDefault(); openPalette(); }
    else if (/^[1-9]$/.test(e.key)) {
      var app = byKey[state.favs[Number(e.key) - 1]];
      if (app) openApp(app);
    } else if (e.key === "Escape") closeMenu();
  });

  // ================= тема и варианты оформления =================
  var $theme = document.getElementById("theme-toggle");
  var $variants = document.getElementById("variants");

  function paintToggles() {
    var dark = root.getAttribute("data-theme") === "dark";
    $theme.innerHTML = "";
    $theme.appendChild(icon(dark ? "sun" : "moon"));
    $theme.title = dark ? "Светлая тема" : "Тёмная тема";
    $theme.setAttribute("aria-label", $theme.title);

    var current = root.getAttribute("data-variant");
    Array.prototype.forEach.call($variants.querySelectorAll(".variant-btn"), function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-v") === current ? "true" : "false");
    });
  }

  function renderVariantSwitcher() {
    if (cfg.showVariantSwitcher === false) return;
    $variants.innerHTML = "";
    $variants.appendChild(el("span", { class: "variants-label", text: "Вариант" }));
    VARIANTS.forEach(function (v) {
      var b = el("button", { class: "variant-btn", type: "button", "data-v": v.id, title: v.name + " — " + v.desc }, [
        el("b", { text: v.id.toUpperCase() }), el("span", { text: v.name }),
      ]);
      b.addEventListener("click", function () { setVariant(v.id); });
      $variants.appendChild(b);
    });
    $variants.hidden = false;
  }

  function setVariant(id) {
    if (root.getAttribute("data-variant") === id) return;
    root.setAttribute("data-variant", id);
    try { localStorage.setItem(KEYS.variant, id); } catch (e) { /* ignore */ }
    if (/[?&]v=/.test(location.search) && window.history.replaceState) {
      window.history.replaceState(null, "", location.pathname + location.hash);
    }
    closeMenu();
    paintToggles();
    renderContent();
    var v = VARIANTS.filter(function (x) { return x.id === id; })[0];
    toast("Вариант " + id.toUpperCase() + ": " + v.name, "grid");
  }

  function toggleTheme() {
    var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem(KEYS.theme, next); } catch (e) { /* ignore */ }
    paintToggles();
    bg.recolor();
  }

  $theme.addEventListener("click", toggleTheme);

  // ================= шапка: часы и приветствие =================
  function initHero() {
    var titles = document.querySelectorAll(".js-title");
    var subs = document.querySelectorAll(".js-subtitle");
    if (cfg.title) {
      document.title = cfg.title;
      Array.prototype.forEach.call(titles, function (n) { n.textContent = cfg.title; });
    }
    Array.prototype.forEach.call(subs, function (n) { n.textContent = cfg.subtitle || ""; });
    document.getElementById("footer").textContent = (cfg.title || "Портал") + " · " + new Date().getFullYear();
    document.getElementById("recent-icon").appendChild(icon("history"));
    $recheck.appendChild(icon("refresh"));
    $recheck.addEventListener("click", function () { checkAll(true); });

    var $hm = document.getElementById("clock-hm");
    var $s = document.getElementById("clock-s");
    var $date = document.getElementById("hero-date");
    var $greet = document.getElementById("greeting");
    var $sub = document.getElementById("hero-sub");
    var lastGreeting = "";

    $sub.textContent = allApps.length + " " + plural(allApps.length, "приложение", "приложения", "приложений") +
      " в " + sections.length + " " + plural(sections.length, "разделе", "разделах", "разделах") +
      ". Нажмите Ctrl + K, чтобы быстро найти нужное.";

    function tick() {
      var d = new Date();
      var hh = String(d.getHours()).padStart(2, "0");
      var mm = String(d.getMinutes()).padStart(2, "0");
      $hm.textContent = hh + ":" + mm;
      $s.textContent = String(d.getSeconds()).padStart(2, "0");
      $date.textContent = d.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      var h = d.getHours();
      var g = h < 5 ? ["Доброй", "ночи"] : h < 12 ? ["Доброе", "утро"] : h < 18 ? ["Добрый", "день"] : ["Добрый", "вечер"];
      if (g.join(" ") !== lastGreeting) {
        lastGreeting = g.join(" ");
        $greet.innerHTML = "";
        $greet.appendChild(document.createTextNode(g[0] + " "));
        $greet.appendChild(el("span", { class: "accent", text: g[1] }));
      }
    }
    tick();
    setInterval(tick, 1000);
  }

  // ================= живой фон =================
  var bg = (function () {
    var canvas = document.getElementById("bg-canvas");
    var ctx = canvas.getContext && canvas.getContext("2d");
    var noop = { recolor: function () {} };
    if (!ctx || REDUCED) return noop;

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, pts = [], color = "185,135,31";
    var mouse = { x: -9999, y: -9999 };

    function recolor() {
      color = getComputedStyle(root).getPropertyValue("--particle").trim() || color;
    }

    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.round(Math.min(70, (W * H) / 26000));
      pts = [];
      for (var i = 0; i < n; i++) {
        pts.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
          r: Math.random() * 1.6 + 0.6,
        });
      }
    }

    function frame() {
      if (document.hidden) { requestAnimationFrame(frame); return; }
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        // лёгкое притяжение к курсору
        var dx = mouse.x - p.x, dy = mouse.y - p.y, dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 180) { p.vx += dx / dist * 0.012; p.vy += dy / dist * 0.012; }
        p.vx *= 0.99; p.vy *= 0.99;
        if (Math.abs(p.vx) < 0.05) p.vx += (Math.random() - 0.5) * 0.04;
        if (Math.abs(p.vy) < 0.05) p.vy += (Math.random() - 0.5) * 0.04;
        p.x += p.vx; p.y += p.vy;
        if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10;
        if (p.y < -10) p.y = H + 10; if (p.y > H + 10) p.y = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(" + color + ",.55)";
        ctx.fill();

        for (var j = i + 1; j < pts.length; j++) {
          var q = pts[j];
          var ex = p.x - q.x, ey = p.y - q.y, d2 = ex * ex + ey * ey;
          if (d2 < 130 * 130) {
            ctx.strokeStyle = "rgba(" + color + "," + (0.16 * (1 - Math.sqrt(d2) / 130)).toFixed(3) + ")";
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
      }
      requestAnimationFrame(frame);
    }

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", function (e) { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
    document.addEventListener("pointerleave", function () { mouse.x = mouse.y = -9999; });
    recolor(); resize(); requestAnimationFrame(frame);
    return { recolor: recolor };
  })();

  // ================= запуск =================
  function renderAll() {
    renderNav();
    renderContent();
    renderStats();
    renderRecent();
  }

  initHero();
  renderVariantSwitcher();
  paintToggles();
  renderSideLinks();
  renderAll();
  checkAll(false);
})();
