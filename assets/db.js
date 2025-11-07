import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
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
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

import { firebaseConfig } from "./firebaseConfig.js";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Collections helpers
export const colExpenses = (uid) => collection(db, `users/${uid}/expenses`);
export const colAccounts = (uid) => collection(db, `users/${uid}/accounts`);
export const colIncomes = (uid) => collection(db, `users/${uid}/incomes`);
export const colTransfers = (uid) => collection(db, `users/${uid}/transfers`);

export const docUser = (uid) => doc(db, `users/${uid}`);

// Parse 'YYYY-MM' to start/end Timestamps safely
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

// Thêm THU NHẬP
export async function addIncome(uid, payload) {
  const data = {
    name: payload.name,
    amount: Number(payload.amount || 0),
    date: payload.date
      ? Timestamp.fromDate(new Date(payload.date))
      : Timestamp.now(),
    account: payload.account,
    note: payload.note || "",
    createdAt: Timestamp.now(),
  };
  if (!data.name || !data.account) throw new Error("Thiếu tên hoặc tài khoản");
  return addDoc(colIncomes(uid), data);
}

// Lấy danh sách thu nhập theo tháng
export async function listIncomesByMonth(uid, ym) {
  const rng = ymToRange(ym);
  if (!rng) throw new Error("Month filter không hợp lệ (YYYY-MM)");
  const qy = query(
    colIncomes(uid),
    where("date", ">=", rng.start),
    where("date", "<", rng.end),
    orderBy("date", "desc")
  );
  const snap = await getDocs(qy);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getIncome(uid, id) {
  const ref = doc(db, `users/${uid}/incomes/${id}`);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// Cập nhật Thu nhập
export async function updateIncome(uid, id, payload) {
  const ref = doc(db, `users/${uid}/incomes/${id}`);
  const data = {
    name: payload.name?.trim(),
    amount: Number(payload.amount || 0),
    account: payload.account,
    note: payload.note || "",
    updatedAt: Timestamp.now(),
  };
  // chỉ cập nhật ngày nếu người dùng chọn
  if (payload.date) {
    data.date = Timestamp.fromDate(new Date(payload.date));
  }
  await updateDoc(ref, data);
  return true;
}

// Xoá Thu nhập
export async function deleteIncome(uid, id) {
  const ref = doc(db, `users/${uid}/incomes/${id}`);
  await deleteDoc(ref);
  return true;
}

export async function addTransfer(uid, payload) {
  const data = {
    from: payload.from, // tên tài khoản
    to: payload.to,
    amount: Number(payload.amount || 0),
    date: payload.date
      ? Timestamp.fromDate(new Date(payload.date))
      : Timestamp.now(),
    note: payload.note || "",
    createdAt: Timestamp.now(),
  };
  if (!data.from || !data.to) throw new Error("Chọn đầy đủ tài khoản");
  if (data.from === data.to)
    throw new Error("Tài khoản nguồn và đích phải khác nhau");
  if (data.amount <= 0) throw new Error("Số tiền phải > 0");
  return addDoc(colTransfers(uid), data);
}

export async function listTransfersByMonth(uid, ym) {
  const rng = ymToRange(ym);
  if (!rng) throw new Error("Month filter không hợp lệ (YYYY-MM)");
  const qy = query(
    colTransfers(uid),
    where("date", ">=", rng.start),
    where("date", "<", rng.end),
    orderBy("date", "desc")
  );
  const snap = await getDocs(qy);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Tính SỐ DƯ theo tài khoản = Thu nhập - Chi tiêu (trong tháng)
export async function balancesByAccount(uid, ym) {
  const [incomes, expenses, transfers] = await Promise.all([
    listIncomesByMonth(uid, ym),
    listExpensesByMonth(uid, ym),
    listTransfersByMonth(uid, ym),
  ]);

  const map = new Map();

  // + Thu nhập
  incomes.forEach((i) => {
    const acc = i.account || "Khác";
    map.set(acc, (map.get(acc) || 0) + Number(i.amount || 0));
  });

  // - Chi tiêu
  expenses.forEach((x) => {
    const acc = x.account || "Khác";
    map.set(acc, (map.get(acc) || 0) - Number(x.amount || 0));
  });

  // Transfer: from (-), to (+)
  transfers.forEach((t) => {
    const from = t.from || "Khác";
    const to = t.to || "Khác";
    const amt = Number(t.amount || 0);
    map.set(from, (map.get(from) || 0) - amt);
    map.set(to, (map.get(to) || 0) + amt);
  });

  return Array.from(map.entries()).map(([account, balance]) => ({
    account,
    balance,
  }));
}

// Profile
export async function saveProfile(uid, data) {
  await setDoc(
    docUser(uid),
    { displayName: data.displayName || "", updatedAt: Timestamp.now() },
    { merge: true }
  );
}
export async function readProfile(uid) {
  const snap = await getDoc(docUser(uid));
  return snap.exists() ? snap.data() : null;
}

// ===== Expenses: ADD (REPLACE THIS FUNCTION) =====
export async function addExpense(uid, payload) {
  // Parse yyyy-mm-dd thành địa phương (tránh lệch múi giờ)
  function parseLocalDate(ymd) {
    if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
    const [y, m, d] = ymd.split("-").map(Number);
    // set 12:00 để tuyệt đối an toàn với DST/UTC shift
    return new Date(y, m - 1, d, 12, 0, 0);
  }

  const name = (payload.name || "").trim();
  const amount = Number(payload.amount || 0);
  const dateStr = payload.date || "";
  const dateObj = parseLocalDate(dateStr) || new Date(); // fallback: now
  const category = payload.category || "Khác";
  const account = payload.account || "Khác";
  const note = payload.note || "";

  if (!name) throw new Error("Vui lòng nhập tên khoản chi");
  if (!(amount > 0)) throw new Error("Số tiền phải > 0");
  if (!(dateObj instanceof Date) || isNaN(dateObj))
    throw new Error("Ngày không hợp lệ");

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
  if (!rng) throw new Error("Month filter không hợp lệ (YYYY-MM)");
  const qy = query(
    colExpenses(uid),
    where("date", ">=", rng.start),
    where("date", "<", rng.end),
    orderBy("date", "desc")
  );
  const snap = await getDocs(qy);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getExpense(uid, id) {
  const ref = doc(db, `users/${uid}/expenses/${id}`);
  const s = await getDoc(ref);
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export async function updateExpense(uid, id, payload) {
  const ref = doc(db, `users/${uid}/expenses/${id}`);
  const data = {
    name: payload.name?.trim(),
    amount: Number(payload.amount || 0),
    category: payload.category,
    account: payload.account,
    note: payload.note || "",
    updatedAt: Timestamp.now(),
  };
  if (payload.date) data.date = Timestamp.fromDate(new Date(payload.date)); // chỉ set khi có
  await updateDoc(ref, data);
  return true;
}

export async function deleteExpense(uid, id) {
  await deleteDoc(doc(db, `users/${uid}/expenses/${id}`));
  return true;
}

// Lấy danh sách tài khoản (để fill dropdown + hiển thị bảng)
export async function listAccounts(uid) {
  const snap = await getDocs(query(colAccounts(uid), orderBy("name")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Thêm tài khoản mới; nếu isDefault=true thì bỏ mặc định ở tài khoản khác
export async function addAccount(uid, data) {
  const payload = {
    name: (data.name || "").trim(),
    type: data.type || "bank", // bank | ewallet | other
    isDefault: !!data.isDefault,
    createdAt: Timestamp.now(),
  };
  if (!payload.name) throw new Error("Vui lòng nhập tên tài khoản");

  const ref = await addDoc(colAccounts(uid), payload);

  // Đảm bảo chỉ có 1 tài khoản mặc định
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
  if (name != null) data.name = name.trim();
  if (type) data.type = type;
  if (typeof isDefault === "boolean") data.isDefault = isDefault;
  await updateDoc(ref, data);

  // nếu đặt mặc định, bỏ mặc định các tài khoản khác
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

// helper cập nhật hàng loạt theo trường 'account' | 'from' | 'to'
async function reassignCollectionByField(colRef, field, fromValue, toValue) {
  const CHUNK = 300; // an toàn quota
  let last = null,
    total = 0;
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
      total++;
    }
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < CHUNK) break;
  }
  return total;
}

export async function deleteAccountWithReassign(uid, id, targetName) {
  // lấy tên tài khoản cần xoá
  const ref = doc(db, `users/${uid}/accounts/${id}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Account not found");

  const accName = snap.data().name;
  if (snap.data().isDefault) {
    // vẫn cho xoá nếu còn tài khoản khác và target khác; mặc định sẽ chuyển đi
  }

  // không cho xoá nếu chỉ còn 1 tài khoản
  const all = await getDocs(collection(db, `users/${uid}/accounts`));
  if (all.size <= 1)
    throw new Error(
      "Cần tối thiểu 1 tài khoản. Không thể xoá tài khoản cuối cùng."
    );

  if (!targetName || targetName === accName)
    throw new Error("Hãy chọn tài khoản khác để chuyển giao");

  // chuyển giao trong 3 collection
  const usersPath = `users/${uid}`;
  await reassignCollectionByField(
    collection(db, `${usersPath}/expenses`),
    "account",
    accName,
    targetName
  );
  await reassignCollectionByField(
    collection(db, `${usersPath}/incomes`),
    "account",
    accName,
    targetName
  );
  await reassignCollectionByField(
    collection(db, `${usersPath}/transfers`),
    "from",
    accName,
    targetName
  );
  await reassignCollectionByField(
    collection(db, `${usersPath}/transfers`),
    "to",
    accName,
    targetName
  );

  // xoá account
  await deleteDoc(ref);
  return true;
}
