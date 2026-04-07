/**
 * Sitewide time display helpers (no colons).
 * - Clock times: HHMM (24h), e.g. 0000, 2041
 * - Durations from seconds: MMSS if under 1h, else HHMMSS
 */
(function (g) {
  function formatDurationSecCompact(sec) {
    if (!isFinite(sec) || sec < 0) return "0000";
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = Math.floor(sec % 60);
    if (h > 0) {
      return String(h).padStart(2, "0") + String(m).padStart(2, "0") + String(s).padStart(2, "0");
    }
    return String(m).padStart(2, "0") + String(s).padStart(2, "0");
  }

  /** Normalize clock input to HHMM; accepts legacy H:MM / HH:MM or HHMM. */
  function normalizeClockTimeToHHMM(str) {
    str = String(str || "").trim();
    if (!str) return "";
    var m = str.match(/^(\d{1,2}):(\d{2})$/);
    if (m) {
      var H = parseInt(m[1], 10);
      var M = parseInt(m[2], 10);
      if (H >= 0 && H <= 23 && M >= 0 && M <= 59) {
        return String(H).padStart(2, "0") + String(M).padStart(2, "0");
      }
      return str;
    }
    if (/^\d{4}$/.test(str)) {
      var H2 = parseInt(str.slice(0, 2), 10);
      var M2 = parseInt(str.slice(2, 4), 10);
      if (H2 >= 0 && H2 <= 23 && M2 >= 0 && M2 <= 59) return str;
    }
    return str;
  }

  g.formatDurationSecCompact = formatDurationSecCompact;
  g.normalizeClockTimeToHHMM = normalizeClockTimeToHHMM;
})(typeof window !== "undefined" ? window : globalThis);
