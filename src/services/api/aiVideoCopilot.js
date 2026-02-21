import { callNetlifyFunction } from "./netlifyClient.js";

const VIDEO_COPILOT_TIMEOUT_MS = 15000;
const DEFAULT_MODEL = "gemini-3-flash-latest";
const DEFAULT_PROMPT_VERSION = "3.2.0";

const SUPPORTED_TRACKS = new Set([
  "python",
  "javascript",
  "frontend",
  "backend",
  "data_ai",
  "automation",
  "mobile",
  "system_design",
]);

const TRACK_ALIASES = {
  js: "javascript",
  node: "backend",
  nodejs: "backend",
  "front-end": "frontend",
  "back-end": "backend",
  "data-ai": "data_ai",
  data: "data_ai",
  ai: "data_ai",
  ml: "data_ai",
  "system-design": "system_design",
  architecture: "system_design",
};

const TRACK_LABELS = {
  python: "Python",
  javascript: "JavaScript",
  frontend: "Frontend",
  backend: "Backend",
  data_ai: "Data/AI",
  automation: "Tự động hóa",
  mobile: "Mobile",
  system_design: "System Design",
};

const TRACK_FALLBACK_SEEDS = {
  python: [
    {
      title: "Python: Quản lý điểm thi bằng CSV cho lớp học",
      hook: "Bạn có thể tự động tổng hợp điểm cả lớp chỉ bằng vài dòng Python.",
      concept: "đọc file CSV, tính trung bình và xếp loại",
      expansion: "thêm biểu đồ điểm theo từng học sinh",
      resource: "https://docs.python.org/3/library/csv.html",
      priority: "high",
    },
    {
      title: "Python: Bot nhắc deadline học tập mỗi ngày",
      hook: "Biến lịch học rối rắm thành bot nhắc việc chạy tự động.",
      concept: "quét deadline và gửi nhắc việc đúng ngày",
      expansion: "thêm mức ưu tiên và nhắc việc theo khung giờ",
      resource: "https://docs.python.org/3/library/datetime.html",
      priority: "medium",
    },
    {
      title: "Python: API TODO mini với FastAPI",
      hook: "Tạo API chạy thật cho người mới chỉ trong 10 phút.",
      concept: "CRUD TODO với FastAPI và validate dữ liệu",
      expansion: "thêm auth token đơn giản",
      resource: "https://fastapi.tiangolo.com/",
      priority: "high",
    },
    {
      title: "Python: Phân tích chi tiêu cá nhân với Pandas",
      hook: "Từ file chi tiêu thô sang báo cáo dễ hiểu trong vài bước.",
      concept: "lọc dữ liệu theo tháng, nhóm danh mục và đọc xu hướng",
      expansion: "thêm cảnh báo khi chi vượt ngưỡng",
      resource: "https://pandas.pydata.org/docs/",
      priority: "medium",
    },
  ],
  javascript: [
    {
      title: "JavaScript: Flashcard học từ vựng có localStorage",
      hook: "Tự làm app flashcard để học đều mỗi ngày bằng JavaScript thuần.",
      concept: "state thẻ, lật thẻ và lưu localStorage",
      expansion: "thêm chế độ ôn tập thông minh",
      resource: "https://developer.mozilla.org/docs/Web/API/Window/localStorage",
      priority: "high",
    },
    {
      title: "JavaScript: Pomodoro timer cho người học code",
      hook: "Build timer tập trung học code mà không cần thư viện nặng.",
      concept: "start/pause/reset và xử lý setInterval ổn định",
      expansion: "thêm thống kê số phiên học theo ngày",
      resource: "https://developer.mozilla.org/docs/Web/API/setInterval",
      priority: "medium",
    },
    {
      title: "JavaScript: Form đăng ký với validate realtime",
      hook: "Form đẹp chưa đủ, phải có phản hồi rõ thì người dùng mới hoàn thành.",
      concept: "rule validate, hiển thị lỗi theo thời gian thực",
      expansion: "thêm password strength meter",
      resource: "https://developer.mozilla.org/docs/Learn/Forms/Form_validation",
      priority: "high",
    },
    {
      title: "JavaScript: Kanban mini kéo thả",
      hook: "Từ TODO list lên Kanban bằng drag and drop thuần.",
      concept: "cập nhật state khi kéo thả và lưu dữ liệu",
      expansion: "thêm deadline badge để quản lý tiến độ",
      resource: "https://developer.mozilla.org/docs/Web/API/HTML_Drag_and_Drop_API",
      priority: "medium",
    },
  ],
  frontend: [
    {
      title: "Frontend: Redesign trang đăng nhập từ basic lên chuyên nghiệp",
      hook: "Nâng cấp UI login trong 10 phút nhưng vẫn giữ UX dễ dùng.",
      concept: "hierarchy, spacing và trạng thái input rõ ràng",
      expansion: "thêm guideline responsive cho mobile",
      resource: "https://developer.mozilla.org/docs/Web/CSS",
      priority: "high",
    },
    {
      title: "Frontend: Sửa lỗi vỡ card dashboard trên mobile",
      hook: "3 kỹ thuật CSS giúp dashboard không vỡ layout trên màn nhỏ.",
      concept: "grid minmax, text wrapping và action group co giãn",
      expansion: "thêm checklist kiểm thử 3 breakpoint",
      resource: "https://css-tricks.com/snippets/css/complete-guide-grid/",
      priority: "medium",
    },
    {
      title: "Frontend: Form UX với trạng thái lỗi-thành công chuẩn",
      hook: "Người mới hay bỏ qua flow lỗi, và đó là chỗ UX quyết định chuyển đổi.",
      concept: "empty/focus/error/success states và copy rõ ràng",
      expansion: "thêm loading state chống bấm lặp",
      resource: "https://www.nngroup.com/articles/form-design-placeholders/",
      priority: "medium",
    },
    {
      title: "Frontend: Accessibility nhanh cho web cá nhân",
      hook: "A11y đúng cách giúp sản phẩm chuyên nghiệp hơn ngay lập tức.",
      concept: "contrast, focus ring, keyboard navigation, aria-label",
      expansion: "thêm checklist tự audit A11y hằng tuần",
      resource: "https://www.w3.org/WAI/fundamentals/accessibility-intro/",
      priority: "low",
    },
  ],
  backend: [
    {
      title: "Backend: Auth JWT cho người mới từ A-Z",
      hook: "Hiểu JWT theo cách thực chiến thay vì học thuộc lý thuyết.",
      concept: "signup/login, token, middleware bảo vệ route",
      expansion: "thêm refresh token cơ bản",
      resource: "https://jwt.io/introduction",
      priority: "high",
    },
    {
      title: "Backend: Chuẩn hóa REST API sạch và dễ mở rộng",
      hook: "REST API lộn xộn sẽ làm dự án khó scale hơn bạn nghĩ.",
      concept: "endpoint naming, status code và error shape chuẩn",
      expansion: "thêm versioning cho API",
      resource: "https://restfulapi.net/",
      priority: "medium",
    },
    {
      title: "Backend: Caching Redis cho endpoint chậm",
      hook: "Một lớp cache đúng chỗ có thể giảm độ trễ thấy rõ ngay.",
      concept: "cache key, TTL, invalidation và benchmark",
      expansion: "thêm theo dõi cache hit ratio",
      resource: "https://redis.io/docs/latest/",
      priority: "medium",
    },
    {
      title: "Backend: Upload file an toàn trong app thực tế",
      hook: "Upload file là chỗ dễ dính lỗi bảo mật nhất của backend newbie.",
      concept: "validate file type/size và lưu trữ an toàn",
      expansion: "thêm scan malware cho bản nâng cao",
      resource: "https://owasp.org/www-community/vulnerabilities/Unrestricted_File_Upload",
      priority: "low",
    },
  ],
  data_ai: [
    {
      title: "Data/AI: Dự đoán điểm thi bằng hồi quy tuyến tính",
      hook: "Bắt đầu ML từ ví dụ gần gũi với học sinh để dễ nắm bản chất.",
      concept: "chuẩn bị dữ liệu, train model và đọc sai số",
      expansion: "thêm so sánh giữa 2 mô hình đơn giản",
      resource: "https://scikit-learn.org/stable/supervised_learning.html",
      priority: "high",
    },
    {
      title: "Data/AI: Phân nhóm khách hàng bằng KMeans",
      hook: "Từ dữ liệu thô đến insight thực tế chỉ qua 1 mini project.",
      concept: "tiền xử lý dữ liệu và phân cụm cơ bản",
      expansion: "vẽ biểu đồ giúp người mới đọc kết quả",
      resource: "https://scikit-learn.org/stable/modules/clustering.html",
      priority: "medium",
    },
    {
      title: "Data/AI: AI tóm tắt ghi chú học tập tự động",
      hook: "Dùng AI cho nhu cầu thật: đọc ghi chú dài trong 30 giây.",
      concept: "prompt rõ mục tiêu và chuẩn hóa output",
      expansion: "thêm chấm điểm chất lượng tóm tắt",
      resource: "https://ai.google.dev/",
      priority: "medium",
    },
    {
      title: "Data/AI: Dashboard phân tích dữ liệu học tập",
      hook: "Biến bảng số liệu khô khan thành dashboard dễ hành động.",
      concept: "tổng hợp KPI chính và trực quan hóa đơn giản",
      expansion: "thêm cảnh báo khi KPI giảm mạnh",
      resource: "https://plotly.com/python/",
      priority: "low",
    },
  ],
  automation: [
    {
      title: "Automation: Script rename file hàng loạt có quy tắc",
      hook: "Tiết kiệm hàng giờ thao tác tay bằng một script ngắn.",
      concept: "đọc danh sách file và đổi tên theo pattern",
      expansion: "thêm chế độ preview trước khi áp dụng",
      resource: "https://docs.python.org/3/library/pathlib.html",
      priority: "high",
    },
    {
      title: "Automation: Tự động tổng hợp báo cáo tuần từ dữ liệu thô",
      hook: "Mỗi tuần 1 file báo cáo tự động thay vì làm thủ công lặp lại.",
      concept: "gom dữ liệu, tính KPI, xuất báo cáo",
      expansion: "thêm gửi email sau khi tạo báo cáo",
      resource: "https://pandas.pydata.org/docs/",
      priority: "medium",
    },
    {
      title: "Automation: Bot nhắc việc theo lịch cá nhân",
      hook: "Không bỏ sót deadline khi có bot nhắc việc đúng lúc.",
      concept: "đọc lịch, lọc deadline gần, gửi thông báo",
      expansion: "thêm ưu tiên và lọc theo dự án",
      resource: "https://docs.python.org/3/library/sched.html",
      priority: "medium",
    },
    {
      title: "Automation: Pipeline backup dữ liệu đơn giản",
      hook: "Một pipeline backup nhỏ giúp bạn tránh mất dữ liệu quan trọng.",
      concept: "zip, version file và dọn bản cũ",
      expansion: "thêm restore script một chạm",
      resource: "https://nodejs.org/api/fs.html",
      priority: "low",
    },
  ],
  mobile: [
    {
      title: "Mobile: Todo app 3 màn hình cho người mới",
      hook: "Làm app mobile đầu tiên mà vẫn đủ thực tế để đem đi khoe.",
      concept: "navigation, state cơ bản và lưu dữ liệu local",
      expansion: "thêm filter theo trạng thái task",
      resource: "https://reactnative.dev/docs/getting-started",
      priority: "high",
    },
    {
      title: "Mobile: Form nhập liệu chuẩn UX trên điện thoại",
      hook: "Form mobile tốt giúp tỷ lệ hoàn thành tăng rõ rệt.",
      concept: "keyboard handling, validate realtime, error copy",
      expansion: "thêm auto-focus và submit nhanh",
      resource: "https://developer.android.com/guide/topics/ui",
      priority: "medium",
    },
    {
      title: "Mobile: Danh sách card có pull-to-refresh",
      hook: "Tạo trải nghiệm app mượt hơn với pull-to-refresh đúng chuẩn.",
      concept: "list rendering, loading state và empty state",
      expansion: "thêm skeleton loading",
      resource: "https://reactnative.dev/docs/refreshcontrol",
      priority: "medium",
    },
    {
      title: "Mobile: Quản lý trạng thái màn hình đơn giản",
      hook: "State không rõ ràng là nguyên nhân lớn nhất làm app mobile khó mở rộng.",
      concept: "state theo module và luồng dữ liệu một chiều",
      expansion: "thêm kiểm soát side effect cơ bản",
      resource: "https://redux.js.org/introduction/getting-started",
      priority: "low",
    },
  ],
  system_design: [
    {
      title: "System Design: Thiết kế feed cơ bản cho ứng dụng nhỏ",
      hook: "Hiểu hệ thống feed từ bản đơn giản để lên kiến trúc đúng ngay từ đầu.",
      concept: "đọc/ghi dữ liệu, phân trang và cache cơ bản",
      expansion: "thêm ranking tối thiểu theo thời gian",
      resource: "https://www.educative.io/courses/grokking-the-system-design-interview",
      priority: "high",
    },
    {
      title: "System Design: Cache strategy cho website tăng traffic",
      hook: "Không cần hệ thống lớn vẫn có thể áp dụng tư duy cache thực chiến.",
      concept: "cache aside, TTL và invalidation",
      expansion: "thêm theo dõi cache hit/miss",
      resource: "https://redis.io/glossary/cache/",
      priority: "medium",
    },
    {
      title: "System Design: Queue xử lý tác vụ nền",
      hook: "Request nào cũng xử lý đồng bộ thì app sẽ chậm và dễ lỗi.",
      concept: "queue, worker, retry và dead-letter",
      expansion: "thêm giám sát worker đơn giản",
      resource: "https://aws.amazon.com/what-is/message-queue/",
      priority: "medium",
    },
    {
      title: "System Design: Logging và observability nhập môn",
      hook: "Không có logging chuẩn thì debug production sẽ rất tốn thời gian.",
      concept: "structured log, correlation id và metric chính",
      expansion: "thêm alert theo ngưỡng lỗi",
      resource: "https://opentelemetry.io/docs/",
      priority: "low",
    },
  ],
};

function normalizeText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeTrack(value = "", fallback = "python") {
  const raw = normalizeText(value).toLowerCase().replace(/\s+/g, "_");
  const mapped = TRACK_ALIASES[raw] || raw;
  if (SUPPORTED_TRACKS.has(mapped)) return mapped;
  return SUPPORTED_TRACKS.has(fallback) ? fallback : "python";
}

function normalizePriority(value = "") {
  const raw = normalizeText(value, "medium").toLowerCase();
  return ["low", "medium", "high"].includes(raw) ? raw : "medium";
}

function normalizeVideoType(value = "") {
  const raw = normalizeText(value).toLowerCase();
  if (raw === "short_30s") return "short_30s";
  if (raw === "long_5_10") return "long_5_10";
  return "long_5_10";
}

function normalizeDate(value = "") {
  const text = normalizeText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function toIdeaKey(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function hashSeed(value = "") {
  const text = String(value || "");
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

function rotateBySeed(list = [], seedText = "") {
  if (!Array.isArray(list) || !list.length) return [];
  const shift = hashSeed(seedText || String(Date.now())) % list.length;
  if (!shift) return list.slice();
  return [...list.slice(shift), ...list.slice(0, shift)];
}

function toMultilineText(value, fallback = "") {
  if (Array.isArray(value)) {
    const text = value.map((item) => normalizeText(item)).filter(Boolean).join("\n");
    return text || fallback;
  }
  return normalizeText(value, fallback);
}

function normalizeOption(option = {}, fallback = {}) {
  const merged = { ...fallback, ...option };
  const title = normalizeText(merged.title);
  const hook = toMultilineText(merged.hook);
  const outline = toMultilineText(merged.outline);
  const shotList = toMultilineText(merged.shotList);
  const cta = toMultilineText(merged.cta);
  const note = toMultilineText(merged.note);
  if (!title || !hook || !outline || !shotList || !cta || !note) return null;

  return {
    title,
    priority: normalizePriority(merged.priority),
    hook,
    outline,
    shotList,
    cta,
    note,
    assetLinks: normalizeText(merged.assetLinks),
    videoType: normalizeVideoType(merged.videoType),
    deadlineSuggestion: normalizeDate(merged.deadlineSuggestion),
    reason: normalizeText(merged.reason),
  };
}

function buildBlockedTitleSet(payload = {}) {
  const usedTitles = Array.isArray(payload?.context?.usedTitles) ? payload.context.usedTitles : [];
  const recentIdeas = Array.isArray(payload?.context?.recentIdeas) ? payload.context.recentIdeas : [];
  const inputTitle = normalizeText(payload?.input?.title);
  const values = [...usedTitles, ...recentIdeas, inputTitle].filter(Boolean);
  return new Set(values.map((title) => toIdeaKey(title)).filter(Boolean));
}

function isBlockedTitle(title = "", blocked = new Set()) {
  const key = toIdeaKey(title);
  if (!key || !blocked?.size) return false;
  if (blocked.has(key)) return true;
  for (const existing of blocked) {
    if (!existing) continue;
    if (existing.length >= 10 && (key.includes(existing) || existing.includes(key))) return true;
  }
  return false;
}

function buildFallbackOption(seed = {}, index = 0, track = "python") {
  const type = index % 2 === 0 ? "long_5_10" : "short_30s";
  const typeText = type === "short_30s" ? "video ngắn 30 giây" : "video dài 5-10 phút";
  const label = TRACK_LABELS[track] || "lập trình";

  return {
    title: normalizeText(seed.title, `${label}: Mini project cho người mới`),
    priority: normalizePriority(seed.priority || "medium"),
    hook: normalizeText(
      seed.hook,
      `Đây là ý tưởng ${label} giúp người mới có kết quả rõ ràng ngay trong video đầu tiên.`
    ),
    outline: [
      "1) Mở bài 5-8 giây: nêu vấn đề thực tế người mới hay gặp.",
      `2) Chốt mục tiêu video: ${normalizeText(seed.concept, "hoàn thành một mini project có thể chạy được")}.`,
      "3) Triển khai từng bước ngắn, luôn giải thích vì sao làm như vậy.",
      "4) Demo kết quả + nêu 1 lỗi thường gặp và cách sửa nhanh.",
      `5) Bài tập mở rộng: ${normalizeText(seed.expansion, "thêm 1 tính năng nhỏ để người xem tự luyện")}.`,
    ].join("\n"),
    shotList: [
      "- Cảnh 1: Hook facecam, nói rõ lợi ích người xem sẽ nhận được.",
      "- Cảnh 2: Hiển thị kết quả cuối cùng trước để giữ người xem.",
      "- Cảnh 3: Quay màn hình code bước 1-2 ngắn gọn.",
      "- Cảnh 4: Nhấn mạnh lỗi phổ biến và cách xử lý nhanh.",
      "- Cảnh 5: Chốt kết quả trước/sau khi áp dụng.",
      "- Cảnh 6: CTA mời người xem làm lại và bình luận kết quả.",
    ].join("\n"),
    cta: "Bình luận \"mình làm được\" để mình gửi checklist tự luyện theo video này.",
    note: `Giọng creator: rõ, thực chiến, không lý thuyết dài. Ưu tiên ${typeText} và dạy theo nhịp người mới.`,
    assetLinks: normalizeText(seed.resource),
    videoType: type,
    deadlineSuggestion: "",
    reason: normalizeText(
      seed.reason,
      `Ý tưởng bám sát hướng ${label}, dễ sản xuất, dễ hiểu cho học sinh và người mới.`
    ),
  };
}

function buildFallbackOptions(track = "python", payload = {}, maxItems = 3) {
  const safeTrack = normalizeTrack(track);
  const seeds = TRACK_FALLBACK_SEEDS[safeTrack] || TRACK_FALLBACK_SEEDS.python;
  const blocked = buildBlockedTitleSet(payload);
  const rotated = rotateBySeed(seeds, normalizeText(payload?.nonce) || normalizeText(payload?.input?.title));
  const out = [];

  for (let i = 0; i < rotated.length && out.length < maxItems; i += 1) {
    const option = buildFallbackOption(rotated[i], i, safeTrack);
    if (!option) continue;
    if (isBlockedTitle(option.title, blocked)) continue;
    if (out.some((item) => toIdeaKey(item.title) === toIdeaKey(option.title))) continue;
    out.push(option);
  }

  for (let i = 0; i < rotated.length && out.length < maxItems; i += 1) {
    const option = buildFallbackOption(rotated[i], i + 7, safeTrack);
    if (!option) continue;
    if (out.some((item) => toIdeaKey(item.title) === toIdeaKey(option.title))) continue;
    out.push(option);
  }

  return out.slice(0, maxItems);
}

function normalizeOptions(rawOptions, fallbackOptions = [], payload = {}) {
  const blocked = buildBlockedTitleSet(payload);
  const list = Array.isArray(rawOptions) ? rawOptions : [];
  const out = [];

  for (let i = 0; i < list.length; i += 1) {
    const normalized = normalizeOption(list[i], fallbackOptions[i] || fallbackOptions[0] || {});
    if (!normalized) continue;
    if (isBlockedTitle(normalized.title, blocked)) continue;
    if (out.some((item) => toIdeaKey(item.title) === toIdeaKey(normalized.title))) continue;
    out.push(normalized);
    if (out.length >= 3) break;
  }

  for (const fallback of fallbackOptions) {
    if (out.length >= 3) break;
    const normalized = normalizeOption(fallback, fallback);
    if (!normalized) continue;
    if (out.some((item) => toIdeaKey(item.title) === toIdeaKey(normalized.title))) continue;
    out.push(normalized);
  }

  return out.slice(0, 3);
}

export async function getVideoCopilotSuggestions(payload = {}, options = {}) {
  const timeoutMs = Math.max(1000, Number(options?.timeoutMs || VIDEO_COPILOT_TIMEOUT_MS));
  const safeTrack = normalizeTrack(payload?.language || "python");
  const safePayload = {
    ...payload,
    language: safeTrack,
    mode: normalizeText(payload?.mode, "generate"),
    input: payload?.input && typeof payload.input === "object" ? payload.input : {},
    context: payload?.context && typeof payload.context === "object" ? payload.context : {},
    nonce: normalizeText(payload?.nonce),
  };

  const fallbackOptions = buildFallbackOptions(safeTrack, safePayload, 3);

  try {
    const data = await callNetlifyFunction("ai-video-copilot", safePayload, { timeoutMs });
    const optionsNormalized = normalizeOptions(data?.options, fallbackOptions, safePayload);

    if (!optionsNormalized.length) {
      return {
        options: fallbackOptions,
        model: normalizeText(data?.model, DEFAULT_MODEL),
        promptVersion: normalizeText(data?.promptVersion, DEFAULT_PROMPT_VERSION),
        language: normalizeTrack(data?.language || safeTrack, safeTrack),
        fallback: true,
      };
    }

    return {
      options: optionsNormalized,
      model: normalizeText(data?.model, DEFAULT_MODEL),
      promptVersion: normalizeText(data?.promptVersion, DEFAULT_PROMPT_VERSION),
      language: normalizeTrack(data?.language || safeTrack, safeTrack),
      fallback: Boolean(data?.fallback),
    };
  } catch (err) {
    return {
      options: fallbackOptions,
      model: DEFAULT_MODEL,
      promptVersion: DEFAULT_PROMPT_VERSION,
      language: safeTrack,
      fallback: true,
      error: normalizeText(err?.message, "Không thể gọi AI lúc này."),
    };
  }
}
