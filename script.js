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
    if (stored === "dark" || stored === "light") return stored;
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
    var next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    setStoredTheme(next);
  }

  document.addEventListener("DOMContentLoaded", function () {
    initTheme();

    var toggle = document.querySelector(".theme-toggle");
    if (toggle) toggle.addEventListener("click", toggleTheme);

    var menuBtn = document.querySelector(".mobile-menu-btn");
    var mobileNav = document.querySelector(".mobile-nav");
    if (mobileNav) {
      var path = (window.location.pathname || "").toLowerCase();
      var isBlog = path.indexOf("/blog") >= 0;
      mobileNav.querySelectorAll(".mobile-nav-link").forEach(function (link) {
        var label = (link.textContent || "").trim().toLowerCase();
        var active = (label === "home" && (path === "/" || path === "" || path === "/index.html")) ||
                    (label === "about" && path.endsWith("about.html")) ||
                    (label === "writing" && isBlog) ||
                    (label === "photos" && path.endsWith("photos.html")) ||
                    (label === "training" && path.endsWith("training.html"));
        if (active) link.classList.add("active");
      });
    }
    function closeMobileMenu() {
      if (mobileNav) mobileNav.classList.remove("is-open");
      document.body.classList.remove("mobile-menu-open");
      if (menuBtn) {
        menuBtn.setAttribute("aria-expanded", "false");
        menuBtn.setAttribute("aria-label", "Open menu");
      }
    }

    if (menuBtn && mobileNav) {
      menuBtn.addEventListener("click", function () {
        var isOpen = mobileNav.classList.toggle("is-open");
        document.body.classList.toggle("mobile-menu-open", isOpen);
        menuBtn.setAttribute("aria-expanded", isOpen);
        menuBtn.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
      });
      var closeBtn = mobileNav.querySelector(".mobile-nav-close");
      if (closeBtn) closeBtn.addEventListener("click", closeMobileMenu);
      mobileNav.querySelectorAll(".mobile-nav-link").forEach(function (link) {
        link.addEventListener("click", closeMobileMenu);
      });
    }
  });
})();
