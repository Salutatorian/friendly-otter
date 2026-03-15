const fs = require("fs");
const path = require("path");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const filePath = path.join(process.cwd(), "data", "photos.json");
    const data = fs.existsSync(filePath)
      ? JSON.parse(fs.readFileSync(filePath, "utf8"))
      : [];
    res.setHeader("Cache-Control", "s-maxage=60");
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
