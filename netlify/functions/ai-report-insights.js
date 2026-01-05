// netlify/functions/ai-report-insights.js
// Phân tích dữ liệu chi tiêu 1 tháng và trả về 1 đoạn nhận xét ngắn bằng tiếng Việt.

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

// ⚠️ Đảm bảo tên biến môi trường dưới đây GIỐNG với file ai-categorize.js bạn đang dùng
const API_KEY =
  (typeof Deno !== "undefined" ? Deno.env.get("GEMINI_API_KEY") : null) ||
  (typeof process !== "undefined" ? process.env.GEMINI_API_KEY : null);

export default async (request, context) => {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!API_KEY) {
    return new Response(
      JSON.stringify({ error: "Missing GEMINI_API_KEY env" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
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

Dựa trên dữ liệu chi tiêu trong tháng, hãy viết 2–3 câu nhận xét ngắn, dễ hiểu, KHÔNG dùng bullet point, không nhắc tới "dữ liệu" hay "báo cáo".

Thông tin đầu vào:
- Tháng: ${monthLabel || "không rõ"}
- Phạm vi tài khoản: ${accountLabel || "tất cả tài khoản"}
- Tổng chi: ${totalChi} VND
- Tổng thu: ${totalThu} VND
- Số dư (thu - chi): ${net} VND
- So sánh chi tiêu với tháng trước: ${chiCompareText || "không có dữ liệu"}
- So sánh số dư với tháng trước: ${netCompareText || "không có dữ liệu"}
- Danh mục chi cao nhất: ${
    topCategory ? `${topCategory.name} (${topCategory.amount} VND)` : "không có"
  }
- Ngày chi nhiều nhất trong tháng: ${
    topDay ? `${topDay.date} (${topDay.amount} VND)` : "không có"
  }

Yêu cầu:
- BẮT BUỘC viết ít nhất 2 câu hoàn chỉnh, tối đa 3 câu.
- Không bắt đầu bằng lời chào như "Chào bạn".
- Không dùng bullet point, không dùng tiêu đề, không mở đầu câu bằng dấu ":".
- Hạn chế số, không lặp lại toàn bộ số liệu, chỉ nhấn mạnh những điểm nổi bật (tiêu, thu, ngày chi nhiều, danh mục lớn).
- Luôn thêm ít nhất 1 câu gợi ý hành động đơn giản (ví dụ: "cần kiểm soát ăn uống", "cần giữ thói quen tiết kiệm"...).
- Không dùng bullet point, không dùng tiêu đề, không lạm dụng emoji (tối đa 1 emoji nếu cần).
- Trả lời ĐÚNG 2 câu.
- Mỗi câu phải kết thúc bằng dấu chấm.
`;

  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${API_KEY}`, {
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
      const errText = await res.text();
      console.error("Gemini error:", res.status, errText);
      return new Response(JSON.stringify({ error: "Gemini API error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text || "")
        .join(" ")
        .trim() || "";

    return new Response(JSON.stringify({ summary: text }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ai-report-insights error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
