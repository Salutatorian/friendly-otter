(function () {
  var DELAY_PER_ITEM = 70;
  var DURATION = 0.45;
  var blogListObserver = null;
  var postBodyObserver = null;
  var photosGridObserver = null;
  var booksGridObserver = null;
  var moviesGridObserver = null;

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
      var postAudio = el.querySelector(".post-audio-wrap:not([hidden])");
      if (postAudio) children.push(postAudio);
      if (body) {
        var paragraphs = body.querySelectorAll(":scope > p, :scope > h2, :scope > h3, :scope > ul, :scope > ol, :scope > blockquote");
        paragraphs.forEach(function (p) { children.push(p); });
      }
      if (back) children.push(back);
    } else if (el.classList.contains("page")) {
      var pageChildren = el.querySelectorAll(
        ":scope > .page-title, :scope > .hero-title, :scope > .hero-subtitle, " +
        ":scope > .training-header, :scope > .training-filters, " +
        ":scope > .projects-filters, :scope > .projects-grid, :scope > .photos-filters, :scope > .photos-grid, " +
        ":scope > .books-filters, :scope > .books-grid, :scope > .movies-grid, " +
        ":scope > p, :scope > h2, :scope > h3, :scope > .consistency-wrap, " +
        ":scope > ul:not(.blog-list), :scope > ol"
      );
      pageChildren.forEach(function (c) { children.push(c); });
      var aboutBlocks = el.querySelectorAll(".about-block");
      if (aboutBlocks.length > 0) {
        aboutBlocks.forEach(function (c) { children.push(c); });
      }
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
      if (!item.classList.contains("text-ripple-in")) {
        item.style.animationDelay = (i * DELAY_PER_ITEM) + "ms";
        item.classList.add("text-ripple-in");
      }
    });
  }

  function addRippleToPostBody() {
    var article = document.querySelector("article.post");
    if (!article) return;
    var body = article.querySelector(".post-body");
    if (!body) return;
    var paragraphs = body.querySelectorAll(":scope > p, :scope > h2, :scope > h3, :scope > ul, :scope > ol, :scope > blockquote");
    if (paragraphs.length === 0) return;
    var base = 2 * DELAY_PER_ITEM;
    paragraphs.forEach(function (p, i) {
      if (!p.classList.contains("text-ripple-in")) {
        p.style.animationDelay = (base + i * DELAY_PER_ITEM) + "ms";
        p.classList.add("text-ripple-in");
      }
    });
  }

  function addRippleToPolaroids() {
    var grid = document.getElementById("photos-grid");
    if (!grid) return;
    var polaroids = grid.querySelectorAll(".polaroid");
    polaroids.forEach(function (p, i) {
      if (!p.classList.contains("text-ripple-in")) {
        p.style.animationDelay = (i * DELAY_PER_ITEM) + "ms";
        p.classList.add("text-ripple-in");
      }
    });
  }

  function addRippleToBooks() {
    var grid = document.getElementById("books-grid");
    if (!grid) return;
    var cards = grid.querySelectorAll(".book-card");
    cards.forEach(function (c, i) {
      if (!c.classList.contains("text-ripple-in")) {
        c.style.animationDelay = (i * DELAY_PER_ITEM) + "ms";
        c.classList.add("text-ripple-in");
      }
    });
  }

  function addRippleToMovies() {
    var grid = document.getElementById("movies-grid");
    if (!grid) return;
    var cards = grid.querySelectorAll(".movie-card");
    cards.forEach(function (c, i) {
      if (!c.classList.contains("text-ripple-in")) {
        c.style.animationDelay = (i * DELAY_PER_ITEM) + "ms";
        c.classList.add("text-ripple-in");
      }
    });
  }

  function setupObservers() {
    if (blogListObserver) blogListObserver.disconnect();
    if (postBodyObserver) postBodyObserver.disconnect();
    if (photosGridObserver) photosGridObserver.disconnect();
    if (booksGridObserver) booksGridObserver.disconnect();
    if (moviesGridObserver) moviesGridObserver.disconnect();

    var list = document.getElementById("blog-list");
    if (list) {
      blogListObserver = new MutationObserver(function () {
        var items = list.querySelectorAll(".blog-item:not(.blog-loading)");
        if (items.length > 0) addRippleToBlogList();
      });
      blogListObserver.observe(list, { childList: true, subtree: true });
      addRippleToBlogList();
    }

    var postBody = document.querySelector(".post-body");
    if (postBody) {
      postBodyObserver = new MutationObserver(addRippleToPostBody);
      postBodyObserver.observe(postBody, { childList: true, subtree: true });
      addRippleToPostBody();
    }

    var photosGrid = document.getElementById("photos-grid");
    if (photosGrid) {
      photosGridObserver = new MutationObserver(addRippleToPolaroids);
      photosGridObserver.observe(photosGrid, { childList: true, subtree: true });
      addRippleToPolaroids();
    }

    var booksGrid = document.getElementById("books-grid");
    if (booksGrid) {
      booksGridObserver = new MutationObserver(addRippleToBooks);
      booksGridObserver.observe(booksGrid, { childList: true, subtree: true });
      addRippleToBooks();
    }

    var moviesGrid = document.getElementById("movies-grid");
    if (moviesGrid) {
      moviesGridObserver = new MutationObserver(addRippleToMovies);
      moviesGridObserver.observe(moviesGrid, { childList: true, subtree: true });
      addRippleToMovies();
    }
  }

  function run() {
    var article = document.querySelector("article.post");
    if (article) {
      addRippleTo(article, 0);
      setupObservers();
      return;
    }
    var page = document.querySelector(".main .page");
    if (page && !page.querySelector(".post")) {
      addRippleTo(page, 0);
    }
    setupObservers();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }

  window.addEventListener("pagechange", run);
})();
