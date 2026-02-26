import {
  createClass,
  listClasses,
  readClass,
  updateClass,
  deleteClass,
  addClassStudent,
  updateClassStudent,
  removeClassStudent,
  listClassStudents,
  createClassSessions,
  listClassSessions,
  updateClassSession,
  saveSessionReviews,
  shiftClassSessionNextWeek,
  awardStudentStar,
  redeemStudentStars,
  updateStudentPickPercent,
  bulkUpdateStudentPickPercent,
} from "../../services/firebase/firestore.js";
import { t } from "../../shared/constants/copy.vi.js";

const SESSION_TOTAL = 14;
const DEFAULT_DURATION_MIN = 120;

const WEEKDAY_LABELS = {
  1: "Thứ 2",
  2: "Thứ 3",
  3: "Thứ 4",
  4: "Thứ 5",
  5: "Thứ 6",
  6: "Thứ 7",
  7: "Chủ nhật",
};

const SESSION_PHASE_LABELS = {
  knowledge: "Kiến thức mới",
  project: "Làm dự án",
  jury: "Bảo vệ",
};

const SESSION_STATUS_LABELS = {
  planned: "Kế hoạch",
  done: "Đã dạy",
  cancelled: "Hoãn",
};

const CLASS_STATUS_LABELS = {
  active: "Đang dạy",
  completed: "Hoàn thành",
  archived: "Lưu trữ",
};

const REVIEW_STATUS_LABELS = {
  good: "Tốt",
  normal: "Bình thường",
  low_focus: "Chưa tập trung",
  distracted: "Mất tập trung",
  absent: "Vắng mặt",
};

export const REVIEW_STATUS_OPTIONS = Object.freeze([
  { value: "good", label: REVIEW_STATUS_LABELS.good },
  { value: "normal", label: REVIEW_STATUS_LABELS.normal },
  { value: "low_focus", label: REVIEW_STATUS_LABELS.low_focus },
  { value: "distracted", label: REVIEW_STATUS_LABELS.distracted },
  { value: "absent", label: REVIEW_STATUS_LABELS.absent },
]);

export const SESSION_STATUS_OPTIONS = Object.freeze([
  { value: "planned", label: SESSION_STATUS_LABELS.planned },
  { value: "done", label: SESSION_STATUS_LABELS.done },
  { value: "cancelled", label: SESSION_STATUS_LABELS.cancelled },
]);

function asDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value);
  if (value?.seconds) {
    const d = new Date(Number(value.seconds) * 1000);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toDateLabel(value) {
  const d = asDate(value);
  if (!d) return "--";
  return d.toLocaleDateString("vi-VN");
}

function toDateTimeLabel(value, fallbackTime = "") {
  const d = asDate(value);
  if (!d) return fallbackTime || "--";
  const date = d.toLocaleDateString("vi-VN");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${date} ${hh}:${mm}`;
}

function cleanText(value = "") {
  return String(value || "").trim();
}

function cleanVietnamese(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

function parseWeekdayToken(token = "") {
  const raw = cleanVietnamese(token).replace(/^thu\s*/g, "").replace(/^ngay\s*/g, "");
  if (/^(cn|chu\s*nhat|chunhat|sunday|sun)$/i.test(raw)) return 7;
  const num = Number(raw.match(/[1-7]/)?.[0] || 0);
  if (Number.isInteger(num) && num >= 1 && num <= 7) return num;
  return 0;
}

function normalizeStartTime(raw = "") {
  const match = String(raw || "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "";
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (!Number.isInteger(hh) || !Number.isInteger(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return "";
  }
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function normalizePickPercent(value = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, num));
}

function normalizeClassesMode(mode = "") {
  return String(mode || "").trim() === "presentation" ? "presentation" : "admin";
}

function normalizeListTab(value = "") {
  return String(value || "").trim() === "completed" ? "completed" : "active";
}

export function parseClassSlotsInput(text = "") {
  const rows = String(text || "")
    .split(/[\n;,]+/g)
    .map((line) => line.trim())
    .filter(Boolean);

  const map = new Map();
  rows.forEach((line) => {
    const normalized = line.replace(/\s+/g, " ").trim();
    const m = normalized.match(/(chủ\s*nhật|chu\s*nhat|cn|[1-7]|thứ\s*[2-7]|thu\s*[2-7])\D+(\d{1,2}:\d{2})/i);
    if (!m) return;
    const weekday = parseWeekdayToken(m[1]);
    const startTime = normalizeStartTime(m[2]);
    if (!weekday || !startTime) return;
    map.set(`${weekday}_${startTime}`, { weekday, startTime });
  });

  return Array.from(map.values()).sort((a, b) => {
    if (a.weekday !== b.weekday) return a.weekday - b.weekday;
    return String(a.startTime).localeCompare(String(b.startTime));
  });
}

export function formatClassSlots(slots = []) {
  const safe = Array.isArray(slots) ? slots : [];
  if (!safe.length) return t("classes.emptySlots", "Chưa có lịch cố định");
  return safe
    .map((slot) => {
      const weekday = Number(slot?.weekday || 0);
      const label = WEEKDAY_LABELS[weekday] || `Thứ ${weekday}`;
      const start = normalizeStartTime(slot?.startTime || "");
      return `${label} ${start || "--:--"}`;
    })
    .join(", ");
}

function normalizeClassItem(item = {}) {
  const totalSessions = Math.max(1, Number(item?.totalSessions || SESSION_TOTAL));
  const doneSessions = Math.max(0, Number(item?.doneSessions || 0));
  const remainingSessions =
    item?.remainingSessions != null
      ? Math.max(0, Number(item.remainingSessions || 0))
      : Math.max(0, totalSessions - doneSessions);
  const nextSessionNo = Math.max(0, Number(item?.nextSessionNo || 0));
  const status = String(item?.status || "active");

  return {
    ...item,
    totalSessions,
    doneSessions,
    remainingSessions,
    nextSessionNo,
    durationMin: Math.max(30, Number(item?.durationMin || DEFAULT_DURATION_MIN)),
    status,
    startDateText: toDateLabel(item?.startDate),
    slotText: formatClassSlots(item?.slots || []),
    statusLabel: CLASS_STATUS_LABELS[status] || CLASS_STATUS_LABELS.active,
  };
}

function normalizeSessionItem(item = {}) {
  const sessionNo = Math.max(1, Number(item?.sessionNo || 1));
  const status = String(item?.status || "planned");
  const phase = String(item?.phase || "knowledge");
  const weekday = Number(item?.weekday || 1);
  const startTime = normalizeStartTime(item?.startTime || "");
  const endTime = normalizeStartTime(item?.endTime || "");
  const reviewMap = item?.studentReviews && typeof item.studentReviews === "object" ? item.studentReviews : {};
  const rescheduledFromDate = asDate(item?.rescheduledFrom);

  return {
    ...item,
    sessionNo,
    status,
    phase,
    weekday,
    startTime,
    endTime,
    studentReviews: reviewMap,
    phaseLabel: SESSION_PHASE_LABELS[phase] || SESSION_PHASE_LABELS.knowledge,
    statusLabel: SESSION_STATUS_LABELS[status] || SESSION_STATUS_LABELS.planned,
    weekdayLabel: WEEKDAY_LABELS[weekday] || `Thứ ${weekday}`,
    scheduleLabel: toDateTimeLabel(item?.scheduledAt, startTime),
    isRescheduled: !!rescheduledFromDate,
    rescheduledFromLabel: rescheduledFromDate ? toDateLabel(rescheduledFromDate) : "",
  };
}

function mapStudentItem(item = {}) {
  return {
    ...item,
    name: cleanText(item?.name),
    active: !!item?.active,
    joinedFromSessionNo: Math.max(1, Number(item?.joinedFromSessionNo || 1)),
    leftFromSessionNo: Number(item?.leftFromSessionNo || 0) || null,
    starsBalance: Math.max(0, Math.floor(Number(item?.starsBalance || 0))),
    pointsTotal: Math.max(0, Math.floor(Number(item?.pointsTotal || 0))),
    pickPercent: normalizePickPercent(item?.pickPercent || 0),
  };
}

function isStudentAppliedForSession(student = {}, sessionNo = 1) {
  const joinedFrom = Math.max(1, Number(student?.joinedFromSessionNo || 1));
  const leftFrom = Number(student?.leftFromSessionNo || 0);
  if (sessionNo < joinedFrom) return false;
  if (leftFrom > 0 && sessionNo >= leftFrom) return false;
  return true;
}

function pickSelectedSessionId(sessions = [], selectedSessionId = "") {
  const selected = String(selectedSessionId || "").trim();
  if (selected && sessions.some((item) => String(item?.id || "") === selected)) return selected;
  const nextPlanned = sessions.find((item) => String(item?.status || "planned") === "planned");
  if (nextPlanned?.id) return nextPlanned.id;
  return sessions[0]?.id || "";
}

function pickRecentSession(sessions = []) {
  const done = sessions
    .filter((item) => String(item?.status || "") === "done")
    .sort((a, b) => Number(b?.sessionNo || 0) - Number(a?.sessionNo || 0));
  return done[0] || null;
}

function pickUpcomingSession(sessions = []) {
  return sessions.find((item) => String(item?.status || "planned") === "planned") || null;
}

function filterClassesByTab(classes = [], listTab = "active") {
  const safeTab = normalizeListTab(listTab);
  if (safeTab === "completed") {
    return classes.filter((item) => String(item?.status || "") === "completed");
  }
  return classes.filter((item) => String(item?.status || "active") === "active");
}

function sortStudentsForLeaderboard(students = []) {
  return [...students].sort((a, b) => {
    const byPoints = Number(b?.pointsTotal || 0) - Number(a?.pointsTotal || 0);
    if (byPoints !== 0) return byPoints;
    const byStars = Number(b?.starsBalance || 0) - Number(a?.starsBalance || 0);
    if (byStars !== 0) return byStars;
    return String(a?.name || "").localeCompare(String(b?.name || ""), "vi");
  });
}

function buildPresentationVM({
  mode,
  classes,
  selectedClass,
  students,
  randomResult,
  randomHistory,
}) {
  const presentationClasses = filterClassesByTab(classes, "active");
  const tabs = presentationClasses.map((item) => ({
    id: String(item?.id || "").trim(),
    code: cleanText(item?.code),
    title: cleanText(item?.title),
    remainingSessions: Number(item?.remainingSessions || 0),
  }));

  const activeStudents = (Array.isArray(students) ? students : [])
    .filter((student) => !!student?.active)
    .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), "vi"));
  const leaderboard = sortStudentsForLeaderboard(activeStudents);
  const totalPickPercent = activeStudents.reduce(
    (sum, student) => sum + normalizePickPercent(student?.pickPercent || 0),
    0
  );
  const percentNormalized = totalPickPercent > 0 && Math.abs(totalPickPercent - 100) > 0.001;

  return {
    mode,
    tabs,
    selectedClass,
    leaderboard,
    students: activeStudents,
    totalPickPercent,
    percentNormalized,
    randomResult: randomResult || null,
    randomHistory: Array.isArray(randomHistory) ? randomHistory.slice(0, 5) : [],
    canRandom: activeStudents.length > 0,
  };
}

export function buildClassesPageVM(input = {}) {
  const normalizedClasses = (Array.isArray(input?.classes) ? input.classes : []).map((item) =>
    normalizeClassItem(item)
  );
  const mode = normalizeClassesMode(input?.mode);
  const listTab = normalizeListTab(input?.listTab);
  const classCounts = {
    active: normalizedClasses.filter((item) => String(item?.status || "active") === "active").length,
    completed: normalizedClasses.filter((item) => String(item?.status || "") === "completed").length,
  };

  const adminClasses = filterClassesByTab(normalizedClasses, listTab);
  const presentationClasses = filterClassesByTab(normalizedClasses, "active");
  const scopedClasses = mode === "presentation" ? presentationClasses : adminClasses;

  const selectedClassIdInput =
    mode === "presentation"
      ? String(input?.presentationClassId || input?.selectedClassId || "").trim()
      : String(input?.selectedClassId || "").trim();
  const selectedClass =
    scopedClasses.find((item) => String(item?.id || "") === selectedClassIdInput) || scopedClasses[0] || null;

  const students = (Array.isArray(input?.students) ? input.students : []).map((item) => mapStudentItem(item));
  const sessions = (Array.isArray(input?.sessions) ? input.sessions : [])
    .map((item) => normalizeSessionItem(item))
    .sort((a, b) => Number(a?.sessionNo || 0) - Number(b?.sessionNo || 0));

  const selectedSessionId = pickSelectedSessionId(sessions, input?.selectedSessionId);
  const selectedSession = sessions.find((item) => String(item?.id || "") === selectedSessionId) || null;
  const sessionNo = Number(selectedSession?.sessionNo || 1);

  const reviewRows = students
    .map((student) => {
      const review = selectedSession?.studentReviews?.[student.id] || {};
      const applicable = isStudentAppliedForSession(student, sessionNo);
      return {
        id: student.id,
        name: student.name || "(Chưa có tên)",
        active: student.active,
        starsBalance: student.starsBalance,
        pointsTotal: student.pointsTotal,
        pickPercent: student.pickPercent,
        applicable,
        reviewStatus: applicable ? String(review?.status || "normal") : "absent",
        reviewNote: applicable ? String(review?.note || "") : "",
        joinLeaveLabel: student.leftFromSessionNo
          ? `Từ buổi ${student.joinedFromSessionNo} - trước buổi ${student.leftFromSessionNo}`
          : `Từ buổi ${student.joinedFromSessionNo}`,
      };
    })
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "vi"));

  const upcomingSession = pickUpcomingSession(sessions);
  const recentSession = pickRecentSession(sessions);
  const isCompletedClass = String(selectedClass?.status || "") === "completed";
  const canReopen = isCompletedClass;
  const isReadOnlyAdmin = isCompletedClass || listTab === "completed";

  return {
    mode,
    showAdmin: mode === "admin",
    showPresentation: mode === "presentation",
    listTab,
    classCounts,
    classes: adminClasses,
    selectedClass,
    selectedSession,
    selectedSessionId,
    students,
    sessions,
    reviewRows,
    reviewStatusOptions: REVIEW_STATUS_OPTIONS,
    sessionStatusOptions: SESSION_STATUS_OPTIONS,
    detail: {
      upcomingSession,
      recentSession,
      doneSessions: Number(selectedClass?.doneSessions || 0),
      remainingSessions: Number(selectedClass?.remainingSessions || 0),
      totalSessions: Number(selectedClass?.totalSessions || SESSION_TOTAL),
      startDateText: selectedClass?.startDateText || "--",
      slotText: selectedClass?.slotText || t("classes.emptySlots", "Chưa có lịch cố định"),
      durationMin: Number(selectedClass?.durationMin || DEFAULT_DURATION_MIN),
      isCompletedClass,
      canReopen,
    },
    isReadOnly: isReadOnlyAdmin,
    presentation: buildPresentationVM({
      mode,
      classes: normalizedClasses,
      selectedClass,
      students,
      randomResult: input?.classRandomResult || null,
      randomHistory: input?.classRandomHistory || [],
    }),
  };
}

export function pickRandomStudentByPercent(students = []) {
  const activeStudents = (Array.isArray(students) ? students : []).filter((student) => !!student?.active);
  if (!activeStudents.length) return null;

  const weighted = activeStudents.map((student) => ({
    ...student,
    weight: normalizePickPercent(student?.pickPercent || 0),
  }));
  const totalWeight = weighted.reduce((sum, student) => sum + student.weight, 0);

  if (totalWeight <= 0) {
    const idx = Math.floor(Math.random() * activeStudents.length);
    return {
      student: activeStudents[idx],
      normalizedByTotal: false,
      totalWeight: 0,
    };
  }

  let seed = Math.random() * totalWeight;
  for (const student of weighted) {
    seed -= student.weight;
    if (seed <= 0) {
      return {
        student,
        normalizedByTotal: Math.abs(totalWeight - 100) > 0.001,
        totalWeight,
      };
    }
  }

  const fallback = weighted[weighted.length - 1];
  return {
    student: fallback,
    normalizedByTotal: Math.abs(totalWeight - 100) > 0.001,
    totalWeight,
  };
}

export function buildUpcomingClassWidgetVM(classes = [], now = new Date()) {
  const nowMs = (now instanceof Date ? now : new Date()).getTime();
  const candidates = (Array.isArray(classes) ? classes : [])
    .map((item) => normalizeClassItem(item))
    .filter((item) => String(item?.status || "active") === "active" && Number(item?.remainingSessions || 0) > 0)
    .map((item) => ({ ...item, nextDate: asDate(item?.nextScheduledAt) }))
    .filter((item) => item.nextDate instanceof Date && !Number.isNaN(item.nextDate.getTime()))
    .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime());

  if (!candidates.length) {
    return {
      hasUpcoming: false,
      title: t("dashboard.classes.title", "Buổi học sắp tới"),
      summary: t("dashboard.classes.empty", "Chưa có buổi học nào sắp tới."),
      detail: "",
      classId: "",
    };
  }

  const next = candidates.find((item) => item.nextDate.getTime() >= nowMs) || candidates[0];
  const sessionNo = Math.max(1, Number(next?.nextSessionNo || 1));
  const totalSessions = Math.max(1, Number(next?.totalSessions || SESSION_TOTAL));
  const remaining = Math.max(0, Number(next?.remainingSessions || totalSessions - Number(next?.doneSessions || 0)));

  return {
    hasUpcoming: true,
    classId: String(next?.id || "").trim(),
    title: `${cleanText(next?.code)} • ${cleanText(next?.title)}`.trim(),
    summary: `${toDateTimeLabel(next?.nextDate)} • Buổi ${sessionNo}/${totalSessions}`,
    detail: `Còn ${remaining} buổi`,
  };
}

export function normalizeClassesModeValue(value = "") {
  return normalizeClassesMode(value);
}

export async function loadClassesOverview(uid, filter = {}) {
  if (!uid) return [];
  const list = await listClasses(uid, filter);
  return (Array.isArray(list) ? list : []).map((item) => normalizeClassItem(item));
}

export async function loadClassDetail(uid, classId, options = {}) {
  const id = cleanText(classId);
  if (!uid || !id) return { classItem: null, students: [], sessions: [] };

  const ensureSessions = options?.ensureSessions !== false;
  let [classItem, students, sessions] = await Promise.all([
    readClass(uid, id),
    listClassStudents(uid, id),
    listClassSessions(uid, id),
  ]);

  if (ensureSessions && classItem && (!Array.isArray(sessions) || sessions.length === 0)) {
    await createClassSessions(uid, id);
    [classItem, sessions] = await Promise.all([readClass(uid, id), listClassSessions(uid, id)]);
  }

  return {
    classItem: classItem ? normalizeClassItem(classItem) : null,
    students: (Array.isArray(students) ? students : []).map((item) => mapStudentItem(item)),
    sessions: (Array.isArray(sessions) ? sessions : []).map((item) => normalizeSessionItem(item)),
  };
}

export async function createClassWithSessions(uid, payload = {}) {
  const created = await createClass(uid, payload);
  await createClassSessions(uid, created.id);
  return readClass(uid, created.id);
}

export async function updateClassInfo(uid, classId, payload = {}) {
  await updateClass(uid, classId, payload);
  return readClass(uid, classId);
}

export async function reopenCompletedClass(uid, classId) {
  await updateClass(uid, classId, { status: "active" });
  return readClass(uid, classId);
}

export async function deleteClassById(uid, classId) {
  return deleteClass(uid, classId);
}

export async function addStudentToClass(uid, classId, payload = {}) {
  return addClassStudent(uid, classId, payload);
}

export async function deactivateStudentFromNextSession(uid, classId, studentId, nextSessionNo = 1) {
  return removeClassStudent(uid, classId, studentId, nextSessionNo);
}

export async function reactivateStudent(uid, classId, studentId, nextSessionNo = 1) {
  return updateClassStudent(uid, classId, studentId, {
    active: true,
    leftFromSessionNo: null,
    joinedFromSessionNo: Math.max(1, Number(nextSessionNo || 1)),
  });
}

export async function saveClassSessionData(uid, classId, sessionId, payload = {}) {
  const safePayload = {
    status: String(payload?.status || "planned"),
    teachingPlan: String(payload?.teachingPlan || ""),
    teachingResultNote: String(payload?.teachingResultNote || ""),
  };

  await updateClassSession(uid, classId, sessionId, safePayload);
  if (payload?.reviews && typeof payload.reviews === "object") {
    await saveSessionReviews(uid, classId, sessionId, payload.reviews);
  }
  return true;
}

export async function shiftSessionToNextWeek(uid, classId, sessionId, reason = "") {
  return shiftClassSessionNextWeek(uid, classId, sessionId, reason);
}

export async function awardStarToStudent(uid, classId, studentId, delta = 1) {
  return awardStudentStar(uid, classId, studentId, delta);
}

export async function redeemStarsForStudent(uid, classId, studentId, ratio = 5) {
  return redeemStudentStars(uid, classId, studentId, { ratio });
}

export async function updateStudentPickPercentValue(uid, classId, studentId, pickPercent = 0) {
  return updateStudentPickPercent(uid, classId, studentId, pickPercent);
}

export async function bulkUpdateStudentPickPercentValue(uid, classId, patchList = []) {
  return bulkUpdateStudentPickPercent(uid, classId, patchList);
}
