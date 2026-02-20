exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const apiKey = process.env.GEMINI_API_KEY;

  let payload = {};
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  const {
    title = "",
    stage = "idea",
    deadline = "",
    priority = "medium",
    note = "",
  } = payload;

  if (!title) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing title" }),
    };
  }

  if (!apiKey) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        tip: "Tap trung 3 viec quan trong: chot thong diep video, tach canh quay, va khoa deadline tung buoc.",
      }),
      headers: { "Content-Type": "application/json" },
    };
  }

  const prompt = `
Ban la tro ly nang suat cho creator Youtube.
Hay viet 1-2 cau tieng Viet, ngan gon, de goi y hanh dong tiep theo cho task sau:
- Tieu de: ${title}
- Trang thai: ${stage}
- Deadline: ${deadline || "khong co"}
- Uu tien: ${priority}
- Ghi chu: ${note || "khong co"}

Yeu cau:
- Khong bullet point.
- Ton trong deadline.
- Dua ra hanh dong cu the co the lam ngay.
`.trim();

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-latest:generateContent?key=" +
    apiKey;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 120,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        statusCode: 200,
        body: JSON.stringify({
          tip: "Uu tien chot kich ban theo khung 3 phan (hook, gia tri, CTA) va dat moc deadline ro rang cho buoc tiep theo.",
          fallback: true,
          details: errText,
        }),
        headers: { "Content-Type": "application/json" },
      };
    }

    const data = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text || "")
        .join(" ")
        .trim() ||
      "Uu tien hoan tat buoc hien tai trong 1 phien lam viec 60 phut va khoa task tiep theo ngay sau do.";

    return {
      statusCode: 200,
      body: JSON.stringify({ tip: text }),
      headers: { "Content-Type": "application/json" },
    };
  } catch (err) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        tip: "Chia task thanh 3 phan nho, dat gio bat dau cu the, va hoan thanh phan kho nhat truoc.",
        fallback: true,
        details: String(err),
      }),
      headers: { "Content-Type": "application/json" },
    };
  }
};



