import { callNetlifyFunction } from "./netlifyClient.js";

function normalizeHistory(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      name: String(item?.name || "").trim(),
      note: String(item?.note || "").trim(),
      category: String(item?.category || "").trim(),
      appliedAt: item?.appliedAt || null,
      source: String(item?.source || "").trim(),
      mode: String(item?.mode || "").trim(),
      weight: Number(item?.weight || 1),
    }))
    .filter((item) => item.name && item.category)
    .slice(0, 120);
}

export async function suggestCategory({ name, note, categories, history }) {
  const payload = {
    name,
    note,
    categories,
    history: normalizeHistory(history),
  };
  const data = await callNetlifyFunction(
    "ai-categorize",
    payload,
    { timeoutMs: 15000 }
  );
  const category = String(data?.category || "").trim();
  const confidence = Number(data?.confidence || 0);
  const reason = String(data?.reason || "").trim();
  const matchType = String(data?.matchType || "").trim();

  return {
    category,
    confidence: Number.isFinite(confidence) ? confidence : 0,
    reason,
    matchType,
    model: String(data?.model || "gemini-2.5-flash"),
    promptVersion: String(data?.promptVersion || "2.9.0"),
  };
}



