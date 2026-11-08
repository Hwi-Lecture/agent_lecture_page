(() => {
  const course = window.COURSE;
  const grid = document.querySelector("#unit-grid");
  const template = document.querySelector("#tpl-unit-card");
  if (!course || !grid || !template) return;

  document.querySelector("#course-title").textContent = course.title;
  document.querySelector("#course-desc").textContent = course.description;
  document.querySelector("#unit-count").textContent = `${course.units.length}개 단원`;
  const heroCount = document.querySelector("#hero-unit-count");
  if (heroCount) heroCount.textContent = `공개 단원 ${course.units.filter(unit => unit.status === "open").length}개 / 전체 ${course.units.length}개`;

  function progressFor(id) {
    try {
      const value = JSON.parse(localStorage.getItem(`ontology:progress:${id}`));
      if (!value || !Number.isInteger(value.total) || value.total < 1 ||
          !Number.isInteger(value.max) || value.max < 1 ||
          !Number.isInteger(value.last) || value.last < 1 ||
          !Number.isFinite(value.updated)) return null;
      return { total: value.total, max: Math.min(value.max, value.total),
        last: Math.min(value.last, value.total), updated: value.updated };
    } catch (_) { return null; }
  }

  // 단원 편집으로 장 수가 바뀌면 저장된 이전 장 수 대신 실제 문서를 기준으로 표시한다.
  function slideCount(raw) {
    const source = raw.replace(/\r\n?/g, "\n").replace(/^---\n[\s\S]*?\n---(?:\n|$)/, "");
    let count = 0, hasContent = false, fence = null;
    for (const line of source.split("\n")) {
      const marker = line.match(/^\s*(`{3,}|~{3,})/);
      if (marker && (!fence || (marker[1][0] === fence[0] && marker[1].length >= fence.length))) fence = fence ? null : marker[1];
      if (!fence && /^\s*---\s*$/.test(line)) { if (hasContent) count++; hasContent = false; }
      else if (line.trim()) hasContent = true;
    }
    return count + Number(hasContent);
  }

  let latest = null;
  let completed = 0;
  let available = 0;
  const cacheBust = Date.now();
  function updateTotal() {
    const total = available ? completed / available : 0;
    document.querySelector("#total-progress").textContent = `${Math.round(total * 100)}%`;
    document.querySelector("#total-progress-bar").style.setProperty("--progress", total);
  }
  const fragment = document.createDocumentFragment();
  course.units.forEach((unit, index) => {
    const card = template.content.firstElementChild.cloneNode(true);
    const slot = name => card.querySelector(`[data-slot="${name}"]`);
    const open = unit.status === "open";
    const progress = open ? progressFor(unit.id) : null;
    const ratio = progress ? progress.max / progress.total : 0;
    slot("no").textContent = String(index + 1).padStart(2, "0");
    slot("title").textContent = unit.title;
    slot("summary").textContent = unit.summary;
    slot("slides").textContent = progress ? `슬라이드 ${progress.total}장` :
      unit.slides ? `슬라이드 ${unit.slides}장` : "슬라이드 준비 중";
    slot("progress-text").textContent = progress ? `${Math.round(ratio * 100)}%` : "시작 전";
    slot("lab").classList.toggle("is-hidden", !unit.lab);
    if (open) Promise.all(["post", "slides"].map(name =>
      fetch(`content/${unit.id}/${name}.md?v=${cacheBust}`, { cache: "no-store" }).then(r => r.ok ? r.text() : "").catch(() => "")
    )).then(files => {
      card.classList.toggle("is-draft", files.some(text => /^---\s*\r?\n[\s\S]*?\bstatus:\s*draft\b[\s\S]*?\r?\n---(?:\r?\n|$)/i.test(text)));
      const total = slideCount(files[1]);
      if (!total) return;
      const actualRatio = progress ? Math.min(progress.max, total) / total : 0;
      slot("slides").textContent = `슬라이드 ${total}장`;
      slot("progress-text").textContent = progress ? `${Math.round(actualRatio * 100)}%` : "시작 전";
      card.style.setProperty("--progress", actualRatio);
      completed += actualRatio - ratio;
      updateTotal();
      if (latest?.unit.id === unit.id && progress) {
        document.querySelector("#continue-btn").href = `unit.html?u=${encodeURIComponent(unit.id)}&view=slides#${Math.min(progress.last, total)}`;
      }
    });
    card.classList.toggle("is-locked", !open);
    card.style.setProperty("--progress", ratio);
    if (open) {
      card.href = `unit.html?u=${encodeURIComponent(unit.id)}`;
      available++;
      completed += ratio;
      if (progress && (!latest || progress.updated > latest.progress.updated)) latest = { unit, progress };
    } else {
      card.removeAttribute("href");
      card.setAttribute("aria-disabled", "true");
    }
    fragment.append(card);
  });
  grid.replaceChildren(fragment);
  updateTotal();
  if (latest) {
    const button = document.querySelector("#continue-btn");
    button.href = `unit.html?u=${encodeURIComponent(latest.unit.id)}&view=slides#${latest.progress.last}`;
    button.classList.remove("is-hidden");
  }
})();
