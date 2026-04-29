/**
 * Client-side router: intercepts internal links and swaps main content
 * without full page reload, keeping the music player running.
 */
(function () {
  var main = document.querySelector(".site-shell .main");
  var sidebar = document.querySelector(".site-shell .sidebar");
  if (!main || !sidebar) return;

  function isInternalLink(a) {
    if (!a || a.tagName !== "A") return false;
    var href = a.getAttribute("href");
    if (!href || href === "#" || href.startsWith("javascript:")) return false;
    if (a.target === "_blank" || a.hasAttribute("download")) return false;
    if (a.getAttribute("rel") === "external") return false;
    try {
      var url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return false;
      if (url.pathname.indexOf("/admin") >= 0) return false;
      if (href.endsWith(".pdf") || href.endsWith(".pdf#")) return false;
      return true;
    } catch (e) {
      return false;
    }
  }

  function getPath(url) {
    try {
      var u = typeof url === "string" ? new URL(url, window.location.href) : url;
      var p = u.pathname || "/";
      if (p === "" || p.endsWith("/")) p = p || "/";
      return p.replace(/\/index\.html$/i, "/").replace(/\/$/, "") || "/";
    } catch (e) {
      return "/";
    }
  }

  function setActiveNav(path) {
    var links = document.querySelectorAll(".nav-link, .mobile-nav-link");
    var isWriting = path.indexOf("/writing") >= 0;
    links.forEach(function (link) {
      link.classList.remove("active");
      var label = (link.textContent || "").trim().toLowerCase();
      var active =
        (label === "home" && (path === "/" || path === "" || path === "/index.html")) ||
        (label === "portfolio" && path.endsWith("portfolio")) ||
        (label === "about" && path.endsWith("about")) ||
        (label === "writing" && isWriting) ||
        (label === "books" && path.endsWith("books")) ||
        (label === "movies" && path.endsWith("movies")) ||
        (label === "photos" && path.endsWith("photos")) ||
        (label === "videos" && path.endsWith("videos")) ||
        (label === "training" && path.endsWith("training")) ||
        (label === "photo converter" && path.endsWith("tools"));
      if (active) link.classList.add("active");
    });
  }

  function runPageScripts(doc, pageUrl) {
    var scripts = doc.querySelectorAll("body script");
    var skipSrcs = ["script.js", "page-ripple.js", "command-palette.js", "music-player.js", "app-router.js"];
    scripts.forEach(function (oldScript) {
      var src = oldScript.getAttribute("src");
      if (src) {
        var name = src.replace(/^.*\//, "").split("?")[0];
        if (skipSrcs.indexOf(name) >= 0) return;
        var script = document.createElement("script");
        var st = oldScript.getAttribute("type");
        if (st) script.type = st;
        script.src = new URL(src, pageUrl).href;
        script.async = false;
        document.body.appendChild(script);
      } else if (oldScript.textContent.trim()) {
        var s = document.createElement("script");
        s.textContent = oldScript.textContent;
        document.body.appendChild(s);
        s.remove();
      }
    });
  }

  function navigate(href) {
    var url = new URL(href, window.location.href);
    var path = getPath(url);

    fetch(url.href)
      .then(function (r) {
        if (!r.ok) throw new Error("Failed to load");
        return r.text();
      })
      .then(function (html) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, "text/html");
        var newMain = doc.querySelector(".site-shell .main");
        if (!newMain) throw new Error("No main content");

        main.innerHTML = newMain.innerHTML;
        main.className = newMain.className || main.className;
        var shell = document.querySelector(".site-shell");
        if (shell) {
          var newShell = doc.querySelector(".site-shell");
          if (newShell) shell.className = newShell.className || shell.className;
        }
        var title = doc.querySelector("title");
        if (title) document.title = title.textContent;

        history.pushState({ path: path, url: href }, "", url.pathname + url.search);
        setActiveNav(path);
        runPageScripts(doc, url.href);
        window.dispatchEvent(new CustomEvent("pagechange", { detail: { path: path, url: href } }));
      })
      .catch(function (err) {
        console.error("Router error:", err);
        window.location.href = href;
      });
  }

  function playNavSound() {
    try {
      if (window.matchMedia("(max-width: 640px)").matches) return;
      var s = new Audio("/audio/nav-start.wav");
      s.volume = 0.6;
      s.play().catch(function () {});
    } catch (err) {}
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest("a");
    if (!isInternalLink(a)) return;
    if (a.classList.contains("nav-link") || a.classList.contains("mobile-nav-link") || a.classList.contains("brand") || a.classList.contains("mobile-nav-brand")) {
      playNavSound();
    }
    e.preventDefault();
    navigate(a.getAttribute("href"));
  });

  window.addEventListener("popstate", function () {
    navigate(window.location.href);
  });
})();
