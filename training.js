/**
 * Training analytics dashboard — loads real data from /api/training (Strava) or uses placeholder.
 */
(function () {
  // Muted palette for charts (works in light/dark)
  var COLORS = {
    cycling: "rgba(70, 130, 180, 0.85)",
    running: "rgba(100, 149, 100, 0.85)",
    swimming: "rgba(160, 120, 140, 0.85)",
    cyclingMuted: "rgba(70, 130, 180, 0.6)",
    runningMuted: "rgba(100, 149, 100, 0.6)",
    swimmingMuted: "rgba(160, 120, 140, 0.6)",
  };

  // Data (set from API or placeholder)
  var PLACEHOLDER_WEEKS = [];
  var weekLabels = [];
  var totals = { cyclingHours: 0, runningHours: 0, swimmingHours: 0, totalHours: 0 };
  var CONSISTENCY_DAYS = 365;
  var consistencyCols = 53;
  var consistencyData = [];
  var trainingDays = 0;
  var longestStreak = 0;
  var currentStreak = 0;
  var chartInstances = [];

  function buildPlaceholderData() {
    var weeks = [];
    var labels = [];
    for (var w = 11; w >= 0; w--) {
      var d = new Date();
      d.setDate(d.getDate() - w * 7);
      var start = new Date(d);
      start.setDate(start.getDate() - start.getDay());
      var label = "W" + (start.getMonth() + 1) + "/" + start.getDate();
      labels.push(label);
      weeks.push({
        weekLabel: label,
        cyclingHours: 3 + Math.random() * 4,
        runningHours: 1.5 + Math.random() * 2.5,
        swimmingHours: 0.5 + Math.random() * 1.5,
        cyclingMiles: 60 + Math.random() * 80,
        runningMiles: 15 + Math.random() * 25,
        swimmingMiles: 1 + Math.random() * 3,
        sessions: Math.floor(4 + Math.random() * 6),
        cyclingSessions: Math.floor(2 + Math.random() * 3),
        runningSessions: Math.floor(1 + Math.random() * 2),
        swimmingSessions: Math.floor(0 + Math.random() * 2),
      });
    }
    var t = { cyclingHours: 0, runningHours: 0, swimmingHours: 0, totalHours: 0 };
    weeks.forEach(function (row) {
      t.cyclingHours += row.cyclingHours;
      t.runningHours += row.runningHours;
      t.swimmingHours += row.swimmingHours;
    });
    t.totalHours = t.cyclingHours + t.runningHours + t.swimmingHours;
    var cons = [];
    for (var i = 0; i < 365; i++) {
      var r = Math.random();
      if (r < 0.25) cons.push(0);
      else if (r < 0.6) cons.push(1);
      else if (r < 0.85) cons.push(2);
      else if (r < 0.95) cons.push(3);
      else cons.push(4);
    }
    return {
      weeks: weeks,
      weekLabels: labels,
      totals: t,
      consistencyData: cons,
      consistencyCols: 53,
      trainingDays: cons.filter(function (v) { return v > 0; }).length,
      longestStreak: 12,
      currentStreak: 3,
    };
  }

  function setData(data) {
    PLACEHOLDER_WEEKS = data.weeks || [];
    weekLabels = data.weekLabels || [];
    totals = data.totals || { cyclingHours: 0, runningHours: 0, swimmingHours: 0, totalHours: 0 };
    consistencyData = data.consistencyData || [];
    CONSISTENCY_DAYS = consistencyData.length;
    consistencyCols = data.consistencyCols != null ? data.consistencyCols : Math.ceil(CONSISTENCY_DAYS / 7);
    trainingDays = data.trainingDays != null ? data.trainingDays : 0;
    longestStreak = data.longestStreak != null ? data.longestStreak : 0;
    currentStreak = data.currentStreak != null ? data.currentStreak : 0;
  }

  function formatHours(h) {
    var hours = Math.floor(h);
    var mins = Math.round((h - hours) * 60);
    if (hours === 0) return mins + "m";
    return hours + "h " + (mins > 0 ? mins + "m" : "");
  }

  function renderTimeSpentStats() {
    var el = document.getElementById("time-spent-stats");
    if (!el) return;
    var rows = [
      { label: "Cycling", value: formatHours(totals.cyclingHours) },
      { label: "Running", value: formatHours(totals.runningHours) },
      { label: "Swimming", value: formatHours(totals.swimmingHours) },
      { label: "Total", value: formatHours(totals.totalHours) },
    ];
    el.innerHTML = rows
      .map(
        function (r) {
          return (
            '<div class="stat-row">' +
            '<span class="stat-label">' + r.label + "</span>" +
            '<span class="stat-value">' + r.value + "</span>" +
            "</div>"
          );
        }
      )
      .join("");
  }

  function renderConsistencyGrid() {
    var grid = document.getElementById("consistency-grid");
    var summary = document.getElementById("consistency-summary");
    if (!grid) return;
    var cols = consistencyCols;
    var rows = 7;
    grid.innerHTML = "";
    for (var c = 0; c < cols; c++) {
      for (var r = 0; r < rows; r++) {
        var dayIndex = c * 7 + r;
        var level = dayIndex < CONSISTENCY_DAYS ? consistencyData[dayIndex] : 0;
        var cell = document.createElement("div");
        cell.className = "consistency-cell consistency-cell--level-" + level;
        cell.setAttribute("title", "Week " + (c + 1) + " · level " + level);
        grid.appendChild(cell);
      }
    }
    if (summary) {
      summary.textContent =
        trainingDays + " training days · longest streak " + longestStreak + " · current " + currentStreak;
    }
  }

  function getChartOptions(hasLegend) {
    var isDark = document.documentElement.getAttribute("data-theme") === "dark";
    var gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
    var textColor = isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)";
    var isMobile = window.innerWidth < 641;
    var fontSize = isMobile ? 7 : 10;
    var legendSize = isMobile ? 8 : 11;
    var legendPadding = isMobile ? 4 : 12;
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: hasLegend
          ? {
              display: true,
              position: "bottom",
              labels: { color: textColor, font: { size: legendSize }, padding: legendPadding },
            }
          : { display: false },
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: textColor, maxTicksLimit: isMobile ? 5 : 10, font: { size: fontSize } },
        },
        y: {
          grid: { color: gridColor },
          ticks: { color: textColor, maxTicksLimit: isMobile ? 4 : void 0, font: { size: fontSize } },
        },
      },
    };
  }

  function destroyCharts() {
    chartInstances.forEach(function (ch) { if (ch) ch.destroy(); });
    chartInstances = [];
  }

  function initCharts() {
    var isDark = document.documentElement.getAttribute("data-theme") === "dark";
    var textColor = isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)";

    var numWeeks = PLACEHOLDER_WEEKS.length || 1;
    var avgHours =
      Math.round((totals.totalHours / numWeeks) * 10) / 10;
    var avgH = Math.floor(avgHours);
    var avgM = Math.round((avgHours - avgH) * 60);
    var summaryEl = document.getElementById("training-trends-summary");
    if (summaryEl)
      summaryEl.textContent =
        "avg: " + avgH + "h " + (avgM > 0 ? avgM + "m" : "") + " / week · total: " + Math.round(totals.totalHours) + "h";
    var breakdownEl = document.getElementById("sport-breakdown-summary");
    if (breakdownEl) breakdownEl.textContent = "Total: " + Math.round(totals.totalHours) + "h";
    var distEl = document.getElementById("distance-trends-summary");
    if (distEl) {
      var totalMiles = PLACEHOLDER_WEEKS.reduce(function (sum, w) {
        return sum + w.cyclingMiles + w.runningMiles + w.swimmingMiles;
      }, 0);
      var avgMiles = Math.round(totalMiles / numWeeks);
      distEl.textContent = "avg: " + avgMiles + " mi / week";
    }

    var ctxTrends = document.getElementById("chart-training-trends");
    if (ctxTrends && typeof Chart !== "undefined") {
      chartInstances.push(new Chart(ctxTrends, {
        type: "bar",
        data: {
          labels: weekLabels,
          datasets: [
            {
              label: "Cycling",
              data: PLACEHOLDER_WEEKS.map(function (w) { return w.cyclingHours; }),
              backgroundColor: COLORS.cycling,
              stack: "stack0",
            },
            {
              label: "Running",
              data: PLACEHOLDER_WEEKS.map(function (w) { return w.runningHours; }),
              backgroundColor: COLORS.running,
              stack: "stack0",
            },
            {
              label: "Swimming",
              data: PLACEHOLDER_WEEKS.map(function (w) { return w.swimmingHours; }),
              backgroundColor: COLORS.swimming,
              stack: "stack0",
            },
          ],
        },
        options: Object.assign({}, getChartOptions(true), {
          scales: {
            x: Object.assign({}, getChartOptions().scales.x, { stacked: true }),
            y: Object.assign({}, getChartOptions().scales.y, { stacked: true }),
          },
        }),
      }));
    }

    var ctxDonut = document.getElementById("chart-sport-breakdown");
    if (ctxDonut && typeof Chart !== "undefined") {
      chartInstances.push(new Chart(ctxDonut, {
        type: "doughnut",
        data: {
          labels: ["Cycling", "Running", "Swimming"],
          datasets: [
            {
              data: [totals.cyclingHours, totals.runningHours, totals.swimmingHours],
              backgroundColor: [COLORS.cycling, COLORS.running, COLORS.swimming],
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "60%",
          plugins: {
            legend: {
              display: true,
              position: "bottom",
              labels: {
                color: textColor,
                font: { size: window.innerWidth < 641 ? 8 : 11 },
                padding: window.innerWidth < 641 ? 4 : 12,
              },
            },
          },
        },
      }));
    }

    var ctxDistance = document.getElementById("chart-distance-trends");
    if (ctxDistance && typeof Chart !== "undefined") {
      chartInstances.push(new Chart(ctxDistance, {
        type: "bar",
        data: {
          labels: weekLabels,
          datasets: [
            {
              label: "Cycling mi",
              data: PLACEHOLDER_WEEKS.map(function (w) { return Math.round(w.cyclingMiles); }),
              backgroundColor: COLORS.cyclingMuted,
              stack: "stack1",
            },
            {
              label: "Running mi",
              data: PLACEHOLDER_WEEKS.map(function (w) { return Math.round(w.runningMiles); }),
              backgroundColor: COLORS.runningMuted,
              stack: "stack1",
            },
            {
              label: "Swim mi",
              data: PLACEHOLDER_WEEKS.map(function (w) { return Math.round(w.swimmingMiles * 10) / 10; }),
              backgroundColor: COLORS.swimmingMuted,
              stack: "stack1",
            },
          ],
        },
        options: Object.assign({}, getChartOptions(true), {
          scales: {
            x: Object.assign({}, getChartOptions().scales.x, { stacked: true }),
            y: Object.assign({}, getChartOptions().scales.y, { stacked: true }),
          },
        }),
      }));
    }

    var ctxSessions = document.getElementById("chart-session-count");
    if (ctxSessions && typeof Chart !== "undefined") {
      chartInstances.push(new Chart(ctxSessions, {
        type: "bar",
        data: {
          labels: weekLabels,
          datasets: [
            {
              label: "Cycling",
              data: PLACEHOLDER_WEEKS.map(function (w) { return w.cyclingSessions; }),
              backgroundColor: COLORS.cyclingMuted,
              stack: "stack2",
            },
            {
              label: "Running",
              data: PLACEHOLDER_WEEKS.map(function (w) { return w.runningSessions; }),
              backgroundColor: COLORS.runningMuted,
              stack: "stack2",
            },
            {
              label: "Swimming",
              data: PLACEHOLDER_WEEKS.map(function (w) { return w.swimmingSessions; }),
              backgroundColor: COLORS.swimmingMuted,
              stack: "stack2",
            },
          ],
        },
        options: Object.assign({}, getChartOptions(true), {
          scales: {
            x: Object.assign({}, getChartOptions().scales.x, { stacked: true }),
            y: Object.assign({}, getChartOptions().scales.y, { stacked: true }),
          },
        }),
      }));
    }
  }

  function getActiveRange() {
    var btn = document.querySelector(".training-filter.active");
    return (btn && btn.getAttribute("data-range")) || "all";
  }

  function fetchAndRender(range) {
    var apiBase = window.location.origin;
    var url = apiBase + "/api/training" + (range ? "?range=" + encodeURIComponent(range) : "");
    fetch(url)
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error(r.status)); })
      .then(function (data) {
        destroyCharts();
        setData(data);
        init();
      })
      .catch(function () {
        setData(buildPlaceholderData());
        destroyCharts();
        init();
      });
  }

  function wireFilters() {
    var buttons = document.querySelectorAll(".training-filter");
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        buttons.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        var range = btn.getAttribute("data-range");
        if (range) fetchAndRender(range);
      });
    });
  }

  function init() {
    renderTimeSpentStats();
    renderConsistencyGrid();
    initCharts();
  }

  function boot() {
    wireFilters();
    var range = getActiveRange();
    fetchAndRender(range);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
