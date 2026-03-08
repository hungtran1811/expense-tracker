const MODEL_CANDIDATES_DEFAULT = Object.freeze([
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
]);
const MODEL = String(process.env.GEMINI_CATEGORIZE_MODEL || MODEL_CANDIDATES_DEFAULT[0] || "").trim() || MODEL_CANDIDATES_DEFAULT[0];
const PROMPT_VERSION = "2.8.1";
const { guardAiRequest, jsonResponse } = require("../utils/aiGuard.js");

function safeText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function clampConfidence(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function normalizeHistory(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      name: safeText(item?.name, ""),
      note: safeText(item?.note, ""),
      category: safeText(item?.category, ""),
      appliedAt: item?.appliedAt || null,
      source: safeText(item?.source, ""),
      mode: safeText(item?.mode, ""),
      weight: Number(item?.weight || 1),
    }))
    .filter((item) => item.name && item.category)
    .slice(0, 120);
}

function stripAccents(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function tokenize(value = "") {
  return stripAccents(safeText(value, "").toLowerCase())
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
}

function normalizeKey(value = "") {
  return stripAccents(safeText(value, "").toLowerCase())
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toMs(value) {
  if (!value) return 0;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? 0 : value.getTime();
  if (typeof value?.toDate === "function") {
    const dt = value.toDate();
    return Number.isNaN(dt.getTime()) ? 0 : dt.getTime();
  }
  if (Number.isFinite(Number(value?.seconds || 0))) {
    return Number(value.seconds) * 1000;
  }
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? 0 : dt.getTime();
}

function normalizeWeight(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(0.8, Math.min(1.8, n));
}

function scoreRecency(sample = {}) {
  const diffMs = Date.now() - toMs(sample?.appliedAt);
  if (!Number.isFinite(diffMs) || diffMs <= 0) return 0.18;
  const days = diffMs / 86400000;
  if (days <= 7) return 0.18;
  if (days <= 30) return 0.12;
  if (days <= 90) return 0.08;
  if (days <= 180) return 0.05;
  return 0.02;
}

function scoreMode(sample = {}) {
  const mode = safeText(sample?.mode, "");
  if (mode === "manual-apply" || mode === "manual-label") return 0.16;
  if (mode === "auto-label") return 0.12;
  if (mode === "generate") return 0.06;
  return 0;
}

function scoreSource(sample = {}) {
  return safeText(sample?.source, "") === "ai-feedback" ? 0.1 : 0;
}

function scoreHistoryMatch(inputTokens = [], sampleTokens = []) {
  if (!inputTokens.length || !sampleTokens.length) return { score: 0, overlap: 0 };
  const sampleSet = new Set(sampleTokens);
  let overlap = 0;
  inputTokens.forEach((token) => {
    if (sampleSet.has(token)) overlap += 1;
  });
  if (!overlap) return { score: 0, overlap: 0 };

  const scoreInput = overlap / inputTokens.length;
  const scoreSample = overlap / sampleTokens.length;
  return {
    overlap,
    score: scoreInput * 0.65 + scoreSample * 0.35,
  };
}

function pickExactHistoryMatch(payload = {}) {
  const categories = Array.isArray(payload?.categories) ? payload.categories : [];
  const history = normalizeHistory(payload?.history);
  if (!categories.length || !history.length) return null;

  const inputKey = normalizeKey(`${safeText(payload?.name, "")} ${safeText(payload?.note, "")}`);
  if (!inputKey) return null;

  let best = null;
  history.forEach((sample) => {
    if (!categories.includes(sample.category)) return;
    const sampleKey = normalizeKey(`${sample.name} ${sample.note}`);
    if (!sampleKey || sampleKey !== inputKey) return;
    const score =
      1 +
      normalizeWeight(sample?.weight) * 0.35 +
      scoreRecency(sample) +
      scoreSource(sample) +
      scoreMode(sample);
    if (!best || score > best.score) {
      best = { sample, score };
    }
  });

  if (!best) return null;
  return {
    category: best.sample.category,
    confidence: clampConfidence(0.93 + Math.min(0.05, (best.score - 1) * 0.02)),
    reason: `Trùng khớp chính xác với lịch sử đã gán nhãn: "${best.sample.name}".`,
    matchType: "exact_history",
  };
}

function pickHistoryMatch(payload = {}) {
  const categories = Array.isArray(payload?.categories) ? payload.categories : [];
  const history = normalizeHistory(payload?.history);
  if (!categories.length || !history.length) return null;

  const inputTokens = tokenize(`${safeText(payload?.name, "")} ${safeText(payload?.note, "")}`);
  if (!inputTokens.length) return null;

  let best = null;
  history.forEach((sample) => {
    if (!categories.includes(sample.category)) return;
    const sampleTokens = tokenize(`${sample.name} ${sample.note}`);
    const { score, overlap } = scoreHistoryMatch(inputTokens, sampleTokens);
    if (!score || !overlap) return;

    const exactName = normalizeKey(sample.name) && normalizeKey(sample.name) === normalizeKey(payload?.name || "");
    const weightedScore =
      score +
      (exactName ? 0.24 : 0) +
      scoreRecency(sample) +
      scoreSource(sample) +
      scoreMode(sample) +
      (normalizeWeight(sample?.weight) - 1) * 0.2;

    if (!best || weightedScore > best.score) {
      best = { sample, score: weightedScore, overlap };
    }
  });

  if (!best) return null;
  if (best.overlap < 2 || best.score < 0.42) return null;

  return {
    category: best.sample.category,
    confidence: clampConfidence(0.72 + best.score * 0.22),
    reason: `Khớp với giao dịch trước đây: "${best.sample.name}".`,
    matchType: "fuzzy_history",
  };
}

function parseJsonSafe(text = "") {
  const raw = safeText(text, "");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function extractText(data = {}) {
  return (
    data?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text || "")
      .join(" ")
      .trim() || ""
  );
}

function getModelCandidates() {
  const raw = String(process.env.GEMINI_CATEGORIZE_MODELS || "").trim();
  const fromEnv = raw
    .split(",")
    .map((item) => safeText(item, ""))
    .filter(Boolean);
  const combined = [MODEL, ...fromEnv, ...MODEL_CANDIDATES_DEFAULT].filter(Boolean);
  return Array.from(new Set(combined));
}

async function requestGeminiWithFallback(apiKey, prompt, modelCandidates = []) {
  const tried = [];
  for (const model of modelCandidates) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 240,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        return { ok: true, model, data };
      }

      const errText = await res.text().catch(() => "");
      tried.push({ model, status: res.status, error: errText.slice(0, 600) });
      if (res.status === 404 || res.status === 400) {
        continue;
      }
    } catch (err) {
      tried.push({ model, status: 0, error: String(err?.message || err || "") });
      continue;
    }
  }
  return { ok: false, tried };
}

function localFallback(payload = {}) {
  const categories = Array.isArray(payload?.categories) ? payload.categories : [];
  const exactHistory = pickExactHistoryMatch(payload);
  const historyMatch = pickHistoryMatch(payload);
  const text = `${safeText(payload?.name, "").toLowerCase()} ${safeText(payload?.note, "").toLowerCase()}`.trim();

  const pick = (matches = [], fallback = "Other") => {
    for (const key of matches) {
      if (categories.includes(key)) return key;
    }
    return categories.includes(fallback) ? fallback : categories[0] || "Other";
  };

  let category = pick([], "Other");
  let reason = "Dữ liệu còn ít nên AI đưa ra gợi ý an toàn.";
  let confidence = 0.55;
  let matchType = "heuristic";

  if (exactHistory) {
    category = exactHistory.category;
    reason = exactHistory.reason;
    confidence = exactHistory.confidence;
    matchType = exactHistory.matchType;
  } else if (historyMatch) {
    category = historyMatch.category;
    reason = historyMatch.reason;
    confidence = historyMatch.confidence;
    matchType = historyMatch.matchType;
  } else if (/(ăn|uống|cơm|trà|cafe|cà phê|đồ ăn)/i.test(text)) {
    category = pick(["Food & Drink", "Coffee"], category);
    reason = "Mô tả giao dịch liên quan ăn uống hoặc đồ uống.";
    confidence = 0.82;
  } else if (/(xăng|xe|grab|taxi|di chuyển|vé xe)/i.test(text)) {
    category = pick(["Transport"], category);
    reason = "Mô tả giao dịch liên quan chi phí di chuyển.";
    confidence = 0.8;
  } else if (/(siêu thị|đi chợ|tạp hóa|groceries)/i.test(text)) {
    category = pick(["Groceries"], category);
    reason = "Mô tả giao dịch liên quan nhu yếu phẩm hằng ngày.";
    confidence = 0.8;
  } else if (/(thuốc|khám|bệnh viện|health)/i.test(text)) {
    category = pick(["Healthcare"], category);
    reason = "Mô tả giao dịch liên quan chăm sóc sức khỏe.";
    confidence = 0.78;
  }

  return {
    category,
    confidence,
    reason,
    matchType,
    model: MODEL,
    promptVersion: PROMPT_VERSION,
    fallback: true,
  };
}

function normalizeResult(result = {}, payload = {}, modelUsed = MODEL) {
  const categories = Array.isArray(payload?.categories) ? payload.categories : [];
  const fallback = localFallback(payload);

  const category = safeText(result?.category, fallback.category);
  const validCategory = categories.includes(category) ? category : fallback.category;
  const matchTypeRaw = safeText(result?.matchType, "model");
  const matchType = ["model", "fuzzy_history", "exact_history", "heuristic"].includes(matchTypeRaw)
    ? matchTypeRaw
    : "model";

  return {
    category: validCategory,
    confidence: clampConfidence(result?.confidence ?? fallback.confidence),
    reason: safeText(result?.reason, fallback.reason),
    matchType,
    model: modelUsed,
    promptVersion: PROMPT_VERSION,
  };
}

function buildPrompt(payload = {}) {
  const history = normalizeHistory(payload?.history).slice(0, 30);
  return `
Bạn là AI phân loại nhãn chi tiêu cá nhân.

Danh mục hợp lệ:
${JSON.stringify(payload?.categories || [])}

Giao dịch:
- Tên: ${safeText(payload?.name, "")}
- Ghi chú: ${safeText(payload?.note, "")}

Lịch sử giao dịch đã gán nhãn của người dùng (dùng để cá nhân hóa):
${JSON.stringify(history, null, 2)}

Yêu cầu bắt buộc:
- Trả về DUY NHẤT JSON object, không markdown.
- Schema:
{
  "category": "string thuộc danh mục hợp lệ",
  "confidence": 0.0,
  "reason": "1 câu ngắn",
  "matchType": "model | fuzzy_history | exact_history | heuristic"
}
- confidence từ 0 đến 1.
- reason ngắn gọn, tiếng Việt có dấu.
- matchType bắt buộc theo enum.
- Nếu giao dịch hiện tại giống rõ ràng với lịch sử đã gán nhãn, ưu tiên cùng category.
- Chỉ đặt confidence >= 0.90 khi tín hiệu thật sự rõ.
`.trim();
}

exports.handler = async function handler(event) {
  const guard = await guardAiRequest(event, {
    routeKey: "ai-categorize",
    maxRequests: 30,
    windowMs: 60000,
  });
  if (!guard.ok) return guard.response;

  let payload = {};
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const normalizedPayload = {
    ...payload,
    categories: Array.isArray(payload?.categories)
      ? payload.categories.map((item) => String(item || "").trim()).filter(Boolean)
      : [],
    history: normalizeHistory(payload?.history),
  };

  if (!safeText(normalizedPayload?.name, "") || !normalizedPayload.categories.length) {
    return jsonResponse(400, { error: "Missing name or categories" });
  }

  const exactHistory = pickExactHistoryMatch(normalizedPayload);
  if (exactHistory) {
    return jsonResponse(200, {
      ...exactHistory,
      model: MODEL,
      promptVersion: PROMPT_VERSION,
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return jsonResponse(200, localFallback(normalizedPayload));
  }

  try {
    const prompt = buildPrompt(normalizedPayload);
    const modelCandidates = getModelCandidates();
    const geminiResult = await requestGeminiWithFallback(apiKey, prompt, modelCandidates);

    if (!geminiResult.ok) {
      const tried = Array.isArray(geminiResult?.tried) ? geminiResult.tried : [];
      const hasUnexpected = tried.some((item) => Number(item?.status || 0) !== 404 && Number(item?.status || 0) !== 400);
      if (hasUnexpected) {
        console.warn("ai-categorize Gemini model fallback exhausted:", tried);
      }
      return jsonResponse(200, localFallback(normalizedPayload));
    }

    const text = extractText(geminiResult.data || {});
    const parsed = parseJsonSafe(text);
    return jsonResponse(200, normalizeResult(parsed || {}, normalizedPayload, geminiResult.model || MODEL));
  } catch (err) {
    console.error("ai-categorize error:", err);
    return jsonResponse(200, localFallback(normalizedPayload));
  }
};
