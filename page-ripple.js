(function () {
  var DELAY_PER_ITEM = 70;
  var DURATION = 0.45;

  function addRippleTo(el, baseDelay) {
    if (!el || el.classList.contains("text-ripple-done")) return;
    var children = [];
    if (el.classList.contains("post")) {
      var meta = el.querySelector(".post-meta");
      var title = el.querySelector(".post-title");
      var body = el.querySelector(".post-body");
      var back = el.querySelector(".post-back");
      if (meta) children.push(meta);
      if (title) children.push(title);
      if (body) {
        var paragraphs = body.querySelectorAll(":scope > p, :scope > h2, :scope > h3, :scope > ul, :scope > ol, :scope > blockquote");
        paragraphs.forEach(function (p) { children.push(p); });
      }
      if (back) children.push(back);
    } else if (el.classList.contains("page")) {
      var pageChildren = el.querySelectorAll(
        ":scope > .page-title, :scope > .page-lead, :scope > .hero-title, :scope > .hero-subtitle, " +
        ":scope > .training-header, :scope > .training-filters, " +
        ":scope > .projects-filters, :scope > .projects-grid, :scope > .photos-filters, :scope > .photos-grid, " +
        ":scope > p, :scope > h2, :scope > h3, :scope > .consistency-wrap, " +
        ":scope > ul:not(.blog-list), :scope > ol"
      );
      pageChildren.forEach(function (c) { children.push(c); });
      var dashboardCards = el.querySelectorAll(".dashboard-card");
      if (dashboardCards.length > 0) {
        dashboardCards.forEach(function (c) { children.push(c); });
      } else {
        var grid = el.querySelector(":scope > .dashboard-grid");
        if (grid) children.push(grid);
      }
    }
    if (children.length === 0) return;
    el.classList.add("text-ripple-done");
    children.forEach(function (child, i) {
      child.style.animationDelay = (baseDelay + i * DELAY_PER_ITEM) + "ms";
      child.classList.add("text-ripple-in");
    });
  }

  function addRippleToBlogList() {
    var list = document.querySelector(".blog-list");
    if (!list) return;
    var items = list.querySelectorAll(".blog-item:not(.blog-loading)");
    items.forEach(function (item, i) {
      item.style.animationDelay = (i * DELAY_PER_ITEM) + "ms";
      item.classList.add("text-ripple-in");
    });
  }

  function run() {
    var article = document.querySelector("article.post");
    if (article) {
      addRippleTo(article, 0);
      return;
    }
    var page = document.querySelector(".main .page");
    if (page && !page.querySelector(".post")) {
      addRippleTo(page, 0);
    }
    addRippleToBlogList();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }

  window.addEventListener("pagechange", run);

  var list = document.getElementById("blog-list");
  if (list) {
    var obs = new MutationObserver(function () {
      var items = list.querySelectorAll(".blog-item:not(.blog-loading)");
      if (items.length > 0 && !list.querySelector(".text-ripple-in")) {
        addRippleToBlogList();
      }
    });
    obs.observe(list, { childList: true, subtree: true });
  }
})();
