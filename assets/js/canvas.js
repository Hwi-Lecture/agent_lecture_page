(() => {
  const $ = s => document.querySelector(s), input = $("#editor-input"), selection = $("#cv-selection"), props = $("#cv-props"), deck = $("#deck");
  let selected = null, selectedSlide = -1, drag = null, frame = 0, pendingPoint = null, applying = false;
  const undo = [], redo = [];
  const types = ["rect", "ellipse", "arrow", "text", "image"];
  const colors = ["primary", "node", "edge", "ink", "muted", "danger"];
  const styles = ["fill", "soft", "outline"];
  const number = (v, fallback) => Number.isFinite(Number(v)) && v !== undefined ? Number(v) : fallback;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, Math.round(v * 10) / 10));
  function parseLine(line) {
    const match = line.match(/^\s*(rect|ellipse|arrow|text|image)\b/); if (!match) return null;
    const obj = { type: match[1], raw: line }; let rest = line.slice(match[0].length);
    const token = /^\s+([\w-]+)=("(?:\\.|[^"\\])*"|[^\s]+)/;
    while (rest.trim()) { const m = rest.match(token); if (!m) return null; let value = m[2];
      if (value.startsWith('"')) { try { value = JSON.parse(value); } catch (_) { return null; } }
      obj[m[1]] = value; rest = rest.slice(m[0].length);
    }
    return obj;
  }
  function change(line, values) {
    for (const [key, val] of Object.entries(values)) {
      const encoded = typeof val === "number" ? String(Math.round(val * 10) / 10) : (key === "text" || /\s|["\\]/.test(String(val)) ? JSON.stringify(val) : String(val));
      const re = new RegExp(`(^|\\s)${key}=("(?:\\\\.|[^"\\\\])*"|[^\\s]+)`);
      line = re.test(line) ? line.replace(re, (_, space) => `${space}${key}=${encoded}`) : `${line} ${key}=${encoded}`;
    }
    return line;
  }
  // Preserve front matter and fenced code while identifying the current slide's source range.
  function ranges(source) {
    let start = 0, offset = 0, fence = null, result = [];
    const front = source.match(/^---\n[\s\S]*?\n---(?:\n|$)/); if (front) start = offset = front[0].length;
    for (const line of source.slice(offset).split(/(?<=\n)/)) {
      const bare = line.replace(/\n$/, ""), marker = bare.match(/^\s*(`{3,}|~{3,})/);
      if (marker && (!fence || (fence[0] === marker[1][0] && marker[1].length >= fence.length))) fence = fence ? null : marker[1];
      if (!fence && /^\s*---\s*$/.test(bare)) { if (source.slice(start, offset).trim()) result.push([start, offset]); start = offset + line.length; }
      offset += line.length;
    }
    if (source.slice(start).trim()) result.push([start, source.length]); return result;
  }
  function block(part) {
    let offset = 0, start = -1, bodyStart = 0, fence = null;
    for (const line of part.split(/(?<=\n)/)) {
      const bare = line.replace(/\n$/, ""), marker = bare.match(/^\s*(`{3,}|~{3,})/);
      if (start < 0 && marker && (!fence || (marker[1][0] === fence[0] && marker[1].length >= fence.length))) fence = fence ? null : marker[1];
      if (!fence && start < 0 && /^:::canvas\s*$/.test(bare)) { start = offset; bodyStart = offset + line.length; }
      else if (start >= 0 && /^:::\s*$/.test(bare)) { const match = [part.slice(start, offset + bare.length), part.slice(bodyStart, offset)]; match.index = start; return match; }
      offset += line.length;
    }
    return null;
  }
  function currentPart() { const range = ranges(input.value)[CourseDeck.current()]; return range ? { start: range[0], end: range[1], text: input.value.slice(...range) } : null; }
  function linesFor(part) { const b = block(part); return b ? b[1].replace(/\n$/, "").split("\n") : []; }
  function updatePart(fn) {
    const part = currentPart(); if (!part) return;
    const next = fn(part.text); if (next === part.text) return;
    const before = input.value, after = before.slice(0, part.start) + next + before.slice(part.end);
    if (!drag || !drag.history) {
      const entry = { before, after, slide: CourseDeck.current(), index: selected };
      undo.push(entry); if (undo.length > 100) undo.shift(); redo.length = 0;
      if (drag) drag.history = entry;
    } else drag.history.after = after;
    input.value = after;
    applying = true; try { input.dispatchEvent(new Event("input", { bubbles: true })); } finally { applying = false; }
  }
  // 원문 직접 편집 또는 다른 도구의 변경 뒤에는 오래된 전체 문서 스냅샷을 적용하지 않는다.
  input.addEventListener("input", () => { if (!applying) { undo.length = 0; redo.length = 0; } });
  function historyStep(backward) {
    const source = backward ? undo : redo, target = backward ? redo : undo, item = source[source.length - 1];
    if (!item || input.value !== (backward ? item.after : item.before)) { source.length = 0; target.length = 0; return; }
    source.pop(); target.push(item); selected = item.slide === CourseDeck.current() ? item.index : null; selectedSlide = CourseDeck.current();
    input.value = backward ? item.before : item.after;
    applying = true; try { input.dispatchEvent(new Event("input", { bubbles: true })); } finally { applying = false; }
    refresh();
  }
  function writeLines(part, lines) {
    const b = block(part), text = `:::canvas\n${lines.join("\n")}\n:::`;
    return b ? part.slice(0, b.index) + text + part.slice(b.index + b[0].length) : `${part.replace(/\s*$/, "\n\n")}${text}\n`;
  }
  function setLine(index, fn) { updatePart(part => { const lines = linesFor(part); if (!parseLine(lines[index] || "")) return part; lines[index] = fn(lines[index]); return writeLines(part, lines); }); }
  function render(part, unit) {
    const found = block(part); const layer = document.createElement("div"); layer.className = "slide__canvas";
    if (!found) return { part, layer };
    const lines = linesFor(part); let invalid = 0;
    lines.forEach((line, i) => {
      if (!line.trim()) return; const obj = parseLine(line); if (!obj) { invalid++; return; }
      const element = document.createElement(obj.type === "image" ? "img" : "div");
      const color = colors.includes(obj.color) ? obj.color : "primary", style = styles.includes(obj.style) ? obj.style : "soft";
      element.className = `cv cv--${obj.type} cv--${color}`; element.dataset.index = i;
      if (["rect", "ellipse"].includes(obj.type)) element.classList.add(`cv--${style}`);
      if (obj.type === "image") { if (!/^img\/[a-zA-Z0-9_-]+\.(?:png|jpe?g|gif|webp|svg)$/i.test(obj.src || "")) { invalid++; return; } element.src = `content/${unit}/${obj.src}`; element.alt = ""; element.addEventListener("load", () => requestAnimationFrame(refresh)); }
      if (obj.type === "arrow") {
        const x1 = number(obj.x1, 10), y1 = number(obj.y1, 50), x2 = number(obj.x2, 30), y2 = number(obj.y2, 50);
        const dx = x2 - x1, dy = (y2 - y1) * .5625;
        for (const [k, v] of Object.entries({ x: x1, y: y1, len: Math.hypot(dx, dy), angle: Math.atan2(dy, dx) * 180 / Math.PI })) element.style.setProperty(`--${k}`, v);
        element.classList.add(`cv--head-${["both", "none", "end"].includes(obj.head) ? obj.head : "end"}`); if (obj.dash === "true" || obj.dash === "1") element.classList.add("cv--dash");
      } else {
        for (const [k, fallback] of Object.entries({ x: 10, y: 10, w: 20 })) element.style.setProperty(`--${k}`, number(obj[k], fallback));
        if (obj.h !== undefined) element.style.setProperty("--h", number(obj.h, 15));
        element.style.setProperty("--size", number(obj.size, 2));
        if (obj.type !== "image") { const span = document.createElement("span"); span.className = "cv__text"; span.textContent = obj.text || ""; element.append(span); }
      }
      layer.append(element);
    });
    if (invalid) layer.dataset.warning = `${invalid}개의 canvas 줄을 읽을 수 없습니다.`;
    return { part: part.slice(0, found.index) + part.slice(found.index + found[0].length), layer };
  }
  function refresh() {
    const active = deck.querySelector(".slide.is-active"), idx = window.CourseDeck?.current();
    if (selectedSlide !== idx) selected = null;
    const layer = active?.querySelector(".slide__canvas"), object = layer?.querySelector(`.cv[data-index="${selected}"]`);
    const part = currentPart(), lines = part ? linesFor(part.text) : [], data = selected !== null ? parseLine(lines[selected] || "") : null;
    if (!document.body.classList.contains("is-editing") || !object || !data) { selection.classList.add("is-hidden"); props.classList.add("is-hidden"); }
    else {
      layer.append(selection); selection.classList.remove("is-hidden"); props.classList.remove("is-hidden");
      selection.dataset.kind = data.type === "arrow" ? "arrow" : "box";
      const rect = active.getBoundingClientRect(), measured = object.getBoundingClientRect();
      const coords = data.type === "arrow" ? { x1: number(data.x1,10), y1: number(data.y1,50), x2: number(data.x2,30), y2: number(data.y2,50) } : { x: number(data.x,10), y: number(data.y,10), w: number(data.w,20), h: number(data.h, measured.height / rect.height * 100) };
      for (const [key, val] of Object.entries(coords)) selection.style.setProperty(`--${key}`, val);
      props.querySelectorAll("[data-prop]").forEach(b => b.classList.toggle("is-active", b.dataset.value === (data[b.dataset.prop] || (b.dataset.prop === "style" ? "soft" : "primary"))));
    }
    const layout = active?.className.match(/slide--(title|default|two-col|figure|section)/)?.[1]; if (layout) $("#tool-layout").value = layout;
    const warning = layer?.dataset.warning; if (warning && document.body.classList.contains("is-editing")) { $("#editor-status").dataset.state = "error"; $("#editor-status").textContent = warning; }
  }
  function choose(i) { selected = i; selectedSlide = CourseDeck.current(); refresh(); }
  function insert(line) { updatePart(part => { const lines = linesFor(part); if (lines.length === 1 && !lines[0]) lines.length = 0; selected = lines.length; selectedSlide = CourseDeck.current(); lines.push(line); return writeLines(part, lines); }); refresh(); }
  function pointer(e) {
    if (!document.body.classList.contains("is-editing") || document.body.dataset.view !== "slides") return;
    const object = e.target.closest(".cv"), box = e.target.closest("#cv-selection"); if (!object && !box) { if (e.target.closest(".slide")) { selected = null; refresh(); } return; }
    if (e.button !== 0 || e.target.isContentEditable) return; e.preventDefault();
    if (object) choose(Number(object.dataset.index));
    const part = currentPart(), data = part && parseLine(linesFor(part.text)[selected]); if (!data) return;
    const slide = deck.querySelector(".slide.is-active"), rect = slide.getBoundingClientRect(), target = slide.querySelector(`.cv[data-index="${selected}"]`), measure = target.getBoundingClientRect();
    drag = { startX: e.clientX, startY: e.clientY, rect, data, index: selected, handle: e.target.dataset.handle || "move", h: measure.height / rect.height * 100 };
  }
  deck.addEventListener("pointerdown", pointer);
  function applyPointer() {
    frame = 0; if (!drag || !pendingPoint) return;
    const point = pendingPoint; pendingPoint = null;
    const { data: o, rect: r, handle: h } = drag, dx = (point.x - drag.startX) / r.width * 100, dy = (point.y - drag.startY) / r.height * 100; let v = {};
    if (o.type === "arrow") {
      for (const p of ["1", "2"]) { const move = h === "move" || (p === "1" ? h === "start" : h === "end"); v[`x${p}`] = clamp(number(o[`x${p}`], p === "1" ? 10 : 30) + (move ? dx : 0), 0, 100); v[`y${p}`] = clamp(number(o[`y${p}`],50) + (move ? dy : 0), 0, 100); }
    } else {
      let x = number(o.x,10), y = number(o.y,10), w = number(o.w,20), height = number(o.h,drag.h);
      if (h === "move") { x = clamp(x+dx,0,100-w); y = clamp(y+dy,0,100-height); }
      else { if (h.includes("e")) w = clamp(w+dx,2,100-x); if (h.includes("s")) height = clamp(height+dy,2,100-y); if (h.includes("w")) { const right=x+w; x=clamp(x+dx,0,right-2); w=right-x; } if (h.includes("n")) { const bottom=y+height; y=clamp(y+dy,0,bottom-2); height=bottom-y; } }
      v = { x, y, w, h: height };
    }
    setLine(drag.index, line => change(line,v)); refresh();
  }
  document.addEventListener("pointermove", e => { if (!drag) return; pendingPoint = { x: e.clientX, y: e.clientY }; if (!frame) frame = requestAnimationFrame(applyPointer); });
  function endDrag() { if (frame) { cancelAnimationFrame(frame); frame = 0; } if (pendingPoint) applyPointer(); drag = null; }
  document.addEventListener("pointerup", endDrag);
  document.addEventListener("pointercancel", endDrag);
  deck.addEventListener("dblclick", e => { if (!document.body.classList.contains("is-editing")) return; const obj = e.target.closest(".cv") || (e.target.closest("#cv-selection") && deck.querySelector(`.slide.is-active .cv[data-index="${selected}"]`)); const span = obj?.querySelector(".cv__text"); if (!span) return; const index = Number(obj.dataset.index); selection.classList.add("is-hidden"); obj.classList.add("is-text-editing"); span.contentEditable = "true"; span.focus(); span.addEventListener("blur", () => { obj.classList.remove("is-text-editing"); span.contentEditable = "false"; setLine(index, line => change(line, {text:span.innerText})); refresh(); }, {once:true}); });
  props.addEventListener("click", e => { const button = e.target.closest("button"); if (!button || selected === null) return;
    if (button.dataset.prop) setLine(selected, line => change(line, {[button.dataset.prop]:button.dataset.value}));
    const action = button.dataset.action;
    if (action?.startsWith("size-")) setLine(selected, line => change(line, { size: clamp(number(parseLine(line).size,2)+(action === "size-up" ? .2 : -.2),.5,10) }));
    if (["delete","duplicate","forward","backward"].includes(action)) updatePart(part => { const lines=linesFor(part), i=selected; if (!parseLine(lines[i] || "")) return part; if (action === "delete") { lines.splice(i,1); selected=null; } if (action === "duplicate") { lines.splice(i+1,0,lines[i]); selected=i+1; } const j=i+(action === "forward" ? 1 : -1); if (["forward","backward"].includes(action) && j>=0 && j<lines.length) { [lines[i],lines[j]]=[lines[j],lines[i]]; selected=j; } return writeLines(part,lines); });
    refresh();
  });
  document.addEventListener("keydown", e => {
    if (!document.body.classList.contains("is-editing") || document.body.dataset.view !== "slides" || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.altKey) { e.preventDefault(); historyStep(!e.shiftKey); return; }
    if (selected === null) return;
    if (e.key === "Delete" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d")) { e.preventDefault(); props.querySelector(`[data-action="${e.key === "Delete" ? "delete" : "duplicate"}"]`).click(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest("#split-handle")) return;
    const direction = {ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1]}[e.key];
    if (!direction) return;
    e.preventDefault(); e.stopPropagation();
    const amount = e.shiftKey ? 5 : .5, dx = direction[0] * amount, dy = direction[1] * amount;
    setLine(selected, line => {
      const o = parseLine(line);
      if (o.type === "arrow") {
        const x1=number(o.x1,10), x2=number(o.x2,30), y1=number(o.y1,50), y2=number(o.y2,50);
        const mx=clamp(dx,-Math.min(x1,x2),100-Math.max(x1,x2)), my=clamp(dy,-Math.min(y1,y2),100-Math.max(y1,y2));
        return change(line,{x1:x1+mx,x2:x2+mx,y1:y1+my,y2:y2+my});
      }
      const slide = deck.querySelector(".slide.is-active"), object = slide?.querySelector(`.cv[data-index="${selected}"]`);
      const height = number(o.h, object && slide ? object.getBoundingClientRect().height / slide.getBoundingClientRect().height * 100 : 0);
      return change(line,{x:clamp(number(o.x,10)+dx,0,100-number(o.w,20)),y:clamp(number(o.y,10)+dy,0,100-height)});
    });
    refresh();
  });
  window.CourseCanvas = { render, refresh, insert, updatePart, currentPart, ranges };
})();
