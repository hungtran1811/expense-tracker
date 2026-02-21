const MODEL = "gemini-3-flash-latest";
const PROMPT_VERSION = "3.1.0";
const { guardAiRequest, jsonResponse } = require("../utils/aiGuard.js");

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

function normalizeTopPriorities(value) {
  const list = Array.isArray(value) ? value : [value];
  return list
    .map((item) => safeText(item, ""))
    .filter(Boolean)
    .slice(0, 3);
}

function toOption(item = {}) {
  const goal = item?.goal || {};
  const habit = item?.habit || {};
  const weeklyPlan = item?.weeklyPlan || {};
  const goalTitle = safeText(goal?.title, "mục tiêu chính");
  const topPrioritiesRaw = normalizeTopPriorities(weeklyPlan?.topPriorities);
  const topPriorities =
    topPrioritiesRaw.length >= 3
      ? topPrioritiesRaw
      : [
          topPrioritiesRaw[0] || `Hoàn thành mốc quan trọng cho ${goalTitle}`,
          topPrioritiesRaw[1] || "Khóa lịch làm việc cố định cho tuần này",
          topPrioritiesRaw[2] || "Rà soát và chốt đầu việc còn mở trước cuối tuần",
        ];
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
    weeklyPlan: {
      focusTheme: safeText(weeklyPlan?.focusTheme, `Tập trung hoàn thành ${goalTitle}`),
      topPriorities,
      actionCommitments: safeText(weeklyPlan?.actionCommitments, "Mỗi ngày chốt ít nhất một đầu việc ưu tiên."),
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
        weeklyPlan: {
          focusTheme: "Giữ đều 2 phiên sản xuất quan trọng trong tuần",
          topPriorities: [
            "Chốt dứt điểm 1 video đang ở giai đoạn dựng",
            "Hoàn thành 1 kịch bản mới trước giữa tuần",
            "Rà soát checklist xuất bản trước cuối tuần",
          ],
          actionCommitments: "Mỗi ngày chốt một việc quan trọng trước 12h để không dồn việc.",
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
        weeklyPlan: {
          focusTheme: "Giảm dồn việc cuối tuần",
          topPriorities: [
            "Khóa deadline quay cho 1 video trong tuần",
            "Hoàn thành hook + outline cho video tiếp theo",
            "Dành 1 buổi tối ưu tiêu đề và thumbnail",
          ],
          actionCommitments: "Không để quá 2 đầu việc mở cùng lúc trong pipeline video.",
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
        weeklyPlan: {
          focusTheme: "Duy trì lịch ra video ổn định",
          topPriorities: [
            "Đẩy 1 video sang trạng thái xuất bản",
            "Khóa xong shot list cho video kế tiếp",
            "Chuẩn bị sẵn chủ đề tuần sau",
          ],
          actionCommitments: "Mỗi mốc quá hạn phải xử lý ngay trong ngày, không dồn sang hôm sau.",
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
      weeklyPlan: {
        focusTheme: "Mỗi tuần chốt 1 video hoàn chỉnh",
        topPriorities: [
          "Hoàn tất kịch bản và shot list trước thứ 3",
          "Quay và dựng xong trước thứ 6",
          "Xuất bản trong cuối tuần",
        ],
        actionCommitments: "Mỗi ngày dành 1 block cố định cho video, không hủy lịch.",
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
      weeklyPlan: {
        focusTheme: "Tối ưu chi phí sản xuất có kiểm soát",
        topPriorities: [
          "Rà soát chi phí từng video ngay sau khi quay",
          "Chuẩn hóa checklist chuẩn bị để tránh phát sinh",
          "Theo dõi ngân sách tuần theo từng đầu việc",
        ],
        actionCommitments: "Cuối mỗi ngày cập nhật chi phí thực tế và điều chỉnh kế hoạch hôm sau.",
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
      weeklyPlan: {
        focusTheme: "Mở rộng pipeline ý tưởng khả thi",
        topPriorities: [
          "Chốt 3 ý tưởng có thể quay ngay trong tuần",
          "Viết outline sơ bộ cho từng ý tưởng đã chọn",
          "Xếp lịch ưu tiên theo deadline thực tế",
        ],
        actionCommitments: "Ý tưởng mới phải đi kèm 1 hành động cụ thể trong vòng 24h.",
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
      "weeklyPlan": {
        "focusTheme": "string",
        "topPriorities": ["string", "string", "string"],
        "actionCommitments": "string"
      },
      "reason": "string ngắn"
    }
  ]
}
- Chính xác 3 options.
- Mỗi option phải có goal + habit + weeklyPlan đầy đủ, hành động được ngay.
- weeklyPlan.topPriorities phải có đúng 3 mục rõ ràng, cụ thể.
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
  const guard = await guardAiRequest(event, {
    routeKey: "ai-goal-suggest",
    maxRequests: 20,
    windowMs: 60000,
  });
  if (!guard.ok) return guard.response;

  let payload = {};
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const fallbackOptions = buildLocalOptions(payload);
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return jsonResponse(200, {
      options: fallbackOptions,
      model: MODEL,
      promptVersion: PROMPT_VERSION,
      fallback: true,
    });
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
      return jsonResponse(200, {
        options: fallbackOptions,
        model: MODEL,
        promptVersion: PROMPT_VERSION,
        fallback: true,
      });
    }

    const data = await res.json();
    const text = extractText(data);
    const parsed = parseJsonSafe(text);
    const options = normalizeOptions(parsed?.options, fallbackOptions);

    return jsonResponse(200, {
      options,
      model: MODEL,
      promptVersion: PROMPT_VERSION,
    });
  } catch (err) {
    console.error("ai-goal-suggest error:", err);
    return jsonResponse(200, {
      options: fallbackOptions,
      model: MODEL,
      promptVersion: PROMPT_VERSION,
      fallback: true,
    });
  }
};
