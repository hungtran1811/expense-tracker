import { callNetlifyFunction } from "./netlifyClient.js";

function normalizeHistory(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      name: String(item?.name || "").trim(),
      note: String(item?.note || "").trim(),
      category: String(item?.category || "").trim(),
    }))
    .filter((item) => item.name && item.category)
    .slice(0, 40);
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

  return {
    category,
    confidence: Number.isFinite(confidence) ? confidence : 0,
    reason,
    model: String(data?.model || "gemini-3-flash-latest"),
    promptVersion: String(data?.promptVersion || "2.7.0"),
  };
}



