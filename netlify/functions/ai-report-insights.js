const MODEL_CANDIDATES_DEFAULT = Object.freeze([
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
]);
const MODEL =
  String(process.env.GEMINI_REPORT_MODEL || MODEL_CANDIDATES_DEFAULT[0] || "").trim() ||
  MODEL_CANDIDATES_DEFAULT[0];
const PROMPT_VERSION = "2.6.2";
const { guardAiRequest, jsonResponse } = require("../utils/aiGuard.js");

function safeString(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function buildMonthlyPrompt(payload = {}) {
  const {
    monthLabel,
    accountLabel,
    totalChi,
    totalThu,
    net,
    chiCompareText,
    netCompareText,
    topCategory,
    topDay,
  } = payload;

  return `
Bạn là trợ lý tài chính cá nhân, trả lời ngắn gọn bằng tiếng Việt có dấu.

Yêu cầu:
- Viết đúng 2 câu.
- Không bullet point.
- Có 1 nhận định nổi bật + 1 gợi ý hành động đơn giản.

Ngữ cảnh:
- Tháng: ${safeString(monthLabel, "không rõ")}
- Phạm vi: ${safeString(accountLabel, "tất cả tài khoản")}
- Tổng chi: ${Number(totalChi || 0)} VND
- Tổng thu: ${Number(totalThu || 0)} VND
- Dòng tiền ròng: ${Number(net || 0)} VND
- So sánh chi: ${safeString(chiCompareText, "không có")}
- So sánh ròng: ${safeString(netCompareText, "không có")}
- Danh mục chi cao nhất: ${
    topCategory ? `${safeString(topCategory.name)} (${Number(topCategory.amount || 0)} VND)` : "không có"
  }
- Ngày chi nhiều nhất: ${
    topDay ? `${safeString(topDay.date)} (${Number(topDay.amount || 0)} VND)` : "không có"
  }
`.trim();
}

function buildWeeklyPrompt(payload = {}) {
  return `
Bạn là AI Copilot của NEXUS OS, chuyên hỗ trợ nghi thức tổng kết tuần.

Yêu cầu:
- Viết 3-4 câu tiếng Việt có dấu.
- Tập trung vào hành động tuần mới, không lan man.
- Cấu trúc: 1 câu tổng quan + 2 câu hành động + 1 câu rủi ro/chặn.
- Không bullet point, không markdown.

Ngữ cảnh tuần:
${JSON.stringify(payload, null, 2)}
`.trim();
}

function extractGeminiText(data = {}) {
  return (
    data?.candidates?.[0]?.content?.parts
      ?.map((p) => p?.text || "")
      .join(" ")
      .trim() || ""
  );
}

function getModelCandidates() {
  const raw = String(process.env.GEMINI_REPORT_MODELS || "").trim();
  const fromEnv = raw
    .split(",")
    .map((item) => safeString(item, ""))
    .filter(Boolean);
  const combined = [MODEL, ...fromEnv, ...MODEL_CANDIDATES_DEFAULT].filter(Boolean);
  return Array.from(new Set(combined));
}

async function requestGeminiWithFallback({
  apiKey,
  prompt,
  temperature,
  maxOutputTokens,
  modelCandidates = [],
}) {
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
            temperature,
            maxOutputTokens,
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
      break;
    } catch (err) {
      tried.push({ model, status: 0, error: String(err?.message || err || "") });
    }
  }
  return { ok: false, tried };
}

exports.handler = async function handler(event) {
  const guard = await guardAiRequest(event, {
    routeKey: "ai-report-insights",
    maxRequests: 10,
    windowMs: 60000,
  });
  if (!guard.ok) return guard.response;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return jsonResponse(500, { error: "Missing GEMINI_API_KEY" });
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const isWeeklyMode = String(payload?.mode || "").trim() === "weekly-review";
  const prompt = isWeeklyMode ? buildWeeklyPrompt(payload) : buildMonthlyPrompt(payload);

  try {
    const result = await requestGeminiWithFallback({
      apiKey,
      prompt,
      temperature: isWeeklyMode ? 0.42 : 0.4,
      maxOutputTokens: isWeeklyMode ? 240 : 180,
      modelCandidates: getModelCandidates(),
    });

    if (!result.ok) {
      console.error("ai-report-insights Gemini fallback exhausted:", result.tried || []);
      return jsonResponse(500, {
        error: "Gemini API error",
        status: 500,
        details: "Model fallback exhausted",
      });
    }

    const summary = extractGeminiText(result.data || {});
    return jsonResponse(200, {
      summary,
      model: result.model || MODEL,
      promptVersion: PROMPT_VERSION,
    });
  } catch (err) {
    console.error("ai-report-insights error:", err);
    return jsonResponse(500, { error: "Internal error", details: String(err) });
  }
};
