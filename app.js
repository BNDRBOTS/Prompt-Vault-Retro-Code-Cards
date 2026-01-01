const $ = (s) => document.querySelector(s);

function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.top = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      fallbackCopy(text);
    }
  } catch {
    fallbackCopy(text);
  }
}

function padPct(n){
  const s = String(n);
  return s.length === 1 ? `0${s}` : s;
}

function updateScrollPct(){
  const el = $("#scrollPct");
  const doc = document.documentElement;
  const max = doc.scrollHeight - window.innerHeight;
  const pct = max <= 0 ? 0 : Math.round((window.scrollY / max) * 100);
  el.textContent = `${padPct(Math.max(0, Math.min(100, pct)))}%`;
}

function normalize(s){ return (s || "").toLowerCase().trim(); }

let PROMPTS = [];
let activeTag = "All";

function getQueryState(){
  const u = new URL(window.location.href);
  return {
    q: u.searchParams.get("q") || "",
    tag: u.searchParams.get("tag") || "All",
  };
}

function setQueryState({ q, tag }){
  const u = new URL(window.location.href);
  if (q) u.searchParams.set("q", q); else u.searchParams.delete("q");
  if (tag && tag !== "All") u.searchParams.set("tag", tag); else u.searchParams.delete("tag");
  history.replaceState(null, "", u.toString());
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function renderTags(){
  const tagsEl = $("#tags");
  const tags = new Set(["All"]);
  PROMPTS.forEach(p => (p.tags || []).forEach(t => tags.add(t)));

  tagsEl.innerHTML = "";
  [...tags].forEach(t => {
    const b = document.createElement("button");
    b.className = `tag${t === activeTag ? " is-active" : ""}`;
    b.type = "button";
    b.textContent = t;
    b.addEventListener("click", () => {
      activeTag = t;
      const q = $("#q").value || "";
      setQueryState({ q, tag: activeTag });
      render();
      renderTags();
    });
    tagsEl.appendChild(b);
  });
}

function cardTemplate(p){
  const safeId = p.id || crypto.randomUUID();
  const title = p.title || "Untitled";
  const lang = p.lang || "text";
  const body = p.body || "";

  return `
    <section class="code-card" id="${safeId}" data-code-card>
      <header class="code-card__header">
        <div class="code-card__left">
          <span class="code-card__lang">${lang}</span>
          <span class="code-card__title">${title}</span>
        </div>

        <div class="code-card__actions">
          <button class="copy" type="button" data-copy-btn aria-label="Copy code">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 6h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
                stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M7 18H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2"
                stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span data-copy-label>Copy code</span>
          </button>

          <button class="copy" type="button" data-link-btn aria-label="Copy link">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M10 13a5 5 0 0 0 7.07 0l1.41-1.41a5 5 0 0 0-7.07-7.07L10 4"
                stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M14 11a5 5 0 0 0-7.07 0L5.52 12.4a5 5 0 0 0 7.07 7.07L14 20"
                stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span data-link-label>Copy link</span>
          </button>
        </div>
      </header>

      <div class="code-card__body">
        <pre><code data-code>${escapeHtml(body)}</code></pre>
      </div>
    </section>
  `;
}

function wireCardEvents(root){
  root.querySelectorAll("[data-code-card]").forEach(card => {
    const copyBtn = card.querySelector("[data-copy-btn]");
    const linkBtn = card.querySelector("[data-link-btn]");
    const codeEl = card.querySelector("[data-code]");
    const copyLabel = card.querySelector("[data-copy-label]");
    const linkLabel = card.querySelector("[data-link-label]");

    copyBtn.addEventListener("click", async () => {
      await copyText(codeEl.textContent);
      const old = copyLabel.textContent;
      copyLabel.textContent = "Copied";
      copyBtn.classList.add("is-copied");
      setTimeout(() => { copyLabel.textContent = old; copyBtn.classList.remove("is-copied"); }, 1100);
    });

    linkBtn.addEventListener("click", async () => {
      const url = new URL(window.location.href);
      url.hash = `#${card.id}`;
      await copyText(url.toString());
      const old = linkLabel.textContent;
      linkLabel.textContent = "Copied";
      linkBtn.classList.add("is-copied");
      setTimeout(() => { linkLabel.textContent = old; linkBtn.classList.remove("is-copied"); }, 1100);
    });
  });
}

function render(){
  const grid = $("#grid");
  const count = $("#count");
  const q = normalize($("#q").value);

  const filtered = PROMPTS.filter(p => {
    const inTag = activeTag === "All" || (p.tags || []).includes(activeTag);
    if (!inTag) return false;
    if (!q) return true;
    const hay = normalize(`${p.title || ""}\n${p.body || ""}\n${(p.tags || []).join(" ")}`);
    return hay.includes(q);
  });

  count.textContent = `${filtered.length} / ${PROMPTS.length} prompts`;
  grid.innerHTML = filtered.map(cardTemplate).join("");
  wireCardEvents(grid);
}

async function init(){
  const res = await fetch("prompts.json", { cache: "no-store" });
  PROMPTS = await res.json();

  const state = getQueryState();
  activeTag = state.tag || "All";

  $("#q").value = state.q || "";
  $("#q").addEventListener("input", () => {
    setQueryState({ q: $("#q").value, tag: activeTag });
    render();
  });

  $("#clear").addEventListener("click", () => {
    $("#q").value = "";
    activeTag = "All";
    setQueryState({ q: "", tag: "All" });
    renderTags();
    render();
  });

  renderTags();
  render();

  updateScrollPct();
  window.addEventListener("scroll", updateScrollPct, { passive: true });

  // If landing on a hash, scroll it into view
  if (location.hash) {
    const el = document.querySelector(location.hash);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

init();
