// Renders the site from data/videos.json. To add or reorder videos, edit that file only.
(async function () {
  const EMBED = window.SITE_EMBED !== false; // the preview build turns inline playback off
  const data = window.SITE_DATA || (await fetch("data/videos.json").then((r) => r.json()));
  const pages = data.pages;
  // Videos marked "hidden": true in the data file (e.g. ones that went private) are left out everywhere,
  // including counts and Shuffle. Remove the flag to bring one back.
  const visible = (list) => list.filter((v) => !v.hidden);
  for (const p of pages) for (const s of p.sections || []) {
    if (s.items) s.items = visible(s.items);
    for (const ser of s.series || []) ser.items = visible(ser.items);
  }
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
    if (p.nav === false) return; // still reachable by link and through Shuffle, just not in the menu
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

  // ---------- Landing page: featured video + shuffled sketch wall ----------
  // The featured video sits top-left; beside it, the jump links and the Shuffle button;
  // the sketches start at the featured picture's midpoint and fill the rest in three sizes,
  // in a new random order (and random sizes) on every visit.
  const shuffled = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  let wallCleanup = null;

  function allVideos() {
    const out = [];
    for (const p of pages) {
      if (p.featured) out.push(p.featured);
      for (const s of p.sections || []) {
        for (const v of s.items || []) out.push(v);
        for (const ser of s.series || []) for (const v of ser.items) out.push(v);
      }
    }
    const seen = new Set();
    return out.filter((v) => { const k = v.youtube || v.vimeo; if (seen.has(k)) return false; seen.add(k); return true; });
  }
  function shufflePool() {
    const vids = allVideos().map((v) => ({ v }));
    const md = data.site.microdramas;
    const eps = [];
    if (md) for (const s of md.seasons) for (let n = 1; n <= s.episodes; n++) eps.push({ href: `${md.href}#${s.key}-${n}`, title: `${md.title} · ${s.key.toUpperCase()} Ep ${n}` });
    return vids.concat(eps);
  }
  function playRandom() {
    const pool = shufflePool();
    let recent = [];
    try { recent = JSON.parse(sessionStorage.getItem("recentShuffle") || "[]"); } catch (e) {}
    const key = (x) => x.href || x.v.youtube || x.v.vimeo;
    const fresh = pool.filter((x) => !recent.includes(key(x)));
    const pick = (fresh.length ? fresh : pool)[Math.floor(Math.random() * (fresh.length || pool.length))];
    try { sessionStorage.setItem("recentShuffle", JSON.stringify([key(pick), ...recent].slice(0, 20))); } catch (e) {}
    if (pick.href) location.href = pick.href; else openViewer(pick.v, { shuffle: true });
  }

  function wallCard(v, size) {
    const li = card(v);
    li.className = "w-item w-" + size;
    return li;
  }

  function renderWall(page, main) {
    if (wallCleanup) wallCleanup();
    const f = page.featured;
    const grid = el("ul", { class: "wall" });

    const feat = el("li", { class: "w-feature" });
    const fb = el("button", { class: "card", type: "button", "aria-label": "Play " + f.title },
      el("div", { class: "thumb vig" }, el("img", { src: f.thumb, alt: "", decoding: "async" }), el("span", { class: "big-play", "aria-hidden": "true" })),
      el("span", { class: "kicker", text: f.kicker || "Featured" }),
      el("span", { class: "title", text: f.title }));
    fb.addEventListener("click", () => openViewer(f));
    feat.append(fb);

    const nav = el("li", { class: "w-jump" });
    const jl = el("nav", { "aria-label": "More to watch" },
      ...(page.jump || []).map((j) => el("a", { href: j.href },
        el("span", { class: "j-label", text: j.label }), el("span", { class: "j-note", text: j.note + " →" }))));
    const sh = el("button", { class: "shuffle", type: "button", "aria-label": "Shuffle: play a random video from the site" },
      el("span", { class: "shuffle-icon", "aria-hidden": "true" }), "Shuffle");
    sh.addEventListener("click", playRandom);
    const jumpInner = el("div", { class: "jump-inner" }, jl, sh, el("p", { class: "j-count", text: `Any of ${shufflePool().length} videos` }));
    nav.append(jumpInner);

    const sizes = shuffled(page.sections[0].items.map((_, i) => ["s", "s", "m", "m", "l"][i % 5]));
    const items = shuffled(page.sections[0].items).map((v, i) => wallCard(v, sizes[i]));
    grid.append(feat, nav, ...items);
    main.append(el("section", { class: "wall-wrap" }, grid));

    // Size each tile's row span from its real height so titles never collide (masonry on an 8px row grid).
    const fit = () => {
      const cs = getComputedStyle(grid);
      const row = parseFloat(cs.gridAutoRows) || 8, gap = parseFloat(cs.rowGap) || 0;
      const span = (h) => Math.max(1, Math.ceil((h + gap) / (row + gap)));
      const wide = grid.classList.toggle("is-wide", parseInt(cs.getPropertyValue("--cols")) >= 8);
      const fCard = feat.firstElementChild, fThumb = fCard.querySelector(".thumb");
      feat.style.gridRowEnd = "span " + span(fCard.offsetHeight + (wide ? 48 : 28));
      // Wide: the sketches beside the featured video start at its picture's midpoint (or below the links if those run longer).
      nav.style.gridRowEnd = "span " + span(wide ? Math.max(fThumb.offsetHeight / 2, jumpInner.offsetHeight + 16) : jumpInner.offsetHeight + 32);
      for (const li of items) li.style.gridRowEnd = "span " + span(li.firstElementChild.offsetHeight + 20);
    };
    const ro = new ResizeObserver(fit);
    ro.observe(grid);
    requestAnimationFrame(fit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

    const bg = backdrop();
    wallCleanup = () => { ro.disconnect(); bg(); wallCleanup = null; };
  }

  // Background drawing behind the landing page: straight lines, right-angle elbows and arrowheads
  // on an 8px grid, like blocking marks on a studio floor plan. It drifts slightly slower than the scroll.
  function backdrop() {
    const H = 8000, W = 1600;
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "backdrop");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMin slice");
    const snap = (v) => Math.round(v / 8) * 8, r = Math.random;
    let solid = "", dashed = "", heads = "", marks = "", tally = "";
    const count = Math.round(H / 70);
    for (let i = 0; i < count; i++) {
      let x = snap(r() * W), y = snap(200 + r() * (H - 300)), d = `M${x} ${y}`;
      const ox = x, oy = y;
      let horiz = r() < 0.5, dx = 0, dy = 0;
      for (let k = 0, n = 1 + Math.floor(r() * 3); k < n; k++) {
        const len = snap(48 + r() * 220) * (r() < 0.5 ? -1 : 1);
        dx = horiz ? len : 0; dy = horiz ? 0 : len;
        x = Math.max(8, Math.min(W - 8, x + dx)); y = Math.max(8, Math.min(H - 8, y + dy));
        d += ` L${x} ${y}`; horiz = !horiz;
      }
      if (r() < 0.3) dashed += d + " "; else solid += d + " ";
      const a = Math.atan2(Math.sign(dy), Math.sign(dx));
      const hp = (t) => `${(x - 8 * Math.cos(a + t)).toFixed(1)} ${(y - 8 * Math.sin(a + t)).toFixed(1)}`;
      if (r() < 0.75) heads += `M${hp(0.55)} L${x} ${y} L${hp(-0.55)} `;
      const sq = `M${ox - 2} ${oy - 2} h4 v4 h-4 z `;
      if (i % 17 === 3) tally += sq; else marks += sq;
    }
    for (let i = 0; i < count * 0.6; i++) {
      const x = snap(r() * W), y = snap(r() * H);
      solid += `M${x - 4} ${y} h8 M${x} ${y - 4} v8 `;
    }
    const path = (cls, d) => { const p = document.createElementNS(NS, "path"); p.setAttribute("class", cls); p.setAttribute("d", d); svg.append(p); };
    path("bd-solid", solid); path("bd-dashed", dashed); path("bd-heads", heads); path("bd-marks", marks); path("bd-tally", tally);
    svg.style.height = H + "px";
    document.body.prepend(svg);

    const still = matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    const move = () => { raf = 0; svg.style.transform = still.matches ? "" : `translate3d(0, ${(-window.scrollY * 0.88).toFixed(1)}px, 0)`; };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(move); };
    window.addEventListener("scroll", onScroll, { passive: true });
    move();
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); svg.remove(); };
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
    if (wallCleanup) wallCleanup();
    main.replaceChildren();

    if (page.layout === "tabs") { renderTabs(page, main); return; }
    if (page.layout === "wall") { renderWall(page, main); return; }
    if (page.about) {
      const links = el("p", { class: "about-links" },
        ...page.about.links.map((l) => el("a", { href: l.url, target: "_blank", rel: "noopener", text: l.label })));
      // Paragraphs may hold [text](url) links; everything else stays plain text.
      const para = (t) => {
        const p = el("p");
        let last = 0;
        for (const m of t.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g)) {
          p.append(t.slice(last, m.index), el("a", { href: m[2], target: "_blank", rel: "noopener", text: m[1] }));
          last = m.index + m[0].length;
        }
        p.append(t.slice(last));
        return p;
      };
      main.append(el("section", { class: "about" }, ...page.about.paragraphs.map(para), links));
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
        el("ul", { class: "grid" }, ...(s.shuffle ? shuffled(s.items) : s.items).map((v) => card(v)))));
    }
  }

  // Viewer
  const dlg = $("viewer");
  let lastFocus = null;
  // What Chris did on each video, for the Shuffle player: taken from the Other Videos sections
  // (Directing / Editing / Color), or a video's own "roles" list in the data file; otherwise "Directed".
  const ROLE = { Directing: "Directed", Editing: "Edited", Color: "Colored" };
  const roleMap = new Map();
  for (const p of pages) for (const s of p.sections || []) if (ROLE[s.title])
    for (const v of s.items || []) {
      const k = v.youtube || v.vimeo;
      roleMap.set(k, [...new Set([...(roleMap.get(k) || []), ROLE[s.title]])]);
    }
  const rolesFor = (v) => v.roles || roleMap.get(v.youtube || v.vimeo) || ["Directed"];

  function openViewer(v, opts = {}) {
    lastFocus = document.activeElement;
    const roles = $("viewer-roles");
    roles.hidden = !opts.shuffle;
    roles.textContent = opts.shuffle ? ["Shuffle", ...["Directed", "Edited", "Colored"].filter((r) => rolesFor(v).includes(r))].join("  ·  ") : "";
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
