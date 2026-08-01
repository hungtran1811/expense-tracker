/**
 * Optional Gemini categorize endpoint.
 * Set GEMINI_API_KEY in Netlify env to enable; otherwise returns 503.
 */

const KEYWORD_MAP = [
  { keys: ["ăn", "cơm", "phở", "cafe", "trà", "uống"], categoryKey: "food" },
  { keys: ["xăng", "grab", "xe", "taxi"], categoryKey: "transport" },
  { keys: ["điện", "nước", "wifi", "hóa đơn"], categoryKey: "bills" },
];

function heuristic(note = "", allowed = []) {
  const text = String(note || "").toLowerCase();
  for (const row of KEYWORD_MAP) {
    if (allowed.length && !allowed.includes(row.categoryKey)) continue;
    if (row.keys.some((k) => text.includes(k))) return row.categoryKey;
  }
  return allowed[0] || "other";
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let body = {};
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    body = {};
  }

  const note = String(body.note || "");
  const allowedKeys = Array.isArray(body.allowedKeys) ? body.allowedKeys.map(String) : [];
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryKey: heuristic(note, allowedKeys), source: "heuristic" }),
    };
  }

  try {
    const prompt = `Classify this Vietnamese expense note into one category key from: ${allowedKeys.join(", ") || "food, transport, bills, other"}. Note: "${note}". Reply JSON only: {"categoryKey":"..."}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : {};
    const categoryKey = String(parsed.categoryKey || heuristic(note, allowedKeys));
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryKey, source: "gemini" }),
    };
  } catch {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryKey: heuristic(note, allowedKeys), source: "heuristic" }),
    };
  }
}
