"use strict";

const BASE_URL   = "https://openlibrary.org";
const COVER_BASE = "https://covers.openlibrary.org/b/id";
const PER_PAGE   = 20;

const TRENDING = [
  { title: "Naruto",               author: "Masashi Kishimoto", tag: "Shōnen" },
  { title: "One Piece",            author: "Eiichiro Oda",      tag: "Shōnen" },
  { title: "Attack on Titan",      author: "Hajime Isayama",    tag: "Seinen" },
  { title: "Demon Slayer",         author: "Koyoharu Gotouge",  tag: "Shōnen" },
  { title: "My Hero Academia",     author: "Kohei Horikoshi",   tag: "Shōnen" },
  { title: "Death Note",           author: "Tsugumi Ohba",      tag: "Seinen" },
  { title: "Fullmetal Alchemist",  author: "Hiromu Arakawa",    tag: "Shōnen" },
  { title: "Dragon Ball",          author: "Akira Toriyama",    tag: "Shōnen" },
  { title: "Sword Art Online",     author: "Reki Kawahara",     tag: "Isekai" },
  { title: "Re:Zero",              author: "Tappei Nagatsuki",  tag: "Isekai" },
];

const JP_CHARS = ["漫","画","本","読","物","語","夢","空","力","心","火","水","風","雷","剣"];

const state = {
  section: "search",
  lastQuery: "",
  page: 1,
  totalPages: 1,
  library: JSON.parse(localStorage.getItem("anilib_library") || "[]"),
};

const $ = id => document.getElementById(id);
const searchInput     = $("searchInput");
const statusBar       = $("statusBar");
const statusText      = $("statusText");
const spinner         = $("spinner");
const errorBox        = $("errorBox");
const errorText       = $("errorText");
const resultsSection  = $("resultsSection");
const resultsTitle    = $("resultsTitle");
const bookGrid        = $("bookGrid");
const pagination      = $("pagination");
const librarySection  = $("librarySection");
const libraryGrid     = $("libraryGrid");
const emptyLibrary    = $("emptyLibrary");
const libCount        = $("libCount");
const trendingSection = $("trendingSection");
const trendingList    = $("trendingList");
const modalOverlay    = $("modalOverlay");
const modalInner      = $("modalInner");

function showStatus(msg, loading = false) {
  statusBar.style.display = "block";
  statusText.textContent  = msg;
  spinner.style.display   = loading ? "block" : "none";
  errorBox.style.display  = "none";
}
function hideStatus() { statusBar.style.display = "none"; }
function showError(msg) {
  errorBox.style.display = "flex";
  errorText.textContent  = msg;
  hideStatus();
}

function showSection(name) {
  resultsSection.style.display  = "none";
  librarySection.style.display  = "none";
  trendingSection.style.display = "none";
  state.section = name;
  if (name === "search" && state.lastQuery) resultsSection.style.display = "block";
  else if (name === "favorites") { librarySection.style.display = "block"; renderLibrary(); }
  else if (name === "trending")  { trendingSection.style.display = "block"; renderTrending(); }
  document.querySelectorAll(".nav-item").forEach(el =>
    el.classList.toggle("active", el.dataset.section === name));
}

function coverURL(id, size = "M") { return id ? `${COVER_BASE}/${id}-${size}.jpg` : null; }

function placeholderEl(title) {
  const d = document.createElement("div");
  d.className = "book-cover-placeholder";
  d.innerHTML = `<div class="placeholder-char">${JP_CHARS[Math.floor(Math.random()*JP_CHARS.length)]}</div><div class="placeholder-title">${title}</div>`;
  return d;
}

function coverEl(coverId, title, size = "M") {
  const wrap = document.createElement("div");
  wrap.className = "book-cover-wrap";
  const url = coverURL(coverId, size);
  if (url) {
    const img = document.createElement("img");
    img.src = url; img.alt = title; img.loading = "lazy";
    img.onerror = () => img.replaceWith(placeholderEl(title));
    wrap.appendChild(img);
  } else {
    wrap.appendChild(placeholderEl(title));
  }
  return wrap;
}

const isSaved = key => state.library.some(b => b.key === key);

function toggleSave(book) {
  state.library = isSaved(book.key)
    ? state.library.filter(b => b.key !== book.key)
    : [...state.library, book];
  localStorage.setItem("anilib_library", JSON.stringify(state.library));
  document.querySelectorAll(`.save-btn[data-key="${book.key}"]`).forEach(btn => {
    const s = isSaved(book.key);
    btn.classList.toggle("saved", s);
    btn.title = s ? "Remove from library" : "Save to library";
    btn.textContent = s ? "♥" : "♡";
  });
  libCount.textContent = `${state.library.length} saved`;
}

function makeSaveBtn(book, isStatic = false) {
  const btn = document.createElement("button");
  const s = isSaved(book.key);
  btn.className = "save-btn" + (s ? " saved" : "");
  btn.dataset.key = book.key;
  btn.title = s ? "Remove from library" : "Save to library";
  btn.textContent = s ? "♥" : "♡";
  if (isStatic) btn.style.position = "static";
  btn.addEventListener("click", e => { e.stopPropagation(); toggleSave(book); });
  return btn;
}

function bookCard(book) {
  const card = document.createElement("div");
  card.className = "book-card";
  const cover = coverEl(book.cover_id, book.title);
  cover.appendChild(makeSaveBtn(book));
  card.appendChild(cover);
  const info = document.createElement("div");
  info.className = "book-info";
  info.innerHTML = `
    <div class="book-title">${book.title || "Untitled"}</div>
    <div class="book-author">${book.author || "Unknown author"}</div>
    ${book.year ? `<div class="book-year">${book.year}</div>` : ""}
  `;
  card.appendChild(info);
  card.appendChild(makeSaveBtn(book, true));
  card.addEventListener("click", () => openModal(book));
  return card;
}

function renderBooks(books) {
  bookGrid.innerHTML = "";
  if (!books?.length) {
    bookGrid.innerHTML = `<p style="color:var(--ink-muted);grid-column:1/-1;padding:2rem 0;">No results found. Try a different search!</p>`;
    return;
  }
  books.forEach(b => bookGrid.appendChild(bookCard(b)));
}

function renderLibrary() {
  libCount.textContent = `${state.library.length} saved`;
  emptyLibrary.style.display = state.library.length ? "none" : "block";
  libraryGrid.innerHTML = "";
  state.library.forEach(b => libraryGrid.appendChild(bookCard(b)));
}

function renderTrending() {
  trendingList.innerHTML = "";
  TRENDING.forEach((item, i) => {
    const el = document.createElement("div");
    el.className = "trend-item";
    el.innerHTML = `
      <div class="trend-num${i < 3 ? " top" : ""}">${String(i+1).padStart(2,"0")}</div>
      <div class="trend-info"><div class="trend-title">${item.title}</div><div class="trend-meta">${item.author}</div></div>
      <div class="trend-badge">${item.tag}</div>
    `;
    el.addEventListener("click", () => { searchInput.value = item.title; showSection("search"); doSearch(item.title, 1); });
    trendingList.appendChild(el);
  });
}

function renderPagination(current, total) {
  pagination.innerHTML = "";
  if (total <= 1) return;
  const start = Math.max(1, Math.min(current - 2, total - 4));
  const end   = Math.min(total, start + 4);
  const btn = (n, label) => {
    const b = document.createElement("button");
    b.className = "page-btn" + (n === current ? " active" : "");
    b.textContent = label || n;
    b.disabled = n < 1 || n > total;
    b.addEventListener("click", () => doSearch(state.lastQuery, n));
    return b;
  };
  pagination.appendChild(btn(current - 1, "← Prev"));
  for (let i = start; i <= end; i++) pagination.appendChild(btn(i));
  pagination.appendChild(btn(current + 1, "Next →"));
}

async function doSearch(query, page = 1) {
  if (!query.trim()) return;
  state.lastQuery = query;
  state.page = page;
  showStatus(`Searching for "${query}"...`, true);
  errorBox.style.display = "none";
  resultsSection.style.display = "none";

  const url = `${BASE_URL}/search.json?q=${encodeURIComponent(query)}&limit=${PER_PAGE}&offset=${(page-1)*PER_PAGE}&fields=key,title,author_name,first_publish_year,cover_i,subject,number_of_pages_median,isbn`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const books = (data.docs || []).map(d => ({
      key:      d.key || "",
      title:    d.title || "Untitled",
      author:   (d.author_name || []).join(", ") || "Unknown author",
      year:     d.first_publish_year || null,
      cover_id: d.cover_i || null,
      subjects: (d.subject || []).slice(0, 5),
      pages:    d.number_of_pages_median || null,
      isbn:     (d.isbn || [])[0] || null,
    }));
    const total = data.numFound || 0;
    state.totalPages = Math.min(Math.ceil(total / PER_PAGE), 50);
    showStatus(`Found ${total.toLocaleString()} results for "${query}"`);
    setTimeout(hideStatus, 2500);
    resultsTitle.textContent = `"${query}" — ${total.toLocaleString()} results`;
    renderBooks(books);
    renderPagination(page, state.totalPages);
    showSection("search");
    resultsSection.style.display = "block";
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    showError(err.message.includes("fetch") ? "Network error. Check your internet connection." : `Error: ${err.message}`);
  }
}

async function openModal(book) {
  modalOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
  renderModal(book, null);
  if (book.key) {
    try {
      const res = await fetch(`${BASE_URL}${book.key}.json`);
      if (res.ok) {
        const d = await res.json();
        const desc = typeof d.description === "string" ? d.description : d.description?.value || "";
        if (desc) renderModal(book, desc);
      }
    } catch { /* fail silently */ }
  }
}

// Fetch the MangaDex series UUID for a title, then return its direct title page URL.
// Falls back to the search URL if the API call fails or finds no match.
async function mangaDexDirectURL(title) {
  const fallback = `https://mangadex.org/search?q=${encodeURIComponent(title)}`;
  try {
    const res = await fetch(
      `https://api.mangadex.org/manga?title=${encodeURIComponent(title)}&limit=1&order[relevance]=desc`,
      { headers: { "Accept": "application/json" } }
    );
    if (!res.ok) return fallback;
    const data = await res.json();
    const id = data?.data?.[0]?.id;
    return id ? `https://mangadex.org/title/${id}` : fallback;
  } catch {
    return fallback;
  }
}

function getReadLinks(book) {
  const q     = encodeURIComponent(book.title);
  const qFull = encodeURIComponent(`${book.title} ${book.author}`);
  const isManga = /manga|anime|shonen|shojo|seinen|isekai|one piece|naruto|dragon ball|bleach|attack on titan|demon slayer|death note|fullmetal|sword art|re:zero|my hero/i.test(
    [book.title, book.author, ...(book.subjects||[])].join(" ")
  );

  const links = [];

  if (isManga) {
    // Primary slot: URL will be patched to the direct series page by renderModal
    links.push({
      label: "MangaDex",
      icon: "📖",
      desc: "Go straight to all chapters — largest free scanlation library",
      url: `https://mangadex.org/search?q=${q}`,   // placeholder; resolved async
      primary: true,
      mangadex: true,
    });
    links.push({
      label: "MangaReader",
      icon: "📚",
      desc: "Read chapters online — no account needed",
      url: `https://mangareader.to/search?keyword=${q}`,
    });
    links.push({
      label: "MangaSee",
      icon: "🗂️",
      desc: "High-quality scans with full chapter history",
      url: `https://mangasee123.com/search/?name=${q}`,
    });
    links.push({
      label: "MangaKakalot",
      icon: "🎴",
      desc: "Fast reader with a huge back-catalogue",
      url: `https://mangakakalot.com/search/story/${encodeURIComponent(book.title.toLowerCase().replace(/\s+/g, "_"))}`,
    });
  } else {
    links.push({
      label: "Standard Ebooks",
      icon: "📖",
      desc: "Free, beautifully formatted public-domain ebooks",
      url: `https://standardebooks.org/ebooks?query=${q}`,
      primary: true,
    });
    links.push({
      label: "Project Gutenberg",
      icon: "📜",
      desc: "60,000+ free ebooks — classic literature",
      url: `https://www.gutenberg.org/ebooks/search/?query=${qFull}`,
    });
    links.push({
      label: "Anna's Archive",
      icon: "🗄️",
      desc: "Largest open-access book search engine",
      url: `https://annas-archive.org/search?q=${qFull}`,
    });
  }

  links.push({
    label: "Open Library",
    icon: "🌐",
    desc: "Borrow or preview on Open Library",
    url: `https://openlibrary.org${book.key}`,
  });

  links.push({
    label: "Z-Library",
    icon: "🔍",
    desc: "Search millions of books and articles",
    url: `https://z-lib.id/s/${qFull}`,
  });

  return links;
}

function renderModal(book, desc) {
  const url = coverURL(book.cover_id, "L");
  const tags = (book.subjects || []).slice(0, 6);
  const readLinks = getReadLinks(book);
  const primary = readLinks[0];

  modalInner.innerHTML = `
    <div class="modal-top">
      <div class="modal-cover">
        ${url
          ? `<img src="${url}" alt="${book.title}" onerror="this.parentElement.innerHTML='<div class=\\"modal-cover-placeholder\\"><span>漫</span></div>'">`
          : `<div class="modal-cover-placeholder"><span>漫</span></div>`}
      </div>
      <div class="modal-meta">
        <div class="modal-title">${book.title}</div>
        <div class="modal-author">${book.author}</div>
        ${tags.length ? `<div class="modal-tags">${tags.map(s=>`<span class="modal-tag">${s}</span>`).join("")}</div>` : ""}
        <div class="modal-action-row">
          <div class="read-btn-group">
            <a class="modal-btn primary read-primary-btn" id="readPrimaryBtn" href="${primary.url}" target="_blank" rel="noopener">
              ${primary.icon} Read Free on ${primary.label}
            </a>
            <button class="read-more-toggle" id="readMoreToggle" title="More reading sources">▾</button>
          </div>
          <button class="modal-btn secondary" id="modalSaveBtn">${isSaved(book.key) ? "♥ Saved" : "♡ Save"}</button>
        </div>
        <div class="read-sources-panel" id="readSourcesPanel" style="display:none;">
          <p class="read-sources-label">More places to read free:</p>
          <div class="read-sources-list">
            ${readLinks.slice(1).map(l => `
              <a class="read-source-item" href="${l.url}" target="_blank" rel="noopener">
                <span class="read-source-icon">${l.icon}</span>
                <span class="read-source-info">
                  <span class="read-source-name">${l.label}</span>
                  <span class="read-source-desc">${l.desc}</span>
                </span>
                <span class="read-source-arrow">→</span>
              </a>
            `).join("")}
          </div>
        </div>
      </div>
    </div>
    <div class="modal-divider"></div>
    ${desc ? `<div class="modal-section-title">About</div><div class="modal-desc">${desc.slice(0,600)}${desc.length>600?"...":""}</div><div class="modal-divider"></div>` : ""}
    <div class="modal-section-title">Details</div>
    <div class="modal-detail-grid">
      ${book.year  ? `<div class="detail-item"><span class="detail-label">First Published</span><span class="detail-val">${book.year}</span></div>` : ""}
      ${book.pages ? `<div class="detail-item"><span class="detail-label">Pages</span><span class="detail-val">${book.pages}</span></div>` : ""}
      ${book.isbn  ? `<div class="detail-item"><span class="detail-label">ISBN</span><span class="detail-val">${book.isbn}</span></div>` : ""}
      <div class="detail-item"><span class="detail-label">OL Key</span><span class="detail-val" style="font-size:0.75rem;color:var(--ink-muted)">${book.key}</span></div>
    </div>
  `;

  const saveBtn = $("modalSaveBtn");
  saveBtn?.addEventListener("click", () => {
    toggleSave(book);
    saveBtn.textContent = isSaved(book.key) ? "♥ Saved" : "♡ Save";
  });

  const toggle = $("readMoreToggle");
  const panel  = $("readSourcesPanel");
  toggle?.addEventListener("click", () => {
    const open = panel.style.display === "block";
    panel.style.display = open ? "none" : "block";
    toggle.textContent  = open ? "▾" : "▴";
    toggle.classList.toggle("open", !open);
  });

  // If this is a manga primary button, resolve the direct MangaDex series URL async
  if (primary.mangadex) {
    const btn = $("readPrimaryBtn");
    if (btn) {
      btn.style.opacity = "0.75";
      btn.title = "Resolving direct link…";
      mangaDexDirectURL(book.title).then(directURL => {
        // Guard: modal may have been closed/replaced by the time this resolves
        const live = $("readPrimaryBtn");
        if (live) {
          live.href = directURL;
          live.style.opacity = "";
          live.title = "";
        }
      });
    }
  }
}

function closeModal() { modalOverlay.classList.remove("open"); document.body.style.overflow = ""; }

$("gridViewBtn").addEventListener("click", () => {
  bookGrid.classList.remove("list-view");
  $("gridViewBtn").classList.add("active");
  $("listViewBtn").classList.remove("active");
});
$("listViewBtn").addEventListener("click", () => {
  bookGrid.classList.add("list-view");
  $("listViewBtn").classList.add("active");
  $("gridViewBtn").classList.remove("active");
});

document.querySelectorAll(".genre-tag").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".genre-tag").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const q = btn.dataset.genre ? btn.dataset.genre + " manga" : state.lastQuery;
    if (q) { searchInput.value = q; doSearch(q, 1); showSection("search"); }
  });
});

$("searchBtn").addEventListener("click", () => doSearch(searchInput.value));
searchInput.addEventListener("keydown", e => e.key === "Enter" && doSearch(searchInput.value));
document.querySelectorAll(".qs-btn").forEach(btn =>
  btn.addEventListener("click", () => { searchInput.value = btn.dataset.q; doSearch(btn.dataset.q, 1); showSection("search"); }));
document.querySelectorAll(".nav-item").forEach(el =>
  el.addEventListener("click", e => { e.preventDefault(); showSection(el.dataset.section); }));
$("modalClose").addEventListener("click", closeModal);
modalOverlay.addEventListener("click", e => e.target === modalOverlay && closeModal());
document.addEventListener("keydown", e => e.key === "Escape" && closeModal());

libCount.textContent = `${state.library.length} saved`;
doSearch("manga", 1);
