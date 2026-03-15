(function () {
  // Add your tracks here. Put audio files in an "audio" folder (e.g. audio/my-song.mp3).
  var TRACKS = [
    { src: "/audio/beyourself.mp3", title: "Be Yourself", art: "/images/beyourself.jpeg" }
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

  var currentIndex = 0;
  var isPlaying = false;

  function getTrack() {
    return TRACKS[currentIndex] || TRACKS[0];
  }

  function loadTrack() {
    var t = getTrack();
    audio.src = t.src || "";
    titleEl.textContent = t.title || "—";
    if (artImg) {
      artImg.src = t.art || "";
      artImg.style.display = t.art ? "" : "none";
    }
    if (!t.src) return;
    audio.load();
  }

  function setPlaying(playing) {
    isPlaying = !!playing;
    if (artEl) artEl.classList.toggle("is-playing", isPlaying);
    playBtn.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
    playBtn.setAttribute("data-state", isPlaying ? "playing" : "paused");
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
  }

  function goNext() {
    if (TRACKS.length === 0) return;
    currentIndex = currentIndex >= TRACKS.length - 1 ? 0 : currentIndex + 1;
    loadTrack();
    if (isPlaying) play();
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
    });
    audio.volume = volumeEl.value / 100;
  }

  loadTrack();
})();
