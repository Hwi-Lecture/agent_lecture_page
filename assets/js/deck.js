(() => {
  const $ = s => document.querySelector(s), deck = $("#deck"), body = document.body;
  let slides = [], index = 0, unit = "", split = .55;
  const toc = $("#slide-toc-list"), handle = $("#split-handle");
  function show(n, updateHash = true, save = true) {
    if (!slides.length) return;
    index = Math.max(0, Math.min(n, slides.length - 1));
    slides.forEach((slide, i) => { slide.classList.toggle("is-active", i === index); slide.setAttribute("aria-hidden", i !== index); slide.inert = i !== index; });
    $("#slide-current").textContent = index + 1; $("#slide-total").textContent = slides.length;
    $("#prev-btn").disabled = index === 0; $("#next-btn").disabled = index === slides.length - 1;
    $("#slide-progress").style.setProperty("--progress", (index + 1) / slides.length);
    updateLabBtn();
    requestAnimationFrame(() => window.CourseCanvas?.refresh());
    toc.querySelectorAll("button").forEach((button, i) => button.classList.toggle("is-active", i === index));
    if (updateHash && body.dataset.view === "slides") history.pushState(null, "", `#${index + 1}`);
    if (save && body.dataset.view === "slides" && !body.classList.contains("is-editing")) {
      try { const key = `ontology:progress:${unit}`; const old = JSON.parse(localStorage.getItem(key) || "{}");
        localStorage.setItem(key, JSON.stringify({ last: index + 1, max: Math.min(slides.length, Math.max(Number(old.max) || 0, index + 1)), total: slides.length, updated: Date.now() }));
      } catch (_) {}
    }
  }
  // 실습 버튼: 실습 없는 장 → 숨김 / 이미 같은 실습이 열림 → 숨김 / 다른 실습이 열림 → "교체" 버튼
  function updateLabBtn() {
    const btn = $("#lab-btn"), lab = slides[index]?.dataset.lab, open = body.classList.contains("is-lab-open");
    const same = open && $("#lab-frame").getAttribute("src") === `labs/${lab}.html`;
    btn.classList.toggle("is-hidden", !lab || same);
    btn.classList.toggle("is-swap", Boolean(lab && open && !same));
    btn.textContent = lab && open && !same ? "🧪 이 실습으로 교체" : "🧪 실습 열기";
  }
  function fromHash() { const n = /^#([1-9]\d*)$/.exec(location.hash); return n && +n[1] <= slides.length ? +n[1] - 1 : 0; }
  function render(source, id, preserve = false) {
    unit = id; slides = CourseMarkdown.slides(source, id); deck.replaceChildren(...slides); toc.replaceChildren();
    slides.forEach((slide, i) => { const li = document.createElement("li"), btn = document.createElement("button"), num = document.createElement("span");
      num.className = "slide-toc__no"; num.textContent = i + 1; btn.append(num, document.createTextNode(slide.dataset.title));
      if (slide.dataset.lab) { const badge = document.createElement("span"); badge.className = "slide-toc__lab"; badge.textContent = "🧪"; btn.append(badge); }
      btn.addEventListener("click", () => { show(i); closeToc(); }); li.append(btn); toc.append(li);
    });
    show(preserve ? index : fromHash(), false, !preserve);
  }
  function closeToc() { body.classList.remove("is-toc-open"); $("#toc-btn").setAttribute("aria-expanded", "false"); }
  $("#prev-btn").onclick = () => show(index - 1); $("#next-btn").onclick = () => show(index + 1);
  $("#toc-btn").onclick = () => { if (body.dataset.view !== "slides") { $("#post-toc").scrollIntoView(); return; } const open = body.classList.toggle("is-toc-open"); $("#toc-btn").setAttribute("aria-expanded", open); if (open) $("#toc-close-btn").focus(); };
  $("#toc-close-btn").onclick = closeToc; $('[data-close="toc"]').onclick = closeToc;
  $("#fullscreen-btn").onclick = () => { if (!document.fullscreenElement) $("#deck-view").requestFullscreen?.().catch(() => {}); else document.exitFullscreen?.().catch(() => {}); };
  $("#lab-btn").onclick = () => { const lab = slides[index]?.dataset.lab; if (!lab) return; const frame = $("#lab-frame"); const url = `labs/${lab}.html`; if (frame.getAttribute("src") !== url) frame.src = url; $("#lab-title").textContent = slides[index].dataset.title; body.classList.add("is-lab-open"); updateLabBtn(); };
  $("#lab-close-btn").onclick = () => { body.classList.remove("is-lab-open"); $("#lab-frame").removeAttribute("src"); updateLabBtn(); };
  function setSplit(v) { split = Math.max(.25, Math.min(.75, v)); $("#deck-view").style.setProperty("--split", split); handle.setAttribute("aria-valuenow", Math.round(split * 100)); }
  handle.onpointerdown = e => { handle.setPointerCapture(e.pointerId); handle.classList.add("is-active"); };
  handle.onpointermove = e => { if (!handle.hasPointerCapture(e.pointerId)) return; const r = $("#deck-view").getBoundingClientRect(); setSplit(innerWidth <= 900 ? (e.clientY-r.top)/r.height : (e.clientX-r.left)/r.width); };
  handle.onpointerup = handle.onpointercancel = () => handle.classList.remove("is-active");
  handle.onkeydown = e => { const delta = ["ArrowRight", "ArrowDown"].includes(e.key) ? .05 : ["ArrowLeft", "ArrowUp"].includes(e.key) ? -.05 : 0; if (delta) { e.preventDefault(); e.stopPropagation(); setSplit(split + delta); } };
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeToc(); if (body.dataset.view !== "slides" || body.classList.contains("is-editing") || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return; if (e.key === "ArrowRight") show(index + 1); if (e.key === "ArrowLeft") show(index - 1); });
  let touch; deck.addEventListener("touchstart", e => { touch = e.changedTouches[0].clientX; }, { passive: true }); deck.addEventListener("touchend", e => { const d = e.changedTouches[0].clientX - touch; if (Math.abs(d) > 60) show(index + (d < 0 ? 1 : -1)); }, { passive: true });
  window.addEventListener("hashchange", () => { if (body.dataset.view === "slides") show(fromHash(), false); });
  window.CourseDeck = { render, activate: () => show(fromHash(), false), current: () => index };
})();
