(() => {
  const $ = s => document.querySelector(s), params = new URLSearchParams(location.search);
  const id = params.get("u"), unit = COURSE.units.find(u => u.id === id && u.status === "open");
  const state = $("#unit-state"), text = $("#unit-state-text");
  const app = window.CourseUnit = { id, view: "post", files: {}, saved: {} };
  let visitedSlides = false;
  function lastSlide() {
    if (visitedSlides) return CourseDeck.current() + 1;
    try { const last = JSON.parse(localStorage.getItem(`ontology:progress:${id}`) || "{}").last; return Number.isInteger(last) && last > 0 ? last : 1; } catch (_) { return 1; }
  }
  function fail(message) { state.classList.remove("is-hidden"); state.dataset.state = "error"; text.textContent = message; }
  if (!unit) { fail("단원을 찾을 수 없습니다. 목록에서 단원을 선택해 주세요."); return; }
  $("#unit-title").textContent = unit.title; $("#unit-no").textContent = String(COURSE.units.indexOf(unit) + 1).padStart(2, "0"); document.title = `${unit.title} — ${COURSE.title}`;
  app.render = function(view, value, preview = false) {
    const parsed = CourseMarkdown.parse(value); $("#draft-badge").classList.toggle("is-hidden", parsed.meta.status !== "draft");
    if (view === "post") {
      const article = $("#post-body"), toc = $("#post-toc"); article.innerHTML = CourseMarkdown.html(parsed.source); toc.replaceChildren();
      article.querySelectorAll('img[src^="img/"]').forEach(img => { img.src = `content/${id}/${img.getAttribute("src")}`; });
      article.querySelectorAll("h2,h3").forEach((h, i) => { h.id = `heading-${i + 1}`; const li = document.createElement("li"), a = document.createElement("a"); li.className = `post-toc__${h.tagName.toLowerCase()}`; a.href = `#${h.id}`; a.textContent = h.textContent; li.append(a); toc.append(li); });
    } else { CourseDeck.render(parsed.source, id, preview); visitedSlides = true; }
  };
  app.setView = function(view) {
    if (document.body.classList.contains("is-editing") && !window.CourseEditor.close()) return;
    app.view = view; document.body.dataset.view = view;
    document.querySelectorAll("[data-view-tab]").forEach(b => { const active = b.dataset.viewTab === view; b.classList.toggle("is-active", active); b.setAttribute("aria-selected", active); });
    const url = new URL(location.href); url.searchParams.set("view", view); url.hash = view === "slides" ? `#${lastSlide()}` : ""; history.pushState(null, "", url);
    app.render(view, app.files[view]);
  };
  document.querySelectorAll("[data-view-tab]").forEach(b => b.onclick = () => { if (b.dataset.viewTab !== app.view) app.setView(b.dataset.viewTab); });
  window.addEventListener("popstate", () => { const view = new URLSearchParams(location.search).get("view") === "slides" ? "slides" : "post"; if (!app.files[view] || view === app.view) return; if (document.body.classList.contains("is-editing") && !window.CourseEditor.close()) { history.go(1); return; } app.view = view; document.body.dataset.view = view; document.querySelectorAll("[data-view-tab]").forEach(b => { const active = b.dataset.viewTab === view; b.classList.toggle("is-active", active); b.setAttribute("aria-selected", active); }); app.render(view, app.files[view]); });
  state.classList.remove("is-hidden");
  const cacheBust = Date.now();
  Promise.all(["post", "slides"].map(async view => { const r = await fetch(`content/${id}/${view}.md?v=${cacheBust}`, { cache: "no-store" }); if (!r.ok) throw Error(); app.files[view] = app.saved[view] = await r.text(); }))
    .then(() => { app.view = params.get("view") === "slides" ? "slides" : "post"; document.body.dataset.view = app.view; document.querySelectorAll("[data-view-tab]").forEach(b => { const active = b.dataset.viewTab === app.view; b.classList.toggle("is-active", active); b.setAttribute("aria-selected", active); }); app.render(app.view, app.files[app.view]); state.classList.add("is-hidden"); window.dispatchEvent(new Event("course-ready")); })
    .catch(() => fail("콘텐츠를 불러오지 못했습니다. 로컬 서버와 파일을 확인해 주세요."));
})();
