// netlify/functions/ai-categorize.js

exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed",
    };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing GEMINI_API_KEY" }),
      };
    }

    const { name, note, categories } = JSON.parse(event.body || "{}");

    if (!name || !Array.isArray(categories) || categories.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing name or categories" }),
      };
    }

    const prompt = `
Bạn là hệ thống phân loại chi tiêu cá nhân.

Danh sách danh mục hợp lệ:
${JSON.stringify(categories)}

Tên khoản chi: "${name}"
Ghi chú: "${note || ""}"

YÊU CẦU QUAN TRỌNG:
- Trả về DUY NHẤT một JSON object.
- KHÔNG dùng code block, KHÔNG dùng \`\`\`json.
- KHÔNG thêm chữ nào ngoài JSON.
- JSON phải đúng cú pháp, parse được.

Mẫu JSON:
{"category":"...","confidence":0.0}

Bây giờ hãy trả JSON duy nhất cho đầu vào trên.
`.trim();

    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
      apiKey;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Gemini error:", errText);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Gemini request failed" }),
      };
    }

    const data = await res.json();

    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "{}";

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      console.warn("Cannot parse JSON from Gemini:", text);
      parsed = { category: "Khác", confidence: 0 };
    }

    if (!categories.includes(parsed.category)) {
      parsed.category = "Khác";
    }

    return {
      statusCode: 200,
      body: JSON.stringify(parsed),
    };
  } catch (err) {
    console.error("ai-categorize error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server error" }),
    };
  }
};
