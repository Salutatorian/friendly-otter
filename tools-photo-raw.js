(function () {
  /** Decoder: vendored libraw-wasm (LibRaw → WASM worker); assets in ./vendor/libraw-wasm/ (index.js, worker.js, libraw.wasm). */
  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function dimsFromMeta(meta) {
    var s = meta && meta.sizes;
    if (!s) return { w: 0, h: 0 };
    var w = Number(s.iwidth || s.width || 0);
    var h = Number(s.iheight || s.height || 0);
    return { w: w, h: h };
  }

  function toRgbaClamped(rgb, w, h) {
    var expected3 = w * h * 3;
    var expected4 = w * h * 4;
    var n = rgb.length;
    if (n === expected4) {
      if (rgb instanceof Uint8ClampedArray) return rgb;
      return new Uint8ClampedArray(rgb);
    }
    var out = new Uint8ClampedArray(w * h * 4);
    if (n === expected3) {
      for (var i = 0, j = 0; i < expected3; i += 3, j += 4) {
        out[j] = rgb[i];
        out[j + 1] = rgb[i + 1];
        out[j + 2] = rgb[i + 2];
        out[j + 3] = 255;
      }
      return out;
    }
    throw new Error("Unexpected pixel buffer length " + n + " for " + w + "×" + h);
  }

  var settings = {
    useCameraWb: true,
    outputBps: 8,
    outputColor: 1,
    halfSize: false,
  };

  var currentName = "";

  async function bindToolsPanel() {
    var panel = document.getElementById("tool-photo-raw");
    if (!panel || panel.dataset.toolsInit === "1") return;

    var zone = $("#raw-drop-zone");
    var input = $("#raw-file-input");
    var canvas = $("#raw-preview-canvas");
    var dlBtn = $("#raw-download-btn");
    var fmtSel = $("#raw-format");
    var jpegWrap = $("#raw-jpeg-quality-wrap");
    var jpegQ = $("#raw-jpeg-quality");
    var jpegQVal = $("#raw-jpeg-quality-value");
    if (!zone || !input || !canvas || !dlBtn || !fmtSel) return;

    panel.dataset.toolsInit = "1";

    var LibRawMod = await import("./vendor/libraw-wasm/index.js");
    var LibRaw = LibRawMod.default;

    var statusEl = $("#raw-status");
    var warnEl = $("#raw-coi-warn");
    var previewWrap = $("#raw-preview-wrap");
    var actions = $("#raw-actions");

    if (typeof crossOriginIsolated !== "undefined" && !crossOriginIsolated) {
      if (warnEl) warnEl.hidden = false;
    }

    function syncJpegQualityUi() {
      if (!jpegWrap || !jpegQ || !jpegQVal || !fmtSel) return;
      var isJpeg = (fmtSel.value || "") === "image/jpeg";
      jpegWrap.hidden = !isJpeg;
      if (isJpeg) {
        var n = Number(jpegQ.value);
        jpegQVal.textContent = n + "%";
        jpegQ.setAttribute("aria-valuenow", String(n));
      }
    }

    syncJpegQualityUi();
    fmtSel.addEventListener("change", syncJpegQualityUi);
    if (jpegQ) jpegQ.addEventListener("input", syncJpegQualityUi);

    function setBusy(msg) {
      if (statusEl) statusEl.textContent = msg || "";
    }

    function onPickFiles(files) {
      if (!files || !files.length) return;
      processFile(files[0]);
    }

    zone.addEventListener("click", function () {
      input.click();
    });

    zone.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        input.click();
      }
    });

    ["dragenter", "dragover"].forEach(function (ev) {
      zone.addEventListener(ev, function (e) {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.add("raw-drop-zone--active");
      });
    });

    ["dragleave", "drop"].forEach(function (ev) {
      zone.addEventListener(ev, function (e) {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.remove("raw-drop-zone--active");
      });
    });

    zone.addEventListener("drop", function (e) {
      var dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length) onPickFiles(dt.files);
    });

    input.addEventListener("change", function () {
      if (input.files && input.files.length) onPickFiles(input.files);
      input.value = "";
    });

    dlBtn.addEventListener("click", function () {
      var mime = fmtSel.value || "image/jpeg";
      var ext = mime === "image/png" ? "png" : "jpg";
      var base = (currentName || "raw-convert").replace(/\.[^/.]+$/, "") || "raw-convert";
      var name = base + "." + ext;
      var jpegQuality = 0.95;
      if (mime === "image/jpeg" && jpegQ) {
        jpegQuality = Number(jpegQ.value) / 100;
        if (jpegQuality < 0.92) jpegQuality = 0.92;
        if (jpegQuality > 0.98) jpegQuality = 0.98;
      }
      canvas.toBlob(
        function (blob) {
          if (!blob) return;
          var a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = name;
          a.click();
          setTimeout(function () {
            URL.revokeObjectURL(a.href);
          }, 4000);
        },
        mime,
        mime === "image/jpeg" ? jpegQuality : undefined
      );
    });

    async function processFile(file) {
      currentName = file.name || "image";
      actions.hidden = true;
      previewWrap.hidden = true;
      setBusy("Decoding " + currentName + "… (this can take a moment)");

      var buf = new Uint8Array(await file.arrayBuffer());
      var raw = new LibRaw();

      try {
        await raw.open(buf, settings);
        var meta = await raw.metadata(true);
        var dim = dimsFromMeta(meta);
        var w = dim.w;
        var h = dim.h;
        if (!w || !h) {
          setBusy("Could not read output size from this RAW file.");
          return;
        }
        var pixels = await raw.imageData();
        var rgba = toRgbaClamped(pixels, w, h);
        var ctx = canvas.getContext("2d");
        canvas.width = w;
        canvas.height = h;
        ctx.putImageData(new ImageData(rgba, w, h), 0, 0);
        previewWrap.hidden = false;
        actions.hidden = false;
        setBusy("Ready — " + w + "×" + h + " — " + currentName);
      } catch (err) {
        console.error(err);
        setBusy((err && err.message) || String(err) || "Conversion failed.");
      }
    }
  }

  function boot() {
    bindToolsPanel().catch(function (err) {
      console.error(err);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.addEventListener("pagechange", boot);
})();
