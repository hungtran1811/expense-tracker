const MODEL = "gemini-3-flash-latest";
const PROMPT_VERSION = "2.6.1";

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

exports.handler = async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Missing GEMINI_API_KEY" }),
    };
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

  const isWeeklyMode = String(payload?.mode || "").trim() === "weekly-review";
  const prompt = isWeeklyMode ? buildWeeklyPrompt(payload) : buildMonthlyPrompt(payload);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: isWeeklyMode ? 0.42 : 0.4,
          maxOutputTokens: isWeeklyMode ? 240 : 180,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("ai-report-insights Gemini error:", res.status, errText);
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Gemini API error",
          status: res.status,
          details: errText,
        }),
      };
    }

    const data = await res.json();
    const summary = extractGeminiText(data);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        summary,
        model: MODEL,
        promptVersion: PROMPT_VERSION,
      }),
    };
  } catch (err) {
    console.error("ai-report-insights error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Internal error", details: String(err) }),
    };
  }
};
