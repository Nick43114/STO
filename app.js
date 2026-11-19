(function () {
  "use strict";
  const C = window.STUDIO_CONFIG;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const money = n => new Intl.NumberFormat("uk-UA").format(n) + " " + C.currency;
  const duration = m => { const h = Math.floor(m / 60), r = m % 60; return (h ? h + " год" : "") + (h && r ? " " : "") + (r ? r + " хв" : ""); };
  const DAYS = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const pad = n => String(n).padStart(2, "0");
  const hm = m => pad(Math.floor(m / 60)) + ":" + pad(m % 60);
  const toMin = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const dateKey = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const parseKey = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  const longDate = k => parseKey(k).toLocaleDateString("uk-UA", { weekday: "long", day: "numeric", month: "long" });
  const serviceById = id => C.services.find(s => s.id === id);

  // ---------- Сховище записів (у цьому браузері; далі підключимо спільну базу) ----------
  const store = {
    get(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  const getBookings = () => store.get("sto_bookings", []);
  const getClosedDays = () => store.get("sto_closed_days", []);

  // ---------- Розрахунок вільного часу ----------
  function workHours(key) {
    if (getClosedDays().includes(key)) return null;
    const s = C.schedule[parseKey(key).getDay()];
    return s ? { open: toMin(s.open), close: toMin(s.close) } : null;
  }
  // Повертає номер вільного боксу або -1. Запас додається з обох боків запису.
  function freeBox(key, start, dur, bookings) {
    const buf = C.bufferMinutes, end = start + dur;
    for (let b = 0; b < C.boxes; b++) {
      const clash = bookings.some(x => x.date === key && x.box === b && start < x.end + buf && x.start < end + buf);
      if (!clash) return b;
    }
    return -1;
  }
  function slotsFor(key, service) {
    const wh = workHours(key);
    if (!wh) return [];
    const bookings = getBookings(), out = [];
    const now = new Date(), isToday = dateKey(now) === key, nowMin = now.getHours() * 60 + now.getMinutes();
    for (let t = wh.open; t + service.durationMin <= wh.close; t += C.slotStepMinutes) {
      const past = isToday && t < nowMin + C.minLeadMinutes;
      out.push({ start: t, free: !past && freeBox(key, t, service.durationMin, bookings) >= 0 });
    }
    return out;
  }
  function bookableDays() {
    const out = [], today = new Date();
    for (let i = 0; i <= C.bookingDaysAhead; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      out.push({ key: dateKey(d), d, open: !!workHours(dateKey(d)) });
    }
    return out;
  }

  // ---------- Шапка ----------
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

  // ---------- Картки ----------
  function serviceCard(s) {
    return `<article class="card service">
      <div class="service__icon">${esc(s.icon || "🔧")}</div>
      <div><h3>${esc(s.name)}</h3><p class="muted" style="margin:0">${esc(s.desc || "")}</p></div>
      <div class="service__meta"><span class="tag tag--price">від ${money(s.price)}</span>
        <span class="tag">⏱ ${duration(s.durationMin)}</span></div>
      <a class="btn btn--small" href="#/book?service=${encodeURIComponent(s.id)}">Записатися</a>
    </article>`;
  }

  // ---------- Контакти ----------
  function contactsView() {
    const c = C.contacts, rows = [];
    rows.push(`<a class="contact" href="tel:${esc(c.phone)}"><span class="contact__icon">📞</span><div><b>Телефон</b><span>${esc(c.phoneText)}</span></div></a>`);
    if (c.phone2) rows.push(`<a class="contact" href="tel:${esc(c.phone2)}"><span class="contact__icon">📞</span><div><b>Другий телефон</b><span>${esc(c.phone2Text || c.phone2)}</span></div></a>`);
    rows.push(`<a class="contact" ${c.mapUrl ? `href="${esc(c.mapUrl)}" target="_blank" rel="noopener"` : ""}><span class="contact__icon">📍</span><div><b>Адреса</b><span>${esc(c.address)}</span></div></a>`);
    rows.push(`<div class="contact"><span class="contact__icon">🕘</span><div><b>Графік роботи</b><span>${scheduleText()}</span></div></div>`);
    if (c.email) rows.push(`<a class="contact" href="mailto:${esc(c.email)}"><span class="contact__icon">✉️</span><div><b>Email</b><span>${esc(c.email)}</span></div></a>`);
    if (c.telegram) rows.push(`<a class="contact" href="${esc(c.telegram)}" target="_blank" rel="noopener"><span class="contact__icon">💬</span><div><b>Telegram</b><span>${esc(c.telegram.replace(/^https?:\/\//, ""))}</span></div></a>`);
    if (c.viber) rows.push(`<a class="contact" href="${esc(c.viber)}"><span class="contact__icon">📲</span><div><b>Viber</b><span>${esc(c.phoneText)}</span></div></a>`);
    if (c.instagram) rows.push(`<a class="contact" href="${esc(c.instagram)}" target="_blank" rel="noopener"><span class="contact__icon">📷</span><div><b>Instagram</b><span>${esc(c.instagram.replace(/^https?:\/\//, ""))}</span></div></a>`);
    return `<h1>Контакти</h1><div class="contact-list">${rows.join("")}</div>
      <a class="btn btn--block" href="tel:${esc(c.phone)}">Зателефонувати</a>`;
  }

  // ---------- Питання ----------
  const faqState = { i: 0 };
  function faqView() {
    const item = C.faq[faqState.i];
    return `<h1>Питання</h1><p class="muted">Оберіть питання — відповідь з'явиться нижче.</p>
      <div class="faq-buttons">${C.faq.map((f, i) => `<button type="button" class="faq-btn${i === faqState.i ? " active" : ""}" data-faq="${i}">${esc(f.q)}</button>`).join("")}</div>
      <div class="card faq-answer"><h3>${esc(item.q)}</h3><p style="margin:0">${esc(item.a)}</p></div>
      <div class="card callbox"><p style="margin:0">${esc(C.faqFallback)}</p>
        <a class="btn btn--block" href="tel:${esc(C.contacts.phone)}">📞 ${esc(C.contacts.phoneText)}</a></div>`;
  }

  // ---------- Запис ----------
  let B = null;
  function resetBooking(serviceId) {
    B = { serviceId: serviceId && serviceById(serviceId) ? serviceId : "", date: "", time: null, name: "", phone: "", error: "", done: null };
  }
  function bookView() {
    if (B.done) return bookDone(B.done);
    const svc = serviceById(B.serviceId);
    let html = `<h1>Запис</h1><p class="muted">Оберіть послугу, дату й вільну годину.</p>
      <div class="steps-title">1. Послуга</div>
      <select class="select" id="b-service"><option value="">— оберіть послугу —</option>
      ${C.services.map(s => `<option value="${esc(s.id)}"${s.id === B.serviceId ? " selected" : ""}>${esc(s.name)}  (${duration(s.durationMin)})</option>`).join("")}</select>`;
    if (svc) {
      html += `<div class="steps-title">2. Дата</div><div class="days" id="b-days">${bookableDays().map(x =>
        `<button type="button" class="day${x.key === B.date ? " active" : ""}" data-date="${x.key}"${x.open ? "" : " disabled"}>
          <small>${DAYS[x.d.getDay()]}</small><b>${x.d.getDate()}</b><small>${x.d.toLocaleDateString("uk-UA", { month: "short" }).replace(".", "")}</small></button>`).join("")}</div>`;
    }
    if (svc && B.date) {
      const slots = slotsFor(B.date, svc);
      html += `<div class="steps-title">3. Година</div>`;
      if (!slots.some(s => s.free)) html += `<div class="card muted">На цей день вільного часу немає. Оберіть іншу дату.</div>`;
      else html += `<div class="times">${slots.map(s => `<button type="button" class="time${s.start === B.time ? " active" : ""}" data-time="${s.start}"${s.free ? "" : " disabled"}>${hm(s.start)}</button>`).join("")}</div>`;
    }
    if (svc && B.date && B.time !== null) {
      html += `<div class="steps-title">4. Ваші дані</div>
        <div class="field"><label for="b-name">Ім'я</label><input class="input" id="b-name" autocomplete="name" value="${esc(B.name)}" placeholder="Ваше ім'я"></div>
        <div class="field"><label for="b-phone">Телефон</label><input class="input" id="b-phone" type="tel" inputmode="tel" autocomplete="tel" value="${esc(B.phone)}" placeholder="+38 0XX XXX XX XX"></div>
        ${B.error ? `<div class="error">${esc(B.error)}</div>` : ""}
        <div class="card summary"><b>Ваш запис</b><dl>
          <dt>Послуга</dt><dd>${esc(svc.name)}</dd><dt>Дата</dt><dd>${esc(longDate(B.date))}</dd>
          <dt>Час</dt><dd>${hm(B.time)}–${hm(B.time + svc.durationMin)}</dd><dt>Вартість</dt><dd>від ${money(svc.price)}</dd></dl></div>
        <button class="btn btn--block" id="b-submit" type="button" style="margin-top:14px">Підтвердити запис</button>`;
    }
    return html;
  }
  function bookDone(b) {
    return `<div class="card" style="text-align:center"><div class="ok-badge">✓</div><h2>Запис підтверджено</h2>
      <p class="muted">Чекаємо вас у «${esc(C.name)}».</p></div>
      <div class="card summary" style="margin-top:12px"><dl>
        <dt>Послуга</dt><dd>${esc(b.serviceName)}</dd><dt>Дата</dt><dd>${esc(longDate(b.date))}</dd>
        <dt>Час</dt><dd>${hm(b.start)}–${hm(b.end)}</dd><dt>Ім'я</dt><dd>${esc(b.name)}</dd>
        <dt>Телефон</dt><dd>${esc(b.phone)}</dd><dt>Адреса</dt><dd>${esc(C.contacts.address)}</dd></dl></div>
      <p class="muted" style="margin-top:12px">Щоб змінити або скасувати запис, зателефонуйте: <a href="tel:${esc(C.contacts.phone)}" style="color:var(--accent)">${esc(C.contacts.phoneText)}</a></p>
      <a class="btn btn--ghost btn--block" href="#/book" id="b-new">Зробити ще один запис</a>`;
  }
  function submitBooking() {
    const svc = serviceById(B.serviceId);
    const name = B.name.trim(), digits = B.phone.replace(/\D/g, "");
    if (name.length < 2) { B.error = "Вкажіть ім'я."; return rerender(); }
    if (digits.length < 10 || digits.length > 12) { B.error = "Вкажіть коректний номер телефону."; return rerender(); }
    // Повторна перевірка перед збереженням — захист від подвійного запису
    const bookings = getBookings();
    const box = freeBox(B.date, B.time, svc.durationMin, bookings);
    if (box < 0 || !workHours(B.date)) { B.time = null; B.error = "На жаль, цю годину вже зайняли. Оберіть іншу."; return rerender(); }
    const rec = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), serviceId: svc.id, serviceName: svc.name,
      date: B.date, start: B.time, end: B.time + svc.durationMin, box, name, phone: B.phone.trim(), createdAt: new Date().toISOString(), status: "new" };
    bookings.push(rec);
    store.set("sto_bookings", bookings);
    B.done = rec;
    rerender();
  }

  // ---------- Маршрутизація ----------
  const views = {
    "/": () => `
      <section class="hero" ${C.photos.hero ? `style="background-image:linear-gradient(rgba(20,23,28,.65),rgba(20,23,28,.85)),url('${esc(C.photos.hero)}')"` : ""}>
        <h1>${esc(C.name)}</h1><p>${esc(C.slogan)}</p>
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
    "/services": () => `<h1>Послуги</h1><p class="muted">Ціни орієнтовні — точну вартість узгоджуємо до початку робіт.</p>
      <div class="grid">${C.services.map(serviceCard).join("")}</div>`,
    "/book": bookView,
    "/faq": faqView,
    "/contacts": contactsView
  };
  let currentPath = "/";
  function rerender() {
    const days = $("#b-days"), left = days ? days.scrollLeft : 0, top = window.scrollY;
    $("#view").innerHTML = (views[currentPath] || views["/"])();
    const d2 = $("#b-days"); if (d2) d2.scrollLeft = left;
    window.scrollTo(0, top);
  }
  function route() {
    const raw = location.hash.replace(/^#/, "") || "/";
    const [path, query] = raw.split("?");
    currentPath = views[path] ? path : "/";
    if (currentPath === "/book") resetBooking(new URLSearchParams(query || "").get("service"));
    if (currentPath === "/faq") faqState.i = 0;
    $("#view").innerHTML = views[currentPath]();
    document.querySelectorAll(".tabbar a").forEach(a => a.classList.toggle("active", a.dataset.route === currentPath));
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  // Повторний натиск на той самий розділ (хеш не змінюється) — оновлює його
  document.addEventListener("click", e => {
    const a = e.target.closest("a[href^='#/']");
    if (a && a.getAttribute("href") === (location.hash || "#/")) { e.preventDefault(); route(); }
  });

  const view = $("#view");
  view.addEventListener("click", e => {
    const t = e.target.closest("[data-faq],[data-date],[data-time],#b-submit");
    if (!t) return;
    if (t.dataset.faq !== undefined) { faqState.i = +t.dataset.faq; return rerender(); }
    if (t.dataset.date) { B.date = t.dataset.date; B.time = null; B.error = ""; return rerender(); }
    if (t.dataset.time) { B.time = +t.dataset.time; B.error = ""; return rerender(); }
    if (t.id === "b-submit") submitBooking();
  });
  view.addEventListener("change", e => {
    if (e.target.id === "b-service") { B.serviceId = e.target.value; B.time = null; B.error = ""; rerender(); }
  });
  view.addEventListener("input", e => {
    if (e.target.id === "b-name") B.name = e.target.value;
    if (e.target.id === "b-phone") B.phone = e.target.value;
  });
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

  $("#install-icon").src = C.logo;
  $("#install-name").textContent = C.name;
  $("#install-text").textContent = C.install.text;
  $("#install-btn").textContent = C.install.button;

  const alreadyAdded = () => isStandalone() || safeGet(FLAG) === "1";
  function showBanner() {
    if (alreadyAdded()) { banner.hidden = true; return; }
    const steps = $("#install-steps"), hint = $("#install-hint"), btn = $("#install-btn");
    if (deferredPrompt) {                       // Android / Chrome: системне вікно встановлення
      steps.hidden = true; hint.hidden = true; btn.hidden = false;
    } else if (isIOS) {                         // iPhone / iPad: інструкція з трьох кроків
      steps.hidden = false; hint.hidden = true; btn.hidden = true;
    } else {                                    // інші браузери
      steps.hidden = true; btn.hidden = true; hint.hidden = false;
      hint.textContent = "Відкрийте меню браузера (⋮) і оберіть «Додати на головний екран» або «Встановити застосунок».";
    }
    banner.hidden = false;
  }
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredPrompt = e; showBanner(); });
  window.addEventListener("appinstalled", () => { safeSet(FLAG, "1"); banner.hidden = true; deferredPrompt = null; });

  $("#install-btn").addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (choice.outcome === "accepted") { safeSet(FLAG, "1"); banner.hidden = true; } else showBanner();
  });
  $("#install-close").addEventListener("click", () => { banner.hidden = true; }); // лише на цей захід

  if (navigator.getInstalledRelatedApps) {
    navigator.getInstalledRelatedApps().then(apps => {
      if (apps && apps.length) { safeSet(FLAG, "1"); banner.hidden = true; }
    }).catch(() => {});
  }
  // iPhone: показуємо одразу. Інші браузери: даємо 2 с, щоб браузер сам повідомив,
  // що застосунок можна встановити (або що він уже встановлений) — тоді зайвого вікна не буде.
  if (isIOS) showBanner();
  else setTimeout(() => { if (banner.hidden && !alreadyAdded()) showBanner(); }, 2000);

  // Якщо клієнт додав застосунок, поки сторінка відкрита — підказка зникає одразу
  const mq = window.matchMedia("(display-mode: standalone)");
  const onMode = e => { if (e.matches) { safeSet(FLAG, "1"); banner.hidden = true; } };
  if (mq.addEventListener) mq.addEventListener("change", onMode);

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
