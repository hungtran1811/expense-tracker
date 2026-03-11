const MODEL_CANDIDATES_DEFAULT = Object.freeze([
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
]);
const MODEL =
  String(process.env.GEMINI_CATEGORIZE_MODEL || MODEL_CANDIDATES_DEFAULT[0] || "").trim() ||
  MODEL_CANDIDATES_DEFAULT[0];
const PROMPT_VERSION = "2.9.0";
const { guardAiRequest, jsonResponse } = require("../utils/aiGuard.js");

const CATEGORY_ALIAS_MAP = Object.freeze({
  "food drink": "Food & Drink",
  "food and drink": "Food & Drink",
  "an uong": "Food & Drink",
  food: "Food & Drink",
  drink: "Food & Drink",
  coffee: "Coffee",
  cafe: "Coffee",
  "ca phe": "Coffee",
  cf: "Coffee",
  personal: "Personal",
  "ca nhan": "Personal",
  rent: "Rent",
  housing: "Rent",
  "nha o": "Rent",
  fitness: "Fitness",
  gym: "Fitness",
  sport: "Fitness",
  "the thao": "Fitness",
  groceries: "Groceries",
  grocery: "Groceries",
  "di cho": "Groceries",
  "tap hoa": "Groceries",
  transport: "Transport",
  travel: "Transport",
  "di chuyen": "Transport",
  "xang xe": "Transport",
  healthcare: "Healthcare",
  health: "Healthcare",
  "suc khoe": "Healthcare",
  "benh vien": "Healthcare",
  lending: "Lending",
  loan: "Lending",
  "cho vay": "Lending",
  other: "Other",
  khac: "Other",
  misc: "Other",
  miscellaneous: "Other",
});

function safeText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function clampConfidence(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function stripAccents(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeKey(value = "") {
  return stripAccents(safeText(value, "").toLowerCase())
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value = "") {
  return normalizeKey(value)
    .split(" ")
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
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

function normalizeCategories(value) {
  if (!Array.isArray(value)) return [];
  const set = new Set();
  value.forEach((item) => {
    const text = safeText(item, "");
    if (!text) return;
    if (normalizeKey(text) === "all") return;
    set.add(text);
  });
  return Array.from(set);
}

function canonicalizeCategory(value = "", categories = []) {
  const raw = safeText(value, "");
  if (!raw) return "";
  if (categories.includes(raw)) return raw;

  const key = normalizeKey(raw);
  if (!key) return "";

  const exactByKey = categories.find((item) => normalizeKey(item) === key);
  if (exactByKey) return exactByKey;

  const aliased = CATEGORY_ALIAS_MAP[key] || "";
  if (aliased && categories.includes(aliased)) return aliased;

  return "";
}

function normalizeHistory(value, categories = []) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      name: safeText(item?.name, ""),
      note: safeText(item?.note, ""),
      category: canonicalizeCategory(item?.category, categories),
      appliedAt: item?.appliedAt || null,
      source: safeText(item?.source, ""),
      mode: safeText(item?.mode, ""),
      weight: Number(item?.weight || 1),
    }))
    .filter((item) => item.name && item.category)
    .slice(0, 120);
}

function pickExactHistoryMatch(payload = {}) {
  const categories = Array.isArray(payload?.categories) ? payload.categories : [];
  const history = Array.isArray(payload?.history) ? payload.history : [];
  if (!categories.length || !history.length) return null;

  const inputNameKey = normalizeKey(safeText(payload?.name, ""));
  const inputCombinedKey = normalizeKey(`${safeText(payload?.name, "")} ${safeText(payload?.note, "")}`);
  if (!inputNameKey) return null;

  let best = null;
  history.forEach((sample) => {
    if (!categories.includes(sample.category)) return;
    const sampleNameKey = normalizeKey(sample?.name || "");
    const sampleCombinedKey = normalizeKey(`${sample?.name || ""} ${sample?.note || ""}`);

    let exactLevel = 0;
    if (sampleCombinedKey && inputCombinedKey && sampleCombinedKey === inputCombinedKey) {
      exactLevel = 2;
    } else if (sampleNameKey && sampleNameKey === inputNameKey) {
      exactLevel = 1;
    }
    if (!exactLevel) return;

    const score =
      1 +
      exactLevel * 0.22 +
      normalizeWeight(sample?.weight) * 0.35 +
      scoreRecency(sample) +
      scoreSource(sample) +
      scoreMode(sample);

    if (!best || score > best.score) {
      best = { sample, score, exactLevel };
    }
  });

  if (!best) return null;
  const confidenceBase = best.exactLevel >= 2 ? 0.95 : 0.92;
  return {
    category: best.sample.category,
    confidence: clampConfidence(confidenceBase + Math.min(0.04, (best.score - 1) * 0.02)),
    reason:
      best.exactLevel >= 2
        ? `Trùng khớp chính xác với lịch sử đã gán nhãn: "${best.sample.name}".`
        : `Trùng tên giao dịch với lịch sử đã gán nhãn: "${best.sample.name}".`,
    matchType: "exact_history",
  };
}

function pickHistoryMatch(payload = {}) {
  const categories = Array.isArray(payload?.categories) ? payload.categories : [];
  const history = Array.isArray(payload?.history) ? payload.history : [];
  if (!categories.length || !history.length) return null;

  const inputNameKey = normalizeKey(safeText(payload?.name, ""));
  const inputTokens = tokenize(`${safeText(payload?.name, "")} ${safeText(payload?.note, "")}`);
  if (!inputTokens.length) return null;

  const categoryScores = new Map();
  history.forEach((sample) => {
    if (!categories.includes(sample.category)) return;
    const sampleTokens = tokenize(`${sample.name} ${sample.note}`);
    const { score, overlap } = scoreHistoryMatch(inputTokens, sampleTokens);
    if (!score || !overlap) return;

    const exactName = normalizeKey(sample.name) === inputNameKey;
    const weightedScore =
      score +
      (exactName ? 0.28 : 0) +
      scoreRecency(sample) +
      scoreSource(sample) +
      scoreMode(sample) +
      (normalizeWeight(sample?.weight) - 1) * 0.22;
    if (!(weightedScore > 0)) return;

    const key = sample.category;
    const current = categoryScores.get(key) || {
      category: key,
      score: 0,
      bestSample: sample,
      bestSampleScore: -1,
      overlapMax: 0,
    };
    current.score += weightedScore;
    current.overlapMax = Math.max(current.overlapMax, overlap);
    if (weightedScore > current.bestSampleScore) {
      current.bestSample = sample;
      current.bestSampleScore = weightedScore;
    }
    categoryScores.set(key, current);
  });

  const ranked = Array.from(categoryScores.values()).sort((a, b) => b.score - a.score);
  if (!ranked.length) return null;
  const best = ranked[0];
  const secondScore = Number(ranked[1]?.score || 0);
  const margin = best.score - secondScore;

  if (best.overlapMax < 1) return null;
  if (best.score < 0.7) return null;
  if (margin < 0.18 && best.score < 1.2) return null;

  return {
    category: best.category,
    confidence: clampConfidence(0.72 + Math.min(0.2, best.score * 0.12) + Math.min(0.06, margin * 0.05)),
    reason: `Khớp với lịch sử giao dịch gần đây: "${safeText(best.bestSample?.name, "giao dịch tương tự")}".`,
    matchType: "fuzzy_history",
  };
}

function containsAnyFragment(textKey = "", fragments = []) {
  const safeKey = normalizeKey(textKey);
  if (!safeKey) return false;
  return (Array.isArray(fragments) ? fragments : []).some((frag) => {
    const key = normalizeKey(frag);
    return key && safeKey.includes(key);
  });
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
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${apiKey}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.12,
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
  const textKey = normalizeKey(`${safeText(payload?.name, "")} ${safeText(payload?.note, "")}`);

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
  } else if (
    containsAnyFragment(textKey, ["cf", "cafe", "ca phe", "coffee", "tra sua", "matcha"])
  ) {
    category = pick(["Coffee"], category);
    reason = "Mô tả giao dịch gần với nhóm cà phê/đồ uống.";
    confidence = 0.84;
  } else if (
    containsAnyFragment(textKey, ["an", "uong", "com", "bun", "pho", "do an", "nha hang", "quan an"])
  ) {
    category = pick(["Food & Drink"], category);
    reason = "Mô tả giao dịch liên quan ăn uống.";
    confidence = 0.82;
  } else if (
    containsAnyFragment(textKey, ["xang", "xe", "grab", "taxi", "di chuyen", "ve xe", "gui xe"])
  ) {
    category = pick(["Transport"], category);
    reason = "Mô tả giao dịch liên quan chi phí di chuyển.";
    confidence = 0.8;
  } else if (
    containsAnyFragment(textKey, ["sieu thi", "di cho", "tap hoa", "groceries", "thuc pham"])
  ) {
    category = pick(["Groceries"], category);
    reason = "Mô tả giao dịch liên quan mua sắm nhu yếu phẩm.";
    confidence = 0.8;
  } else if (
    containsAnyFragment(textKey, ["thuoc", "kham", "benh vien", "y te", "health"])
  ) {
    category = pick(["Healthcare"], category);
    reason = "Mô tả giao dịch liên quan chăm sóc sức khỏe.";
    confidence = 0.78;
  } else if (
    containsAnyFragment(textKey, ["thue nha", "tien nha", "rent", "phong tro", "dien nuoc"])
  ) {
    category = pick(["Rent"], category);
    reason = "Mô tả giao dịch liên quan nhà ở/sinh hoạt.";
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

  const category = canonicalizeCategory(result?.category, categories) || fallback.category;
  const matchTypeRaw = safeText(result?.matchType, "model");
  const matchType = ["model", "fuzzy_history", "exact_history", "heuristic"].includes(matchTypeRaw)
    ? matchTypeRaw
    : "model";

  return {
    category,
    confidence: clampConfidence(result?.confidence ?? fallback.confidence),
    reason: safeText(result?.reason, fallback.reason),
    matchType,
    model: modelUsed,
    promptVersion: PROMPT_VERSION,
  };
}

function reconcileModelWithHistory(payload = {}, modelResult = {}) {
  const historyStrong = pickHistoryMatch(payload);
  if (!historyStrong) return modelResult;

  const modelMatchType = safeText(modelResult?.matchType, "model");
  if (modelMatchType === "exact_history" || modelMatchType === "fuzzy_history") {
    return modelResult;
  }

  const modelCategory = safeText(modelResult?.category, "");
  const modelConfidence = clampConfidence(modelResult?.confidence || 0);
  if (modelCategory === historyStrong.category) return modelResult;

  if (historyStrong.confidence >= 0.82 && modelConfidence < 0.9) {
    return {
      ...modelResult,
      category: historyStrong.category,
      confidence: historyStrong.confidence,
      reason: `${historyStrong.reason} Ưu tiên lịch sử gán nhãn cá nhân để giảm gán sai.`,
      matchType: "fuzzy_history",
    };
  }

  if (historyStrong.confidence >= modelConfidence + 0.08) {
    return {
      ...modelResult,
      category: historyStrong.category,
      confidence: historyStrong.confidence,
      reason: `${historyStrong.reason} Tín hiệu lịch sử mạnh hơn model hiện tại.`,
      matchType: "fuzzy_history",
    };
  }

  return modelResult;
}

function buildPrompt(payload = {}) {
  const history = (Array.isArray(payload?.history) ? payload.history : []).slice(0, 36);
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

  const categories = normalizeCategories(payload?.categories);
  const normalizedPayload = {
    name: safeText(payload?.name, ""),
    note: safeText(payload?.note, ""),
    categories,
    history: normalizeHistory(payload?.history, categories),
  };

  if (!normalizedPayload.name || !normalizedPayload.categories.length) {
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
      const hasUnexpected = tried.some(
        (item) => Number(item?.status || 0) !== 404 && Number(item?.status || 0) !== 400
      );
      if (hasUnexpected) {
        console.warn("ai-categorize Gemini model fallback exhausted:", tried);
      }
      return jsonResponse(200, localFallback(normalizedPayload));
    }

    const text = extractText(geminiResult.data || {});
    const parsed = parseJsonSafe(text);
    const normalizedModel = normalizeResult(parsed || {}, normalizedPayload, geminiResult.model || MODEL);
    const finalResult = reconcileModelWithHistory(normalizedPayload, normalizedModel);
    return jsonResponse(200, finalResult);
  } catch (err) {
    console.error("ai-categorize error:", err);
    return jsonResponse(200, localFallback(normalizedPayload));
  }
};
