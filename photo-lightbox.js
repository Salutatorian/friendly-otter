(function () {
  var overlay = null;
  var photos = [];

  function closeLightbox() {
    if (!overlay) return;
    document.body.classList.remove("photo-lightbox-open");
    overlay.remove();
    overlay = null;
    if (typeof history !== "undefined" && history.replaceState) {
      var u = window.location.href.split("#")[0];
      if (window.location.hash) history.replaceState(null, "", u);
    }
  }

  function openLightbox(photo) {
    if (!photo || !photo.src) return;
    if (overlay) closeLightbox();
    overlay = document.createElement("div");
    overlay.className = "photo-lightbox-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "Photo viewer");
    var caption = [photo.title, photo.meta, photo.caption].filter(Boolean).join(" · ");
    overlay.innerHTML =
      '<div class="photo-lightbox-backdrop"></div>' +
      '<div class="photo-lightbox-content">' +
      '  <button type="button" class="photo-lightbox-close" aria-label="Close"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg></button>' +
      '  <img src="' + (photo.src || "").replace(/"/g, "&quot;") + '" alt="' + (photo.alt || photo.title || "").replace(/"/g, "&quot;") + '" class="photo-lightbox-img" />' +
      (caption ? '<div class="photo-lightbox-caption">' + caption.replace(/</g, "&lt;").replace(/>/g, "&gt;") + '</div>' : '') +
      '</div>';
    document.body.appendChild(overlay);
    document.body.classList.add("photo-lightbox-open");
    overlay.querySelector(".photo-lightbox-backdrop").addEventListener("click", closeLightbox);
    overlay.querySelector(".photo-lightbox-close").addEventListener("click", closeLightbox);
    overlay.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); closeLightbox(); }
    });
    try { overlay.querySelector(".photo-lightbox-close").focus(); } catch (x) {}
  }

  window.openPhotoLightbox = function (idOrIndex) {
    var p = null;
    if (typeof idOrIndex === "string") {
      p = photos.find(function (x) { return String(x.id) === String(idOrIndex); });
    } else if (typeof idOrIndex === "number" && photos[idOrIndex]) {
      p = photos[idOrIndex];
    }
    if (p) openLightbox(p);
  };

  document.addEventListener("DOMContentLoaded", function () {
    var grid = document.getElementById("photos-grid");
    if (!grid) return;
    fetch("/api/photos").then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }).then(function (list) {
      photos = list || [];
      var hash = (window.location.hash || "").replace(/^#/, "");
      var match = hash.match(/^photo[=:-]?(.+)$/i);
      if (match) {
        var id = decodeURIComponent(match[1]);
        setTimeout(function () { openPhotoLightbox(id); }, 200);
      }
    });
    grid.addEventListener("click", function (e) {
      var polaroid = e.target.closest(".polaroid");
      if (!polaroid) return;
      e.preventDefault();
      var img = polaroid.querySelector("img");
      var id = polaroid.getAttribute("data-photo-id");
      var src = img ? img.getAttribute("src") : "";
      var titleEl = polaroid.querySelector(".polaroid-title");
      var metaEl = polaroid.querySelector(".polaroid-meta");
      var capEl = polaroid.querySelector(".polaroid-caption");
      var title = titleEl ? titleEl.textContent : "";
      var meta = metaEl ? metaEl.textContent : "";
      var caption = capEl ? capEl.textContent : "";
      openLightbox({ id: id, src: src, title: title, meta: meta, caption: caption, alt: img ? img.getAttribute("alt") : "" });
    });
  });
})();
