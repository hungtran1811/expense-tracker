const MODEL = "gemini-3-flash-latest";
const PROMPT_VERSION = "2.8.2";

const SHOT_LIST_FALLBACK = {
  python:
    "- Hook 2s: vấn đề Python cần giải quyết\n- Demo kết quả 3-5s\n- Bước 1: setup dữ liệu nhanh\n- Bước 2: code logic cốt lõi\n- Bước 3: test nhanh 1-2 case\n- Chốt: bài tập tự luyện + CTA",
  javascript:
    "- Hook 2s: vấn đề JavaScript cần giải quyết\n- Demo kết quả 3-5s\n- Bước 1: setup state dữ liệu\n- Bước 2: xử lý sự kiện + cập nhật UI\n- Bước 3: test nhanh 1-2 case\n- Chốt: bài tập tự luyện + CTA",
};

const NOTE_FALLBACK = {
  python:
    "Bản Short 30s: 1 hook + 1 demo + 1 mẹo code + CTA.\nBản dài 5-10 phút: chia 3 phần (vấn đề, code, tổng kết).\nKhi đã quen: mở rộng 10-15+ phút với test/debug sâu hơn.\nCông nghệ/thư viện gợi ý: Python 3.12, Flask hoặc FastAPI, SQLite/Pandas.\nCách dạy: ví dụ thực tế, ngôn ngữ đơn giản cho người mới.\nKết mỗi phần bằng mini-bài tập để người xem tự làm lại.",
  javascript:
    "Bản Short 30s: 1 hook + 1 demo UI + 1 mẹo code + CTA.\nBản dài 5-10 phút: chia 3 phần (state, event, render).\nKhi đã quen: mở rộng 10-15+ phút với debug/refactor sâu hơn.\nCông nghệ/thư viện gợi ý: JavaScript ES2023, Vite, Chart.js hoặc React.\nCách dạy: đi từ kết quả đến code để người mới không bị ngợp.\nKết mỗi phần bằng mini-bài tập để người xem tự làm lại.",
};

const VIDEO_TEMPLATES = {
  python: [
    {
      title: "Python: Expense tracker mini cho người mới",
      priority: "high",
      shotList:
        "- Hook: vì sao nên học Python qua dự án thật\n- Demo output nhanh\n- Tạo model giao dịch\n- Viết hàm thêm/sửa/xóa\n- Tính tổng thu/chi\n- Chốt bài tập mở rộng",
      note:
        "Giải thích rất ngắn gọn từng bước để học sinh theo kịp.\nNhấn mạnh 1 lỗi thường gặp và cách sửa.\nGiữ code gọn, tránh lan man.\nCuối video chốt checklist hành động.",
      reason: "Dự án gần gũi, tạo kết quả nhanh ngay buổi đầu.",
      assetLinks: "https://docs.python.org/3/tutorial/\nhttps://fastapi.tiangolo.com/",
    },
    {
      title: "Python: To-do list có deadline trong 10 phút",
      priority: "medium",
      shotList:
        "- Hook: vì sao to-do list là bài mở đầu tốt\n- Demo dữ liệu task\n- Tạo cấu trúc task + deadline\n- Viết logic thêm/xóa/đánh dấu\n- Lọc task quá hạn\n- Chốt bài tập nâng cấp",
      note:
        "Tách bài toán thành bước nhỏ để người mới đỡ ngợp.\nMỗi hàm làm 1 việc rõ ràng.\nCó phần debug nhanh khi nhập sai dữ liệu.\nKết video bằng bài tập tự luyện.",
      reason: "Ngắn gọn, dễ làm theo và áp dụng ngay.",
      assetLinks: "https://docs.python.org/3/tutorial/\nhttps://docs.python.org/3/library/datetime.html",
    },
    {
      title: "Python: Quiz app chấm điểm tự động",
      priority: "medium",
      shotList:
        "- Hook: học Python qua mini game\n- Demo 1 lượt chơi\n- Tạo mảng câu hỏi/đáp án\n- Xử lý chọn đáp án\n- Tính điểm\n- Chốt bài tập thêm cấp độ",
      note:
        "Ví dụ vui, hợp học sinh và newbie.\nGiải thích if/else + loop ngắn gọn.\nThêm phần xử lý lỗi nhập liệu.\nKết thúc bằng checklist tự luyện.",
      reason: "Nội dung trực quan, dễ giữ chân người xem.",
      assetLinks: "https://docs.python.org/3/tutorial/",
    },
  ],
  javascript: [
    {
      title: "JavaScript: Expense tracker mini trên trình duyệt",
      priority: "high",
      shotList:
        "- Hook: học JS nhanh qua dự án thật\n- Demo UI cập nhật realtime\n- Tạo state giao dịch\n- Bind form + validate\n- Render danh sách\n- Chốt bài tập lọc theo tháng",
      note:
        "Dạy theo flow: kết quả trước, code sau.\nMỗi phần chỉ 1 mục tiêu rõ ràng.\nCó đoạn debug ngắn lỗi event listener.\nKết thúc bằng checklist thực hành.",
      reason: "Trực quan, nhìn thấy kết quả ngay nên dễ theo.",
      assetLinks: "https://developer.mozilla.org/docs/Web/JavaScript\nhttps://vite.dev/guide/",
    },
    {
      title: "JavaScript: To-do Kanban mini cho người mới",
      priority: "medium",
      shotList:
        "- Hook: từ to-do lên kanban rất nhanh\n- Demo 3 cột task\n- Tạo state task\n- Thêm/xóa/chuyển cột\n- Lưu localStorage\n- Chốt bài tập thêm deadline",
      note:
        "Tập trung 3 concept: state, event, render.\nVí dụ ngắn để tránh quá tải thông tin.\nHướng dẫn tách hàm nhỏ dễ đọc.\nCuối video giao bài tập nâng cấp UI.",
      reason: "Giúp người mới hiểu cách JS vận hành trong app thực tế.",
      assetLinks: "https://developer.mozilla.org/docs/Web/API/Window/localStorage\nhttps://developer.mozilla.org/docs/Web/JavaScript",
    },
    {
      title: "JavaScript: Quiz app trắc nghiệm có đếm giờ",
      priority: "medium",
      shotList:
        "- Hook: học JS qua game quiz\n- Demo 1 vòng quiz\n- Tạo bộ câu hỏi\n- Xử lý chọn đáp án\n- Tính điểm + đếm ngược\n- Chốt bài tập replay",
      note:
        "Giải thích quản lý state bằng object đơn giản.\nNêu mẹo tránh bug timer chạy trùng.\nMỗi bước đều có output để check.\nKết video bằng hướng mở rộng.",
      reason: "Nội dung vui, phù hợp học sinh và người mới.",
      assetLinks: "https://developer.mozilla.org/docs/Web/API/setInterval\nhttps://developer.mozilla.org/docs/Web/JavaScript",
    },
  ],
};

const VARIANTS = [
  { suffix: "bản 30s ngắn gọn", angle: "tập trung hook + kết quả + CTA" },
  { suffix: "bản 5-10 phút cho người mới", angle: "đi từng bước rõ ràng" },
  { suffix: "bản checklist thực hành", angle: "có bài tập nhỏ sau mỗi đoạn" },
  { suffix: "bản debug lỗi thường gặp", angle: "chèn một lỗi thật và sửa ngay" },
];

function safeText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeLanguage(value = "") {
  const v = safeText(value, "").toLowerCase();
  if (v === "python" || v === "javascript") return v;
  return "python";
}

function normalizePriority(value = "") {
  const v = safeText(value, "medium").toLowerCase();
  return ["low", "medium", "high"].includes(v) ? v : "medium";
}

function normalizeDate(value = "") {
  const v = safeText(value, "");
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "";
}

function lines(value = "") {
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function ensureBulletLines(value = "", minLines = 6, fallback = "") {
  const normalized = lines(value).map((line) =>
    line.startsWith("- ") ? line : `- ${line.replace(/^-+\s*/, "")}`
  );
  if (normalized.length >= minLines) return normalized.join("\n");
  return lines(fallback)
    .map((line) => (line.startsWith("- ") ? line : `- ${line.replace(/^-+\s*/, "")}`))
    .join("\n");
}

function ensureParagraphLines(value = "", minLines = 6, fallback = "") {
  const normalized = lines(value);
  if (normalized.length >= minLines) return normalized.join("\n");
  return lines(fallback).join("\n");
}

function isOptionLikeObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return ["title", "priority", "shotList", "assetLinks", "note", "deadlineSuggestion", "reason"].some(
    (key) => safeText(value?.[key], "") !== ""
  );
}

function hashToInt(value = "") {
  const str = String(value || "");
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function rotateList(list = [], offset = 0) {
  if (!Array.isArray(list) || !list.length) return [];
  const n = Math.abs(Number(offset || 0)) % list.length;
  return [...list.slice(n), ...list.slice(0, n)];
}

function detectLanguage(payload = {}) {
  const explicit = normalizeLanguage(payload?.language || "");
  if (payload?.language) return explicit;

  const context = payload?.context || {};
  const input = payload?.input || {};
  const blob = [
    safeText(context?.channelFocus, ""),
    safeText(context?.targetAudience, ""),
    safeText(context?.ownerTagline, ""),
    ...(Array.isArray(context?.preferredTopics) ? context.preferredTopics : []),
    safeText(input?.title, ""),
    safeText(input?.note, ""),
    safeText(input?.shotList, ""),
  ]
    .join(" ")
    .toLowerCase();

  const py = blob.indexOf("python");
  const js = Math.min(
    ...[blob.indexOf("javascript"), blob.indexOf("java script")].filter((i) => i >= 0)
  );

  if (Number.isFinite(py) && !Number.isFinite(js)) return "python";
  if (!Number.isFinite(py) && Number.isFinite(js)) return "javascript";
  if (Number.isFinite(py) && Number.isFinite(js)) return py <= js ? "python" : "javascript";
  return "python";
}

function applyVariant(template = {}, variant = {}) {
  const suffix = safeText(variant?.suffix, "");
  const angle = safeText(variant?.angle, "");
  return {
    ...template,
    title: suffix ? `${safeText(template?.title, "Nội dung video")} - ${suffix}` : safeText(template?.title, "Nội dung video"),
    note: [safeText(template?.note, ""), angle ? `Góc triển khai: ${angle}.` : ""].filter(Boolean).join("\n"),
  };
}

function normalizeOption(item = {}, payload = {}, language = "python") {
  const input = payload?.input || {};
  const shotFallback = SHOT_LIST_FALLBACK[language] || SHOT_LIST_FALLBACK.python;
  const noteFallback = NOTE_FALLBACK[language] || NOTE_FALLBACK.python;

  const titleRaw = safeText(item?.title, "");
  const inputTitle = safeText(input?.title, "");
  const title =
    titleRaw && inputTitle && titleRaw.toLowerCase() === inputTitle.toLowerCase()
      ? `${titleRaw} - bản tối ưu cho người mới`
      : titleRaw || (inputTitle ? `Nâng cấp: ${inputTitle}` : "Nội dung dự án cho người mới");

  return {
    title,
    priority: normalizePriority(item?.priority),
    shotList: ensureBulletLines(item?.shotList, 6, shotFallback),
    assetLinks: safeText(item?.assetLinks, ""),
    note: ensureParagraphLines(
      `${safeText(item?.note, noteFallback)}\n${NOTE_FALLBACK[language] || NOTE_FALLBACK.python}`,
      6,
      noteFallback
    ),
    deadlineSuggestion: normalizeDate(item?.deadlineSuggestion || input?.deadline),
    reason: safeText(item?.reason, "Nội dung sát mục tiêu dạy học qua dự án đơn giản."),
  };
}

function buildLocalOptions(payload = {}, language = "python") {
  const templates = VIDEO_TEMPLATES[language] || VIDEO_TEMPLATES.python;
  const seed = hashToInt(
    [safeText(payload?.nonce, ""), safeText(payload?.mode, "generate"), language, safeText(payload?.input?.title, "")].join("|")
  );

  const rotated = rotateList(templates, seed % Math.max(templates.length, 1));
  const mode = safeText(payload?.mode, "generate").toLowerCase() === "improve" ? "improve" : "generate";
  const input = payload?.input || {};

  return rotated.slice(0, 3).map((template, index) => {
    const variant = VARIANTS[(seed + index) % VARIANTS.length];
    const flavored = applyVariant(template, variant);

    if (mode === "improve" && index === 0) {
      return normalizeOption(
        {
          ...flavored,
          title: input?.title
            ? `Nâng cấp: ${safeText(input?.title, "")} - ${safeText(variant?.suffix, "bản tối ưu")}`
            : flavored.title,
          shotList: `${safeText(input?.shotList, "")}\n${safeText(flavored?.shotList, "")}`,
          note: `${safeText(input?.note, "")}\n${safeText(flavored?.note, "")}`,
          assetLinks: safeText(input?.assetLinks, "") || flavored.assetLinks,
          priority: safeText(input?.priority, flavored.priority),
          deadlineSuggestion: normalizeDate(input?.deadline),
          reason: "Đã cải thiện trực tiếp từ nội dung bạn đang nhập để dùng ngay.",
        },
        payload,
        language
      );
    }

    return normalizeOption(
      {
        ...flavored,
        deadlineSuggestion: normalizeDate(input?.deadline),
      },
      payload,
      language
    );
  });
}

function buildPrompt(payload = {}, language = "python") {
  const languageLabel = language === "python" ? "Python" : "JavaScript";
  const forbiddenLabel = language === "python" ? "JavaScript" : "Python";

  return `
Bạn là AI Copilot cho creator nội dung lập trình.

Yêu cầu bắt buộc:
- Trả về DUY NHẤT 1 JSON object, không markdown.
- Schema:
{
  "options": [
    {
      "title": "string",
      "priority": "low|medium|high",
      "shotList": "string",
      "assetLinks": "string",
      "note": "string",
      "deadlineSuggestion": "YYYY-MM-DD hoặc rỗng",
      "reason": "string ngắn"
    }
  ]
}
- Trả về chính xác 3 options.
- Chỉ dùng ${languageLabel}, không so sánh với ${forbiddenLabel}.
- Mỗi option là 1 ý tưởng dự án thực tế cho người mới.
- shotList tối thiểu 6 dòng bullet, mỗi dòng bắt đầu bằng "- ".
- note tối thiểu 6 dòng, bắt buộc có:
  1) "Bản Short 30s: ..."
  2) "Bản dài 5-10 phút: ..."
  3) "Khi đã quen: ..."
  4) gợi ý stack + ít nhất 2 công nghệ/thư viện.
- Tiếng Việt có dấu chuẩn UTF-8.

Dữ liệu đầu vào:
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

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const objectLike = raw.match(/\{[\s\S]*"options"\s*:\s*\[[\s\S]*\][\s\S]*\}/i);
  const candidates = [raw, fenced?.[1], objectLike?.[0]].filter(Boolean);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // ignore
    }
  }
  return null;
}

function normalizeOptions(value, fallback = [], payload = {}, language = "python") {
  const base = Array.isArray(value) ? value.filter(isOptionLikeObject) : [];
  const normalized = base
    .map((item) => normalizeOption(item, payload, language))
    .filter((item) => item.title && lines(item.shotList).length >= 6 && lines(item.note).length >= 6)
    .slice(0, 3);

  const fallbackNorm = (Array.isArray(fallback) ? fallback : [])
    .filter(isOptionLikeObject)
    .map((item) => normalizeOption(item, payload, language));

  const out = [...normalized];
  for (const item of fallbackNorm) {
    if (out.length >= 3) break;
    if (!out.some((existing) => existing.title.toLowerCase() === item.title.toLowerCase())) {
      out.push(item);
    }
  }

  return out.slice(0, 3);
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
    mode: safeText(payload?.mode, "generate"),
    nonce: safeText(payload?.nonce, ""),
    language: safeText(payload?.language, ""),
    input: payload?.input && typeof payload.input === "object" ? payload.input : {},
    context: payload?.context && typeof payload.context === "object" ? payload.context : {},
  };

  const language = detectLanguage(normalizedPayload);
  const fallbackOptions = buildLocalOptions(normalizedPayload, language);
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        options: fallbackOptions,
        language,
        model: MODEL,
        promptVersion: PROMPT_VERSION,
        fallback: true,
      }),
    };
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
    const prompt = buildPrompt(normalizedPayload, language);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          topP: 0.92,
          maxOutputTokens: 1200,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("ai-video-copilot Gemini error:", res.status, errText);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          options: fallbackOptions,
          language,
          model: MODEL,
          promptVersion: PROMPT_VERSION,
          fallback: true,
        }),
      };
    }

    const data = await res.json();
    const text = extractText(data);
    const parsed = parseJsonSafe(text);
    const options = normalizeOptions(parsed?.options, fallbackOptions, normalizedPayload, language);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        options,
        language,
        model: MODEL,
        promptVersion: PROMPT_VERSION,
      }),
    };
  } catch (err) {
    console.error("ai-video-copilot error:", err);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        options: fallbackOptions,
        language,
        model: MODEL,
        promptVersion: PROMPT_VERSION,
        fallback: true,
      }),
    };
  }
};
