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

  // Nav: site pages, with external links slotted after the first page
  const nav = $("nav");
  const navLinks = {};
  pages.forEach((p, i) => {
    const a = el("a", { href: "#" + p.id, text: p.label });
    navLinks[p.id] = a;
    nav.append(a);
    if (i === 0) for (const x of data.site.external || [])
      nav.append(el("a", { href: x.url, class: "ext", target: "_blank", rel: "noopener", text: x.label }));
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

  function card(v) {
    const thumb = el("div", { class: "thumb" });
    if (v.thumb) {
      const img = el("img", { src: thumbSrc(v.thumb), alt: "", loading: "lazy", decoding: "async" });
      img.addEventListener("error", () => img.replaceWith(poster(v.title)), { once: true });
      thumb.append(img);
    } else thumb.append(poster(v.title));
    const b = el("button", { class: "card", type: "button", "aria-label": "Play " + v.title },
      thumb, el("span", { class: "title", text: v.title }));
    b.addEventListener("click", () => openViewer(v));
    return el("li", {}, b);
  }

  function render(id) {
    const page = pages.find((p) => p.id === id) || pages[0];
    for (const [k, a] of Object.entries(navLinks))
      k === page.id ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current");
    document.title = page === pages[0] ? data.site.name : `${page.label} · ${data.site.name}`;
    const main = $("main");
    main.replaceChildren();

    if (page.about) {
      const links = el("p", { class: "about-links" },
        ...page.about.links.map((l) => el("a", { href: l.url, target: "_blank", rel: "noopener", text: l.label })));
      main.append(el("section", { class: "about" }, ...page.about.paragraphs.map((t) => el("p", { text: t })), links));
      return;
    }
    for (const s of page.sections) {
      const n = s.items.length;
      main.append(el("section", { class: "section" },
        el("div", { class: "section-head" },
          el("h2", { text: s.title }),
          el("span", { class: "count", text: `${String(n).padStart(2, "0")} ${n === 1 ? "video" : "videos"}` })),
        s.intro ? el("p", { class: "intro", text: s.intro }) : null,
        el("ul", { class: "grid" }, ...s.items.map(card))));
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
