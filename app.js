(function () {
  "use strict";
  const C = window.STUDIO_CONFIG;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const money = n => new Intl.NumberFormat("uk-UA").format(n) + " " + C.currency;
  const duration = m => { const h = Math.floor(m / 60), r = m % 60; return (h ? h + " год" : "") + (h && r ? " " : "") + (r ? r + " хв" : ""); };
  const DAYS = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

  // ---------- Шапка, назва, логотип ----------
  document.title = C.name + " — запис онлайн";
  $("#brand-name").textContent = C.name;
  $("#brand-logo").src = C.logo;

  function scheduleText() {
    const order = [1, 2, 3, 4, 5, 6, 0], parts = [];
    let i = 0;
    while (i < order.length) {
      const d = order[i], s = C.schedule[d]; let j = i;
      const key = s ? s.open + "–" + s.close : "вихідний";
      while (j + 1 < order.length) {
        const n = C.schedule[order[j + 1]];
        if ((n ? n.open + "–" + n.close : "вихідний") === key) j++; else break;
      }
      parts.push((i === j ? DAYS[d] : DAYS[d] + "–" + DAYS[order[j]]) + ": " + key);
      i = j + 1;
    }
    return parts.join("<br>");
  }

  // ---------- Розділи ----------
  function serviceCard(s) {
    return `<article class="card service">
      <div class="service__icon">${esc(s.icon || "🔧")}</div>
      <div><h3>${esc(s.name)}</h3><p class="muted" style="margin:0">${esc(s.desc || "")}</p></div>
      <div class="service__meta"><span class="tag tag--price">від ${money(s.price)}</span>
        <span class="tag">⏱ ${duration(s.durationMin)}</span></div>
      <a class="btn btn--small" href="#/book?service=${encodeURIComponent(s.id)}">Записатися</a>
    </article>`;
  }

  const views = {
    "/": () => `
      <section class="hero" ${C.photos.hero ? `style="background-image:linear-gradient(rgba(20,23,28,.65),rgba(20,23,28,.85)),url('${esc(C.photos.hero)}')"` : ""}>
        <h1>${esc(C.name)}</h1>
        <p>${esc(C.slogan)}</p>
        <a class="btn" href="#/book">Записатися на годину</a>
      </section>
      <div class="info-row">
        <div class="chip"><span>🕘</span><div><b>Графік роботи</b>${scheduleText()}</div></div>
        <div class="chip"><span>📍</span><div><b>Адреса</b>${esc(C.contacts.address)}</div></div>
        <a class="chip" href="tel:${esc(C.contacts.phone)}"><span>📞</span><div><b>Телефон</b>${esc(C.contacts.phoneText)}</div></a>
      </div>
      <div class="section-title"><h2>Популярні послуги</h2><a href="#/services">Усі послуги →</a></div>
      <div class="grid">${C.services.slice(0, 3).map(serviceCard).join("")}</div>
      <div class="section-title"><h2>Чому ми</h2></div>
      <div class="grid">${C.advantages.map(a =>
        `<div class="card adv"><div class="adv__icon">${esc(a.icon)}</div><div><h3>${esc(a.title)}</h3><p class="muted" style="margin:0">${esc(a.text)}</p></div></div>`).join("")}</div>`,

    "/services": () => `
      <h1>Послуги</h1>
      <p class="muted">Ціни орієнтовні — точну вартість узгоджуємо до початку робіт.</p>
      <div class="grid">${C.services.map(serviceCard).join("")}</div>`,

    "/book":     () => stub("📅", "Запис", "Цей розділ буде на наступному кроці: вибір послуги, дати й вільної години."),
    "/faq":      () => stub("❓", "Питання", "Цей розділ буде на наступному кроці: кнопки з готовими відповідями."),
    "/contacts": () => stub("📍", "Контакти", "Цей розділ буде на одному з наступних кроків.")
  };
  function stub(icon, title, text) {
    return `<div class="stub card"><div class="big">${icon}</div><h2>${title}</h2><p class="muted">${text}</p></div>`;
  }

  function route() {
    const path = (location.hash.replace(/^#/, "") || "/").split("?")[0];
    const render = views[path] || views["/"];
    $("#view").innerHTML = render();
    document.querySelectorAll(".tabbar a").forEach(a => a.classList.toggle("active", a.dataset.route === (views[path] ? path : "/")));
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  route();

  // ---------- Підказка «Додайте на головний екран» ----------
  // Показуємо при кожному заході, поки застосунок НЕ доданий на головний екран.
  const FLAG = "sto_installed";
  const isStandalone = () =>
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.navigator.standalone === true;
  const safeGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const safeSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

  const banner = $("#install-banner");
  let deferredPrompt = null;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (isStandalone()) safeSet(FLAG, "1");          // запущено з головного екрана

  function showBanner() {
    if (isStandalone() || safeGet(FLAG) === "1") { banner.hidden = true; return; }
    $("#install-text").textContent = C.install.text;
    $("#install-btn").textContent = C.install.button;
    $("#install-ios").hidden = !(isIOS && !deferredPrompt);
    banner.hidden = false;
  }

  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferredPrompt = e;
    showBanner();
  });
  window.addEventListener("appinstalled", () => {
    safeSet(FLAG, "1");
    banner.hidden = true;
    deferredPrompt = null;
  });

  $("#install-btn").addEventListener("click", async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (choice.outcome === "accepted") { safeSet(FLAG, "1"); banner.hidden = true; }
    } else {
      // немає системного вікна (iOS, Safari, інші) — показуємо інструкцію
      $("#install-ios").hidden = false;
      if (!isIOS) $("#install-ios").textContent = "У меню браузера (⋮) оберіть «Додати на головний екран» або «Встановити застосунок».";
    }
  });
  $("#install-close").addEventListener("click", () => { banner.hidden = true; }); // лише на цей захід

  // Якщо браузер повідомляє про вже встановлений застосунок — ховаємо підказку
  if (navigator.getInstalledRelatedApps) {
    navigator.getInstalledRelatedApps().then(apps => {
      if (apps && apps.length) { safeSet(FLAG, "1"); banner.hidden = true; }
    }).catch(() => {});
  }
  showBanner();

  // ---------- Service worker ----------
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
