// netlify/functions/ai-report-insights.js
// Phân tích dữ liệu chi tiêu 1 tháng và trả về 2 câu nhận xét ngắn (VN).

exports.handler = async function (event, context) {
  // Only POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // Env
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Missing GEMINI_API_KEY" }),
    };
  }

  // Parse JSON body
  let payload = {};
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

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
  } = payload || {};

  const prompt = `
Bạn là một trợ lý tài chính cá nhân, nói chuyện ngắn gọn, thân thiện, bằng tiếng Việt.

Dựa trên thông tin dưới đây, hãy viết ĐÚNG 2 câu nhận xét, mỗi câu kết thúc bằng dấu chấm.
Không dùng bullet point, không dùng tiêu đề, không bắt đầu bằng "Chào bạn".
Hạn chế số, chỉ nhấn mạnh điểm nổi bật và có 1 gợi ý hành động đơn giản.

Thông tin:
- Tháng: ${monthLabel || "không rõ"}
- Phạm vi: ${accountLabel || "tất cả tài khoản"}
- Tổng chi: ${totalChi ?? 0} VND
- Tổng thu: ${totalThu ?? 0} VND
- Số dư (thu - chi): ${net ?? 0} VND
- So sánh chi với tháng trước: ${chiCompareText || "không có"}
- So sánh số dư với tháng trước: ${netCompareText || "không có"}
- Danh mục chi cao nhất: ${
    topCategory ? `${topCategory.name} (${topCategory.amount} VND)` : "không có"
  }
- Ngày chi nhiều nhất: ${
    topDay ? `${topDay.date} (${topDay.amount} VND)` : "không có"
  }
`.trim();

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
    apiKey;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 180,
        },
      }),
    });

    if (!res.ok) {
      // ✅ trả lỗi thật về FE để debug (401/403/429/…)
      const errText = await res.text().catch(() => "");
      console.error("Gemini error:", res.status, errText);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Gemini API error",
          status: res.status,
          details: errText,
        }),
      };
    }

    const data = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text || "")
        .join(" ")
        .trim() || "";

    return {
      statusCode: 200,
      body: JSON.stringify({ summary: text }),
      headers: { "Content-Type": "application/json" },
    };
  } catch (err) {
    console.error("ai-report-insights error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal error", details: String(err) }),
    };
  }
};
