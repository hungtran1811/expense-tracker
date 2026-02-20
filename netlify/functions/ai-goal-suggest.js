const MODEL = "gemini-3-flash-latest";
const PROMPT_VERSION = "2.7.1";

function safeText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizePeriod(value, fallback = "month") {
  const v = safeText(value, fallback);
  return ["day", "week", "month"].includes(v) ? v : fallback;
}

function normalizeArea(value) {
  const v = safeText(value, "ca-nhan");
  return ["ca-nhan", "tai-chinh", "youtube", "suc-khoe"].includes(v) ? v : "ca-nhan";
}

function normalizePriority(value) {
  const v = safeText(value, "medium");
  return ["low", "medium", "high"].includes(v) ? v : "medium";
}

function normalizeDate(value) {
  const v = safeText(value, "");
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "";
}

function toOption(item = {}) {
  const goal = item?.goal || {};
  const habit = item?.habit || {};
  return {
    goal: {
      title: safeText(goal?.title, ""),
      area: normalizeArea(goal?.area),
      period: normalizePeriod(goal?.period, "month"),
      targetValue: Math.max(1, Number(goal?.targetValue || 1)),
      unit: safeText(goal?.unit, "lần"),
      dueDate: normalizeDate(goal?.dueDate),
      priority: normalizePriority(goal?.priority),
      note: safeText(goal?.note, ""),
    },
    habit: {
      name: safeText(habit?.name, ""),
      period: normalizePeriod(habit?.period, "day"),
      targetCount: Math.max(1, Number(habit?.targetCount || 1)),
      xpPerCheckin: Math.max(1, Number(habit?.xpPerCheckin || 10)),
    },
    reason: safeText(item?.reason, ""),
  };
}

function buildLocalOptions(payload = {}) {
  const mode = safeText(payload?.mode, "generate").toLowerCase() === "improve" ? "improve" : "generate";
  const input = payload?.input || {};
  const goal = input?.goal || {};
  const habit = input?.habit || {};

  const baseGoalTitle = safeText(goal?.title, "Hoàn thành 2 video chất lượng trong tháng");
  const baseArea = normalizeArea(goal?.area);
  const baseDueDate = normalizeDate(goal?.dueDate);
  const baseHabitName = safeText(habit?.name, "Viết kịch bản 30 phút mỗi ngày");

  if (mode === "improve") {
    return [
      toOption({
        goal: {
          title: baseGoalTitle,
          area: baseArea,
          period: normalizePeriod(goal?.period, "month"),
          targetValue: Math.max(1, Number(goal?.targetValue || 2)),
          unit: safeText(goal?.unit, "video"),
          dueDate: baseDueDate,
          priority: "high",
          note: "Chia mục tiêu thành mốc tuần để theo dõi rõ tiến độ.",
        },
        habit: {
          name: baseHabitName,
          period: normalizePeriod(habit?.period, "day"),
          targetCount: Math.max(1, Number(habit?.targetCount || 1)),
          xpPerCheckin: Math.max(10, Number(habit?.xpPerCheckin || 10)),
        },
        reason: "Giữ đúng mục tiêu hiện tại nhưng tăng khả năng thực thi theo tuần.",
      }),
      toOption({
        goal: {
          title: `${baseGoalTitle} và tối ưu tỷ lệ hoàn thành đúng hạn`,
          area: baseArea,
          period: "month",
          targetValue: Math.max(1, Number(goal?.targetValue || 2)),
          unit: "video",
          dueDate: baseDueDate,
          priority: "medium",
          note: "Ưu tiên khóa deadline từng giai đoạn sản xuất.",
        },
        habit: {
          name: "Chốt 1 task video quan trọng trước 12h",
          period: "day",
          targetCount: 1,
          xpPerCheckin: 12,
        },
        reason: "Tăng kỷ luật đầu ngày để giảm dồn việc cuối tuần.",
      }),
      toOption({
        goal: {
          title: "Ổn định nhịp sản xuất 1 video/tuần",
          area: "youtube",
          period: "month",
          targetValue: 4,
          unit: "video",
          dueDate: baseDueDate,
          priority: "medium",
          note: "Tập trung sự ổn định thay vì tăng số lượng quá nhanh.",
        },
        habit: {
          name: "Hoàn thành checklist tiền kỳ trước thứ 4",
          period: "week",
          targetCount: 1,
          xpPerCheckin: 20,
        },
        reason: "Giảm rủi ro trễ hạn nhờ khóa việc tiền kỳ sớm.",
      }),
    ];
  }

  return [
    toOption({
      goal: {
        title: "Hoàn thành 4 video YouTube trong 30 ngày",
        area: "youtube",
        period: "month",
        targetValue: 4,
        unit: "video",
        dueDate: "",
        priority: "high",
        note: "Mỗi tuần chốt 1 video đã xuất bản, không dồn cuối tháng.",
      },
      habit: {
        name: "Viết kịch bản 45 phút mỗi ngày",
        period: "day",
        targetCount: 1,
        xpPerCheckin: 12,
      },
      reason: "Tập trung vào output thực tế và giữ đều nhịp sản xuất.",
    }),
    toOption({
      goal: {
        title: "Giảm chi phí sản xuất video 15% trong tháng",
        area: "tai-chinh",
        period: "month",
        targetValue: 15,
        unit: "%",
        dueDate: "",
        priority: "medium",
        note: "Rà soát các khoản thuê ngoài và tối ưu tài nguyên sẵn có.",
      },
      habit: {
        name: "Ghi lại chi phí phát sinh sau mỗi buổi quay",
        period: "day",
        targetCount: 1,
        xpPerCheckin: 10,
      },
      reason: "Kết hợp mục tiêu tài chính với thói quen ghi nhận để dễ kiểm soát.",
    }),
    toOption({
      goal: {
        title: "Xây dựng thư viện 20 ý tưởng video mới",
        area: "youtube",
        period: "month",
        targetValue: 20,
        unit: "ý tưởng",
        dueDate: "",
        priority: "medium",
        note: "Ưu tiên ý tưởng có thể quay trong 1 buổi.",
      },
      habit: {
        name: "Ghi 1 ý tưởng video trước khi kết thúc ngày",
        period: "day",
        targetCount: 1,
        xpPerCheckin: 8,
      },
      reason: "Giữ pipeline ý tưởng luôn dồi dào cho các tuần tiếp theo.",
    }),
  ];
}

function buildPrompt(payload = {}) {
  return `
Bạn là AI Copilot cho creator, nhiệm vụ: đề xuất 3 bundle mục tiêu để điền form ngay.

Bắt buộc:
- Trả về DUY NHẤT JSON object, không markdown.
- Schema:
{
  "options": [
    {
      "goal": {
        "title": "string",
        "area": "ca-nhan|tai-chinh|youtube|suc-khoe",
        "period": "day|week|month",
        "targetValue": 1,
        "unit": "string",
        "dueDate": "YYYY-MM-DD hoặc rỗng",
        "priority": "low|medium|high",
        "note": "string"
      },
      "habit": {
        "name": "string",
        "period": "day|week|month",
        "targetCount": 1,
        "xpPerCheckin": 10
      },
      "reason": "string ngắn"
    }
  ]
}
- Chính xác 3 options.
- Mỗi option phải có goal + habit đầy đủ, hành động được ngay.
- Tiếng Việt có dấu, ngắn gọn, thực dụng.

Ngữ cảnh đầu vào:
${JSON.stringify(payload, null, 2)}
`.trim();
}

function extractText(data = {}) {
  return (
    data?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text || "")
      .join(" ")
      .trim() || ""
  );
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

function normalizeOptions(value, fallback = []) {
  const options = (Array.isArray(value) ? value : [])
    .map((item) => toOption(item))
    .filter((item) => item.goal.title && item.habit.name)
    .slice(0, 3);

  if (options.length === 3) return options;
  return (Array.isArray(fallback) ? fallback : []).map((item) => toOption(item)).slice(0, 3);
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

  const fallbackOptions = buildLocalOptions(payload);
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        options: fallbackOptions,
        model: MODEL,
        promptVersion: PROMPT_VERSION,
        fallback: true,
      }),
    };
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
    const prompt = buildPrompt(payload);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.48,
          maxOutputTokens: 760,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("ai-goal-suggest Gemini error:", res.status, errText);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          options: fallbackOptions,
          model: MODEL,
          promptVersion: PROMPT_VERSION,
          fallback: true,
        }),
      };
    }

    const data = await res.json();
    const text = extractText(data);
    const parsed = parseJsonSafe(text);
    const options = normalizeOptions(parsed?.options, fallbackOptions);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        options,
        model: MODEL,
        promptVersion: PROMPT_VERSION,
      }),
    };
  } catch (err) {
    console.error("ai-goal-suggest error:", err);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        options: fallbackOptions,
        model: MODEL,
        promptVersion: PROMPT_VERSION,
        fallback: true,
      }),
    };
  }
};
