import { callNetlifyFunction } from "./netlifyClient.js";

const VIDEO_COPILOT_TIMEOUT_MS = 15000;

const DEFAULT_SHOT_LIST =
  "- Hook 2s: vấn đề chính\n- Demo kết quả 3-5s\n- Bước 1: setup nhanh\n- Bước 2: code logic cốt lõi\n- Bước 3: test nhanh\n- Chốt: bài tập + CTA";

const DEFAULT_NOTE =
  "Bản Short 30s: 1 hook + 1 demo + 1 mẹo code + CTA.\nBản dài 5-10 phút: chia 3 phần (vấn đề, code, tổng kết).\nKhi đã quen: mở rộng 10-15+ phút với debug và mở rộng tính năng.\nCông nghệ/ thư viện gợi ý: tối thiểu 2 mục phù hợp.\nCách dạy: ưu tiên ví dụ thực tế, ngôn ngữ đơn giản cho người mới.\nCuối video có mini-bài tập để tự luyện.";

const LANGUAGE_FALLBACK = {
  python: [
    "Python: Expense tracker mini cho người mới",
    "Python: To-do list có deadline trong 10 phút",
    "Python: Quiz app chấm điểm tự động",
  ],
  javascript: [
    "JavaScript: Expense tracker mini trên trình duyệt",
    "JavaScript: To-do Kanban mini",
    "JavaScript: Quiz app trắc nghiệm có đếm giờ",
  ],
};

function normalizeText(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function countLines(value = "") {
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean).length;
}

function normalizeTitle(title, inputTitle = "") {
  const raw = normalizeText(title);
  if (!raw) return "";
  const source = normalizeText(inputTitle).toLowerCase();
  if (source && raw.toLowerCase() === source) {
    return `${raw} - bản tối ưu cho người mới`;
  }
  return raw;
}

function normalizeLanguage(value = "") {
  const raw = normalizeText(value).toLowerCase();
  if (raw === "python" || raw === "javascript") return raw;
  return "python";
}

function isOptionLikeObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = ["title", "priority", "shotList", "assetLinks", "note", "deadlineSuggestion", "reason"];
  return keys.some((key) => normalizeText(value?.[key], "") !== "");
}

function buildFallbackOptions(inputTitle = "", language = "python") {
  const lang = normalizeLanguage(language);
  const options = LANGUAGE_FALLBACK[lang] || LANGUAGE_FALLBACK.python;
  return options.slice(0, 3).map((title, index) => ({
    title: normalizeTitle(index === 0 && inputTitle ? `Nâng cấp: ${inputTitle}` : title, inputTitle),
    priority: index === 0 ? "high" : "medium",
    shotList: DEFAULT_SHOT_LIST,
    assetLinks: "",
    note: DEFAULT_NOTE,
    deadlineSuggestion: "",
    reason: "Nội dung sát mục tiêu dạy học qua dự án đơn giản.",
  }));
}

function normalizeOptions(value, inputTitle = "", language = "python") {
  const base = Array.isArray(value) ? value.filter(isOptionLikeObject) : [];
  const normalized = base
    .map((item) => ({
      title: normalizeTitle(item?.title, inputTitle),
      priority: normalizeText(item?.priority, "medium"),
      shotList:
        countLines(item?.shotList) >= 6
          ? normalizeText(item?.shotList, DEFAULT_SHOT_LIST)
          : DEFAULT_SHOT_LIST,
      assetLinks: normalizeText(item?.assetLinks),
      note: countLines(item?.note) >= 6 ? normalizeText(item?.note, DEFAULT_NOTE) : DEFAULT_NOTE,
      deadlineSuggestion: normalizeText(item?.deadlineSuggestion),
      reason: normalizeText(item?.reason),
    }))
    .filter((item) => item.title && item.shotList && item.note)
    .slice(0, 3);

  const fallbacks = buildFallbackOptions(inputTitle, language);
  const merged = [...normalized];
  for (const item of fallbacks) {
    if (merged.length >= 3) break;
    const duplicated = merged.some(
      (existing) => existing.title.toLowerCase() === item.title.toLowerCase()
    );
    if (!duplicated) merged.push(item);
  }

  return merged.slice(0, 3);
}

export async function getVideoCopilotSuggestions(payload = {}, options = {}) {
  const timeoutMs = Math.max(1000, Number(options?.timeoutMs || VIDEO_COPILOT_TIMEOUT_MS));
  const data = await callNetlifyFunction("ai-video-copilot", payload || {}, {
    timeoutMs,
  });

  const inputTitle = String(payload?.input?.title || "").trim();
  const language = normalizeLanguage(data?.language || payload?.language || "python");
  const suggestions = normalizeOptions(data?.options, inputTitle, language);

  if (!suggestions.length) {
    throw new Error("Không nhận được phương án video hợp lệ.");
  }

  return {
    options: suggestions,
    model: String(data?.model || "gemini-3-flash-latest"),
    promptVersion: String(data?.promptVersion || "2.8.1"),
    language,
    fallback: Boolean(data?.fallback),
  };
}
