(function () {
  var STORAGE_KEY = "greater-engine-theme";

  function getStoredTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function setStoredTheme(value) {
    try {
      if (value) localStorage.setItem(STORAGE_KEY, value);
      else localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }

  function getPreferredTheme() {
    var stored = getStoredTheme();
    if (stored === "dark" || stored === "light" || stored === "reading") return stored;
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
    return "light";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
  }

  function initTheme() {
    var theme = getPreferredTheme();
    applyTheme(theme);
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute("data-theme");
    var next = current === "dark" ? "reading" : current === "reading" ? "light" : "dark";
    applyTheme(next);
    setStoredTheme(next);
    try { window.dispatchEvent(new CustomEvent("themechange", { detail: { theme: next } })); } catch (e) {}
  }

  document.addEventListener("click", function (e) {
    if (e.target.closest(".theme-toggle")) {
      e.preventDefault();
      toggleTheme();
    }
  });

  function closeMobileMenu() {
    var mobileNav = document.querySelector(".mobile-nav");
    var menuBtn = document.querySelector(".mobile-menu-btn");
    if (mobileNav) mobileNav.classList.remove("is-open");
    document.body.classList.remove("mobile-menu-open");
    if (menuBtn) {
      menuBtn.setAttribute("aria-expanded", "false");
      menuBtn.setAttribute("aria-label", "Open menu");
    }
  }

  document.addEventListener("click", function (e) {
    if (e.target.closest(".mobile-menu-btn")) {
      e.preventDefault();
      var menuBtn = e.target.closest(".mobile-menu-btn");
      var mobileNav = document.querySelector(".mobile-nav");
      if (menuBtn && mobileNav) {
        var isOpen = mobileNav.classList.toggle("is-open");
        document.body.classList.toggle("mobile-menu-open", isOpen);
        menuBtn.setAttribute("aria-expanded", isOpen);
        menuBtn.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
      }
    } else if (e.target.closest(".mobile-nav-close") || e.target.closest(".mobile-nav-link")) {
      closeMobileMenu();
    }
  });

  document.addEventListener("DOMContentLoaded", function () {
    initTheme();

    // Scroll reveal: fade in elements as they enter viewport
    var reveals = document.querySelectorAll(".scroll-reveal");
    if (reveals.length && "IntersectionObserver" in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1 });
      reveals.forEach(function (el) { observer.observe(el); });
    } else {
      reveals.forEach(function (el) { el.classList.add("is-visible"); });
    }

    var mobileNav = document.querySelector(".mobile-nav");
    if (mobileNav) {
      var path = (window.location.pathname || "").toLowerCase();
      var isWriting = path.indexOf("/writing") >= 0;
      mobileNav.querySelectorAll(".mobile-nav-link").forEach(function (link) {
        var label = (link.textContent || "").trim().toLowerCase();
        var active = (label === "home" && (path === "/" || path === "" || path === "/index.html")) ||
                    (label === "about" && path.endsWith("about")) ||
                    (label === "writing" && isWriting) ||
                    (label === "books" && path.endsWith("books")) ||
                    (label === "photos" && path.endsWith("photos")) ||
                    (label === "training" && path.endsWith("training"));
        if (active) link.classList.add("active");
      });
    }
  });
})();
