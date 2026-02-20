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
  limit,
  startAfter,
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
export const colXpLogs = (uid) => collection(db, `users/${uid}/xpLogs`);
export const colWeeklyReviews = (uid) => collection(db, `users/${uid}/weeklyReviews`);
export const colAiSuggestions = (uid) => collection(db, `users/${uid}/aiSuggestions`);
export const docUser = (uid) => doc(db, `users/${uid}`);

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

  return addDoc(colIncomes(uid), data);
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
  const data = {
    name: (payload.name || "").trim(),
    amount: Number(payload.amount || 0),
    account: payload.account,
    note: payload.note || "",
    updatedAt: Timestamp.now(),
  };
  if (payload.date) data.date = Timestamp.fromDate(new Date(payload.date));
  await updateDoc(ref, data);
  return true;
}

export async function deleteIncome(uid, id) {
  await deleteDoc(doc(db, `users/${uid}/incomes/${id}`));
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

  return addDoc(colTransfers(uid), data);
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

export async function balancesByAccountTotal(uid) {
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

  return Array.from(map.entries()).map(([account, balance]) => ({
    account,
    balance,
  }));
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

  return addDoc(colExpenses(uid), data);
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
  return true;
}

export async function deleteExpense(uid, id) {
  await deleteDoc(doc(db, `users/${uid}/expenses/${id}`));
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
