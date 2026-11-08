(() => {
  function parse(source) {
    source = source.replace(/\r\n?/g, "\n");
    const match = source.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
    const meta = {};
    if (match) {
      match[1].split("\n").forEach(line => { const m = line.match(/^([\w-]+):\s*(.*?)\s*$/); if (m) meta[m[1]] = m[2]; });
      source = source.slice(match[0].length);
    }
    return { meta, source };
  }
  function html(source) {
    // 콜아웃은 일반 blockquote와 별도로 렌더한다.
    return marked.parse(source.replace(/^> \[!(NOTE|TIP|WARN)\][^\n]*\n((?:>[^\n]*(?:\n|$))*)/gim, (_, kind, body) => {
      const type = kind.toLowerCase(), label = { note: "메모", tip: "팁", warn: "주의" }[type];
      return `<div class="callout callout--${type}"><p class="callout__title">${label}</p>\n\n${body.replace(/^> ?/gm, "")}\n</div>\n`;
    }));
  }
  function slides(source, unit) {
    const parts = []; let current = [], fence = null;
    for (const line of source.split("\n")) {
      const marker = line.match(/^\s*(`{3,}|~{3,})/);
      if (marker && (!fence || (marker[1][0] === fence[0] && marker[1].length >= fence.length))) fence = fence ? null : marker[1];
      if (!fence && /^\s*---\s*$/.test(line)) { parts.push(current.join("\n")); current = []; }
      else current.push(line);
    }
    parts.push(current.join("\n"));
    return parts.filter(part => part.trim()).map(part => {
      const canvas = CourseCanvas.render(part, unit); part = canvas.part;
      const settings = part.match(/^\s*<!--\s*(.*?)\s*-->\s*/);
      let layout = "default", lab = "";
      if (settings) {
        settings[1].split(";").forEach(item => { const [key, value] = item.split(":").map(x => x.trim());
          if (key === "layout" && ["title", "default", "two-col", "figure", "section"].includes(value)) layout = value;
          if (key === "lab" && /^[a-z0-9-]+$/.test(value)) lab = value;
        });
        part = part.slice(settings[0].length);
      }
      const section = document.createElement("section"); section.className = `slide slide--${layout}`;
      if (lab) section.dataset.lab = lab;
      const body = document.createElement("div"); body.className = "slide__body";
      if (layout === "two-col") {
        const cols = part.split(/^\|\|\|\s*$/m); const heading = cols[0].match(/^\s*(#{1,6} [^\n]+)\n?/);
        if (heading) { body.insertAdjacentHTML("beforeend", html(heading[1])); cols[0] = cols[0].slice(heading[0].length); }
        for (const col of [cols[0], cols.slice(1).join("\n")]) { const div = document.createElement("div"); div.className = "slide__col"; div.innerHTML = html(col); body.append(div); }
      } else body.innerHTML = html(part);
      section.dataset.title = body.querySelector("h1,h2,h3")?.textContent || "슬라이드";
      section.append(body, canvas.layer);
      section.querySelectorAll('img[src^="img/"]').forEach(img => { img.src = `content/${unit}/${img.getAttribute("src")}`; });
      return section;
    });
  }
  window.CourseMarkdown = { parse, html, slides };
})();
