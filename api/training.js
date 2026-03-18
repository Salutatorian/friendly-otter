/**
 * Vercel serverless API: /api/training
 * Returns Strava training data in the shape expected by training.js
 * Env: STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN
 */
module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
  const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
  const STRAVA_REFRESH_TOKEN = process.env.STRAVA_REFRESH_TOKEN;

  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET || !STRAVA_REFRESH_TOKEN) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(500).json({
      error:
        "Missing Strava env (STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN). Set in Vercel project settings.",
    });
  }

  const range =
    (req.query && req.query.range) ||
    (req.url && new URL(req.url, "http://localhost").searchParams.get("range")) ||
    "all";

  const rangeDays =
    { "7d": 7, "1m": 30, "3m": 90, "6m": 180, all: 365 }[range] || 365;

  try {
    const accessToken = await refreshAccessToken(
      STRAVA_CLIENT_ID,
      STRAVA_CLIENT_SECRET,
      STRAVA_REFRESH_TOKEN
    );
    const after = Math.floor(Date.now() / 1000 - rangeDays * 24 * 3600);
    const activities = await fetchAllActivities(accessToken, after);
    const dashboard = processActivitiesToDashboard(activities, rangeDays);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "s-maxage=1, max-age=0, stale-while-revalidate");
    return res.status(200).json(dashboard);
  } catch (err) {
    console.error("Training API error:", err);
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(500).json({ error: err.message });
  }
};

async function refreshAccessToken(clientId, clientSecret, refreshToken) {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error("Strava token refresh failed: " + res.status + " " + err);
  }

  const data = await res.json();
  return data.access_token;
}

async function fetchAllActivities(accessToken, after) {
  const activities = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const url = `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=${perPage}&page=${page}`;
    const res = await fetch(url, {
      headers: { Authorization: "Bearer " + accessToken },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error("Strava activities failed: " + res.status + " " + text);
    }

    const chunk = await res.json();
    if (!chunk.length) break;

    activities.push(...chunk);

    if (chunk.length < perPage) break;
    page++;
  }

  return activities;
}

function sportCategory(type) {
  const t = (type || "").toLowerCase();
  if (t.includes("ride") || t === "virtualride") return "cycling";
  if (t.includes("run") || t === "virtualrun") return "running";
  if (t.includes("swim")) return "swimming";
  return null;
}

function processActivitiesToDashboard(activities, rangeDays = 365) {
  const weekBuckets = {};
  const dayBuckets = {};

  activities.forEach((a) => {
    const start = new Date(a.start_date);
    const key = start.toISOString().slice(0, 10);

    const weekStart = new Date(start);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekKey = weekStart.toISOString().slice(0, 10);

    const sport = sportCategory(a.type || a.sport_type);
    if (!sport) return;

    const hours = (a.moving_time || 0) / 3600;
    const miles = (a.distance || 0) / 1609.344;

    if (!weekBuckets[weekKey]) {
      weekBuckets[weekKey] = {
        weekLabel: "W" + (weekStart.getMonth() + 1) + "/" + weekStart.getDate(),
        cyclingHours: 0,
        runningHours: 0,
        swimmingHours: 0,
        cyclingMiles: 0,
        runningMiles: 0,
        swimmingMiles: 0,
        cyclingSessions: 0,
        runningSessions: 0,
        swimmingSessions: 0,
      };
    }

    const w = weekBuckets[weekKey];
    w[sport + "Hours"] += hours;
    w[sport + "Miles"] += miles;
    w[sport + "Sessions"] += 1;

    if (!dayBuckets[key]) dayBuckets[key] = { minutes: 0, count: 0 };
    dayBuckets[key].minutes += hours * 60;
    dayBuckets[key].count += 1;
  });

  const weekKeys = Object.keys(weekBuckets).sort();
  const weeks = weekKeys.map((k) => weekBuckets[k]);
  const weekLabels = weeks.map((w) => w.weekLabel);

  const totals = {
    cyclingHours: 0,
    runningHours: 0,
    swimmingHours: 0,
    totalHours: 0,
  };

  weeks.forEach((w) => {
    totals.cyclingHours += w.cyclingHours;
    totals.runningHours += w.runningHours;
    totals.swimmingHours += w.swimmingHours;
  });

  totals.totalHours =
    totals.cyclingHours + totals.runningHours + totals.swimmingHours;

  const consistencyDays = Math.min(rangeDays, 365);
  const consistencyData = [];
  let trainingDays = 0;
  let currentStreak = 0;
  let longestStreak = 0;
  let run = 0;

  for (let i = consistencyDays - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const day = dayBuckets[key];

    let level = 0;
    if (day && day.minutes > 0) {
      trainingDays++;
      if (day.minutes >= 90) level = 4;
      else if (day.minutes >= 45) level = 3;
      else if (day.minutes >= 20) level = 2;
      else level = 1;

      run++;
      if (run > longestStreak) longestStreak = run;
    } else {
      if (run > 0 && currentStreak === 0) currentStreak = run;
      run = 0;
    }

    consistencyData.push(level);
  }

  if (run > 0 && currentStreak === 0) currentStreak = run;

  const consistencyCols = Math.ceil(consistencyDays / 7);
  return {
    weeks,
    weekLabels,
    totals,
    consistencyData,
    consistencyCols,
    trainingDays,
    longestStreak,
    currentStreak,
  };
}