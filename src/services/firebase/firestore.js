import {
  getFirestore,
  collection,
  addDoc,
  Timestamp,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  increment,
  limit,
  startAfter,
  writeBatch,
  runTransaction,
} from "firebase/firestore";
import { app } from "./app.js";

const db = getFirestore(app);

export const colExpenses = (uid) => collection(db, `users/${uid}/expenses`);
export const colAccounts = (uid) => collection(db, `users/${uid}/accounts`);
export const colIncomes = (uid) => collection(db, `users/${uid}/incomes`);
export const colTransfers = (uid) => collection(db, `users/${uid}/transfers`);
export const colGoals = (uid) => collection(db, `users/${uid}/goals`);
export const colHabits = (uid) => collection(db, `users/${uid}/habits`);
export const colHabitLogs = (uid) => collection(db, `users/${uid}/habitLogs`);
export const colVideoTasks = (uid) => collection(db, `users/${uid}/videoTasks`);
export const colVideoRetros = (uid) => collection(db, `users/${uid}/videoRetros`);
export const colContentBlueprints = (uid) => collection(db, `users/${uid}/contentBlueprints`);
export const colClasses = (uid) => collection(db, `users/${uid}/classes`);
export const colClassStudents = (uid, classId) =>
  collection(db, `users/${uid}/classes/${classId}/students`);
export const colClassSessions = (uid, classId) =>
  collection(db, `users/${uid}/classes/${classId}/sessions`);
export const colXpLogs = (uid) => collection(db, `users/${uid}/xpLogs`);
export const colWeeklyReviews = (uid) => collection(db, `users/${uid}/weeklyReviews`);
export const colAiSuggestions = (uid) => collection(db, `users/${uid}/aiSuggestions`);
export const docUser = (uid) => doc(db, `users/${uid}`);

const BALANCE_CACHE_TTL_MS = 5 * 60 * 1000;
const _balanceCache = new Map();

function normalizeBalanceKey(value) {
  const text = String(value || "").trim();
  return text || "Other";
}

function toBalanceItemsFromMap(map) {
  return Array.from(map.entries())
    .map(([account, balance]) => ({
      account: normalizeBalanceKey(account),
      balance: Number(balance || 0),
    }))
    .sort((a, b) => String(a.account).localeCompare(String(b.account), "vi"));
}

function toBalanceMap(items = []) {
  const map = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const key = normalizeBalanceKey(item?.account || item?.accountName || item?.name);
    const value = Number(item?.balance || 0);
    map.set(key, Number.isFinite(value) ? value : 0);
  });
  return map;
}

function getCachedBalanceEntry(uid, maxAgeMs = BALANCE_CACHE_TTL_MS) {
  if (!uid) return null;
  const entry = _balanceCache.get(uid);
  if (!entry || !(entry.map instanceof Map)) return null;
  if (Date.now() - Number(entry.updatedAt || 0) > Math.max(1000, Number(maxAgeMs || BALANCE_CACHE_TTL_MS))) {
    return null;
  }
  return entry;
}

function setCachedBalanceItems(uid, items = []) {
  if (!uid) return [];
  const map = toBalanceMap(items);
  _balanceCache.set(uid, {
    map,
    updatedAt: Date.now(),
  });
  return toBalanceItemsFromMap(map);
}

function applyBalanceDeltaCache(uid, deltas = []) {
  if (!uid) return;
  const entry = _balanceCache.get(uid);
  if (!entry || !(entry.map instanceof Map)) return;

  const map = entry.map;
  (Array.isArray(deltas) ? deltas : []).forEach((deltaItem) => {
    const key = normalizeBalanceKey(deltaItem?.account || deltaItem?.name);
    const delta = Number(deltaItem?.delta || 0);
    if (!Number.isFinite(delta) || delta === 0) return;
    map.set(key, (map.get(key) || 0) + delta);
  });

  entry.updatedAt = Date.now();
}

export function invalidateBalanceCache(uid) {
  if (!uid) {
    _balanceCache.clear();
    return;
  }
  _balanceCache.delete(uid);
}

function ymToRange(ym) {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return null;
  const [y, m] = ym.split("-").map(Number);
  const startDate = new Date(y, m - 1, 1);
  const endDate = new Date(y, m, 1);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return null;
  return {
    start: Timestamp.fromDate(startDate),
    end: Timestamp.fromDate(endDate),
  };
}

function toTimestamp(value) {
  if (!value) return null;
  if (value instanceof Timestamp) return value;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return Timestamp.fromDate(value);
  }
  if (typeof value === "string") {
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    return Timestamp.fromDate(d);
  }
  return null;
}

function toTimestampStrict(value, label = "date") {
  const ts = toTimestamp(value);
  if (!ts) throw new Error(`${label} không hợp lệ`);
  return ts;
}

function mapDocs(snapshot) {
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function parseLocalDate(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function normalizeVideoLanguageKey(value = "") {
  const text = String(value || "").trim().toLowerCase();
  return text === "javascript" ? "javascript" : "python";
}

function normalizeVideoTypeKey(value = "") {
  const text = String(value || "").trim().toLowerCase();
  if (text === "long") return "long";
  if (text === "short") return "short";
  return "short";
}

export async function addIncome(uid, payload) {
  const data = {
    name: (payload.name || "").trim(),
    amount: Number(payload.amount || 0),
    date: payload.date
      ? Timestamp.fromDate(new Date(payload.date))
      : Timestamp.now(),
    account: payload.account,
    note: payload.note || "",
    createdAt: Timestamp.now(),
  };

  if (!data.name || !data.account) {
    throw new Error("Thiếu tên hoặc tài khoản");
  }

  const ref = await addDoc(colIncomes(uid), data);
  applyBalanceDeltaCache(uid, [{ account: data.account, delta: Number(data.amount || 0) }]);
  return ref;
}

export async function listIncomesByMonth(uid, ym) {
  const rng = ymToRange(ym);
  if (!rng) throw new Error("Bộ lọc tháng không hợp lệ (YYYY-MM)");

  const qy = query(
    colIncomes(uid),
    where("date", ">=", rng.start),
    where("date", "<", rng.end),
    orderBy("date", "desc")
  );
  const snap = await getDocs(qy);
  return mapDocs(snap);
}

export async function listIncomesByDateRange(uid, fromDate, toDateExclusive) {
  const fromTs = toTimestampStrict(fromDate, "fromDate");
  const toTs = toTimestampStrict(toDateExclusive, "toDateExclusive");

  const qy = query(
    colIncomes(uid),
    where("date", ">=", fromTs),
    where("date", "<", toTs),
    orderBy("date", "desc")
  );
  const snap = await getDocs(qy);
  return mapDocs(snap);
}

export async function getIncome(uid, id) {
  const ref = doc(db, `users/${uid}/incomes/${id}`);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function updateIncome(uid, id, payload) {
  const ref = doc(db, `users/${uid}/incomes/${id}`);
  const prevSnap = await getDoc(ref);
  const prev = prevSnap.exists() ? prevSnap.data() : null;
  const data = {
    name: (payload.name || "").trim(),
    amount: Number(payload.amount || 0),
    account: payload.account,
    note: payload.note || "",
    updatedAt: Timestamp.now(),
  };
  if (payload.date) data.date = Timestamp.fromDate(new Date(payload.date));
  await updateDoc(ref, data);

  const prevAccount = normalizeBalanceKey(prev?.account);
  const prevAmount = Number(prev?.amount || 0);
  const nextAccount = normalizeBalanceKey(data.account || prev?.account);
  const nextAmount = Number(data.amount || 0);

  if (prevAccount === nextAccount) {
    applyBalanceDeltaCache(uid, [{ account: nextAccount, delta: nextAmount - prevAmount }]);
  } else {
    applyBalanceDeltaCache(uid, [
      { account: prevAccount, delta: -prevAmount },
      { account: nextAccount, delta: nextAmount },
    ]);
  }

  return true;
}

export async function deleteIncome(uid, id) {
  const ref = doc(db, `users/${uid}/incomes/${id}`);
  const snap = await getDoc(ref);
  const prev = snap.exists() ? snap.data() : null;

  await deleteDoc(ref);
  if (prev) {
    applyBalanceDeltaCache(uid, [
      { account: prev.account, delta: -Number(prev.amount || 0) },
    ]);
  }
  return true;
}

export async function addTransfer(uid, payload) {
  const data = {
    from: payload.from,
    to: payload.to,
    fromAccountId: payload.fromAccountId || payload.fromId || "",
    toAccountId: payload.toAccountId || payload.toId || "",
    amount: Number(payload.amount || 0),
    date: payload.date
      ? Timestamp.fromDate(new Date(payload.date))
      : Timestamp.now(),
    note: payload.note || "",
    createdAt: Timestamp.now(),
  };

  if (!data.from || !data.to) {
    throw new Error("Vui lòng chọn đầy đủ tài khoản");
  }
  if (data.from === data.to) {
    throw new Error("Tài khoản chuyển và nhận phải khác nhau");
  }
  if (!(data.amount > 0)) {
    throw new Error("Số tiền phải lớn hơn 0");
  }

  const ref = await addDoc(colTransfers(uid), data);
  applyBalanceDeltaCache(uid, [
    { account: data.from, delta: -Number(data.amount || 0) },
    { account: data.to, delta: Number(data.amount || 0) },
  ]);
  return ref;
}

export async function listTransfersByMonth(uid, ym) {
  const rng = ymToRange(ym);
  if (!rng) throw new Error("Bộ lọc tháng không hợp lệ (YYYY-MM)");

  const qy = query(
    colTransfers(uid),
    where("date", ">=", rng.start),
    where("date", "<", rng.end),
    orderBy("date", "desc")
  );

  const snap = await getDocs(qy);
  return mapDocs(snap);
}

export async function listTransfersByDateRange(uid, fromDate, toDateExclusive) {
  const fromTs = toTimestampStrict(fromDate, "fromDate");
  const toTs = toTimestampStrict(toDateExclusive, "toDateExclusive");

  const qy = query(
    colTransfers(uid),
    where("date", ">=", fromTs),
    where("date", "<", toTs),
    orderBy("date", "desc")
  );

  const snap = await getDocs(qy);
  return mapDocs(snap);
}

export async function balancesByAccount(uid, ym) {
  const [incomes, expenses, transfers] = await Promise.all([
    listIncomesByMonth(uid, ym),
    listExpensesByMonth(uid, ym),
    listTransfersByMonth(uid, ym),
  ]);

  const map = new Map();

  incomes.forEach((i) => {
    const key = i.account || "Other";
    map.set(key, (map.get(key) || 0) + Number(i.amount || 0));
  });

  expenses.forEach((e) => {
    const key = e.account || "Other";
    map.set(key, (map.get(key) || 0) - Number(e.amount || 0));
  });

  transfers.forEach((t) => {
    const from = t.from || "Other";
    const to = t.to || "Other";
    const amount = Number(t.amount || 0);
    map.set(from, (map.get(from) || 0) - amount);
    map.set(to, (map.get(to) || 0) + amount);
  });

  return Array.from(map.entries()).map(([account, balance]) => ({
    account,
    balance,
  }));
}

export async function balancesByAccountTotal(uid, options = {}) {
  const forceRefresh = !!options?.forceRefresh;
  const cacheMaxAgeMs = Number(options?.cacheMaxAgeMs || BALANCE_CACHE_TTL_MS);
  if (!forceRefresh) {
    const cached = getCachedBalanceEntry(uid, cacheMaxAgeMs);
    if (cached) {
      return toBalanceItemsFromMap(cached.map);
    }
  }

  const [incomesSnap, expensesSnap, transfersSnap] = await Promise.all([
    getDocs(colIncomes(uid)),
    getDocs(colExpenses(uid)),
    getDocs(colTransfers(uid)),
  ]);

  const map = new Map();

  incomesSnap.forEach((d) => {
    const data = d.data();
    const key = data.account || "Other";
    map.set(key, (map.get(key) || 0) + Number(data.amount || 0));
  });

  expensesSnap.forEach((d) => {
    const data = d.data();
    const key = data.account || "Other";
    map.set(key, (map.get(key) || 0) - Number(data.amount || 0));
  });

  transfersSnap.forEach((d) => {
    const data = d.data();
    const from = data.from || "Other";
    const to = data.to || "Other";
    const amount = Number(data.amount || 0);
    map.set(from, (map.get(from) || 0) - amount);
    map.set(to, (map.get(to) || 0) + amount);
  });

  return setCachedBalanceItems(
    uid,
    Array.from(map.entries()).map(([account, balance]) => ({
      account,
      balance,
    }))
  );
}

export async function saveProfile(uid, data) {
  const displayName = data.displayName || "";
  await setDoc(
    docUser(uid),
    {
      displayName,
      profile: {
        displayName,
      },
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  );
}

export async function readProfile(uid) {
  const snap = await getDoc(docUser(uid));
  return snap.exists() ? snap.data() : null;
}

export async function readUserSettings(uid) {
  if (!uid) return null;

  const snap = await getDoc(docUser(uid));
  if (!snap.exists()) return null;

  const data = snap.data() || {};
  const legacyDisplayName = typeof data.displayName === "string" ? data.displayName : "";
  const profile = data.profile && typeof data.profile === "object" ? data.profile : {};

  if (!profile.displayName && legacyDisplayName) {
    return {
      ...data,
      profile: {
        ...profile,
        displayName: legacyDisplayName,
      },
    };
  }

  return data;
}

export async function saveUserSettings(uid, partialPayload = {}) {
  if (!uid || !partialPayload || typeof partialPayload !== "object") return false;

  const payload = {
    ...partialPayload,
    updatedAt: Timestamp.now(),
  };

  const profileDisplayName = partialPayload?.profile?.displayName;
  if (typeof profileDisplayName === "string" && profileDisplayName.trim()) {
    payload.displayName = profileDisplayName.trim();
  }

  await setDoc(docUser(uid), payload, { merge: true });
  return true;
}

// ================================
// Classes, Students, Sessions
// ================================

const CLASS_TOTAL_SESSIONS = 14;
const CLASS_DEFAULT_DURATION_MIN = 120;
const CLASS_SESSION_STATUSES = new Set(["planned", "done", "cancelled"]);
const CLASS_STATUSES = new Set(["active", "completed", "archived"]);
const CLASS_REVIEW_STATUSES = new Set(["good", "normal", "low_focus", "distracted", "absent"]);

function normalizeClassCode(value = "") {
  return String(value || "").trim();
}

function normalizeClassCodeLower(value = "") {
  return normalizeClassCode(value).toLowerCase();
}

function normalizeTimeText(value = "") {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "";
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (!Number.isInteger(hh) || !Number.isInteger(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return "";
  }
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function normalizeClassSlots(slots = []) {
  const safe = Array.isArray(slots) ? slots : [];
  const map = new Map();

  safe.forEach((item) => {
    const weekday = Number(item?.weekday || 0);
    const startTime = normalizeTimeText(item?.startTime || "");
    if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7 || !startTime) return;
    const key = `${weekday}_${startTime}`;
    if (!map.has(key)) {
      map.set(key, { weekday, startTime });
    }
  });

  return Array.from(map.values()).sort((a, b) => {
    if (a.weekday !== b.weekday) return a.weekday - b.weekday;
    return a.startTime.localeCompare(b.startTime);
  });
}

function normalizePickPercent(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return Math.max(0, Math.min(100, Number(fallback || 0)));
  return Math.max(0, Math.min(100, num));
}

function weekdayMonFirst(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return 1;
  const day = d.getDay();
  return day === 0 ? 7 : day;
}

function parseSlotStartDate(dayDate, startTime = "08:00") {
  const [hh, mm] = String(startTime || "08:00")
    .split(":")
    .map((part) => Number(part));
  return new Date(
    dayDate.getFullYear(),
    dayDate.getMonth(),
    dayDate.getDate(),
    Number.isFinite(hh) ? hh : 8,
    Number.isFinite(mm) ? mm : 0,
    0,
    0
  );
}

function formatTimeFromDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "00:00";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function sessionPhaseByNo(sessionNo = 1) {
  if (sessionNo <= 8) return "knowledge";
  if (sessionNo <= 13) return "project";
  return "jury";
}

function buildClassSessionsFromRule(classData = {}) {
  const startDate = toTimestamp(classData?.startDate);
  if (!startDate) throw new Error("Ngày bắt đầu lớp không hợp lệ");

  const totalSessions = Math.max(1, Number(classData?.totalSessions || CLASS_TOTAL_SESSIONS));
  const durationMin = Math.max(30, Number(classData?.durationMin || CLASS_DEFAULT_DURATION_MIN));
  const slots = normalizeClassSlots(classData?.slots || []);
  if (!slots.length) throw new Error("Vui lòng cấu hình ít nhất 1 khung giờ học");

  const start = startDate.toDate();
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0);
  const sessions = [];

  let cursor = new Date(startDay);
  let guard = 0;
  while (sessions.length < totalSessions && guard < 500) {
    guard += 1;
    const weekday = weekdayMonFirst(cursor);
    const daySlots = slots.filter((slot) => slot.weekday === weekday);

    daySlots.forEach((slot) => {
      if (sessions.length >= totalSessions) return;

      const startAt = parseSlotStartDate(cursor, slot.startTime);
      if (startAt.getTime() < start.getTime()) return;

      const endAt = new Date(startAt.getTime() + durationMin * 60 * 1000);
      const sessionNo = sessions.length + 1;
      const sessionId = `s${String(sessionNo).padStart(2, "0")}`;

      sessions.push({
        id: sessionId,
        sessionNo,
        phase: sessionPhaseByNo(sessionNo),
        weekday: slot.weekday,
        startTime: slot.startTime,
        endTime: formatTimeFromDate(endAt),
        durationMin,
        scheduledAt: Timestamp.fromDate(startAt),
        status: "planned",
        teachingPlan: "",
        teachingResultNote: "",
        studentReviews: {},
      });
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  if (sessions.length < totalSessions) {
    throw new Error("Không thể tự sinh đủ 14 buổi. Vui lòng kiểm tra khung giờ lớp.");
  }
  return sessions;
}

async function deleteCollectionDocs(colRef) {
  const snap = await getDocs(colRef);
  if (snap.empty) return;
  await Promise.all(snap.docs.map((item) => deleteDoc(item.ref)));
}

function normalizeSessionReviewsPayload(reviews = {}) {
  const safe = reviews && typeof reviews === "object" ? reviews : {};
  const out = {};

  Object.entries(safe).forEach(([studentId, value]) => {
    const sid = String(studentId || "").trim();
    if (!sid) return;
    const status = String(value?.status || "normal").trim();
    const normalizedStatus = CLASS_REVIEW_STATUSES.has(status) ? status : "normal";
    out[sid] = {
      status: normalizedStatus,
      note: String(value?.note || "").trim(),
    };
  });

  return out;
}

function asDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }
  if (value instanceof Timestamp) {
    const d = value.toDate();
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (value?.seconds) {
    const d = new Date(Number(value.seconds) * 1000);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildSlotGroups(slots = []) {
  const groups = new Map();
  normalizeClassSlots(slots).forEach((slot) => {
    const weekday = Number(slot?.weekday || 0);
    if (!groups.has(weekday)) groups.set(weekday, []);
    groups.get(weekday).push(slot);
  });
  return groups;
}

function findNextSlotAssignmentAfter(
  baseDate,
  slots = [],
  durationMin = CLASS_DEFAULT_DURATION_MIN,
  occupied = new Set()
) {
  const base = asDate(baseDate);
  if (!base) return null;

  const slotGroups = buildSlotGroups(slots);
  if (!slotGroups.size) return null;

  const day0 = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0);
  const safeDuration = Math.max(30, Number(durationMin || CLASS_DEFAULT_DURATION_MIN));

  for (let offset = 0; offset <= 400; offset += 1) {
    const day = new Date(day0);
    day.setDate(day.getDate() + offset);
    const weekday = weekdayMonFirst(day);
    const daySlots = slotGroups.get(weekday) || [];

    for (const slot of daySlots) {
      const candidate = parseSlotStartDate(day, slot.startTime);
      const ms = candidate.getTime();
      if (ms <= base.getTime()) continue;
      if (occupied.has(ms)) continue;

      const endAt = new Date(ms + safeDuration * 60 * 1000);
      return {
        scheduledAt: Timestamp.fromDate(candidate),
        weekday: Number(slot.weekday || weekday),
        startTime: slot.startTime,
        endTime: formatTimeFromDate(endAt),
      };
    }
  }

  return null;
}

async function syncClassProgress(uid, classId) {
  if (!uid || !classId) return null;
  const [classSnap, sessionsSnap] = await Promise.all([
    getDoc(doc(db, `users/${uid}/classes/${classId}`)),
    getDocs(query(colClassSessions(uid, classId), orderBy("sessionNo", "asc"))),
  ]);
  if (!classSnap.exists()) return null;

  const classData = classSnap.data() || {};
  const sessions = mapDocs(sessionsSnap);
  const totalSessions = Math.max(1, Number(classData?.totalSessions || CLASS_TOTAL_SESSIONS));
  const doneSessions = sessions.filter((session) => String(session?.status || "") === "done").length;
  const computedRemaining = Math.max(0, totalSessions - doneSessions);
  const nextSession = sessions.find((session) => String(session?.status || "planned") === "planned") || null;

  const currentStatus = String(classData?.status || "active");
  let status = currentStatus;
  if (currentStatus !== "archived") {
    if (doneSessions >= totalSessions) {
      status = "completed";
    } else if (currentStatus === "completed") {
      status = "active";
    }
  }

  const remainingSessions = status === "completed" ? 0 : computedRemaining;

  const patch = {
    status,
    doneSessions,
    remainingSessions,
    nextSessionNo: status === "completed" ? 0 : nextSession ? Number(nextSession.sessionNo || 0) : 0,
    nextSessionId: status === "completed" ? "" : nextSession?.id || "",
    nextScheduledAt: status === "completed" ? null : nextSession?.scheduledAt || null,
    updatedAt: Timestamp.now(),
  };

  await updateDoc(doc(db, `users/${uid}/classes/${classId}`), patch);
  return patch;
}

export async function createClass(uid, payload = {}) {
  if (!uid) throw new Error("Thiếu uid");

  const code = normalizeClassCode(payload?.code);
  const codeLower = normalizeClassCodeLower(code);
  const title = String(payload?.title || "").trim();
  if (!code) throw new Error("Vui lòng nhập mã lớp");
  if (!title) throw new Error("Vui lòng nhập tên lớp");

  const duplicatedSnap = await getDocs(
    query(colClasses(uid), where("codeLower", "==", codeLower), limit(1))
  );
  if (!duplicatedSnap.empty) throw new Error("Mã lớp đã tồn tại");

  const slots = normalizeClassSlots(payload?.slots || []);
  if (!slots.length) throw new Error("Vui lòng chọn ít nhất 1 khung giờ học");

  const startDate = toTimestamp(payload?.startDate || new Date());
  if (!startDate) throw new Error("Ngày bắt đầu lớp không hợp lệ");

  const status = CLASS_STATUSES.has(String(payload?.status || "")) ? payload.status : "active";
  const totalSessions = CLASS_TOTAL_SESSIONS;
  const now = Timestamp.now();
  const data = {
    code,
    codeLower,
    title,
    description: String(payload?.description || "").trim(),
    status,
    startDate,
    durationMin: CLASS_DEFAULT_DURATION_MIN,
    slots,
    totalSessions,
    doneSessions: 0,
    remainingSessions: totalSessions,
    nextSessionId: "",
    nextSessionNo: 1,
    nextScheduledAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const ref = await addDoc(colClasses(uid), data);
  return { id: ref.id, ...data };
}

export async function listClasses(uid, filter = {}) {
  if (!uid) return [];
  const snap = await getDocs(query(colClasses(uid), orderBy("updatedAt", "desc")));
  let list = mapDocs(snap);

  if (filter?.status) {
    const status = String(filter.status || "").trim();
    list = list.filter((item) => String(item?.status || "") === status);
  }

  if (filter?.activeOnly) {
    list = list.filter((item) => String(item?.status || "active") === "active");
  }

  return list;
}

export async function readClass(uid, classId) {
  const id = String(classId || "").trim();
  if (!uid || !id) return null;
  const snap = await getDoc(doc(db, `users/${uid}/classes/${id}`));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function updateClass(uid, classId, payload = {}) {
  const id = String(classId || "").trim();
  if (!uid || !id) throw new Error("Thiếu mã lớp");

  const ref = doc(db, `users/${uid}/classes/${id}`);
  const prevSnap = await getDoc(ref);
  if (!prevSnap.exists()) throw new Error("Không tìm thấy lớp học");
  const prev = prevSnap.data() || {};

  const data = {
    updatedAt: Timestamp.now(),
  };

  if (payload.code != null) {
    const nextCode = normalizeClassCode(payload.code);
    if (!nextCode) throw new Error("Mã lớp không được để trống");
    const nextCodeLower = normalizeClassCodeLower(nextCode);
    if (nextCodeLower !== String(prev?.codeLower || "").trim()) {
      const duplicatedSnap = await getDocs(
        query(colClasses(uid), where("codeLower", "==", nextCodeLower), limit(1))
      );
      const duplicated = duplicatedSnap.docs.find((item) => item.id !== id);
      if (duplicated) throw new Error("Mã lớp đã tồn tại");
    }
    data.code = nextCode;
    data.codeLower = nextCodeLower;
  }

  if (payload.title != null) {
    const nextTitle = String(payload.title || "").trim();
    if (!nextTitle) throw new Error("Tên lớp không được để trống");
    data.title = nextTitle;
  }
  if (payload.description != null) data.description = String(payload.description || "").trim();
  if (payload.startDate !== undefined) {
    const nextStartDate = toTimestamp(payload.startDate);
    if (!nextStartDate) throw new Error("Ngày bắt đầu lớp không hợp lệ");
    data.startDate = nextStartDate;
  }
  if (payload.slots != null) {
    const slots = normalizeClassSlots(payload.slots);
    if (!slots.length) throw new Error("Vui lòng chọn ít nhất 1 khung giờ học");
    data.slots = slots;
  }
  if (payload.status != null) {
    const status = String(payload.status || "").trim();
    data.status = CLASS_STATUSES.has(status) ? status : "active";
  }

  await updateDoc(ref, data);
  return true;
}

export async function deleteClass(uid, classId) {
  const id = String(classId || "").trim();
  if (!uid || !id) throw new Error("Thiếu mã lớp");

  await Promise.all([
    deleteCollectionDocs(colClassStudents(uid, id)),
    deleteCollectionDocs(colClassSessions(uid, id)),
  ]);
  await deleteDoc(doc(db, `users/${uid}/classes/${id}`));
  return true;
}

export async function addClassStudent(uid, classId, payload = {}) {
  const id = String(classId || "").trim();
  if (!uid || !id) throw new Error("Thiếu mã lớp");

  const name = String(payload?.name || "").trim();
  if (!name) throw new Error("Vui lòng nhập tên học sinh");
  const joinedFromSessionNo = Math.max(1, Number(payload?.joinedFromSessionNo || 1));
  const now = Timestamp.now();

  const data = {
    name,
    active: true,
    joinedFromSessionNo,
    leftFromSessionNo: null,
    starsBalance: 0,
    pointsTotal: 0,
    pickPercent: 0,
    scoreUpdatedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const ref = await addDoc(colClassStudents(uid, id), data);
  await updateDoc(doc(db, `users/${uid}/classes/${id}`), { updatedAt: Timestamp.now() });
  return { id: ref.id, ...data };
}

export async function updateClassStudent(uid, classId, studentId, payload = {}) {
  const classKey = String(classId || "").trim();
  const studentKey = String(studentId || "").trim();
  if (!uid || !classKey || !studentKey) throw new Error("Thiếu mã lớp hoặc học sinh");

  const data = {
    updatedAt: Timestamp.now(),
  };
  if (payload.name != null) {
    const name = String(payload.name || "").trim();
    if (!name) throw new Error("Tên học sinh không được để trống");
    data.name = name;
  }
  if (payload.active != null) data.active = !!payload.active;
  if (payload.joinedFromSessionNo != null) {
    data.joinedFromSessionNo = Math.max(1, Number(payload.joinedFromSessionNo || 1));
  }
  if (payload.leftFromSessionNo !== undefined) {
    const leftFrom = Number(payload.leftFromSessionNo || 0);
    data.leftFromSessionNo = leftFrom > 0 ? leftFrom : null;
  }
  if (payload.pickPercent !== undefined) {
    data.pickPercent = normalizePickPercent(payload.pickPercent, 0);
    data.scoreUpdatedAt = Timestamp.now();
  }
  if (payload.starsBalance !== undefined) {
    const stars = Number(payload.starsBalance || 0);
    data.starsBalance = Math.max(0, Math.floor(stars));
    data.scoreUpdatedAt = Timestamp.now();
  }
  if (payload.pointsTotal !== undefined) {
    const points = Number(payload.pointsTotal || 0);
    data.pointsTotal = Math.max(0, Math.floor(points));
    data.scoreUpdatedAt = Timestamp.now();
  }

  await updateDoc(doc(db, `users/${uid}/classes/${classKey}/students/${studentKey}`), data);
  await updateDoc(doc(db, `users/${uid}/classes/${classKey}`), { updatedAt: Timestamp.now() });
  return true;
}

export async function awardStudentStar(uid, classId, studentId, delta = 1) {
  const classKey = String(classId || "").trim();
  const studentKey = String(studentId || "").trim();
  if (!uid || !classKey || !studentKey) throw new Error("Thiếu mã lớp hoặc học sinh");

  const safeDelta = Math.trunc(Number(delta || 0));
  if (!Number.isFinite(safeDelta) || safeDelta === 0) {
    throw new Error("Giá trị sao không hợp lệ");
  }

  const classRef = doc(db, `users/${uid}/classes/${classKey}`);
  const studentRef = doc(db, `users/${uid}/classes/${classKey}/students/${studentKey}`);

  return runTransaction(db, async (tx) => {
    const studentSnap = await tx.get(studentRef);
    if (!studentSnap.exists()) throw new Error("Không tìm thấy học sinh");

    const data = studentSnap.data() || {};
    const currentStars = Math.max(0, Math.floor(Number(data?.starsBalance || 0)));
    const nextStars = currentStars + safeDelta;
    if (nextStars < 0) throw new Error("Số sao không hợp lệ");

    const now = Timestamp.now();
    tx.update(studentRef, {
      starsBalance: nextStars,
      updatedAt: now,
      scoreUpdatedAt: now,
    });
    tx.update(classRef, { updatedAt: now });

    return {
      starsBalance: nextStars,
      pointsTotal: Math.max(0, Math.floor(Number(data?.pointsTotal || 0))),
    };
  });
}

export async function redeemStudentStars(uid, classId, studentId, options = {}) {
  const classKey = String(classId || "").trim();
  const studentKey = String(studentId || "").trim();
  if (!uid || !classKey || !studentKey) throw new Error("Thiếu mã lớp hoặc học sinh");

  const ratio = Math.max(1, Math.floor(Number(options?.ratio || 5)));
  const classRef = doc(db, `users/${uid}/classes/${classKey}`);
  const studentRef = doc(db, `users/${uid}/classes/${classKey}/students/${studentKey}`);

  return runTransaction(db, async (tx) => {
    const studentSnap = await tx.get(studentRef);
    if (!studentSnap.exists()) throw new Error("Không tìm thấy học sinh");

    const data = studentSnap.data() || {};
    const starsBefore = Math.max(0, Math.floor(Number(data?.starsBalance || 0)));
    const currentPoints = Math.max(0, Math.floor(Number(data?.pointsTotal || 0)));
    const earnedPoints = Math.floor(starsBefore / ratio);
    const nextPoints = currentPoints + earnedPoints;
    const now = Timestamp.now();

    tx.update(studentRef, {
      starsBalance: 0,
      pointsTotal: nextPoints,
      updatedAt: now,
      scoreUpdatedAt: now,
    });
    tx.update(classRef, { updatedAt: now });

    return {
      earnedPoints,
      starsBefore,
      pointsTotal: nextPoints,
      starsBalance: 0,
    };
  });
}

export async function updateStudentPickPercent(uid, classId, studentId, pickPercent = 0) {
  const classKey = String(classId || "").trim();
  const studentKey = String(studentId || "").trim();
  if (!uid || !classKey || !studentKey) throw new Error("Thiếu mã lớp hoặc học sinh");

  const now = Timestamp.now();
  await updateDoc(doc(db, `users/${uid}/classes/${classKey}/students/${studentKey}`), {
    pickPercent: normalizePickPercent(pickPercent, 0),
    updatedAt: now,
    scoreUpdatedAt: now,
  });
  await updateDoc(doc(db, `users/${uid}/classes/${classKey}`), { updatedAt: now });
  return true;
}

export async function bulkUpdateStudentPickPercent(uid, classId, patchList = []) {
  const classKey = String(classId || "").trim();
  if (!uid || !classKey) throw new Error("Thiếu mã lớp");

  const rows = Array.isArray(patchList) ? patchList : [];
  if (!rows.length) return false;

  const now = Timestamp.now();
  const batch = writeBatch(db);

  rows.forEach((row) => {
    const studentKey = String(row?.studentId || "").trim();
    if (!studentKey) return;
    batch.update(doc(db, `users/${uid}/classes/${classKey}/students/${studentKey}`), {
      pickPercent: normalizePickPercent(row?.pickPercent, 0),
      updatedAt: now,
      scoreUpdatedAt: now,
    });
  });

  batch.update(doc(db, `users/${uid}/classes/${classKey}`), { updatedAt: now });
  await batch.commit();
  return true;
}

export async function removeClassStudent(uid, classId, studentId, nextSessionNo = 1) {
  const classKey = String(classId || "").trim();
  const studentKey = String(studentId || "").trim();
  if (!uid || !classKey || !studentKey) throw new Error("Thiếu mã lớp hoặc học sinh");

  await updateDoc(doc(db, `users/${uid}/classes/${classKey}/students/${studentKey}`), {
    active: false,
    leftFromSessionNo: Math.max(1, Number(nextSessionNo || 1)),
    updatedAt: Timestamp.now(),
  });
  await updateDoc(doc(db, `users/${uid}/classes/${classKey}`), { updatedAt: Timestamp.now() });
  return true;
}

export async function listClassStudents(uid, classId, options = {}) {
  const id = String(classId || "").trim();
  if (!uid || !id) return [];
  const snap = await getDocs(query(colClassStudents(uid, id), orderBy("createdAt", "asc")));
  let list = mapDocs(snap);
  if (typeof options?.active === "boolean") {
    list = list.filter((item) => !!item?.active === options.active);
  }
  return list;
}

export async function createClassSessions(uid, classId, options = {}) {
  const id = String(classId || "").trim();
  if (!uid || !id) throw new Error("Thiếu mã lớp");

  const classRef = doc(db, `users/${uid}/classes/${id}`);
  const classSnap = await getDoc(classRef);
  if (!classSnap.exists()) throw new Error("Không tìm thấy lớp học");
  const classData = classSnap.data() || {};

  const forceRebuild = !!options?.forceRebuild;
  const existingSnap = await getDocs(query(colClassSessions(uid, id), orderBy("sessionNo", "asc")));
  if (!forceRebuild && !existingSnap.empty) {
    await syncClassProgress(uid, id);
    return mapDocs(existingSnap);
  }

  const sessions = Array.isArray(options?.sessions) && options.sessions.length
    ? options.sessions
    : buildClassSessionsFromRule(classData);

  if (forceRebuild && !existingSnap.empty) {
    await deleteCollectionDocs(colClassSessions(uid, id));
  }

  const now = Timestamp.now();
  await Promise.all(
    sessions.map((session, idx) => {
      const sessionNo = Math.max(1, Number(session?.sessionNo || idx + 1));
      const sessionId = String(session?.id || `s${String(sessionNo).padStart(2, "0")}`).trim();
      const ref = doc(db, `users/${uid}/classes/${id}/sessions/${sessionId}`);
      return setDoc(
        ref,
        {
          sessionNo,
          phase: String(session?.phase || sessionPhaseByNo(sessionNo)),
          weekday: Number(session?.weekday || 1),
          startTime: normalizeTimeText(session?.startTime || "08:00") || "08:00",
          endTime: normalizeTimeText(session?.endTime || "10:00") || "10:00",
          durationMin: Math.max(30, Number(session?.durationMin || classData?.durationMin || CLASS_DEFAULT_DURATION_MIN)),
          scheduledAt: toTimestamp(session?.scheduledAt) || null,
          status: CLASS_SESSION_STATUSES.has(String(session?.status || "")) ? session.status : "planned",
          teachingPlan: String(session?.teachingPlan || "").trim(),
          teachingResultNote: String(session?.teachingResultNote || "").trim(),
          studentReviews: normalizeSessionReviewsPayload(session?.studentReviews || {}),
          completedAt: toTimestamp(session?.completedAt),
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );
    })
  );

  await syncClassProgress(uid, id);
  return listClassSessions(uid, id);
}

export async function listClassSessions(uid, classId, filter = {}) {
  const id = String(classId || "").trim();
  if (!uid || !id) return [];
  const snap = await getDocs(query(colClassSessions(uid, id), orderBy("sessionNo", "asc")));
  let list = mapDocs(snap);

  if (filter?.status) {
    const status = String(filter.status || "").trim();
    list = list.filter((item) => String(item?.status || "planned") === status);
  }
  if (filter?.fromSessionNo) {
    const fromNo = Math.max(1, Number(filter.fromSessionNo || 1));
    list = list.filter((item) => Number(item?.sessionNo || 0) >= fromNo);
  }
  return list;
}

export async function updateClassSession(uid, classId, sessionId, payload = {}) {
  const classKey = String(classId || "").trim();
  const sessionKey = String(sessionId || "").trim();
  if (!uid || !classKey || !sessionKey) throw new Error("Thiếu mã lớp hoặc buổi học");

  const data = {
    updatedAt: Timestamp.now(),
  };
  if (payload.sessionNo != null) data.sessionNo = Math.max(1, Number(payload.sessionNo || 1));
  if (payload.phase != null) data.phase = String(payload.phase || "").trim() || "knowledge";
  if (payload.weekday != null) data.weekday = Math.max(1, Math.min(7, Number(payload.weekday || 1)));
  if (payload.startTime != null) data.startTime = normalizeTimeText(payload.startTime) || "08:00";
  if (payload.endTime != null) data.endTime = normalizeTimeText(payload.endTime) || "10:00";
  if (payload.durationMin != null) data.durationMin = Math.max(30, Number(payload.durationMin || CLASS_DEFAULT_DURATION_MIN));
  if (payload.scheduledAt !== undefined) data.scheduledAt = toTimestamp(payload.scheduledAt);
  if (payload.status != null) {
    const status = String(payload.status || "").trim();
    data.status = CLASS_SESSION_STATUSES.has(status) ? status : "planned";
    data.completedAt = data.status === "done" ? Timestamp.now() : null;
  }
  if (payload.teachingPlan != null) data.teachingPlan = String(payload.teachingPlan || "").trim();
  if (payload.teachingResultNote != null) data.teachingResultNote = String(payload.teachingResultNote || "").trim();
  if (payload.studentReviews != null) data.studentReviews = normalizeSessionReviewsPayload(payload.studentReviews);

  await updateDoc(doc(db, `users/${uid}/classes/${classKey}/sessions/${sessionKey}`), data);
  await syncClassProgress(uid, classKey);
  return true;
}

export async function shiftClassSessionNextWeek(uid, classId, sessionId, reason = "") {
  const classKey = String(classId || "").trim();
  const sessionKey = String(sessionId || "").trim();
  if (!uid || !classKey || !sessionKey) throw new Error("Thiếu mã lớp hoặc buổi học");

  const [classSnap, sessionsSnap] = await Promise.all([
    getDoc(doc(db, `users/${uid}/classes/${classKey}`)),
    getDocs(query(colClassSessions(uid, classKey), orderBy("sessionNo", "asc"))),
  ]);
  if (!classSnap.exists()) throw new Error("Không tìm thấy lớp học");

  const classData = classSnap.data() || {};
  const slots = normalizeClassSlots(classData?.slots || []);
  if (!slots.length) throw new Error("Lớp chưa có khung giờ học hợp lệ");

  const sessions = mapDocs(sessionsSnap).sort(
    (a, b) => Number(a?.sessionNo || 0) - Number(b?.sessionNo || 0)
  );
  const target = sessions.find((item) => String(item?.id || "") === sessionKey);
  if (!target) throw new Error("Không tìm thấy buổi học cần dời");
  if (String(target?.status || "planned") !== "planned") {
    throw new Error("Chỉ có thể dời buổi đang ở trạng thái kế hoạch");
  }

  const targetNo = Number(target?.sessionNo || 0);
  const hasDoneAfter = sessions.some(
    (item) =>
      Number(item?.sessionNo || 0) > targetNo &&
      String(item?.status || "planned") === "done"
  );
  if (hasDoneAfter) {
    throw new Error("Không thể dời buổi vì đã có buổi đã dạy phía sau");
  }

  const chain = sessions.filter(
    (item) =>
      Number(item?.sessionNo || 0) >= targetNo &&
      String(item?.status || "planned") === "planned"
  );
  if (!chain.length) return false;

  const chainIds = new Set(chain.map((item) => String(item?.id || "")));
  const occupied = new Set(
    sessions
      .filter((item) => !chainIds.has(String(item?.id || "")))
      .map((item) => asDate(item?.scheduledAt)?.getTime())
      .filter((value) => Number.isFinite(value))
  );

  const durationMin = Math.max(30, Number(classData?.durationMin || CLASS_DEFAULT_DURATION_MIN));
  const safeReason = String(reason || "").trim();
  const now = Timestamp.now();
  const batch = writeBatch(db);

  let cursor = asDate(target?.scheduledAt);
  if (!cursor) throw new Error("Buổi học chưa có thời gian để dời lịch");

  for (const item of chain) {
    const assignment = findNextSlotAssignmentAfter(cursor, slots, durationMin, occupied);
    if (!assignment) {
      throw new Error("Không tìm được lịch mới phù hợp để dời buổi");
    }

    const previousScheduledAt = toTimestamp(item?.scheduledAt);
    const scheduledDate = assignment.scheduledAt.toDate();
    cursor = scheduledDate;
    occupied.add(scheduledDate.getTime());

    const payload = {
      scheduledAt: assignment.scheduledAt,
      weekday: assignment.weekday,
      startTime: assignment.startTime,
      endTime: assignment.endTime,
      rescheduledAt: now,
      rescheduledFrom: previousScheduledAt,
      updatedAt: now,
    };
    if (safeReason) payload.rescheduleReason = safeReason;

    batch.update(doc(db, `users/${uid}/classes/${classKey}/sessions/${item.id}`), payload);
  }

  await batch.commit();
  await syncClassProgress(uid, classKey);
  return true;
}

export async function saveSessionReviews(uid, classId, sessionId, reviews = {}) {
  const classKey = String(classId || "").trim();
  const sessionKey = String(sessionId || "").trim();
  if (!uid || !classKey || !sessionKey) throw new Error("Thiếu mã lớp hoặc buổi học");

  await updateDoc(doc(db, `users/${uid}/classes/${classKey}/sessions/${sessionKey}`), {
    studentReviews: normalizeSessionReviewsPayload(reviews),
    updatedAt: Timestamp.now(),
  });
  await updateDoc(doc(db, `users/${uid}/classes/${classKey}`), { updatedAt: Timestamp.now() });
  return true;
}

export async function addExpense(uid, payload) {
  const name = (payload.name || "").trim();
  const amount = Number(payload.amount || 0);
  const dateObj = parseLocalDate(payload.date || "") || new Date();
  const category = payload.category || "Other";
  const account = payload.account || "Other";
  const note = payload.note || "";

  if (!name) throw new Error("Vui lòng nhập tên khoản chi");
  if (!(amount > 0)) throw new Error("Số tiền phải lớn hơn 0");
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    throw new Error("Ngày không hợp lệ");
  }

  const data = {
    name,
    amount,
    date: Timestamp.fromDate(dateObj),
    category,
    account,
    note,
    createdAt: Timestamp.now(),
  };

  const ref = await addDoc(colExpenses(uid), data);
  applyBalanceDeltaCache(uid, [{ account: data.account, delta: -Number(data.amount || 0) }]);
  return ref;
}

export async function listExpensesByMonth(uid, ym) {
  const rng = ymToRange(ym);
  if (!rng) throw new Error("Bộ lọc tháng không hợp lệ (YYYY-MM)");

  const qy = query(
    colExpenses(uid),
    where("date", ">=", rng.start),
    where("date", "<", rng.end),
    orderBy("date", "desc")
  );
  const snap = await getDocs(qy);
  return mapDocs(snap);
}

export async function listExpensesByDateRange(uid, fromDate, toDateExclusive) {
  const fromTs = toTimestampStrict(fromDate, "fromDate");
  const toTs = toTimestampStrict(toDateExclusive, "toDateExclusive");

  const qy = query(
    colExpenses(uid),
    where("date", ">=", fromTs),
    where("date", "<", toTs),
    orderBy("date", "desc")
  );
  const snap = await getDocs(qy);
  return mapDocs(snap);
}

export async function readWeeklyReview(uid, weekKey) {
  const key = String(weekKey || "").trim();
  if (!uid || !key) return null;

  const ref = doc(db, `users/${uid}/weeklyReviews/${key}`);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function saveWeeklyReview(uid, weekKey, payload = {}) {
  const key = String(weekKey || "").trim();
  if (!uid || !key) throw new Error("Thiếu uid hoặc weekKey");
  if (!payload || typeof payload !== "object") throw new Error("Payload không hợp lệ");

  const ref = doc(db, `users/${uid}/weeklyReviews/${key}`);
  const prev = await getDoc(ref);
  const now = Timestamp.now();

  await setDoc(
    ref,
    {
      weekKey: key,
      ...payload,
      createdAt: prev.exists() ? prev.data()?.createdAt || now : now,
      updatedAt: now,
    },
    { merge: true }
  );
  return true;
}

export async function listWeeklyReviews(uid, limitCount = 12) {
  if (!uid) return [];
  const safeLimit = Math.min(52, Math.max(1, Number(limitCount || 12)));

  const snap = await getDocs(
    query(colWeeklyReviews(uid), orderBy("updatedAt", "desc"), limit(safeLimit))
  );
  return mapDocs(snap).map((item) => ({
    ...item,
    weekKey: String(item.weekKey || item.id || "").trim(),
  }));
}

export async function saveAppliedAiSuggestion(uid, payload = {}) {
  if (!uid) throw new Error("Thiếu uid");
  if (!payload || typeof payload !== "object") throw new Error("Payload không hợp lệ");

  const type = String(payload?.type || "").trim();
  if (!type) throw new Error("Thiếu loại gợi ý AI");

  const mode = String(payload?.mode || "generate").trim() || "generate";
  const appliedAt = toTimestamp(payload?.appliedAt || new Date()) || Timestamp.now();

  const data = {
    type,
    mode,
    inputSnapshot: payload?.inputSnapshot && typeof payload.inputSnapshot === "object" ? payload.inputSnapshot : {},
    appliedOutput: payload?.appliedOutput && typeof payload.appliedOutput === "object" ? payload.appliedOutput : {},
    appliedAt,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  await addDoc(colAiSuggestions(uid), data);
  return true;
}

export async function listAppliedAiSuggestions(uid, options = {}) {
  if (!uid) return [];
  const typeFilter = String(options?.type || "").trim();
  const limitCount = Math.min(60, Math.max(1, Number(options?.limitCount || 14)));

  const snap = await getDocs(query(colAiSuggestions(uid), orderBy("updatedAt", "desc"), limit(limitCount)));
  const list = mapDocs(snap);
  if (!typeFilter) return list;
  return list.filter((item) => String(item?.type || "").trim() === typeFilter);
}

export async function getExpense(uid, id) {
  const ref = doc(db, `users/${uid}/expenses/${id}`);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function updateExpense(uid, id, payload) {
  const ref = doc(db, `users/${uid}/expenses/${id}`);
  const prevSnap = await getDoc(ref);
  const prev = prevSnap.exists() ? prevSnap.data() : null;
  const data = {
    name: (payload.name || "").trim(),
    amount: Number(payload.amount || 0),
    category: payload.category,
    account: payload.account,
    note: payload.note || "",
    updatedAt: Timestamp.now(),
  };
  if (payload.date) data.date = Timestamp.fromDate(new Date(payload.date));
  await updateDoc(ref, data);

  const prevAccount = normalizeBalanceKey(prev?.account);
  const prevAmount = Number(prev?.amount || 0);
  const nextAccount = normalizeBalanceKey(data.account || prev?.account);
  const nextAmount = Number(data.amount || 0);

  if (prevAccount === nextAccount) {
    applyBalanceDeltaCache(uid, [{ account: nextAccount, delta: prevAmount - nextAmount }]);
  } else {
    applyBalanceDeltaCache(uid, [
      { account: prevAccount, delta: prevAmount },
      { account: nextAccount, delta: -nextAmount },
    ]);
  }

  return true;
}

export async function deleteExpense(uid, id) {
  const ref = doc(db, `users/${uid}/expenses/${id}`);
  const snap = await getDoc(ref);
  const prev = snap.exists() ? snap.data() : null;

  await deleteDoc(ref);
  if (prev) {
    applyBalanceDeltaCache(uid, [
      { account: prev.account, delta: Number(prev.amount || 0) },
    ]);
  }
  return true;
}

export async function listAccounts(uid) {
  const snap = await getDocs(query(colAccounts(uid), orderBy("name")));
  return mapDocs(snap);
}

export async function addAccount(uid, data) {
  const payload = {
    name: (data.name || "").trim(),
    type: data.type || "bank",
    isDefault: !!data.isDefault,
    createdAt: Timestamp.now(),
  };

  if (!payload.name) throw new Error("Vui lòng nhập tên tài khoản");

  const ref = await addDoc(colAccounts(uid), payload);

  if (payload.isDefault) {
    const snap = await getDocs(query(colAccounts(uid)));
    await Promise.all(
      snap.docs
        .filter((d) => d.id !== ref.id && d.data().isDefault)
        .map((d) =>
          updateDoc(doc(db, `users/${uid}/accounts/${d.id}`), {
            isDefault: false,
          })
        )
    );
  }

  return ref.id;
}

export async function updateAccount(uid, id, { name, type, isDefault }) {
  const ref = doc(db, `users/${uid}/accounts/${id}`);
  const data = {};
  if (name != null) data.name = String(name).trim();
  if (type) data.type = type;
  if (typeof isDefault === "boolean") data.isDefault = isDefault;
  await updateDoc(ref, data);

  if (isDefault) {
    const snap = await getDocs(query(collection(db, `users/${uid}/accounts`)));
    await Promise.all(
      snap.docs
        .filter((d) => d.id !== id && d.data().isDefault)
        .map((d) =>
          updateDoc(doc(db, `users/${uid}/accounts/${d.id}`), {
            isDefault: false,
          })
        )
    );
  }

  return true;
}

async function reassignCollectionByField(colRef, field, fromValue, toValue) {
  const CHUNK = 300;
  let last = null;

  while (true) {
    const qy = last
      ? query(
          colRef,
          where(field, "==", fromValue),
          orderBy("__name__"),
          startAfter(last),
          limit(CHUNK)
        )
      : query(
          colRef,
          where(field, "==", fromValue),
          orderBy("__name__"),
          limit(CHUNK)
        );

    const snap = await getDocs(qy);
    if (snap.empty) break;

    for (const d of snap.docs) {
      await updateDoc(d.ref, { [field]: toValue });
    }

    last = snap.docs[snap.docs.length - 1];
    if (snap.size < CHUNK) break;
  }
}

export async function deleteAccountWithReassign(uid, id, targetRefValue) {
  const sourceRef = doc(db, `users/${uid}/accounts/${id}`);
  const sourceSnap = await getDoc(sourceRef);
  if (!sourceSnap.exists()) throw new Error("Không tìm thấy tài khoản cần xóa");

  const allSnap = await getDocs(collection(db, `users/${uid}/accounts`));
  if (allSnap.size <= 1) {
    throw new Error("Cần ít nhất 1 tài khoản. Không thể xóa tài khoản cuối cùng.");
  }

  let targetName = "";
  if (targetRefValue) {
    const maybeTargetById = allSnap.docs.find((d) => d.id === targetRefValue);
    if (maybeTargetById) {
      targetName = maybeTargetById.data().name;
    } else {
      targetName = String(targetRefValue);
    }
  }

  const sourceName = sourceSnap.data().name;

  if (!targetName || targetName === sourceName) {
    throw new Error("Vui lòng chọn tài khoản khác để chuyển dữ liệu");
  }

  const usersPath = `users/${uid}`;
  await reassignCollectionByField(
    collection(db, `${usersPath}/expenses`),
    "account",
    sourceName,
    targetName
  );
  await reassignCollectionByField(
    collection(db, `${usersPath}/incomes`),
    "account",
    sourceName,
    targetName
  );
  await reassignCollectionByField(
    collection(db, `${usersPath}/transfers`),
    "from",
    sourceName,
    targetName
  );
  await reassignCollectionByField(
    collection(db, `${usersPath}/transfers`),
    "to",
    sourceName,
    targetName
  );

  await deleteDoc(sourceRef);
  invalidateBalanceCache(uid);
  return true;
}

// ================================
// Goals, Habits, Motivation, Video
// ================================

export async function addGoal(uid, payload) {
  const data = {
    title: (payload.title || "").trim(),
    area: payload.area || "ca-nhan",
    period: payload.period || "month",
    targetValue: Number(payload.targetValue || 0),
    currentValue: Number(payload.currentValue || 0),
    unit: (payload.unit || "").trim() || "lan",
    dueDate: toTimestamp(payload.dueDate),
    status: payload.status || "active",
    priority: payload.priority || "medium",
    note: payload.note || "",
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  if (!data.title) throw new Error("Vui lòng nhập tiêu đề mục tiêu");
  if (data.targetValue <= 0) throw new Error("Giá trị mục tiêu phải lớn hơn 0");

  return addDoc(colGoals(uid), data);
}

export async function listGoals(uid, filter = {}) {
  const snap = await getDocs(query(colGoals(uid), orderBy("createdAt", "desc")));
  let list = mapDocs(snap);

  if (filter.status) {
    list = list.filter((x) => x.status === filter.status);
  }
  if (filter.area) {
    list = list.filter((x) => x.area === filter.area);
  }

  return list;
}

export async function updateGoal(uid, goalId, payload) {
  const ref = doc(db, `users/${uid}/goals/${goalId}`);
  const data = {
    updatedAt: Timestamp.now(),
  };

  if (payload.title != null) data.title = String(payload.title).trim();
  if (payload.area != null) data.area = payload.area;
  if (payload.period != null) data.period = payload.period;
  if (payload.targetValue != null) data.targetValue = Number(payload.targetValue || 0);
  if (payload.currentValue != null) data.currentValue = Number(payload.currentValue || 0);
  if (payload.unit != null) data.unit = String(payload.unit || "").trim();
  if (payload.status != null) data.status = payload.status;
  if (payload.priority != null) data.priority = payload.priority;
  if (payload.note != null) data.note = payload.note || "";
  if (payload.dueDate !== undefined) data.dueDate = toTimestamp(payload.dueDate);

  await updateDoc(ref, data);
  return true;
}

export async function deleteGoal(uid, goalId) {
  await deleteDoc(doc(db, `users/${uid}/goals/${goalId}`));
  return true;
}

export async function addHabit(uid, payload) {
  const data = {
    name: (payload.name || "").trim(),
    period: payload.period || "day",
    targetCount: Number(payload.targetCount || 1),
    xpPerCheckin: Number(payload.xpPerCheckin || 10),
    active: payload.active !== false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  if (!data.name) throw new Error("Vui lòng nhập tên thói quen");
  if (data.targetCount <= 0) throw new Error("Mục tiêu thói quen phải lớn hơn 0");

  return addDoc(colHabits(uid), data);
}

export async function listHabits(uid, filter = {}) {
  const snap = await getDocs(query(colHabits(uid), orderBy("createdAt", "desc")));
  let list = mapDocs(snap);
  if (typeof filter.active === "boolean") {
    list = list.filter((x) => !!x.active === filter.active);
  }
  if (filter.period) {
    list = list.filter((x) => x.period === filter.period);
  }
  return list;
}

export async function updateHabit(uid, habitId, payload) {
  const ref = doc(db, `users/${uid}/habits/${habitId}`);
  const data = {
    updatedAt: Timestamp.now(),
  };

  if (payload.name != null) data.name = String(payload.name).trim();
  if (payload.period != null) data.period = payload.period;
  if (payload.targetCount != null) data.targetCount = Number(payload.targetCount || 0);
  if (payload.xpPerCheckin != null) data.xpPerCheckin = Number(payload.xpPerCheckin || 10);
  if (payload.active != null) data.active = !!payload.active;

  await updateDoc(ref, data);
  return true;
}

export async function deleteHabit(uid, habitId) {
  await deleteDoc(doc(db, `users/${uid}/habits/${habitId}`));
  return true;
}

export async function addHabitLog(uid, payload) {
  const habitId = String(payload.habitId || "").trim();
  const dateKey = String(payload.dateKey || "").trim();
  const count = Number(payload.count || 1);

  if (!habitId || !dateKey) throw new Error("Thiếu habitId hoặc dateKey");

  const id = `${habitId}_${dateKey}`;
  const ref = doc(db, `users/${uid}/habitLogs/${id}`);
  const snap = await getDoc(ref);

  const base = {
    habitId,
    dateKey,
    note: payload.note || "",
    updatedAt: Timestamp.now(),
  };

  if (!snap.exists()) {
    await setDoc(ref, {
      ...base,
      count: Math.max(1, count),
      createdAt: Timestamp.now(),
    });
    return { id, ...base, count: Math.max(1, count), createdAt: Timestamp.now() };
  }

  const prev = snap.data();
  const nextCount = Number(prev.count || 0) + Math.max(1, count);
  await setDoc(ref, {
    ...prev,
    ...base,
    count: nextCount,
  });
  return { id, ...prev, ...base, count: nextCount };
}

export async function listHabitLogsByRange(uid, fromDate, toDate) {
  const fromKey = String(fromDate || "").slice(0, 10);
  const toKey = String(toDate || "").slice(0, 10);

  const snap = await getDocs(colHabitLogs(uid));
  let list = mapDocs(snap);
  if (fromKey) list = list.filter((x) => String(x.dateKey || "") >= fromKey);
  if (toKey) list = list.filter((x) => String(x.dateKey || "") <= toKey);

  return list.sort((a, b) => String(a.dateKey || "").localeCompare(String(b.dateKey || "")));
}

export async function addVideoTask(uid, payload) {
  const data = {
    title: (payload.title || "").trim(),
    stage: payload.stage || "idea",
    priority: payload.priority || "medium",
    deadline: toTimestamp(payload.deadline),
    scriptUrl: payload.scriptUrl || "",
    shotList: payload.shotList || "",
    assetLinks: Array.isArray(payload.assetLinks) ? payload.assetLinks : [],
    publishChecklist: {
      titleDone: !!payload.publishChecklist?.titleDone,
      thumbnailDone: !!payload.publishChecklist?.thumbnailDone,
      descriptionDone: !!payload.publishChecklist?.descriptionDone,
      tagsDone: !!payload.publishChecklist?.tagsDone,
    },
    status: payload.status || "active",
    note: payload.note || "",
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  if (!data.title) throw new Error("Vui lòng nhập tên công việc video");

  return addDoc(colVideoTasks(uid), data);
}

export async function listVideoTasks(uid, filter = {}) {
  const snap = await getDocs(query(colVideoTasks(uid), orderBy("createdAt", "desc")));
  let list = mapDocs(snap);

  if (filter.stage) list = list.filter((x) => x.stage === filter.stage);
  if (filter.status) list = list.filter((x) => x.status === filter.status);

  return list;
}

export async function updateVideoTask(uid, taskId, payload) {
  const ref = doc(db, `users/${uid}/videoTasks/${taskId}`);
  const data = {
    updatedAt: Timestamp.now(),
  };

  if (payload.title != null) data.title = String(payload.title).trim();
  if (payload.stage != null) data.stage = payload.stage;
  if (payload.priority != null) data.priority = payload.priority;
  if (payload.deadline !== undefined) data.deadline = toTimestamp(payload.deadline);
  if (payload.scriptUrl != null) data.scriptUrl = payload.scriptUrl || "";
  if (payload.shotList != null) data.shotList = payload.shotList || "";
  if (payload.assetLinks != null) data.assetLinks = payload.assetLinks;
  if (payload.publishChecklist != null) data.publishChecklist = payload.publishChecklist;
  if (payload.status != null) data.status = payload.status;
  if (payload.note != null) data.note = payload.note || "";

  await updateDoc(ref, data);
  return true;
}

export async function moveVideoTaskStage(uid, taskId, nextStage) {
  await updateDoc(doc(db, `users/${uid}/videoTasks/${taskId}`), {
    stage: nextStage,
    updatedAt: Timestamp.now(),
  });
  return true;
}

export async function deleteVideoTask(uid, taskId) {
  await deleteDoc(doc(db, `users/${uid}/videoTasks/${taskId}`));
  return true;
}

export async function upsertVideoRetro(uid, taskId, payload = {}) {
  const id = String(taskId || "").trim();
  if (!uid || !id) throw new Error("Thiếu thông tin bản ghi hậu xuất bản");

  const now = Timestamp.now();
  const ref = doc(db, `users/${uid}/videoRetros/${id}`);
  const prev = await getDoc(ref);

  const durationSec = Math.max(0, Math.floor(Number(payload.durationSec || 0)));
  const views = Math.max(0, Math.floor(Number(payload.views || 0)));
  const ctr = Math.max(0, Number(payload.ctr || 0));
  const retention30s = Math.max(0, Number(payload.retention30s || 0));

  const data = {
    taskId: id,
    titleSnapshot: String(payload.titleSnapshot || "").trim(),
    language: normalizeVideoLanguageKey(payload.language),
    videoType: normalizeVideoTypeKey(
      payload.videoType || (durationSec > 60 ? "long" : "short")
    ),
    publishedAt: toTimestamp(payload.publishedAt),
    durationSec,
    views,
    ctr,
    retention30s,
    note: String(payload.note || "").trim(),
    updatedAt: now,
    createdAt: prev.exists() ? prev.data()?.createdAt || now : now,
  };

  await setDoc(ref, data, { merge: true });
  return { id, ...data };
}

export async function readVideoRetro(uid, taskId) {
  const id = String(taskId || "").trim();
  if (!uid || !id) return null;

  const snap = await getDoc(doc(db, `users/${uid}/videoRetros/${id}`));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function listVideoRetrosByTaskIds(uid, taskIds = []) {
  if (!uid) return [];
  const ids = Array.from(
    new Set(
      (Array.isArray(taskIds) ? taskIds : [])
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    )
  );
  if (!ids.length) return [];

  const snapshots = await Promise.all(
    ids.map((id) => getDoc(doc(db, `users/${uid}/videoRetros/${id}`)))
  );
  return snapshots
    .filter((snap) => snap.exists())
    .map((snap) => ({ id: snap.id, ...snap.data() }));
}

export async function listVideoRetrosByRange(uid, fromDate, toDateExclusive) {
  if (!uid) return [];
  const fromTs = toTimestampStrict(fromDate, "fromDate");
  const toTs = toTimestampStrict(toDateExclusive, "toDateExclusive");

  const snap = await getDocs(colVideoRetros(uid));
  return mapDocs(snap)
    .filter((item) => {
      const publishedAt = toTimestamp(item?.publishedAt);
      if (!publishedAt) return false;
      return publishedAt.seconds >= fromTs.seconds && publishedAt.seconds < toTs.seconds;
    })
    .sort((a, b) => {
      const aa = toTimestamp(a?.publishedAt)?.seconds || 0;
      const bb = toTimestamp(b?.publishedAt)?.seconds || 0;
      return bb - aa;
    });
}

export async function addContentBlueprint(uid, payload = {}) {
  if (!uid) throw new Error("Thiếu uid");

  const data = {
    name: String(payload.name || "").trim(),
    language: normalizeVideoLanguageKey(payload.language),
    videoType: normalizeVideoTypeKey(payload.videoType),
    hookTemplate: String(payload.hookTemplate || "").trim(),
    outlineTemplate: String(payload.outlineTemplate || "").trim(),
    shotListTemplate: String(payload.shotListTemplate || "").trim(),
    ctaTemplate: String(payload.ctaTemplate || "").trim(),
    active: payload.active !== false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  if (!data.name) throw new Error("Vui lòng nhập tên mẫu nội dung");
  return addDoc(colContentBlueprints(uid), data);
}

export async function updateContentBlueprint(uid, blueprintId, payload = {}) {
  const id = String(blueprintId || "").trim();
  if (!uid || !id) throw new Error("Thiếu mã mẫu nội dung");

  const data = {
    updatedAt: Timestamp.now(),
  };

  if (payload.name != null) data.name = String(payload.name || "").trim();
  if (payload.language != null) data.language = normalizeVideoLanguageKey(payload.language);
  if (payload.videoType != null) data.videoType = normalizeVideoTypeKey(payload.videoType);
  if (payload.hookTemplate != null) data.hookTemplate = String(payload.hookTemplate || "").trim();
  if (payload.outlineTemplate != null) data.outlineTemplate = String(payload.outlineTemplate || "").trim();
  if (payload.shotListTemplate != null) data.shotListTemplate = String(payload.shotListTemplate || "").trim();
  if (payload.ctaTemplate != null) data.ctaTemplate = String(payload.ctaTemplate || "").trim();
  if (payload.active != null) data.active = !!payload.active;

  await updateDoc(doc(db, `users/${uid}/contentBlueprints/${id}`), data);
  return true;
}

export async function listContentBlueprints(uid, filter = {}) {
  if (!uid) return [];
  const snap = await getDocs(query(colContentBlueprints(uid), orderBy("createdAt", "desc")));
  let list = mapDocs(snap);

  if (filter.language) {
    const lang = normalizeVideoLanguageKey(filter.language);
    list = list.filter((item) => normalizeVideoLanguageKey(item?.language) === lang);
  }
  if (filter.videoType) {
    const type = normalizeVideoTypeKey(filter.videoType);
    list = list.filter((item) => normalizeVideoTypeKey(item?.videoType) === type);
  }
  if (typeof filter.active === "boolean") {
    list = list.filter((item) => !!item?.active === filter.active);
  }

  return list;
}

export async function awardXp(uid, payload) {
  const action = String(payload.action || "").trim();
  const sourceId = String(payload.sourceId || "global").trim() || "global";
  const periodKey = String(payload.periodKey || "default").trim() || "default";

  if (!action) throw new Error("Thiếu hành động để cộng XP");

  const id = `${action}_${sourceId}_${periodKey}`;
  const ref = doc(db, `users/${uid}/xpLogs/${id}`);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    return { id, duplicated: true, ...snap.data() };
  }

  const data = {
    sourceType: payload.sourceType || "habit",
    sourceId,
    action,
    points: Number(payload.points || 0),
    periodKey,
    createdAt: Timestamp.now(),
  };

  await setDoc(ref, data);
  return { id, duplicated: false, ...data };
}

export async function listXpLogsByRange(uid, fromDate, toDate) {
  const fromTs = toTimestamp(fromDate);
  const toTs = toTimestamp(toDate);

  const snap = await getDocs(colXpLogs(uid));
  let list = mapDocs(snap);

  if (fromTs) {
    list = list.filter((x) => {
      const created = x.createdAt?.seconds ? x.createdAt.seconds : 0;
      return created >= fromTs.seconds;
    });
  }

  if (toTs) {
    list = list.filter((x) => {
      const created = x.createdAt?.seconds ? x.createdAt.seconds : 0;
      return created <= toTs.seconds;
    });
  }

  return list.sort((a, b) => {
    const aa = a.createdAt?.seconds || 0;
    const bb = b.createdAt?.seconds || 0;
    return bb - aa;
  });
}
