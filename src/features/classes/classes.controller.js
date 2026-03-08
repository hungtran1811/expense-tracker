import {
  addClassStudent,
  updateClass,
  updateClassStudent,
  createClassWithAutoSessions,
  listClassesOverview,
  loadClassBundle,
  rescheduleSessionChainByWeek,
  saveSessionAttendanceAndReviews,
  addSessionPoints,
  appendSessionGameHistory,
  resetSessionPoints,
  resolveSessionPointsLegacy,
  toggleSessionHighlight,
  toggleSessionUsed,
  resetSessionUsed,
  resetSessionHighlights,
  deleteClassCascadeHard,
} from "../../services/firebase/firestore.js";

export const CLASS_TOTAL_SESSIONS = 14;
export const CLASS_DURATION_MIN = 120;
export const CLASSES_MODE = Object.freeze({
  ADMIN: "admin",
  PRESENTATION: "presentation",
});
export const CLASSES_ADMIN_TAB = Object.freeze({
  OVERVIEW: "overview",
  SESSIONS: "sessions",
  STUDENTS: "students",
  CREATE: "create",
});
export const CLASSES_SESSION_FILTER = Object.freeze({
  UPCOMING: "upcoming",
  PAST: "past",
  ALL: "all",
});

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === "function") {
    const dt = value.toDate();
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  if (typeof value?.seconds === "number") {
    const dt = new Date(Number(value.seconds) * 1000);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function toMs(value) {
  const dt = toDate(value);
  return dt ? dt.getTime() : 0;
}

function toDateKey(value) {
  const dt = toDate(value);
  if (!dt) return "";
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
    dt.getDate()
  ).padStart(2, "0")}`;
}

function toTimeText(value, fallback = "08:00") {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (!Number.isInteger(hh) || !Number.isInteger(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return fallback;
  }
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function addMinutesToTimeText(timeText = "08:00", minutes = CLASS_DURATION_MIN) {
  const normalized = toTimeText(timeText, "08:00");
  const [hh, mm] = normalized.split(":").map(Number);
  const total = hh * 60 + mm + Number(minutes || CLASS_DURATION_MIN);
  const safe = ((total % 1440) + 1440) % 1440;
  const outH = Math.floor(safe / 60);
  const outM = safe % 60;
  return `${String(outH).padStart(2, "0")}:${String(outM).padStart(2, "0")}`;
}

function weekdayFromDate(value) {
  const dt = toDate(value);
  if (!dt) return 1;
  const day = dt.getDay();
  return day === 0 ? 7 : day;
}

function normalizeMode(value = "") {
  return String(value || "").trim() === CLASSES_MODE.PRESENTATION
    ? CLASSES_MODE.PRESENTATION
    : CLASSES_MODE.ADMIN;
}

function normalizeAdminTab(value = "") {
  const tab = String(value || "").trim();
  if (tab === CLASSES_ADMIN_TAB.SESSIONS) return CLASSES_ADMIN_TAB.SESSIONS;
  if (tab === CLASSES_ADMIN_TAB.STUDENTS) return CLASSES_ADMIN_TAB.STUDENTS;
  if (tab === CLASSES_ADMIN_TAB.CREATE) return CLASSES_ADMIN_TAB.CREATE;
  return CLASSES_ADMIN_TAB.OVERVIEW;
}

function normalizeSessionFilter(value = "") {
  const filter = String(value || "").trim();
  if (filter === CLASSES_SESSION_FILTER.PAST) return CLASSES_SESSION_FILTER.PAST;
  if (filter === CLASSES_SESSION_FILTER.ALL) return CLASSES_SESSION_FILTER.ALL;
  return CLASSES_SESSION_FILTER.UPCOMING;
}

function normalizeClassStatus(value = "") {
  return String(value || "").trim() === "completed" ? "completed" : "active";
}

function normalizeStudentStatus(value = "", activeValue = null) {
  const status = String(value || "").trim();
  if (status === "inactive" || activeValue === false) return "inactive";
  return "active";
}

function normalizeAttendanceStatus(value = "") {
  return String(value || "").trim() === "absent" ? "absent" : "present";
}

function normalizeReviewStatus(value = "") {
  const status = String(value || "").trim();
  if (status === "unfocused") return "unfocused";
  if (status === "good") return "good";
  if (status === "excellent") return "excellent";
  if (status === "low_focus") return "unfocused";
  return "normal";
}

function normalizePointsMap(raw = {}) {
  const out = {};
  Object.entries(raw && typeof raw === "object" ? raw : {}).forEach(([studentId, value]) => {
    const sid = String(studentId || "").trim();
    if (!sid) return;
    const num = Number(value || 0);
    if (!Number.isFinite(num) || num <= 0) return;
    out[sid] = Math.trunc(num);
  });
  return out;
}

function normalizeGameHistory(raw = []) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry, index) => {
      const winnerIds = Array.isArray(entry?.winnerIds)
        ? entry.winnerIds.map((item) => String(item || "").trim()).filter(Boolean)
        : [];
      return {
        id: String(entry?.id || `gh_${index + 1}`).trim(),
        type: String(entry?.type || "custom").trim() || "custom",
        title: String(entry?.title || "").trim(),
        winnerIds,
        pointsAwarded: Math.max(0, Math.trunc(Number(entry?.pointsAwarded || 0))),
        createdAt: entry?.createdAt || null,
        meta: entry?.meta && typeof entry.meta === "object" ? entry.meta : {},
      };
    })
    .filter((entry) => entry.id || entry.title || entry.winnerIds.length);
}

function sortClasses(list = []) {
  return [...(Array.isArray(list) ? list : [])].sort((a, b) => {
    const byStatus =
      (String(a?.status || "active") === "completed" ? 1 : 0) -
      (String(b?.status || "active") === "completed" ? 1 : 0);
    if (byStatus !== 0) return byStatus;
    const byUpdated = toMs(b?.updatedAt) - toMs(a?.updatedAt);
    if (byUpdated !== 0) return byUpdated;
    return String(a?.code || "").localeCompare(String(b?.code || ""), "vi");
  });
}

function normalizeClassItem(item = {}) {
  const slots = Array.isArray(item?.slots) ? item.slots : [];
  const slot = slots[0] || {};
  const subject = String(item?.subject || "").trim();
  const level = String(item?.level || "").trim();
  const title = String(item?.title || "").trim() || [subject, level].filter(Boolean).join(" ").trim();
  return {
    ...item,
    id: String(item?.id || "").trim(),
    code: String(item?.code || "").trim(),
    title,
    subject,
    level,
    status: normalizeClassStatus(item?.status),
    startDate: item?.startDate || null,
    weekday: Number(item?.weekday || slot?.weekday || 1),
    startTime: toTimeText(item?.startTime || slot?.startTime || "08:00"),
    totalSessions: Math.max(1, Number(item?.totalSessions || CLASS_TOTAL_SESSIONS)),
    doneSessions: Math.max(0, Number(item?.doneSessions || 0)),
    remainingSessions: Math.max(0, Number(item?.remainingSessions || 0)),
    nextSessionNo: Math.max(0, Number(item?.nextSessionNo || 0)),
    nextScheduledAt: item?.nextScheduledAt || null,
    description: String(item?.description || "").trim(),
  };
}

function normalizeStudentItem(item = {}) {
  return {
    ...item,
    id: String(item?.id || "").trim(),
    name: String(item?.name || "").trim(),
    note: String(item?.note || "").trim(),
    status: normalizeStudentStatus(item?.status, item?.active),
  };
}

function normalizeLegacyReviews(raw = {}) {
  const out = {};
  Object.entries(raw && typeof raw === "object" ? raw : {}).forEach(([studentId, value]) => {
    const sid = String(studentId || "").trim();
    if (!sid) return;
    out[sid] = normalizeReviewStatus(value?.status || value);
  });
  return out;
}

function normalizeSessionItem(item = {}, students = []) {
  const attendanceRaw = item?.attendance && typeof item.attendance === "object" ? item.attendance : {};
  const reviewsRaw = item?.reviews && typeof item.reviews === "object" ? item.reviews : {};
  const legacyReviews = normalizeLegacyReviews(item?.studentReviews || {});
  const lessonPlan = String(item?.lessonPlan || item?.teachingPlan || "").trim();
  const sessionNote = String(item?.sessionNote || item?.teachingResultNote || "").trim();
  const scheduledAt = item?.scheduledAt || null;
  const startTime = toTimeText(item?.startTime || "08:00");
  const endTime = toTimeText(item?.endTime || addMinutesToTimeText(startTime, CLASS_DURATION_MIN));

  const attendance = buildAttendanceDefault(students, attendanceRaw);
  const reviews = {};
  Object.keys(attendance).forEach((studentId) => {
    reviews[studentId] = normalizeReviewStatus(reviewsRaw[studentId] || legacyReviews[studentId] || "normal");
  });

  return {
    ...item,
    id: String(item?.id || "").trim(),
    sessionNo: Math.max(1, Number(item?.sessionNo || 1)),
    status: String(item?.status || "planned").trim() || "planned",
    scheduledAt,
    sessionDate: toDateKey(scheduledAt),
    weekday: Number(item?.weekday || weekdayFromDate(scheduledAt)),
    startTime,
    endTime,
    lessonPlan,
    sessionNote,
    attendance,
    reviews,
    pointsByStudent: normalizePointsMap(resolveSessionPointsLegacy(item)),
    gameHistory: normalizeGameHistory(item?.gameHistory || []),
    highlightStudentIds: Array.isArray(item?.highlightStudentIds) ? item.highlightStudentIds : [],
    usedStudentIds: Array.isArray(item?.usedStudentIds) ? item.usedStudentIds : [],
    rescheduleHistory: Array.isArray(item?.rescheduleHistory) ? item.rescheduleHistory : [],
  };
}

export function generateSessions14({ startDate, weekday = 1, startTime = "08:00" } = {}) {
  const start = toDate(startDate);
  if (!start) return [];
  const targetWeekday = Math.max(1, Math.min(7, Number(weekday || 1)));
  const base = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0);
  let cursor = new Date(base);
  while (weekdayFromDate(cursor) !== targetWeekday) {
    cursor.setDate(cursor.getDate() + 1);
  }

  const out = [];
  const safeStartTime = toTimeText(startTime, "08:00");
  for (let index = 1; index <= CLASS_TOTAL_SESSIONS; index += 1) {
    const day = new Date(cursor);
    day.setDate(cursor.getDate() + (index - 1) * 7);
    const [hh, mm] = safeStartTime.split(":").map(Number);
    day.setHours(hh, mm, 0, 0);
    out.push({
      sessionNo: index,
      scheduledAt: day,
      startTime: safeStartTime,
      endTime: addMinutesToTimeText(safeStartTime, CLASS_DURATION_MIN),
      status: "planned",
    });
  }
  return out;
}

export function partitionSessionsByTime(sessions = [], now = new Date()) {
  const nowMs = toMs(now);
  const all = [...(Array.isArray(sessions) ? sessions : [])].sort(
    (a, b) => Number(a?.sessionNo || 0) - Number(b?.sessionNo || 0)
  );
  const upcoming = [];
  const past = [];

  all.forEach((session) => {
    const scheduledMs = toMs(session?.scheduledAt);
    if (!scheduledMs) return;
    if (scheduledMs >= nowMs) upcoming.push(session);
    else past.push(session);
  });

  return {
    all,
    upcoming,
    past,
    counts: {
      all: all.length,
      upcoming: upcoming.length,
      past: past.length,
    },
  };
}

export function buildAttendanceDefault(students = [], current = {}) {
  const out = {};
  (Array.isArray(students) ? students : []).forEach((student) => {
    const sid = String(student?.id || "").trim();
    if (!sid) return;
    if (normalizeStudentStatus(student?.status, student?.active) !== "active") return;
    out[sid] = normalizeAttendanceStatus(current?.[sid] || "present");
  });
  return out;
}

function mapStudentsById(students = []) {
  const map = new Map();
  (Array.isArray(students) ? students : []).forEach((student) => {
    const sid = String(student?.id || "").trim();
    if (!sid) return;
    map.set(sid, student);
  });
  return map;
}

function buildSessionPointCounter(session = {}, deltaMap = {}) {
  const counter = new Map();

  Object.entries(session?.pointsByStudent && typeof session.pointsByStudent === "object" ? session.pointsByStudent : {}).forEach(
    ([studentId, value]) => {
      const sid = String(studentId || "").trim();
      if (!sid) return;
      const num = Math.max(0, Math.trunc(Number(value || 0)));
      if (!num) return;
      counter.set(sid, num);
    }
  );

  Object.entries(deltaMap && typeof deltaMap === "object" ? deltaMap : {}).forEach(([studentId, value]) => {
    const sid = String(studentId || "").trim();
    if (!sid) return;
    const delta = Math.trunc(Number(value || 0));
    if (!Number.isFinite(delta) || !delta) return;
    const next = Math.max(0, Number(counter.get(sid) || 0) + delta);
    if (!next) {
      counter.delete(sid);
      return;
    }
    counter.set(sid, next);
  });

  return counter;
}

export function buildSessionLeaderboard(session = {}, students = [], deltaMap = {}) {
  const studentMap = mapStudentsById(students);
  return Array.from(buildSessionPointCounter(session, deltaMap).entries())
    .map(([studentId, count]) => ({
      studentId,
      name: String(studentMap.get(studentId)?.name || "").trim() || "(Khong ro)",
      count: Number(count || 0),
    }))
    .sort((a, b) => Number(b.count || 0) - Number(a.count || 0));
}

export function buildClassLeaderboard(sessions = [], students = [], pointsDeltaBySession = {}) {
  const studentMap = mapStudentsById(students);
  const counter = new Map();

  (Array.isArray(sessions) ? sessions : []).forEach((session) => {
    const sessionId = String(session?.id || "").trim();
    const deltaMap = sessionId ? pointsDeltaBySession?.[sessionId] || {} : {};
    buildSessionPointCounter(session, deltaMap).forEach((value, studentId) => {
      counter.set(studentId, Number(counter.get(studentId) || 0) + Math.max(0, Number(value || 0)));
    });
  });

  return Array.from(counter.entries())
    .map(([studentId, count]) => ({
      studentId,
      name: String(studentMap.get(studentId)?.name || "").trim() || "(Khong ro)",
      count: Number(count || 0),
    }))
    .sort((a, b) => Number(b.count || 0) - Number(a.count || 0));
}

export function pickRandomStudentNoImmediateRepeat(candidates = [], lastStudentId = "") {
  const list = Array.isArray(candidates) ? candidates.filter(Boolean) : [];
  if (!list.length) return null;
  const lastId = String(lastStudentId || "").trim();

  let pool = list;
  if (list.length > 1 && lastId) {
    const filtered = list.filter((item) => String(item?.studentId || item?.id || "").trim() !== lastId);
    if (filtered.length) pool = filtered;
  }

  const index = Math.floor(Math.random() * pool.length);
  return pool[index] || null;
}

function pickSelectedClass(classes = [], selectedClassId = "") {
  const id = String(selectedClassId || "").trim();
  const list = Array.isArray(classes) ? classes : [];
  if (!list.length) return null;
  if (id) {
    const matched = list.find((item) => String(item?.id || "") === id);
    if (matched) return matched;
  }
  const active = list.find((item) => String(item?.status || "active") !== "completed");
  return active || list[0];
}

function pickSelectedSession(sessions = [], selectedSessionId = "", preferredFilter = "upcoming") {
  const all = Array.isArray(sessions) ? sessions : [];
  const sid = String(selectedSessionId || "").trim();
  if (!all.length) return null;
  if (sid) {
    const matched = all.find((item) => String(item?.id || "") === sid);
    if (matched) return matched;
  }

  const partition = partitionSessionsByTime(all, new Date());
  if (preferredFilter === CLASSES_SESSION_FILTER.PAST && partition.past.length) {
    return partition.past[partition.past.length - 1];
  }
  if (partition.upcoming.length) return partition.upcoming[0];
  if (partition.past.length) return partition.past[partition.past.length - 1];
  return all[0];
}

function pickPresentationSession(sessions = [], selectedSessionId = "", now = new Date()) {
  const all = Array.isArray(sessions) ? sessions : [];
  if (!all.length) return null;
  const sid = String(selectedSessionId || "").trim();
  if (sid) {
    const matched = all.find((item) => String(item?.id || "").trim() === sid);
    if (matched) return matched;
  }

  const todayKey = toDateKey(now);
  const todaySession = all.find((item) => toDateKey(item?.scheduledAt) === todayKey);
  if (todaySession) return todaySession;

  const partition = partitionSessionsByTime(all, now);
  if (partition.upcoming.length) return partition.upcoming[0];
  if (partition.past.length) return partition.past[partition.past.length - 1];
  return all[0];
}

function normalizeSyncState(syncState = {}) {
  const pendingOps = Math.max(0, Number(syncState?.pendingOps || 0));
  return {
    pendingOps,
    lastSyncedAt: syncState?.lastSyncedAt || null,
    hasError: !!syncState?.hasError,
    isSyncing: !!syncState?.isSyncing,
  };
}

function toSessionOption(session = {}) {
  const sessionId = String(session?.id || "").trim();
  const dateLabel = toDateKey(session?.scheduledAt) || "--/--/----";
  const status = String(session?.status || "planned").trim() || "planned";
  return {
    id: sessionId,
    sessionNo: Number(session?.sessionNo || 0),
    label: `Buoi ${Number(session?.sessionNo || 0)} - ${dateLabel}`,
    status,
  };
}

export function buildClassesPageVM({
  classes = [],
  mode = CLASSES_MODE.ADMIN,
  adminTab = CLASSES_ADMIN_TAB.OVERVIEW,
  sessionFilter = CLASSES_SESSION_FILTER.UPCOMING,
  selectedClassId = "",
  presentationClassId = "",
  presentationSelectedSessionId = "",
  students = [],
  sessions = [],
  selectedSessionId = "",
  pointsDeltaBySession = {},
  syncState = {},
  gameState = {},
} = {}) {
  const normalizedMode = normalizeMode(mode);
  const normalizedAdminTab = normalizeAdminTab(adminTab);
  const normalizedFilter = normalizeSessionFilter(sessionFilter);

  const classList = sortClasses((Array.isArray(classes) ? classes : []).map(normalizeClassItem));
  const classesActive = classList.filter((item) => item.status !== "completed");
  const classesCompleted = classList.filter((item) => item.status === "completed");
  const selectedClass = pickSelectedClass(classList, selectedClassId);

  const normalizedStudents = (Array.isArray(students) ? students : []).map(normalizeStudentItem);
  const normalizedSessions = (Array.isArray(sessions) ? sessions : []).map((item) =>
    normalizeSessionItem(item, normalizedStudents)
  );
  const sessionPartition = partitionSessionsByTime(normalizedSessions, new Date());

  const selectedSession = pickSelectedSession(normalizedSessions, selectedSessionId, normalizedFilter);
  const selectedSessionIdSafe = String(selectedSession?.id || "").trim();
  const upcomingSession = sessionPartition.upcoming[0] || null;

  let visibleSessions = sessionPartition.all;
  if (normalizedFilter === CLASSES_SESSION_FILTER.UPCOMING) visibleSessions = sessionPartition.upcoming;
  if (normalizedFilter === CLASSES_SESSION_FILTER.PAST) visibleSessions = sessionPartition.past;

  const presentationClass = pickSelectedClass(classesActive, presentationClassId || selectedClass?.id || "");
  const presentationSession = pickPresentationSession(
    normalizedSessions,
    presentationSelectedSessionId,
    new Date()
  );
  const presentationSessionId = String(presentationSession?.id || "").trim();
  const sessionDelta = presentationSessionId ? pointsDeltaBySession?.[presentationSessionId] || {} : {};
  const sessionPointCounter = buildSessionPointCounter(presentationSession, sessionDelta);

  const presentationAttendance = Object.entries(
    buildAttendanceDefault(normalizedStudents, presentationSession?.attendance || {})
  ).map(([studentId, attendance]) => {
    const student = normalizedStudents.find((item) => String(item?.id || "") === studentId);
    return {
      studentId,
      name: String(student?.name || "").trim() || "(Khong ro)",
      attendance,
      pointCount: Number(sessionPointCounter.get(studentId) || 0),
      used: (presentationSession?.usedStudentIds || []).includes(studentId),
      status: student?.status || "active",
      note: student?.note || "",
    };
  });

  const randomCandidates = presentationAttendance.filter((item) => item.attendance === "present");
  const leaderboardSession = buildSessionLeaderboard(presentationSession, normalizedStudents, sessionDelta);
  const leaderboardClass = buildClassLeaderboard(
    normalizedSessions,
    normalizedStudents,
    pointsDeltaBySession
  );
  const gameHistory = [...(Array.isArray(presentationSession?.gameHistory) ? presentationSession.gameHistory : [])].sort(
    (a, b) => toMs(b?.createdAt) - toMs(a?.createdAt)
  );

  return {
    mode: normalizedMode,
    adminTab: normalizedAdminTab,
    sessionFilter: normalizedFilter,
    classesAll: classList,
    classesActive,
    classesCompleted,
    selectedClass,
    selectedClassId: String(selectedClass?.id || "").trim(),
    students: normalizedStudents,
    sessionsAll: sessionPartition.all,
    sessionsUpcoming: sessionPartition.upcoming,
    sessionsPast: sessionPartition.past,
    sessionCounts: sessionPartition.counts,
    visibleSessions,
    selectedSession,
    selectedSessionId: selectedSessionIdSafe,
    upcomingSession,
    presentation: {
      selectedClass: presentationClass,
      selectedClassId: String(presentationClass?.id || "").trim(),
      selectedSessionId: presentationSessionId,
      session: presentationSession,
      availableSessions: normalizedSessions.map((session) => toSessionOption(session)),
      attendance: presentationAttendance,
      randomCandidates,
      leaderboardSession,
      leaderboardClass,
      pointsSession: leaderboardSession,
      pointsClass: leaderboardClass,
      gameHistory,
      syncState: normalizeSyncState(syncState),
      gameState: gameState && typeof gameState === "object" ? gameState : {},
    },
  };
}

export async function loadClassesOverview(uid) {
  const list = await listClassesOverview(uid);
  return (Array.isArray(list) ? list : []).map(normalizeClassItem);
}

export async function loadClassDetail(uid, classId, options = {}) {
  const bundle = await loadClassBundle(uid, classId, {
    ensureSessions: options?.ensureSessions !== false,
    autoCompletePastSessions: options?.autoCompletePastSessions !== false,
    autoCompleteOptions: options?.autoCompleteOptions || {},
  });

  const students = (Array.isArray(bundle?.students) ? bundle.students : []).map(normalizeStudentItem);
  const sessions = (Array.isArray(bundle?.sessions) ? bundle.sessions : []).map((item) =>
    normalizeSessionItem(item, students)
  );

  return {
    classItem: bundle?.classItem ? normalizeClassItem(bundle.classItem) : null,
    students,
    sessions,
  };
}

export async function createClassFlow(uid, payload = {}) {
  return createClassWithAutoSessions(uid, payload);
}

export async function updateClassFlow(uid, classId, payload = {}) {
  const slots = [{ weekday: Number(payload?.weekday || 1), startTime: toTimeText(payload?.startTime || "08:00") }];
  await updateClass(uid, classId, {
    code: payload?.code,
    title: payload?.title,
    subject: payload?.subject,
    level: payload?.level,
    startDate: payload?.startDate,
    slots,
    weekday: payload?.weekday,
    startTime: payload?.startTime,
    status: payload?.status,
    description: payload?.description,
  });
  return true;
}

export async function deleteClassFlow(uid, classId) {
  return deleteClassCascadeHard(uid, classId);
}

export async function addStudentFlow(uid, classId, payload = {}) {
  return addClassStudent(uid, classId, payload);
}

export async function updateStudentFlow(uid, classId, studentId, payload = {}) {
  return updateClassStudent(uid, classId, studentId, payload);
}

export async function saveSessionFlow(uid, classId, sessionId, payload = {}) {
  return saveSessionAttendanceAndReviews(uid, classId, sessionId, payload);
}

export async function rescheduleSessionFlow(uid, classId, sessionId, reason = "") {
  return rescheduleSessionChainByWeek(uid, classId, sessionId, reason);
}

export async function addSessionPointsFlow(uid, classId, sessionId, pointsPatch = {}, options = {}) {
  return addSessionPoints(uid, classId, sessionId, pointsPatch, options);
}

export async function appendSessionGameHistoryFlow(uid, classId, sessionId, entry = {}) {
  return appendSessionGameHistory(uid, classId, sessionId, entry);
}

export async function resetSessionPointsFlow(uid, classId, sessionId) {
  return resetSessionPoints(uid, classId, sessionId);
}

export async function toggleSessionHighlightFlow(uid, classId, sessionId, studentId) {
  return toggleSessionHighlight(uid, classId, sessionId, studentId);
}

export async function toggleSessionUsedFlow(uid, classId, sessionId, studentId) {
  return toggleSessionUsed(uid, classId, sessionId, studentId);
}

export async function resetSessionUsedFlow(uid, classId, sessionId) {
  return resetSessionUsed(uid, classId, sessionId);
}

export async function resetSessionHighlightsFlow(uid, classId, sessionId) {
  return resetSessionHighlights(uid, classId, sessionId);
}
