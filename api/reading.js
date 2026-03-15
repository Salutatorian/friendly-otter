/**
 * GET /api/reading — returns books from Goodreads RSS feed (all 3 shelves)
 * Env: GOODREADS_USER_ID (optional, defaults to 199403748 for Joshua Waldo)
 * Returns: { read: [], currentlyReading: [], toRead: [] }
 */
const DEFAULT_USER_ID = "199403748";
const CACHE_MS = 3 * 1000; // 3 seconds — nearly instant sync when you add books on Goodreads
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

function extractAllItems(xml) {
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const title = extractTag(block, "book_title") || extractTag(block, "title") || "";
    const author = extractTag(block, "author_name") || "";
    const cover = extractTag(block, "book_large_image_url")
      || extractTag(block, "book_medium_image_url")
      || extractTag(block, "book_small_image_url")
      || extractTag(block, "book_image_url")
      || "";
    const link = extractTag(block, "link") || "";
    const ratingStr = extractTag(block, "user_rating") || "0";
    const rating = Math.min(5, Math.max(0, parseInt(ratingStr, 10) || 0));

    if (title) {
      items.push({
        title,
        author,
        cover,
        link,
        rating,
      });
    }
  }
  return items;
}

async function fetchShelf(userId, shelf) {
  const url = `https://www.goodreads.com/review/list_rss/${userId}?shelf=${encodeURIComponent(shelf)}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; GreaterEngine/1.0; +https://github.com)",
    },
  });
  if (!response.ok) throw new Error("Goodreads RSS failed: " + response.status);
  const xml = await response.text();
  return extractAllItems(xml);
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userId = process.env.GOODREADS_USER_ID || DEFAULT_USER_ID;

  if (cache && Date.now() - cacheTime < CACHE_MS) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "s-maxage=3, max-age=3, stale-while-revalidate");
    return res.status(200).json(cache);
  }

  try {
    const [read, currentlyReading, toRead] = await Promise.all([
      fetchShelf(userId, "read"),
      fetchShelf(userId, "currently-reading"),
      fetchShelf(userId, "to-read"),
    ]);

    const data = { read, currentlyReading, toRead };
    cache = data;
    cacheTime = Date.now();

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "s-maxage=3, max-age=3, stale-while-revalidate");
    return res.status(200).json(data);
  } catch (err) {
    console.error("Reading API error:", err);
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(500).json({
      error: err.message || "Failed to fetch Goodreads",
      read: [],
      currentlyReading: [],
      toRead: [],
    });
  }
};
