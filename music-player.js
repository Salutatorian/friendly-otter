(function () {
  var STATE_KEY = "musicPlayerState";
  // Add your tracks here. Put audio files in an "audio" folder (e.g. audio/my-song.mp3).
  var TRACKS = [
    { src: "/audio/beyourself.mp3", title: "Be Yourself", art: "/images/beyourself.jpeg" },
    { src: "/audio/vince-van-gogh.mp3", title: "Vince Van Gogh", art: "/images/vince-van-gogh.png" }
  ];

  var audio = document.getElementById("music-audio");
  var artEl = document.getElementById("music-art");
  var artImg = document.getElementById("music-art-img");
  var playBtn = document.getElementById("music-play");
  var titleEl = document.getElementById("music-title");
  var prevBtn = document.querySelector(".music-prev");
  var nextBtn = document.querySelector(".music-next");
  var volumeEl = document.getElementById("music-volume");

  if (!audio || !artEl || !playBtn) return;

  var mobileBar = null;
  var mobilePlay = null;
  var mobilePrev = null;
  var mobileNext = null;
  var mobileTitle = null;

  function isMobileMusicLayout() {
    return window.matchMedia("(max-width: 640px)").matches;
  }

  function syncMobileChrome() {
    if (!mobilePlay || !mobileTitle) return;
    mobilePlay.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
    mobilePlay.setAttribute("data-state", isPlaying ? "playing" : "paused");
    mobileTitle.textContent = titleEl ? titleEl.textContent : "—";
  }

  function teardownMobileBar() {
    if (mobileBar && mobileBar.parentNode && mobileBar.getAttribute("data-music-player-injected") === "1") {
      mobileBar.parentNode.removeChild(mobileBar);
    }
    mobileBar = mobilePlay = mobilePrev = mobileNext = mobileTitle = null;
    try {
      document.body.classList.remove("has-mobile-music-bar");
    } catch (e) {}
  }

  function ensureMobileBar() {
    if (!isMobileMusicLayout()) {
      teardownMobileBar();
      return;
    }
    mobileBar = document.querySelector(".mobile-music-bar");
    if (!mobileBar) {
      mobileBar = document.createElement("div");
      mobileBar.className = "mobile-music-bar";
      mobileBar.setAttribute("data-music-player-injected", "1");
      mobileBar.setAttribute("aria-label", "Music player");
      mobileBar.innerHTML =
        '<button type="button" class="mobile-music-prev" aria-label="Previous track"></button>' +
        '<button type="button" class="mobile-music-play" aria-label="Play" data-state="paused"></button>' +
        '<button type="button" class="mobile-music-next" aria-label="Next track"></button>' +
        '<span class="mobile-music-title" id="mobile-music-title">—</span>';
      document.body.appendChild(mobileBar);
    }
    mobilePrev = mobileBar.querySelector(".mobile-music-prev");
    mobilePlay = mobileBar.querySelector(".mobile-music-play");
    mobileNext = mobileBar.querySelector(".mobile-music-next");
    mobileTitle = mobileBar.querySelector(".mobile-music-title");
    if (mobilePrev && !mobilePrev._geMusicBound) {
      mobilePrev._geMusicBound = true;
      mobilePrev.addEventListener("click", function (e) {
        e.preventDefault();
        goPrev();
      });
    }
    if (mobilePlay && !mobilePlay._geMusicBound) {
      mobilePlay._geMusicBound = true;
      mobilePlay.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        togglePlayPause();
      });
    }
    if (mobileNext && !mobileNext._geMusicBound) {
      mobileNext._geMusicBound = true;
      mobileNext.addEventListener("click", function (e) {
        e.preventDefault();
        goNext();
      });
    }
    try {
      document.body.classList.add("has-mobile-music-bar");
    } catch (e) {}
    syncMobileChrome();
  }

  var currentIndex = 0;
  var isPlaying = false;
  var rafId = null;
  var DEG_PER_SEC = 360 / 8; // one full rotation every 8 seconds

  function getTrack() {
    return TRACKS[currentIndex] || TRACKS[0];
  }

  function saveState() {
    try {
      var state = {
        index: currentIndex,
        playing: isPlaying,
        time: audio.currentTime || 0,
        volume: volumeEl ? Number(volumeEl.value) : 10
      };
      sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function loadState() {
    try {
      var raw = sessionStorage.getItem(STATE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function loadTrack(seekTime) {
    var t = getTrack();
    audio.src = t.src || "";
    titleEl.textContent = t.title || "—";
    syncMobileChrome();
    if (artImg) {
      artImg.src = t.art || "";
      artImg.style.display = t.art ? "" : "none";
    }
    if (!t.src) return;
    audio.load();
    if (typeof seekTime === "number" && seekTime > 0) {
      audio.addEventListener("loadedmetadata", function seek() {
        audio.removeEventListener("loadedmetadata", seek);
        audio.currentTime = Math.min(seekTime, audio.duration || 0);
      }, { once: true });
    }
    updateRotation();
  }

  function updateRotation() {
    if (!artEl || !audio.src) return;
    var deg = (audio.currentTime || 0) * DEG_PER_SEC;
    artEl.style.transform = "rotate(" + deg + "deg)";
  }

  function tick() {
    updateRotation();
    if (isPlaying) rafId = requestAnimationFrame(tick);
  }

  function setPlaying(playing) {
    isPlaying = !!playing;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (artEl) artEl.classList.toggle("is-playing", isPlaying);
    playBtn.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
    playBtn.setAttribute("data-state", isPlaying ? "playing" : "paused");
    syncMobileChrome();
    updateRotation();
    if (isPlaying) rafId = requestAnimationFrame(tick);
    saveState();
  }

  function play() {
    if (!audio.src) return;
    audio.play().then(function () {
      setPlaying(true);
    }).catch(function () {
      setPlaying(false);
    });
  }

  function pause() {
    audio.pause();
    setPlaying(false);
  }

  function togglePlayPause() {
    if (isPlaying) pause();
    else play();
  }

  function goPrev() {
    if (TRACKS.length === 0) return;
    currentIndex = currentIndex <= 0 ? TRACKS.length - 1 : currentIndex - 1;
    loadTrack();
    if (isPlaying) play();
    saveState();
  }

  function goNext() {
    if (TRACKS.length === 0) return;
    currentIndex = currentIndex >= TRACKS.length - 1 ? 0 : currentIndex + 1;
    loadTrack();
    if (isPlaying) play();
    saveState();
  }

  playBtn.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    togglePlayPause();
  });

  if (prevBtn) prevBtn.addEventListener("click", goPrev);
  if (nextBtn) nextBtn.addEventListener("click", goNext);

  audio.addEventListener("ended", goNext);
  audio.addEventListener("pause", function () {
    if (!audio.ended) setPlaying(false);
  });
  audio.addEventListener("play", function () {
    setPlaying(true);
  });

  if (volumeEl) {
    volumeEl.addEventListener("input", function () {
      audio.volume = Math.max(0, Math.min(1, volumeEl.value / 100));
      saveState();
    });
    audio.volume = volumeEl.value / 100;
  }

  audio.addEventListener("timeupdate", (function () {
    var last = 0;
    return function () {
      var now = Date.now();
      if (now - last < 1000) return;
      last = now;
      saveState();
    };
  })());

  window.addEventListener("beforeunload", saveState);

  var saved = loadState();
  if (saved && typeof saved.index === "number" && saved.index >= 0 && saved.index < TRACKS.length) {
    currentIndex = saved.index;
    if (volumeEl && typeof saved.volume === "number") {
      volumeEl.value = Math.max(0, Math.min(100, saved.volume));
      audio.volume = volumeEl.value / 100;
    }
  }

  loadTrack(saved && typeof saved.time === "number" ? saved.time : undefined);

  if (saved && saved.playing && audio.src) {
    audio.addEventListener("canplaythrough", function resume() {
      audio.removeEventListener("canplaythrough", resume);
      play();
    }, { once: true });
  }

  ensureMobileBar();
  window.addEventListener("resize", function () {
    ensureMobileBar();
    syncMobileChrome();
  });
})();
