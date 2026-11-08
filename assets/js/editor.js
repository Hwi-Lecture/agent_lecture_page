(() => {
  const $ = s => document.querySelector(s), app = window.CourseUnit, input = $("#editor-input"), status = $("#editor-status"), edit = $("#edit-btn");
  if (!app.id) return;
  let saving = false, editable = false;
  function setStatus(state, message) { status.dataset.state = state; status.textContent = message; }
  function dirty() { return input.value !== app.saved[app.view].replace(/\r\n?/g, "\n"); }
  function close() {
    if (saving) return false;
    if (dirty() && !confirm("저장하지 않은 변경사항을 버릴까요?")) return false;
    app.files[app.view] = app.saved[app.view]; document.body.classList.remove("is-editing"); edit.setAttribute("aria-pressed", "false"); app.render(app.view, app.files[app.view], true); return true;
  }
  window.CourseEditor = { close };
  let checking = null;
  window.addEventListener("course-ready", () => {
    edit.classList.remove("is-hidden");
    edit.title = "편집 서버 확인 중";
    checking = (async () => {
      try { const r = await fetch("/api/status", { cache: "no-store" }); editable = r.ok && (await r.json()).editable === true; } catch (_) { editable = false; }
      edit.title = editable ? "Markdown 편집" : "편집하려면 start.bat으로 로컬 서버를 실행하세요";
    })();
  });
  // 서버 확인이 끝나기 전에 눌러도 잘못된 안내가 뜨지 않도록 확인 완료를 기다린다
  edit.onclick = async () => { if (checking) await checking; if (!editable) { alert("편집 기능은 로컬 서버에서 사용할 수 있어요. 강의 폴더의 start.bat을 실행하고 새로 열린 페이지에서 다시 시도해 주세요."); return; } if (document.body.classList.contains("is-editing")) { close(); return; } input.value = app.files[app.view]; $("#editor-file").textContent = `content/${app.id}/${app.view}.md`; setStatus("saved", "저장됨"); document.body.classList.add("is-editing"); edit.setAttribute("aria-pressed", "true"); input.focus(); };
  $("#editor-cancel").onclick = close;
  input.oninput = () => { app.files[app.view] = input.value; app.render(app.view, input.value, true); setStatus(dirty() ? "dirty" : "saved", dirty() ? "수정됨" : "저장됨"); };
  async function save() {
    if (saving || !dirty()) return; saving = true; $("#editor-save").disabled = true; const value = input.value, view = app.view; setStatus("saving", "저장 중");
    try { const response = await fetch("/api/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: `content/${app.id}/${view}.md`, content: value, original: app.saved[view] }) });
      if (response.status === 409) throw Error("파일이 다른 곳에서 수정됐어요. 내용을 복사한 뒤 새로고침해 주세요.");
      if (!response.ok) throw Error("저장에 실패했어요."); app.saved[view] = value; setStatus(dirty() ? "dirty" : "saved", dirty() ? "수정됨" : "저장됨");
    } catch (error) { setStatus("error", error.message || "저장에 실패했어요."); } finally { saving = false; $("#editor-save").disabled = false; }
  }
  $("#editor-save").onclick = save;
  const snippets = {
    slide: "\n\n---\n<!-- layout: default -->\n## 새 슬라이드\n\n내용을 입력하세요.\n",
    "two-col": "\n|||\n",
    table: "\n| 항목 | 내용 |\n| --- | --- |\n| 예시 | 내용 |\n",
    callout: "\n> [!NOTE]\n> 내용을 입력하세요.\n",
    lab: "<!-- layout: default; lab: sample-lab -->\n"
  };
  function insertText(value) { const start = input.selectionStart, end = input.selectionEnd; input.setRangeText(value, start, end, "end"); input.dispatchEvent(new Event("input", {bubbles:true})); input.focus(); }
  document.querySelectorAll("[data-snippet]").forEach(button => button.addEventListener("click", () => {
    if (button.dataset.snippet !== "lab") return insertText(snippets[button.dataset.snippet]);
    CourseCanvas.updatePart(part => { const match = part.match(/^(\s*<!--\s*)([\s\S]*?)(\s*-->)/); if (!match) return `<!-- layout: default; lab: sample-lab -->\n${part}`;
      const fields = match[2].split(";").map(s => s.trim()).filter(Boolean), i = fields.findIndex(s => /^lab\s*:/.test(s)); if (i < 0) fields.push("lab: sample-lab"); else fields[i] = "lab: sample-lab";
      return match[1] + fields.join("; ") + match[3] + part.slice(match[0].length);
    });
  }));
  $("#tool-layout").addEventListener("change", e => { const layout = e.target.value;
    CourseCanvas.updatePart(part => { const match = part.match(/^(\s*<!--\s*)([\s\S]*?)(\s*-->)/); if (!match) return `<!-- layout: ${layout} -->\n${part}`;
      const fields = match[2].split(";").map(s => s.trim()).filter(Boolean), i = fields.findIndex(s => /^layout\s*:/.test(s)); if (i < 0) fields.unshift(`layout: ${layout}`); else fields[i] = `layout: ${layout}`;
      return part.slice(0, match.index) + match[1] + fields.join("; ") + match[3] + part.slice(match.index + match[0].length);
    });
  });
  const defaults = {rect:'rect x=10 y=50 w=20 h=14 color=primary style=soft text="사각형"', ellipse:'ellipse x=35 y=50 w=20 h=14 color=node style=soft text="원"', arrow:'arrow x1=30 y1=57 x2=40 y2=57 color=ink head=end', text:'text x=10 y=25 w=28 size=2 text="글상자"'};
  document.querySelectorAll("[data-insert]").forEach(button => button.addEventListener("click", () => { if (button.dataset.insert === "image") $("#image-input").click(); else CourseCanvas.insert(defaults[button.dataset.insert]); }));
  async function upload(file) {
    if (!file) return; if (file.size > 10 * 1024 * 1024) { alert("이미지는 10MB 이하여야 합니다."); return; }
    const view = app.view, slide = window.CourseDeck?.current(), reader = new FileReader();
    try {
      const encoded = await new Promise((resolve, reject) => { reader.onload = () => resolve(reader.result.split(",")[1]); reader.onerror = reject; reader.readAsDataURL(file); });
      const response = await fetch("/api/upload", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({unit:app.id,name:file.name,data:encoded})});
      if (!response.ok) throw Error("지원하지 않는 파일이거나 업로드에 실패했습니다."); const {src} = await response.json();
      if (!document.body.classList.contains("is-editing") || app.view !== view || (view === "slides" && CourseDeck.current() !== slide)) { alert(`이미지가 저장되었지만 편집 위치가 바뀌었습니다. 파일: ${src}`); return; }
      if (view === "slides") CourseCanvas.insert(`image x=50 y=35 w=30 src=${src}`); else insertText(`![이미지](${src})`);
    } catch (error) { alert(error.message || "이미지 업로드에 실패했습니다."); }
  }
  $("#image-input").addEventListener("change", e => { upload(e.target.files[0]); e.target.value = ""; });
  [$("#editor"), $("#deck")].forEach(target => { target.addEventListener("dragover", e => { if (!document.body.classList.contains("is-editing") || !e.dataTransfer.types.includes("Files")) return; e.preventDefault(); target.classList.add("is-dragover"); }); target.addEventListener("dragleave", e => { if (!target.contains(e.relatedTarget)) target.classList.remove("is-dragover"); }); target.addEventListener("drop", e => { target.classList.remove("is-dragover"); if (!document.body.classList.contains("is-editing") || !e.dataTransfer.files.length) return; e.preventDefault(); upload(e.dataTransfer.files[0]); }); });
  document.addEventListener("keydown", e => { if (document.body.classList.contains("is-editing") && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); } });
  window.addEventListener("beforeunload", e => { if (document.body.classList.contains("is-editing") && dirty()) { e.preventDefault(); e.returnValue = ""; } });
})();
