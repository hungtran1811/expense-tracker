/**
 * Optional AI / heuristic category suggestion.
 * Tries Netlify function when available; falls back to keyword map.
 */

const KEYWORD_MAP: Array<{ keys: string[]; categoryKey: string }> = [
  { keys: ["ăn", "cơm", "phở", "cafe", "trà", "uống", "nhậu"], categoryKey: "food" },
  { keys: ["xăng", "grab", "be ", "xe", "taxi", "bus"], categoryKey: "transport" },
  { keys: ["điện", "nước", "net", "wifi", "hóa đơn"], categoryKey: "bills" },
  { keys: ["thuốc", "khám", "bệnh"], categoryKey: "health" },
  { keys: ["mua sắm", "shopee", "lazada", "quần", "áo"], categoryKey: "shopping" },
];

function heuristicCategory(note: string, allowed: string[]): string | null {
  const text = String(note || "").toLowerCase();
  if (!text) return null;
  for (const row of KEYWORD_MAP) {
    if (!allowed.includes(row.categoryKey)) continue;
    if (row.keys.some((key) => text.includes(key.trim()))) return row.categoryKey;
  }
  return null;
}

export async function suggestCategoryFromNote(
  note: string,
  allowedKeys: string[] = []
): Promise<string | null> {
  const allowed = allowedKeys.map((item) => String(item || "").trim()).filter(Boolean);
  const fallback = heuristicCategory(note, allowed.length ? allowed : KEYWORD_MAP.map((r) => r.categoryKey));

  try {
    const response = await fetch("/.netlify/functions/ai-categorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note, allowedKeys: allowed }),
    });
    if (!response.ok) return fallback;
    const data = (await response.json()) as { categoryKey?: string };
    const key = String(data?.categoryKey || "").trim();
    if (key && (!allowed.length || allowed.includes(key))) return key;
  } catch {
    /* offline / no function */
  }

  return fallback;
}
