/**
 * GET /api/movies — returns films from Letterboxd RSS (watched)
 * Env: LETTERBOXD_USERNAME (optional, defaults to joshuawaldo)
 * Returns: { watched: [] }
 */
const DEFAULT_USERNAME = "joshuawaldo";
const CACHE_MS = 1000; // 1 second — instant sync when you add/rate films on Letterboxd
let cache = null;
let cacheTime = 0;

function extractTag(xml, tagName) {
  const open = "<" + tagName + ">";
  const close = "</" + tagName + ">";
  const i = xml.indexOf(open);
  if (i === -1) return null;
  const start = i + open.length;
  const end = xml.indexOf(close, start);
  if (end === -1) return null;
  return xml.slice(start, end).replace(/<!\[CDATA\[|\]\]>/g, "").trim();
}

function parseLetterboxdRating(str) {
  if (!str) return 0;
  const num = parseFloat(str);
  if (!Number.isNaN(num)) return Math.min(5, Math.max(0, num));
  const stars = (str.match(/★/g) || []).length;
  const half = (str.match(/½/g) || []).length;
  return Math.min(5, Math.max(0, stars + half * 0.5));
}

function extractPosterFromDescription(html) {
  if (!html) return "";
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return imgMatch ? imgMatch[1] : "";
}

function extractAllItems(xml) {
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    let title =
      extractTag(block, "letterboxd:filmTitle") ||
      extractTag(block, "letterboxd-filmTitle") ||
      "";
    if (!title) {
      const rawTitle = extractTag(block, "title") || "";
      title = rawTitle
        .replace(/^[^:]+(?:watched|reviewed|rated)\s*/i, "")
        .replace(/\s*[★☆½]+.*$/, "")
        .trim() || rawTitle;
    }
    const link = extractTag(block, "link") || "";
    const description = extractTag(block, "description") || "";
    const cover = extractPosterFromDescription(description) || "";
    const ratingStr =
      extractTag(block, "letterboxd:memberRating") ||
      extractTag(block, "letterboxd-memberRating") ||
      "";
    const rating = parseLetterboxdRating(ratingStr);

    if (title) {
      items.push({
        title,
        link,
        cover,
        rating,
      });
    }
  }
  return items;
}

async function fetchLetterboxdRss(username) {
  const url = `https://letterboxd.com/${encodeURIComponent(username)}/rss/`;
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; GreaterEngine/1.0; +https://github.com)",
    },
  });
  if (!response.ok) throw new Error("Letterboxd RSS failed: " + response.status);
  const xml = await response.text();
  return extractAllItems(xml);
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const username =
    process.env.LETTERBOXD_USERNAME || DEFAULT_USERNAME;

  if (cache && Date.now() - cacheTime < CACHE_MS) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "s-maxage=1, max-age=1, stale-while-revalidate");
    return res.status(200).json(cache);
  }

  try {
    const watched = await fetchLetterboxdRss(username);
    const data = { watched };
    cache = data;
    cacheTime = Date.now();

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "s-maxage=1, max-age=1, stale-while-revalidate");
    return res.status(200).json(data);
  } catch (err) {
    console.error("Movies API error:", err);
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(500).json({
      error: err.message || "Failed to fetch Letterboxd",
      watched: [],
    });
  }
};
