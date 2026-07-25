import { formatCurrency } from "../finance/finance.controller.js";
import { t } from "../../shared/constants/copy.vi.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function byId(id) {
  return document.getElementById(id);
}

export function sanitizeSavingsGoalDraft(payload = {}) {
  const name = String(payload?.name || "").trim();
  const targetAmount = Math.round(Number(payload?.targetAmount || 0));
  const currentAmount = Math.round(Number(payload?.currentAmount || 0));
  const note = String(payload?.note || "").trim();

  if (!name) throw new Error(t("savings.errName", "Vui lòng nhập tên mục tiêu."));
  if (!(targetAmount > 0)) throw new Error(t("savings.errTarget", "Mục tiêu phải lớn hơn 0."));
  if (currentAmount < 0) throw new Error(t("savings.errCurrent", "Tiến độ không được âm."));

  return { name, targetAmount, currentAmount, note };
}

export function buildSavingsGoalView(goal = {}) {
  const target = Math.max(0, Math.round(Number(goal?.targetAmount || 0)));
  const current = Math.max(0, Math.round(Number(goal?.currentAmount || 0)));
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return {
    id: String(goal?.id || "").trim(),
    name: String(goal?.name || "").trim(),
    note: String(goal?.note || "").trim(),
    targetAmount: target,
    currentAmount: current,
    targetText: formatCurrency(target),
    currentText: formatCurrency(current),
    pct,
    pctText: `${pct}%`,
  };
}

export function renderSavingsGoalsSection(goals = []) {
  const listEl = byId("savingsGoalsList");
  const summaryEl = byId("savingsGoalsSummary");
  const sectionEl = byId("homeSavingsSection");
  const items = (Array.isArray(goals) ? goals : []).map(buildSavingsGoalView);

  if (summaryEl) summaryEl.textContent = `${items.length} mục tiêu`;
  if (sectionEl) sectionEl.classList.toggle("is-empty", items.length === 0);
  if (!listEl) return;

  if (!items.length) {
    listEl.innerHTML = `
      <div class="home-empty-inline">
        <strong>${escapeHtml(t("savings.emptyTitle", "Chưa có mục tiêu"))}</strong>
      </div>
    `;
    return;
  }

  listEl.innerHTML = `
    <div class="savings-goals-list">
      ${items
        .map(
          (goal) => `
            <article class="savings-goal-card">
              <div class="savings-goal-head">
                <div class="savings-goal-copy">
                  <strong class="savings-goal-name u-ellipsis">${escapeHtml(goal.name)}</strong>
                  <span class="savings-goal-meta u-ellipsis">${escapeHtml(
                    `${goal.currentText} / ${goal.targetText}${goal.note ? ` · ${goal.note}` : ""}`
                  )}</span>
                </div>
                <strong class="savings-goal-pct">${escapeHtml(goal.pctText)}</strong>
              </div>
              <div class="savings-progress" aria-hidden="true">
                <span class="savings-progress-bar" style="width:${goal.pct}%"></span>
              </div>
              <div class="savings-goal-actions">
                <button
                  type="button"
                  class="btn btn-sm btn-outline-primary"
                  data-savings-action="edit"
                  data-savings-id="${escapeHtml(goal.id)}"
                >
                  ${escapeHtml(t("common.edit", "Sửa"))}
                </button>
                <button
                  type="button"
                  class="btn btn-sm btn-outline-danger"
                  data-savings-action="delete"
                  data-savings-id="${escapeHtml(goal.id)}"
                >
                  ${escapeHtml(t("common.delete", "Xóa"))}
                </button>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

export function renderSavingsGoalForm(draft = {}) {
  const isEdit = !!String(draft?.id || "").trim();
  const titleEl = byId("savingsGoalTitle");
  const hintEl = byId("savingsGoalHint");
  const saveBtn = byId("btnSaveSavingsGoal");

  if (titleEl) {
    titleEl.textContent = isEdit
      ? t("savings.editTitle", "Sửa mục tiêu")
      : t("savings.createTitle", "Thêm mục tiêu");
  }
  if (hintEl) {
    hintEl.textContent = isEdit
      ? t("savings.editHint", "Cập nhật tên, số mục tiêu hoặc số đã tiết kiệm.")
      : t("savings.createHint", "Đặt mục tiêu tiết kiệm và cập nhật tiến độ thủ công.");
  }
  if (saveBtn) {
    saveBtn.textContent = isEdit
      ? t("savings.saveChanges", "Lưu thay đổi")
      : t("savings.createAction", "Tạo mục tiêu");
  }

  if (byId("sgId")) byId("sgId").value = draft?.id || "";
  if (byId("sgName")) byId("sgName").value = draft?.name || "";
  if (byId("sgTargetAmount")) byId("sgTargetAmount").value = draft?.targetAmount ?? "";
  if (byId("sgCurrentAmount")) byId("sgCurrentAmount").value = draft?.currentAmount ?? 0;
  if (byId("sgNote")) byId("sgNote").value = draft?.note || "";
}

export function readSavingsForm() {
  return {
    id: byId("sgId")?.value || "",
    name: byId("sgName")?.value || "",
    targetAmount: byId("sgTargetAmount")?.value || "",
    currentAmount: byId("sgCurrentAmount")?.value || "0",
    note: byId("sgNote")?.value || "",
  };
}

export function clearSavingsForm() {
  renderSavingsGoalForm({
    id: "",
    name: "",
    targetAmount: "",
    currentAmount: 0,
    note: "",
  });
}
