import { t, formatTemplate } from "../../shared/constants/copy.vi.js";

let _eventsBound = false;

const byId = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setHtml(id, html = "") {
  const el = byId(id);
  if (el) el.innerHTML = html;
}

function setText(id, text = "") {
  const el = byId(id);
  if (el) el.textContent = text;
}

function setValue(id, value = "") {
  const el = byId(id);
  if (el) el.value = value;
}

function setDisabled(id, disabled = false) {
  const el = byId(id);
  if (el) el.disabled = !!disabled;
}

function toInputDate(value) {
  if (!value) return "";
  const d = value?.seconds ? new Date(Number(value.seconds) * 1000) : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function renderModeSwitch(vm = {}) {
  const mode = String(vm?.mode || "admin");
  const adminBtn = byId("classesModeAdmin");
  const presentationBtn = byId("classesModePresentation");
  if (adminBtn) {
    adminBtn.classList.toggle("active", mode !== "presentation");
    adminBtn.dataset.classesMode = "admin";
    adminBtn.textContent = t("classes.modes.admin", "Quản trị");
  }
  if (presentationBtn) {
    presentationBtn.classList.toggle("active", mode === "presentation");
    presentationBtn.dataset.classesMode = "presentation";
    presentationBtn.textContent = t("classes.modes.presentation", "Trình chiếu");
  }
  byId("classesAdminPane")?.classList.toggle("d-none", mode === "presentation");
  byId("classesPresentationPane")?.classList.toggle("d-none", mode !== "presentation");
}

function renderListTabs(vm = {}) {
  const listTab = String(vm?.listTab || "active");
  const activeCount = Number(vm?.classCounts?.active || 0);
  const completedCount = Number(vm?.classCounts?.completed || 0);
  const tabActive = byId("classesListTabActive");
  const tabCompleted = byId("classesListTabCompleted");
  if (tabActive) {
    tabActive.classList.toggle("active", listTab === "active");
    tabActive.textContent = `${t("classes.tabs.active", "Đang dạy")} (${activeCount})`;
  }
  if (tabCompleted) {
    tabCompleted.classList.toggle("active", listTab === "completed");
    tabCompleted.textContent = `${t("classes.tabs.completed", "Đã hoàn thành")} (${completedCount})`;
  }
}

function renderClassesList(vm = {}) {
  const classes = Array.isArray(vm?.classes) ? vm.classes : [];
  const selectedClassId = String(vm?.selectedClass?.id || "");
  if (!classes.length) {
    const isCompleted = String(vm?.listTab || "active") === "completed";
    setHtml(
      "classesList",
      `<div class="text-muted small">${escapeHtml(
        isCompleted
          ? t("classes.emptyCompleted", "Chưa có lớp nào hoàn thành.")
          : t("classes.emptyClasses", "Chưa có lớp học nào.")
      )}</div>`
    );
    return;
  }
  setHtml(
    "classesList",
    classes
      .map((item) => {
        const id = String(item?.id || "");
        const active = id === selectedClassId ? "is-active" : "";
        const done = Number(item?.doneSessions || 0);
        const total = Number(item?.totalSessions || 14);
        const remaining = Number(item?.remainingSessions || Math.max(0, total - done));
        return `
          <article class="class-item ${active}">
            <div class="class-item-head">
              <div>
                <div class="class-item-code">${escapeHtml(String(item?.code || "--"))}</div>
                <div class="class-item-title">${escapeHtml(String(item?.title || ""))}</div>
              </div>
              <span class="badge ${String(item?.status || "") === "completed" ? "text-bg-success" : "text-bg-light"}">
                ${escapeHtml(String(item?.statusLabel || ""))}
              </span>
            </div>
            <div class="class-item-meta">${escapeHtml(
              t("classes.progressLabel", "Đã dạy {{progress}} • Còn {{remaining}} buổi")
                .replace("{{progress}}", `${done}/${total}`)
                .replace("{{remaining}}", String(remaining))
            )}</div>
            <button class="btn btn-sm btn-outline-primary mt-2" data-class-select="${escapeHtml(id)}">
              ${escapeHtml(t("classes.actions.selectClass", "Chọn lớp"))}
            </button>
          </article>
        `;
      })
      .join("")
  );
}

function renderClassDetail(vm = {}) {
  const selectedClass = vm?.selectedClass || null;
  const detail = vm?.detail || {};
  if (!selectedClass) {
    setHtml("classDetail", `<div class="text-muted small">${escapeHtml(t("classes.emptyClassDetail", "Chọn một lớp để xem chi tiết."))}</div>`);
    return;
  }
  const done = Number(detail?.doneSessions || 0);
  const total = Number(detail?.totalSessions || 14);
  const remaining = Number(detail?.remainingSessions || 0);
  const showReopen = !!detail?.canReopen;
  setHtml(
    "classDetail",
    `
      <div class="class-detail-grid">
        <div class="d-flex align-items-center gap-2 flex-wrap">
          <strong>${escapeHtml(String(selectedClass?.code || "--"))}</strong>
          <span>•</span>
          <span>${escapeHtml(String(selectedClass?.title || ""))}</span>
          ${showReopen ? `<span class="badge text-bg-success">${escapeHtml(t("classes.badges.completed", "Hoàn thành"))}</span>` : ""}
        </div>
        <div class="small text-muted">${escapeHtml(t("classes.labels.startDate", "Bắt đầu"))}: ${escapeHtml(String(detail?.startDateText || "--"))}</div>
        <div class="small text-muted">${escapeHtml(t("classes.labels.schedule", "Lịch học"))}: ${escapeHtml(String(detail?.slotText || "--"))}</div>
        <div class="small text-muted">${escapeHtml(
          t("classes.progressLabel", "Đã dạy {{progress}} • Còn {{remaining}} buổi")
            .replace("{{progress}}", `${done}/${total}`)
            .replace("{{remaining}}", String(remaining))
        )}</div>
        ${
          showReopen
            ? `<div><button class="btn btn-sm btn-outline-primary" id="btnReopenClass">${escapeHtml(
                t("classes.actions.reopenClass", "Mở lại lớp")
              )}</button></div>`
            : ""
        }
      </div>
    `
  );
}

function renderStudents(vm = {}) {
  const students = Array.isArray(vm?.students) ? vm.students : [];
  const isReadOnly = !!vm?.isReadOnly;
  setDisabled("btnAddStudent", isReadOnly);
  if (byId("classStudentName")) byId("classStudentName").disabled = isReadOnly;

  if (!students.length) {
    setHtml("classStudentsList", `<div class="text-muted small">${escapeHtml(t("classes.emptyStudents", "Chưa có học sinh."))}</div>`);
    return;
  }

  setHtml(
    "classStudentsList",
    `
      <div class="table-responsive">
        <table class="table table-sm align-middle class-table">
          <thead>
            <tr>
              <th>${escapeHtml(t("classes.student.table.name", "Học sinh"))}</th>
              <th>${escapeHtml(t("classes.student.table.status", "Trạng thái"))}</th>
              <th>${escapeHtml(t("classes.student.table.scope", "Mốc áp dụng"))}</th>
              <th>${escapeHtml(t("classes.student.table.points", "Điểm"))}</th>
              <th>${escapeHtml(t("classes.student.table.stars", "Sao"))}</th>
              <th>${escapeHtml(t("classes.student.table.pickPercent", "% random"))}</th>
              <th class="text-end">${escapeHtml(t("classes.student.table.actions", "Thao tác"))}</th>
            </tr>
          </thead>
          <tbody>
            ${students
              .map((student) => {
                const id = String(student?.id || "");
                const active = !!student?.active;
                const range = student?.leftFromSessionNo
                  ? `Từ buổi ${student?.joinedFromSessionNo || 1} - trước buổi ${student?.leftFromSessionNo}`
                  : `Từ buổi ${student?.joinedFromSessionNo || 1}`;
                const action = isReadOnly
                  ? `<span class="small text-muted">${escapeHtml(t("classes.readOnly", "Chỉ xem"))}</span>`
                  : active
                  ? `<button class="btn btn-sm btn-outline-danger" data-student-remove="${escapeHtml(id)}">${escapeHtml(
                      t("classes.actions.removeStudent", "Ngừng từ buổi kế")
                    )}</button>`
                  : `<button class="btn btn-sm btn-outline-primary" data-student-reactivate="${escapeHtml(id)}">${escapeHtml(
                      t("classes.actions.reactivateStudent", "Kích hoạt lại")
                    )}</button>`;
                return `
                  <tr>
                    <td>${escapeHtml(String(student?.name || "(Chưa có tên)"))}</td>
                    <td><span class="badge ${active ? "text-bg-success" : "text-bg-secondary"}">${escapeHtml(
                      active ? t("classes.student.active", "Đang học") : t("classes.student.inactive", "Tạm ngừng")
                    )}</span></td>
                    <td class="small text-muted">${escapeHtml(range)}</td>
                    <td><span class="badge text-bg-primary">${Number(student?.pointsTotal || 0)}</span></td>
                    <td><span class="badge text-bg-warning">${Number(student?.starsBalance || 0)}⭐</span></td>
                    <td><input type="number" min="0" max="100" class="form-control form-control-sm class-pick-percent" data-student-pick-percent="${escapeHtml(
                      id
                    )}" value="${escapeHtml(String(Number(student?.pickPercent || 0)))}" ${isReadOnly || !active ? "disabled" : ""} /></td>
                    <td class="text-end">${action}</td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `
  );
}

function renderSessions(vm = {}) {
  const sessions = Array.isArray(vm?.sessions) ? vm.sessions : [];
  const selectedSessionId = String(vm?.selectedSessionId || "");
  if (!sessions.length) {
    setHtml("classSessionsList", `<div class="text-muted small">${escapeHtml(t("classes.emptySessions", "Chưa có lịch buổi học."))}</div>`);
    return;
  }
  setHtml(
    "classSessionsList",
    sessions
      .map((session) => {
        const id = String(session?.id || "");
        const moved = session?.isRescheduled
          ? `<div class="small text-warning-emphasis mt-1">${escapeHtml(
              t("classes.sessionRescheduledFrom", "Đã dời từ {{date}}").replace("{{date}}", String(session?.rescheduledFromLabel || "--"))
            )}</div>`
          : "";
        return `
          <button class="class-session-item ${id === selectedSessionId ? "is-active" : ""}" data-session-select="${escapeHtml(id)}">
            <div class="class-session-head">
              <strong>${escapeHtml(t("classes.labels.session", "Buổi"))} ${Number(session?.sessionNo || 0)}</strong>
              <span class="badge text-bg-light">${escapeHtml(String(session?.statusLabel || ""))}</span>
            </div>
            <div class="small text-muted">${escapeHtml(String(session?.phaseLabel || ""))}</div>
            <div class="small">${escapeHtml(String(session?.scheduleLabel || "--"))}</div>
            ${moved}
          </button>
        `;
      })
      .join("")
  );
}

function renderSessionReviewEditor(vm = {}) {
  const session = vm?.selectedSession || null;
  const reviewRows = Array.isArray(vm?.reviewRows) ? vm.reviewRows : [];
  const reviewOptions = Array.isArray(vm?.reviewStatusOptions) ? vm.reviewStatusOptions : [];
  const isReadOnly = !!vm?.isReadOnly;
  const canShift = !!session && String(session?.status || "planned") === "planned" && !isReadOnly;
  setDisabled("sessionTeachingPlan", !session || isReadOnly);
  setDisabled("sessionTeachingResult", !session || isReadOnly);
  setDisabled("sessionStatus", !session || isReadOnly);
  setDisabled("sessionRescheduleReason", !canShift);
  setDisabled("btnShiftSessionNextWeek", !canShift);
  setDisabled("btnSaveSessionReview", !session || isReadOnly);

  if (!session) {
    setHtml("sessionReviewTable", `<div class="text-muted small">${escapeHtml(t("classes.emptySessionEditor", "Chọn buổi học để nhập ghi chú."))}</div>`);
    setValue("sessionId", "");
    return;
  }

  setValue("sessionId", String(session?.id || ""));
  setValue("sessionStatus", String(session?.status || "planned"));
  setValue("sessionTeachingPlan", String(session?.teachingPlan || ""));
  setValue("sessionTeachingResult", String(session?.teachingResultNote || ""));

  const rowsHtml = reviewRows.length
    ? reviewRows
        .map((row) => {
          const options = reviewOptions
            .map((opt) => `<option value="${escapeHtml(opt.value)}" ${opt.value === String(row?.reviewStatus || "normal") ? "selected" : ""}>${escapeHtml(opt.label)}</option>`)
            .join("");
          const disabled = row?.applicable && !isReadOnly ? "" : "disabled";
          return `
            <tr data-student-id="${escapeHtml(String(row?.id || ""))}" data-applicable="${row?.applicable ? "1" : "0"}">
              <td>${escapeHtml(String(row?.name || ""))}</td>
              <td><select class="form-select form-select-sm class-review-status" ${disabled}>${options}</select></td>
              <td><input class="form-control form-control-sm class-review-note" value="${escapeHtml(String(row?.reviewNote || ""))}" ${disabled} /></td>
            </tr>
          `;
        })
        .join("")
    : `<tr><td colspan="3" class="text-muted small">${escapeHtml(t("classes.emptyStudentsForSession", "Chưa có học sinh áp dụng cho buổi này."))}</td></tr>`;

  setHtml(
    "sessionReviewTable",
    `<div class="table-responsive"><table class="table table-sm align-middle class-table"><thead><tr><th>${escapeHtml(
      t("classes.student.table.name", "Học sinh")
    )}</th><th>${escapeHtml(t("classes.review.table.status", "Đánh giá"))}</th><th>${escapeHtml(
      t("classes.review.table.note", "Ghi chú")
    )}</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`
  );
}

function renderClassForm(vm = {}) {
  const selectedClass = vm?.selectedClass || null;
  const isReadOnly = !!vm?.isReadOnly && !!selectedClass;
  setValue("classId", String(selectedClass?.id || ""));
  setValue("classCode", String(selectedClass?.code || ""));
  setValue("classTitle", String(selectedClass?.title || ""));
  setValue("classStartDate", selectedClass?.startDate ? toInputDate(selectedClass.startDate) : "");
  setValue("classStatus", String(selectedClass?.status || "active"));
  setValue("classDescription", String(selectedClass?.description || ""));
  setValue("classSlots", Array.isArray(selectedClass?.slots) ? selectedClass.slots.map((s) => `${s.weekday} ${s.startTime}`).join("\n") : "");
  ["classCode", "classTitle", "classStartDate", "classStatus", "classDescription", "classSlots"].forEach((id) =>
    setDisabled(id, isReadOnly)
  );
  setDisabled("btnSaveClass", !selectedClass || isReadOnly);
  setDisabled("btnDeleteClass", !selectedClass || isReadOnly);
  setText(
    "classesFormMode",
    selectedClass
      ? isReadOnly
        ? t("classes.formModeRead", "Đang xem lớp đã hoàn thành")
        : t("classes.formModeEdit", "Đang sửa lớp đã chọn")
      : t("classes.formModeCreate", "Tạo lớp mới")
  );
}

function renderPresentation(vm = {}) {
  const presentation = vm?.presentation || {};
  const tabs = Array.isArray(presentation?.tabs) ? presentation.tabs : [];
  const selectedClassId = String(presentation?.selectedClass?.id || vm?.selectedClass?.id || "");
  const selectedClassName =
    String(presentation?.selectedClass?.title || "").trim() || String(presentation?.selectedClass?.code || "").trim();
  setText(
    "classesPresentationTitle",
    selectedClassName
      ? formatTemplate(t("classes.presentation.titleWithClass", "Trình chiếu lớp: {{name}}"), { name: selectedClassName })
      : t("classes.presentation.title", "Trình chiếu theo lớp")
  );
  setText("classesPresentationSubtitle", t("classes.presentation.subtitle", "Chỉ hiển thị phần cần dùng trong lúc dạy."));

  setHtml(
    "classesPresentationClassTabs",
    tabs.length
      ? tabs
          .map(
            (item) => `<button class="btn btn-outline-primary btn-sm ${
              String(item?.id || "") === selectedClassId ? "active" : ""
            }" data-presentation-class="${escapeHtml(String(item?.id || ""))}">${escapeHtml(String(item?.code || "--"))}</button>`
          )
          .join("")
      : `<div class="text-muted small">${escapeHtml(t("classes.presentation.emptyClasses", "Chưa có lớp đang dạy."))}</div>`
  );

  const students = Array.isArray(presentation?.students) ? presentation.students : [];
  setHtml(
    "classLeaderboard",
    students.length
      ? `<div class="table-responsive"><table class="table table-sm align-middle class-table"><thead><tr><th>#</th><th>${escapeHtml(
          t("classes.student.table.name", "Học sinh")
        )}</th><th>${escapeHtml(t("classes.student.table.points", "Điểm"))}</th><th>${escapeHtml(
          t("classes.student.table.stars", "Sao")
        )}</th></tr></thead><tbody>${(presentation?.leaderboard || [])
          .map(
            (s, idx) =>
              `<tr><td>${idx + 1}</td><td>${escapeHtml(String(s?.name || ""))}</td><td>${Number(
                s?.pointsTotal || 0
              )}</td><td>${Number(s?.starsBalance || 0)}⭐</td></tr>`
          )
          .join("")}</tbody></table></div>`
      : `<div class="text-muted small">${escapeHtml(t("classes.presentation.emptyStudents", "Lớp chưa có học sinh đang học."))}</div>`
  );

  setHtml(
    "classPresentationStudents",
    students.length
      ? `<div class="class-present-students">${students
          .map(
            (s) => `<article class="class-present-student">
              <div class="class-present-student-main">
                <strong>${escapeHtml(String(s?.name || ""))}</strong>
                <div class="small text-muted">${escapeHtml(
                  formatTemplate(t("classes.presentation.pickPercentLabel", "Xác suất gọi: {{percent}}%"), {
                    percent: Number(s?.pickPercent || 0),
                  })
                )}</div>
              </div>
              <div class="class-present-actions">
                <button class="btn btn-sm btn-outline-primary" data-student-star-add="${escapeHtml(
                  String(s?.id || "")
                )}">${escapeHtml(t("classes.actions.awardStar", "+⭐"))}</button>
                <button class="btn btn-sm btn-outline-secondary" data-student-redeem="${escapeHtml(
                  String(s?.id || "")
                )}">${escapeHtml(t("classes.actions.redeemStars", "Đã sử dụng"))}</button>
              </div>
            </article>`
          )
          .join("")}</div>`
      : ""
  );

  const history = Array.isArray(presentation?.randomHistory) ? presentation.randomHistory : [];
  const warning = presentation?.percentNormalized
    ? `<div class="alert alert-warning py-2 px-3 mb-2 small">${escapeHtml(
        formatTemplate(
          t("classes.random.normalizedWarning", "Tổng % hiện tại là {{total}}. Hệ thống đang chuẩn hóa theo tổng hiện tại."),
          { total: Number(presentation?.totalPickPercent || 0).toFixed(2).replace(/\.00$/, "") }
        )
      )}</div>`
    : "";
  const result = presentation?.randomResult?.name
    ? `<div class="class-random-result"><div class="small text-muted">${escapeHtml(
        t("classes.random.resultTitle", "Kết quả vừa chọn")
      )}</div><strong>${escapeHtml(String(presentation.randomResult.name || ""))}</strong></div>`
    : `<div class="text-muted small">${escapeHtml(t("classes.random.resultEmpty", "Chưa random lần nào."))}</div>`;
  const historyHtml = history.length
    ? `<ul class="class-random-history">${history
        .map((item) => `<li><span>${escapeHtml(String(item?.name || ""))}</span><small>${escapeHtml(String(item?.atLabel || ""))}</small></li>`)
        .join("")}</ul>`
    : `<div class="text-muted small">${escapeHtml(t("classes.random.historyEmpty", "Chưa có lịch sử random."))}</div>`;
  setHtml(
    "classRandomPanel",
    `${warning}<button class="btn btn-primary w-100 mb-2" id="btnClassRandomPick" ${
      presentation?.canRandom ? "" : "disabled"
    }>${escapeHtml(t("classes.random.pickButton", "Random tên"))}</button>${result}<div class="mt-2"><div class="small text-muted mb-1">${escapeHtml(
      t("classes.random.historyTitle", "5 lượt gần nhất")
    )}</div>${historyHtml}</div>`
  );
}

export function renderClassesPage(vm = {}) {
  renderModeSwitch(vm);
  if (vm?.showAdmin) {
    renderListTabs(vm);
    renderClassesList(vm);
    renderClassDetail(vm);
    renderStudents(vm);
    renderSessions(vm);
    renderSessionReviewEditor(vm);
    renderClassForm(vm);
    const filteredCount = Array.isArray(vm?.classes) ? vm.classes.length : 0;
    const activeCount = Number(vm?.classCounts?.active || 0);
    const completedCount = Number(vm?.classCounts?.completed || 0);
    setText("classesCountBadge", `${filteredCount} lớp`);
  } else {
    const activeCount = Number(vm?.classCounts?.active || 0);
    setText("classesCountBadge", `${activeCount} lớp đang dạy`);
  }
  if (vm?.showPresentation) renderPresentation(vm);
}

function readClassFormPayload() {
  return {
    classId: String(byId("classId")?.value || "").trim(),
    code: String(byId("classCode")?.value || "").trim(),
    title: String(byId("classTitle")?.value || "").trim(),
    startDate: String(byId("classStartDate")?.value || "").trim(),
    slotsText: String(byId("classSlots")?.value || "").trim(),
    description: String(byId("classDescription")?.value || "").trim(),
    status: String(byId("classStatus")?.value || "active").trim() || "active",
  };
}

function readSessionFormPayload() {
  const reviews = {};
  document.querySelectorAll("#sessionReviewTable tbody tr[data-student-id]").forEach((row) => {
    const studentId = String(row?.dataset?.studentId || "").trim();
    const applicable = String(row?.dataset?.applicable || "1") === "1";
    if (!studentId || !applicable) return;
    reviews[studentId] = {
      status: String(row.querySelector(".class-review-status")?.value || "normal"),
      note: String(row.querySelector(".class-review-note")?.value || "").trim(),
    };
  });
  return {
    sessionId: String(byId("sessionId")?.value || "").trim(),
    status: String(byId("sessionStatus")?.value || "planned").trim() || "planned",
    teachingPlan: String(byId("sessionTeachingPlan")?.value || "").trim(),
    teachingResultNote: String(byId("sessionTeachingResult")?.value || "").trim(),
    rescheduleReason: String(byId("sessionRescheduleReason")?.value || "").trim(),
    reviews,
  };
}

function runHandler(handler, ...args) {
  if (typeof handler !== "function") return;
  Promise.resolve(handler(...args)).catch((err) => console.error("classes handler error", err));
}

export function bindClassesEvents(handlers = {}) {
  if (_eventsBound) return;
  const root = byId("classes");
  if (!root) return;
  _eventsBound = true;

  root.addEventListener("click", (event) => {
    const target = event.target;
    const modeBtn = target.closest("[data-classes-mode]");
    if (modeBtn?.dataset?.classesMode) return runHandler(handlers.onChangeMode, modeBtn.dataset.classesMode);
    const ptClass = target.closest("[data-presentation-class]");
    if (ptClass?.dataset?.presentationClass != null) return runHandler(handlers.onSelectPresentationClass, ptClass.dataset.presentationClass);
    const tabBtn = target.closest("[data-class-tab]");
    if (tabBtn?.dataset?.classTab) return runHandler(handlers.onChangeListTab, tabBtn.dataset.classTab);
    const classBtn = target.closest("[data-class-select]");
    if (classBtn?.dataset?.classSelect != null) return runHandler(handlers.onSelectClass, classBtn.dataset.classSelect);
    const sessionBtn = target.closest("[data-session-select]");
    if (sessionBtn?.dataset?.sessionSelect != null) return runHandler(handlers.onSelectSession, sessionBtn.dataset.sessionSelect);
    const removeBtn = target.closest("[data-student-remove]");
    if (removeBtn?.dataset?.studentRemove) return runHandler(handlers.onRemoveStudent, removeBtn.dataset.studentRemove);
    const reactivateBtn = target.closest("[data-student-reactivate]");
    if (reactivateBtn?.dataset?.studentReactivate) return runHandler(handlers.onReactivateStudent, reactivateBtn.dataset.studentReactivate);
    const starBtn = target.closest("[data-student-star-add]");
    if (starBtn?.dataset?.studentStarAdd) return runHandler(handlers.onAwardStar, starBtn.dataset.studentStarAdd);
    const redeemBtn = target.closest("[data-student-redeem]");
    if (redeemBtn?.dataset?.studentRedeem) return runHandler(handlers.onRedeemStars, redeemBtn.dataset.studentRedeem);
    if (target.closest("#btnClassRandomPick")) return runHandler(handlers.onRandomPick);
    if (target.closest("#btnReopenClass")) return runHandler(handlers.onReopenClass);
    if (target.closest("#btnClassReset")) return runHandler(handlers.onResetClassForm);
    if (target.closest("#btnAddClass")) return runHandler(handlers.onAddClass, readClassFormPayload());
    if (target.closest("#btnSaveClass")) return runHandler(handlers.onSaveClass, readClassFormPayload());
    if (target.closest("#btnDeleteClass")) return runHandler(handlers.onDeleteClass, readClassFormPayload());
    if (target.closest("#btnAddStudent")) return runHandler(handlers.onAddStudent, { name: String(byId("classStudentName")?.value || "").trim() });
    if (target.closest("#btnShiftSessionNextWeek")) return runHandler(handlers.onShiftSessionNextWeek, readSessionFormPayload());
    if (target.closest("#btnSaveSessionReview")) return runHandler(handlers.onSaveSession, readSessionFormPayload());
  });

  root.addEventListener("change", (event) => {
    const input = event.target.closest("[data-student-pick-percent]");
    if (!input) return;
    runHandler(
      handlers.onUpdateStudentPickPercent,
      String(input.dataset.studentPickPercent || "").trim(),
      Number(input.value || 0)
    );
  });

  byId("classStudentName")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    runHandler(handlers.onAddStudent, { name: String(byId("classStudentName")?.value || "").trim() });
  });
}
