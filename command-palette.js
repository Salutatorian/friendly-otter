(function () {
  var isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  var modKey = isMac ? "\u2318" : "Ctrl";
  var apiBase = "";

  var staticItems = [
    { label: "Home", href: "/", icon: "home", group: "Pages", keywords: "home" },
    { label: "About", href: "/about", icon: "user", group: "Pages", keywords: "about" },
    { label: "Writing", href: "/writing", icon: "pen", group: "Pages", keywords: "writing blog articles" },
    { label: "Photos", href: "/photos", icon: "image", group: "Pages", keywords: "photos gallery" },
    { label: "Training", href: "/training", icon: "chart", group: "Pages", keywords: "training" },
    { label: "GitHub", href: "https://github.com/Salutatorian", icon: "github", group: "Links", keywords: "github g" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/joshua-waldo-8b8023394/", icon: "linkedin", group: "Links", keywords: "linkedin" },
    { label: "Instagram", href: "https://www.instagram.com/joshuaawaldo/", icon: "instagram", group: "Links", keywords: "instagram" },
    { label: "Strava", href: "https://www.strava.com/athletes/73302983", icon: "strava", group: "Links", keywords: "strava" },
    { label: "Resume", href: "/resume.pdf", icon: "file", group: "Links", keywords: "resume cv" },
    { label: "Admin", href: "/admin", icon: "gear", group: "Links", keywords: "admin" },
    { label: "Toggle theme", action: "toggleTheme", icon: "moon", group: "Settings", keywords: "theme dark light" },
    { label: "Reading mode", action: "readingTheme", icon: "book", group: "Settings", keywords: "reading tan" }
  ];

  var dynamicItems = [];
  var itemsCache = null;

  function getItems() {
    if (itemsCache) return itemsCache;
    itemsCache = staticItems.concat(dynamicItems);
    return itemsCache;
  }

  function stripHtml(s) {
    if (!s) return "";
    var d = document.createElement("div");
    d.innerHTML = s;
    return (d.textContent || "").replace(/\s+/g, " ").trim();
  }

  function loadDynamicItems() {
    var root = (document.querySelector("base") && document.querySelector("base").href) ? new URL(document.querySelector("base").href).origin : "";
    if (!root && typeof window !== "undefined" && window.location) root = window.location.origin;
    var done = 0;
    var max = 2;
    function finish() {
      done++;
      if (done >= max) {
        itemsCache = null;
      }
    }
    fetch((root || "") + "/api/writings").then(function (r) {
      if (!r.ok) throw new Error();
      return r.json();
    }).then(function (posts) {
      if (!Array.isArray(posts)) return;
      posts.forEach(function (p) {
        var slug = p.slug || String(p.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "post";
        var href = "/writing/post?slug=" + encodeURIComponent(slug);
        var searchText = [p.title, p.excerpt, p.body].join(" ");
        searchText = stripHtml(searchText).toLowerCase();
        dynamicItems.push({
          label: (p.title || "Untitled") + " — article",
          href: href,
          icon: "pen",
          group: "Articles",
          keywords: searchText
        });
      });
    }).catch(function () {}).then(finish);

    fetch((root || "") + "/api/photos").then(function (r) {
      if (!r.ok) throw new Error();
      return r.json();
    }).then(function (photos) {
      if (!Array.isArray(photos)) return;
      photos.forEach(function (p) {
        var searchText = [p.title, p.meta, p.caption, p.alt].join(" ").toLowerCase();
        dynamicItems.push({
          label: (p.title || "Untitled") + " — photo",
          href: "/photos",
          icon: "image",
          group: "Photos",
          keywords: searchText,
          photoId: p.id,
          photoSrc: p.src
        });
      });
    }).catch(function () {}).then(finish);
  }

  var icons = {
    home: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.69z"/><path d="M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1.875v-6.198a2.29 2.29 0 00.091-.086L12 5.43z"/></svg>',
    user: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clip-rule="evenodd"/></svg>',
    pen: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32L19.513 8.2z"/></svg>',
    image: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94l-2.69-2.689a1.5 1.5 0 00-2.12 0l-.88.879.97.97a.75.75 0 11-1.06 1.06l-5.16-5.161a1.5 1.5 0 00-2.12 0L3 16.061zM12 7.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" clip-rule="evenodd"/></svg>',
    chart: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M15.75 2.25a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v6.75h4.5a.75.75 0 010 1.5h-4.5v2.25a.75.75 0 01-1.5 0v-2.25H9v2.25a.75.75 0 01-1.5 0v-2.25H3.75a.75.75 0 010-1.5H9V9H3.75a.75.75 0 010-1.5h4.5v-4.5a.75.75 0 011.5 0V8h3V3.75a.75.75 0 011.5 0V8h3V3.75a.75.75 0 01.75-.75z" clip-rule="evenodd"/></svg>',
    github: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>',
    linkedin: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
    instagram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8z"/></svg>',
    strava: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 4.6 2.635-4.6h4.907l-6.107 10.172-2.301 3.828-2.301-3.828-6.107-10.172h4.908l2.629 4.6z"/></svg>',
    file: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>',
    gear: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97 0-.33-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1 0 .33.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66z"/></svg>',
    moon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z"/></svg>',
    book: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M11.25 4.533A9.707 9.707 0 006 3a9.735 9.735 0 00-3 1.875.75.75 0 00-1 1.125v14.25c0 1.035.84 1.875 1.875 1.875 2.25 0 4.5 0 6.375-1.25V4.533zM12.75 19.875A9.732 9.732 0 0118 21c.966 0 1.875-.3 2.625-.875.621-.459 1.125-1.089 1.125-1.625V4.533A9.707 9.707 0 0018 3a9.735 9.735 0 00-3 1.875.75.75 0 00-1 1.125v14.25c0 .536-.504 1.166-1.125 1.625z"/></svg>'
  };

  var modal = null;
  var input = null;
  var listEl = null;
  var selectedIdx = 0;

  function openPalette() {
    if (modal) return;
    dynamicItems = [];
    itemsCache = null;
    loadDynamicItems();
    modal = document.createElement("div");
    modal.className = "command-palette-overlay";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-label", "Search");
    modal.innerHTML =
      '<div class="command-palette">' +
      '  <div class="command-palette-header">' +
      '    <input type="text" class="command-palette-input" placeholder="Search pages, articles, photos..." autocomplete="off" autocapitalize="off" spellcheck="false" />' +
      '    <span class="command-palette-hint">' + modKey + '+K to close</span>' +
      '  </div>' +
      '  <div class="command-palette-list"></div>' +
      '</div>';
    document.body.appendChild(modal);
    input = modal.querySelector(".command-palette-input");
    listEl = modal.querySelector(".command-palette-list");

    modal.addEventListener("click", function (e) {
      if (e.target === modal) closePalette();
    });
    modal.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); closePalette(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); selectNext(); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); selectPrev(); return; }
      if (e.key === "Enter") { e.preventDefault(); activateSelected(); return; }
    });
    input.addEventListener("input", render);
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") e.preventDefault();
    });

    document.body.classList.add("command-palette-open");
    render();
    setTimeout(function () { input.focus(); }, 50);
  }

  function closePalette() {
    if (!modal) return;
    document.body.classList.remove("command-palette-open");
    modal.remove();
    modal = null;
    input = null;
    listEl = null;
  }

  function filterItems(q) {
    q = (q || "").toLowerCase().trim();
    var all = getItems();
    if (!q) return all;
    return all.filter(function (it) {
      var label = (it.label || "").toLowerCase();
      var keywords = (it.keywords || "").toLowerCase();
      return label.indexOf(q) >= 0 || keywords.indexOf(q) >= 0;
    });
  }

  function selectNext() {
    var rows = listEl.querySelectorAll("[data-index]");
    if (rows.length === 0) return;
    selectedIdx = (selectedIdx + 1) % rows.length;
    scrollToSelected(rows);
  }

  function selectPrev() {
    var rows = listEl.querySelectorAll("[data-index]");
    if (rows.length === 0) return;
    selectedIdx = selectedIdx <= 0 ? rows.length - 1 : selectedIdx - 1;
    scrollToSelected(rows);
  }

  function scrollToSelected(rows) {
    var row = rows[selectedIdx];
    if (row) {
      rows.forEach(function (r) { r.classList.remove("selected"); });
      row.classList.add("selected");
      row.scrollIntoView({ block: "nearest" });
    }
  }

  function activateSelected() {
    var rows = listEl.querySelectorAll("[data-index]");
    var row = rows[selectedIdx];
    if (!row) return;
    var idx = parseInt(row.getAttribute("data-index"), 10);
    var filtered = filterItems(input ? input.value : "");
    var it = filtered[idx];
    if (!it) return;
    closePalette();
    if (it.action === "toggleTheme") {
      var t = document.querySelector(".theme-toggle");
      if (t) t.click();
    } else if (it.action === "readingTheme") {
      try {
        document.documentElement.setAttribute("data-theme", "reading");
        localStorage.setItem("greater-engine-theme", "reading");
        if (window.dispatchEvent) window.dispatchEvent(new CustomEvent("themechange", { detail: { theme: "reading" } }));
      } catch (e) {}
    } else if (it.photoId) {
      window.location.href = it.href + "#photo=" + encodeURIComponent(it.photoId);
    } else if (it.href) {
      window.location.href = it.href;
    }
  }

  function render() {
    var q = input ? input.value : "";
    var filtered = filterItems(q);
    selectedIdx = 0;

    var html = "";
    var lastGroup = "";
    filtered.forEach(function (it, i) {
      if (it.group !== lastGroup) {
        lastGroup = it.group;
        html += '<div class="command-palette-group">' + escapeHtml(it.group) + '</div>';
      }
      var icon = icons[it.icon] || "";
      var cls = "command-palette-item" + (i === 0 ? " selected" : "");
      html += '<div class="' + cls + '" data-index="' + i + '" role="option">' +
        '<span class="command-palette-icon">' + icon + '</span>' +
        '<span class="command-palette-label">' + escapeHtml(it.label) + '</span>' +
        '</div>';
    });
    if (filtered.length === 0) {
      html = '<div class="command-palette-empty">No results</div>';
    }
    listEl.innerHTML = html;

    listEl.querySelectorAll(".command-palette-item").forEach(function (row) {
      row.addEventListener("click", function () {
        selectedIdx = parseInt(row.getAttribute("data-index"), 10);
        activateSelected();
      });
    });
  }

  function escapeHtml(s) {
    if (s == null) return "";
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  document.addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      if (modal) closePalette();
      else openPalette();
    }
  });

  function injectSearchTrigger() {
    var header = document.querySelector(".header-actions");
    if (!header) return;
    if (header.querySelector(".search-trigger")) return;
    var themeToggle = document.querySelector(".theme-toggle");
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "search-trigger";
    btn.setAttribute("aria-label", "Search");
    btn.title = "Search (" + modKey + "+K)";
    btn.innerHTML = '<span class="search-trigger-label">' + modKey + '</span><span class="search-trigger-key">K</span>';
    btn.addEventListener("click", function () {
      if (modal) closePalette();
      else openPalette();
    });
    if (themeToggle) header.insertBefore(btn, themeToggle);
    else header.appendChild(btn);
  }

  document.addEventListener("click", function (e) {
    if (e.target.closest(".mobile-nav-search")) {
      e.preventDefault();
      var mobileNav = document.querySelector(".mobile-nav");
      var menuBtn = document.querySelector(".mobile-menu-btn");
      if (mobileNav) mobileNav.classList.remove("is-open");
      document.body.classList.remove("mobile-menu-open");
      if (menuBtn) {
        menuBtn.setAttribute("aria-expanded", "false");
        menuBtn.setAttribute("aria-label", "Open menu");
      }
      if (modal) closePalette();
      else openPalette();
    }
  });

  document.addEventListener("DOMContentLoaded", injectSearchTrigger);
  window.addEventListener("pagechange", injectSearchTrigger);
})();
