const MODEL = "gemini-3-flash-latest";
const PROMPT_VERSION = "2.7.1";

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
    }))
    .filter((item) => item.name && item.category)
    .slice(0, 40);
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

    if (!best || score > best.score) {
      best = { sample, score, overlap };
    }
  });

  if (!best) return null;
  if (best.overlap < 2 || best.score < 0.34) return null;

  return {
    category: best.sample.category,
    confidence: clampConfidence(0.68 + best.score * 0.24),
    reason: `Khớp với giao dịch trước đây: "${best.sample.name}".`,
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

function localFallback(payload = {}) {
  const categories = Array.isArray(payload?.categories) ? payload.categories : [];
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

  if (historyMatch) {
    category = historyMatch.category;
    reason = historyMatch.reason;
    confidence = historyMatch.confidence;
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
    model: MODEL,
    promptVersion: PROMPT_VERSION,
    fallback: true,
  };
}

function normalizeResult(result = {}, payload = {}) {
  const categories = Array.isArray(payload?.categories) ? payload.categories : [];
  const fallback = localFallback(payload);

  const category = safeText(result?.category, fallback.category);
  const validCategory = categories.includes(category) ? category : fallback.category;

  return {
    category: validCategory,
    confidence: clampConfidence(result?.confidence ?? fallback.confidence),
    reason: safeText(result?.reason, fallback.reason),
    model: MODEL,
    promptVersion: PROMPT_VERSION,
  };
}

function buildPrompt(payload = {}) {
  const history = normalizeHistory(payload?.history).slice(0, 20);
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
  "reason": "1 câu ngắn"
}
- confidence từ 0 đến 1.
- reason ngắn gọn, tiếng Việt có dấu.
- Nếu giao dịch hiện tại giống rõ ràng với lịch sử đã gán nhãn, ưu tiên cùng category.
- Chỉ đặt confidence >= 0.75 khi tín hiệu thật sự rõ.
`.trim();
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  const normalizedPayload = {
    ...payload,
    categories: Array.isArray(payload?.categories)
      ? payload.categories.map((item) => String(item || "").trim()).filter(Boolean)
      : [],
    history: normalizeHistory(payload?.history),
  };

  if (!safeText(normalizedPayload?.name, "") || !normalizedPayload.categories.length) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Missing name or categories" }),
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(localFallback(normalizedPayload)),
    };
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
    const prompt = buildPrompt(normalizedPayload);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.25,
          maxOutputTokens: 220,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("ai-categorize Gemini error:", res.status, errText);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(localFallback(normalizedPayload)),
      };
    }

    const data = await res.json();
    const text = extractText(data);
    const parsed = parseJsonSafe(text);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(normalizeResult(parsed || {}, normalizedPayload)),
    };
  } catch (err) {
    console.error("ai-categorize error:", err);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(localFallback(normalizedPayload)),
    };
  }
};
