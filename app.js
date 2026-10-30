// Renders the site from data/videos.json. To add or reorder videos, edit that file only.
(async function () {
  const EMBED = window.SITE_EMBED !== false; // the preview build turns inline playback off
  const data = window.SITE_DATA || (await fetch("data/videos.json").then((r) => r.json()));
  const pages = data.pages;
  const $ = (id) => document.getElementById(id);
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else n.setAttribute(k, v);
    }
    n.append(...kids.filter(Boolean));
    return n;
  };

  $("year").textContent = new Date().getFullYear();
  $("role").textContent = data.site.role;

  // Nav: site pages, plus extra links (e.g. MicroDramas) slotted after the first page
  const nav = $("nav");
  const navLinks = {};
  pages.forEach((p, i) => {
    const a = el("a", { href: "#" + p.id, text: p.label });
    navLinks[p.id] = a;
    nav.append(a);
    if (i === 0) for (const x of data.site.external || [])
      nav.append(/^https?:/.test(x.url)
        ? el("a", { href: x.url, class: "ext", target: "_blank", rel: "noopener", text: x.label })
        : el("a", { href: x.url, text: x.label }));
  });

  // Video helpers
  const watchUrl = (v) => v.youtube
    ? `https://www.youtube.com/watch?v=${v.youtube}${v.start ? "&t=" + v.start + "s" : ""}`
    : `https://vimeo.com/${v.vimeo}${v.hash ? "/" + v.hash : ""}`;
  const embedUrl = (v) => v.youtube
    ? `https://www.youtube-nocookie.com/embed/${v.youtube}?autoplay=1&rel=0${v.start ? "&start=" + v.start : ""}`
    : `https://player.vimeo.com/video/${v.vimeo}?autoplay=1${v.hash ? "&h=" + v.hash : ""}`;
  const thumbSrc = (t) => (t && t.includes("squarespace-cdn.com") ? t + "?format=750w" : t);

  function poster(title) { return el("div", { class: "poster", text: title }); }

  function card(v, kicker) {
    const thumb = el("div", { class: "thumb" });
    if (v.thumb) {
      const img = el("img", { src: thumbSrc(v.thumb), alt: "", loading: kicker ? "eager" : "lazy", decoding: "async" });
      img.addEventListener("error", () => img.replaceWith(poster(v.title)), { once: true });
      thumb.append(img);
    } else thumb.append(poster(v.title));
    const b = el("button", { class: "card", type: "button", "aria-label": "Play " + v.title },
      thumb, kicker ? el("span", { class: "kicker", text: kicker }) : null, el("span", { class: "title", text: v.title }));
    b.addEventListener("click", () => openViewer(v));
    return el("li", {}, b);
  }

  // Cover flow (Cover Room): series switch, tilted 16:9 covers, now-playing details.
  // Click a side cover, use the arrows, swipe, or press ←/→ to move; click the centre cover or Play to watch.
  const flowState = {};
  function coverflow(s) {
    const st = flowState[s.title] || (flowState[s.title] = { series: 0, idx: null });
    const sec = el("section", { class: "section flow" });
    const pills = el("div", { class: "pills", role: "tablist", "aria-label": s.title + " series" });
    const stage = el("div", { class: "flow-stage", tabindex: "0", "aria-roledescription": "carousel", "aria-label": s.title });
    const prev = el("button", { class: "flow-arrow prev", type: "button", "aria-label": "Previous video" });
    const next = el("button", { class: "flow-arrow next", type: "button", "aria-label": "Next video" });
    const now = el("div", { class: "flow-now", "aria-live": "polite" });
    sec.append(
      el("div", { class: "section-head centered" }, el("h2", { text: s.title })),
      s.intro ? el("p", { class: "intro centered", text: s.intro }) : null,
      pills, stage, now);
    let covers = [];

    function items() { return s.series[st.series].items; }
    function build() {
      const list = items();
      if (st.idx == null || st.idx >= list.length) st.idx = Math.floor((list.length - 1) / 2);
      pills.replaceChildren(...s.series.map((ser, j) => {
        const b = el("button", { class: "pill", type: "button", role: "tab", "aria-selected": String(j === st.series) },
          ser.title, el("span", { class: "count", text: String(ser.items.length).padStart(2, "0") }));
        b.addEventListener("click", () => { if (j !== st.series) { st.series = j; st.idx = null; build(); } });
        return b;
      }));
      covers = list.map((v, i) => {
        const b = el("button", { class: "cover", type: "button", "aria-label": `${v.artist}: ${v.song}` });
        if (v.thumb) b.append(el("img", { src: thumbSrc(v.thumb), alt: "", decoding: "async", draggable: "false" }));
        else b.append(poster(v.title));
        b.addEventListener("click", () => { if (swiped) return; i === st.idx ? openViewer(v) : go(i); });
        return b;
      });
      stage.replaceChildren(...covers, prev, next);
      layout();
    }
    function go(i) { st.idx = Math.max(0, Math.min(i, items().length - 1)); layout(); }
    function layout() {
      const list = items(), w = stage.clientWidth || 1000;
      const W = Math.min(480, w * 0.7), k = W / 480;
      stage.style.setProperty("--cw", W + "px");
      covers.forEach((c, i) => {
        const d = i - st.idx, a = Math.abs(d), sg = Math.sign(d);
        const x = d === 0 ? 0 : sg * (300 + (a - 1) * 104) * k;
        c.style.transform = `translateX(${x}px) translateZ(${d === 0 ? 120 * k : -120 * k}px) rotateY(${d === 0 ? 0 : -sg * 58}deg)`;
        c.style.zIndex = 40 - a;
        c.classList.toggle("is-center", d === 0);
        c.classList.toggle("is-left", d < 0);
        c.classList.toggle("is-hidden", a > 4);
        c.tabIndex = d === 0 ? 0 : -1;
      });
      prev.disabled = st.idx === 0;
      next.disabled = st.idx === list.length - 1;
      const v = list[st.idx];
      const play = el("button", { class: "flow-play", type: "button" }, "Play");
      play.addEventListener("click", () => openViewer(v));
      now.replaceChildren(
        el("p", { class: "flow-kicker", text: `${s.series[st.series].title} · Track ${String(st.idx + 1).padStart(2, "0")}` }),
        el("p", { class: "flow-artist", text: v.artist }),
        el("p", { class: "flow-song" }, v.song, v.coverOf ? el("span", { text: ` · ${v.coverOf} cover` }) : null),
        play);
    }
    prev.addEventListener("click", () => go(st.idx - 1));
    next.addEventListener("click", () => go(st.idx + 1));
    stage.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") { go(st.idx - 1); e.preventDefault(); }
      if (e.key === "ArrowRight") { go(st.idx + 1); e.preventDefault(); }
    });
    let x0 = null, swiped = false;
    stage.addEventListener("pointerdown", (e) => { x0 = e.clientX; swiped = false; });
    stage.addEventListener("pointercancel", () => { x0 = null; });
    stage.addEventListener("dragstart", (e) => e.preventDefault());
    stage.addEventListener("pointerup", (e) => {
      if (x0 == null) return;
      const dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) { swiped = true; go(st.idx + (dx < 0 ? 1 : -1)); }
    });
    new ResizeObserver(() => layout()).observe(stage);
    build();
    return sec;
  }

  // Tabbed layout (Other Videos): one tab per section, first video featured large
  const tabState = {};
  function renderTabs(page, main) {
    const i = Math.min(tabState[page.id] || 0, page.sections.length - 1);
    const s = page.sections[i];
    const tabs = el("div", { class: "tabs", role: "tablist", "aria-label": page.label },
      ...page.sections.map((sec, j) => {
        const n = sec.items.length;
        const b = el("button", { class: "tab", type: "button", role: "tab", "aria-selected": String(j === i) },
          sec.title, el("span", { class: "count", text: String(n).padStart(2, "0") }));
        b.addEventListener("click", () => { tabState[page.id] = j; render(page.id); });
        return b;
      }));
    const [first, ...others] = s.items;
    const side = others.slice(0, 2), rest = others.slice(2);
    main.append(tabs, el("div", { class: "feature-row", role: "tabpanel" },
      el("ul", { class: "feature" }, card(first, "Featured · " + s.title)),
      el("ul", { class: "feature-side" }, ...side.map((v) => card(v)))));
    if (rest.length) main.append(el("section", { class: "rest" }, el("ul", { class: "grid" }, ...rest.map((v) => card(v)))));
  }

  function render(id) {
    const page = pages.find((p) => p.id === id) || pages[0];
    for (const [k, a] of Object.entries(navLinks))
      k === page.id ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current");
    document.title = page === pages[0] ? data.site.name : `${page.label} · ${data.site.name}`;
    const main = $("main");
    main.replaceChildren();

    if (page.layout === "tabs") { renderTabs(page, main); return; }
    if (page.about) {
      const links = el("p", { class: "about-links" },
        ...page.about.links.map((l) => el("a", { href: l.url, target: "_blank", rel: "noopener", text: l.label })));
      main.append(el("section", { class: "about" }, ...page.about.paragraphs.map((t) => el("p", { text: t })), links));
      return;
    }
    for (const s of page.sections) {
      if (s.layout === "coverflow") { main.append(coverflow(s)); continue; }
      const n = s.items.length;
      main.append(el("section", { class: "section" },
        el("div", { class: "section-head" },
          el("h2", { text: s.title }),
          el("span", { class: "count", text: `${String(n).padStart(2, "0")} ${n === 1 ? "video" : "videos"}` })),
        s.intro ? el("p", { class: "intro", text: s.intro }) : null,
        el("ul", { class: "grid" }, ...s.items.map((v) => card(v)))));
    }
  }

  // Viewer
  const dlg = $("viewer");
  let lastFocus = null;
  function openViewer(v) {
    lastFocus = document.activeElement;
    const frame = $("viewer-frame");
    if (EMBED) {
      frame.replaceChildren(el("iframe", {
        src: embedUrl(v), title: v.title,
        allow: "autoplay; fullscreen; picture-in-picture; encrypted-media", allowfullscreen: "",
      }));
    } else {
      frame.replaceChildren(v.thumb ? el("img", { src: thumbSrc(v.thumb), alt: "" }) : poster(v.title));
    }
    $("viewer-title").textContent = v.title;
    $("viewer-desc").textContent = v.description || "";
    const link = $("viewer-link");
    link.href = watchUrl(v);
    link.textContent = `Watch on ${v.youtube ? "YouTube" : "Vimeo"} ↗`;
    dlg.showModal();
  }
  function closeViewer() { if (dlg.open) dlg.close(); }
  dlg.addEventListener("close", () => { $("viewer-frame").replaceChildren(); lastFocus && lastFocus.focus(); });
  $("viewer-close").addEventListener("click", closeViewer);
  dlg.addEventListener("click", (e) => { if (e.target === dlg || e.target.classList.contains("viewer-inner")) closeViewer(); });

  // Routing: #comedy, #music, #other, #about
  const route = () => { closeViewer(); render(location.hash.slice(1)); };
  window.addEventListener("hashchange", () => { route(); window.scrollTo(0, 0); });
  route();
})();
