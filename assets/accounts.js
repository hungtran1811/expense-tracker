// assets/accounts.js
// Xử lý phần SỐ DƯ tài khoản trên Dashboard

import { balancesByAccountTotal } from "./db.js";
import { renderBalancesList } from "./ui.js";

/**
 * Tính & render SỐ DƯ theo từng tài khoản
 * - uid: user.uid hiện tại
 * - không reset theo tháng, luôn là số dư tích luỹ toàn bộ lịch sử
 */
export async function refreshBalances(uid) {
  if (!uid) return;

  const items = await balancesByAccountTotal(uid);

  const wrap = document.getElementById("balanceList");
  if (wrap && typeof renderBalancesList === "function") {
    renderBalancesList(wrap, items);
  }
}
