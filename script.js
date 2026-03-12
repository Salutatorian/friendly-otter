const navbar = document.getElementById("navbar");
const musicToggle = document.getElementById("musicToggle");
const prevTrack = document.getElementById("prevTrack");
const nextTrack = document.getElementById("nextTrack");
const volumeSlider = document.getElementById("volumeSlider");
const bgMusic = document.getElementById("bgMusic");
const musicTitle = document.getElementById("musicTitle");

window.addEventListener("scroll", () => {
  if (navbar) {
    if (window.scrollY > 10) {
      navbar.style.borderBottomColor = "rgba(255,255,255,0.14)";
    } else {
      navbar.style.borderBottomColor = "rgba(255,255,255,0.08)";
    }
  }
});

const playlist = [
  {
    title: "be yourself",
    file: "music.mp3"
  }
];

let currentTrackIndex = 0;

function loadTrack(index) {
  const track = playlist[index];
  bgMusic.src = track.file;
  musicTitle.textContent = track.title;
  bgMusic.load();
}

function playTrack() {
  bgMusic.play()
    .then(() => {
      musicToggle.textContent = "❚❚";
    })
    .catch(() => {
      musicToggle.textContent = "▶";
    });
}

function pauseTrack() {
  bgMusic.pause();
  musicToggle.textContent = "▶";
}

function toggleTrack() {
  if (bgMusic.paused) {
    playTrack();
  } else {
    pauseTrack();
  }
}

function nextSong() {
  currentTrackIndex = (currentTrackIndex + 1) % playlist.length;
  loadTrack(currentTrackIndex);
  playTrack();
}

function prevSong() {
  currentTrackIndex = (currentTrackIndex - 1 + playlist.length) % playlist.length;
  loadTrack(currentTrackIndex);
  playTrack();
}

if (musicToggle && bgMusic && volumeSlider && musicTitle) {
  loadTrack(currentTrackIndex);
  bgMusic.volume = Number(volumeSlider.value);

  musicToggle.addEventListener("click", toggleTrack);
  nextTrack.addEventListener("click", nextSong);
  prevTrack.addEventListener("click", prevSong);

  volumeSlider.addEventListener("input", () => {
    bgMusic.volume = Number(volumeSlider.value);
  });

  bgMusic.addEventListener("ended", nextSong);

  playTrack();

  document.addEventListener(
    "click",
    () => {
      if (bgMusic.paused) {
        playTrack();
      }
    },
    { once: true }
  );
}