import { formatTemplate, t } from "../../shared/constants/copy.vi.js";
import { CLASSES_ADMIN_TAB, CLASSES_MODE, CLASSES_SESSION_FILTER } from "./classes.controller.js";

function byId(id) {
  return document.getElementById(id);
}

function safeText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toDateLabel(value) {
  if (!value) return "";
  const dt = value instanceof Date ? value : new Date(value?.seconds ? value.seconds * 1000 : value);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("vi-VN");
}

function toDateTimeLabel(value) {
  if (!value) return "";
  const dt = value instanceof Date ? value : new Date(value?.seconds ? value.seconds * 1000 : value);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleString("vi-VN", {
    hour12: false,
  });
}

function weekdayLabel(value = 1) {
  const weekday = Number(value || 1);
  if (weekday === 7) return "Chủ nhật";
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 6) return "Thứ 2";
  return `Thứ ${weekday + 1}`;
}

function setText(id, value = "") {
  const el = byId(id);
  if (el) el.textContent = value;
}

function setHtml(id, html = "") {
  const el = byId(id);
  if (el) el.innerHTML = html;
}

function setValue(id, value = "") {
  const el = byId(id);
  if (el) el.value = value;
}

function setActiveButton(id, isActive) {
  const el = byId(id);
  if (!el) return;
  el.classList.toggle("active", !!isActive);
  el.classList.toggle("btn-primary", !!isActive);
  el.classList.toggle("btn-outline-primary", !isActive);
}

function setVisible(id, visible) {
  const el = byId(id);
  if (!el) return;
  el.classList.toggle("d-none", !visible);
}

function renderModeSwitch(mode = CLASSES_MODE.ADMIN) {
  setActiveButton("classesModeAdmin", mode === CLASSES_MODE.ADMIN);
  setActiveButton("classesModePresentation", mode === CLASSES_MODE.PRESENTATION);
  setVisible("classesAdminPane", mode === CLASSES_MODE.ADMIN);
  setVisible("classesPresentationPane", mode === CLASSES_MODE.PRESENTATION);
}

function renderAdminTabs(tab = CLASSES_ADMIN_TAB.OVERVIEW) {
  const tabs = [
    ["classesTabOverview", "classesPaneOverview", CLASSES_ADMIN_TAB.OVERVIEW],
    ["classesTabSessions", "classesPaneSessions", CLASSES_ADMIN_TAB.SESSIONS],
    ["classesTabStudents", "classesPaneStudents", CLASSES_ADMIN_TAB.STUDENTS],
    ["classesTabCreate", "classesPaneCreate", CLASSES_ADMIN_TAB.CREATE],
  ];
  tabs.forEach(([tabId, paneId, value]) => {
    const isActive = tab === value;
    const tabEl = byId(tabId);
    if (tabEl) {
      setActiveButton(tabId, isActive);
      tabEl.classList.toggle("active", isActive);
      tabEl.setAttribute("aria-selected", isActive ? "true" : "false");
    }
    setVisible(paneId, isActive);
  });
}

function renderClassList(vm = {}) {
  const active = Array.isArray(vm?.classesActive) ? vm.classesActive : [];
  const completed = Array.isArray(vm?.classesCompleted) ? vm.classesCompleted : [];

  setText(
    "classesListSummary",
    formatTemplate("Đang dạy {{active}} • Đã hoàn thành {{completed}}", {
      active: active.length,
      completed: completed.length,
    })
  );

  const renderItem = (item, type = "active") => {
    const id = safeText(item?.id);
    const selected = id && id === safeText(vm?.selectedClassId) ? "selected" : "";
    const statusLabel = type === "completed" ? "Đã hoàn thành" : "Đang dạy";
    const subtitle = [safeText(item?.subject), safeText(item?.level)].filter(Boolean).join(" • ");
    const progress = formatTemplate("Đã dạy {{done}}/{{total}} • Còn {{remaining}} buổi", {
      done: Number(item?.doneSessions || 0),
      total: Number(item?.totalSessions || 14),
      remaining: Number(item?.remainingSessions || 0),
    });

    return `
      <button class="classes-list-item ${selected}" type="button" data-class-select="${escapeHtml(id)}">
        <div class="classes-list-head">
          <strong>${escapeHtml(safeText(item?.code, "(Không mã)"))}</strong>
          <span class="badge text-bg-light">${statusLabel}</span>
        </div>
        <div class="classes-list-title">${escapeHtml(safeText(item?.title, "(Chưa đặt tên lớp)"))}</div>
        <div class="classes-list-sub">${escapeHtml(subtitle)}</div>
        <div class="classes-list-meta">${escapeHtml(progress)}</div>
      </button>
    `;
  };

  const html = `
    <div class="classes-list-block">
      <div class="classes-list-group-title">Đang dạy</div>
      ${
        active.length
          ? active.map((item) => renderItem(item, "active")).join("")
          : '<div class="text-muted small">Chưa có lớp đang dạy.</div>'
      }
    </div>
    <div class="classes-list-block mt-3">
      <div class="classes-list-group-title">Đã hoàn thành</div>
      ${
        completed.length
          ? completed.map((item) => renderItem(item, "completed")).join("")
          : '<div class="text-muted small">Chưa có lớp hoàn thành.</div>'
      }
    </div>
  `;
  setHtml("classesList", html);
}

function renderClassDetail(vm = {}) {
  const item = vm?.selectedClass || null;
  if (!item) {
    setText("classDetailEmpty", "Chọn một lớp để xem và chỉnh sửa.");
    setVisible("classDetailFormWrap", false);
    setVisible("classDetailEmpty", true);
    return;
  }

  setVisible("classDetailFormWrap", true);
  setVisible("classDetailEmpty", false);
  setText(
    "classDetailProgress",
    formatTemplate("Đã dạy {{done}}/{{total}} • Còn {{remaining}} buổi", {
      done: Number(item?.doneSessions || 0),
      total: Number(item?.totalSessions || 14),
      remaining: Number(item?.remainingSessions || 0),
    })
  );
  setValue("classId", safeText(item?.id));
  setValue("classCode", safeText(item?.code));
  setValue("classSubject", safeText(item?.subject));
  setValue("classLevel", safeText(item?.level));
  setValue(
    "classStartDate",
    safeText(item?.startDate?.toDate ? item.startDate.toDate().toISOString().slice(0, 10) : "")
  );
  setValue("classWeekday", String(item?.weekday || 1));
  setValue("classStartTime", safeText(item?.startTime, "08:00"));
  setValue("classStatus", safeText(item?.status, "active"));
  setValue("classDescription", safeText(item?.description));
}

function renderSessionFilter(filter = CLASSES_SESSION_FILTER.UPCOMING) {
  setActiveButton("classesSessionFilterUpcoming", filter === CLASSES_SESSION_FILTER.UPCOMING);
  setActiveButton("classesSessionFilterPast", filter === CLASSES_SESSION_FILTER.PAST);
  setActiveButton("classesSessionFilterAll", filter === CLASSES_SESSION_FILTER.ALL);
}

function renderSessionsList(vm = {}) {
  const sessions = Array.isArray(vm?.visibleSessions) ? vm.visibleSessions : [];
  const selectedSessionId = safeText(vm?.selectedSessionId);

  if (!sessions.length) {
    setHtml("classSessionsList", '<div class="text-muted small">Không có buổi học trong bộ lọc hiện tại.</div>');
    return;
  }

  const html = sessions
    .map((session) => {
      const sid = safeText(session?.id);
      const selected = sid === selectedSessionId ? "selected" : "";
      const dateLabel = toDateLabel(session?.scheduledAt) || session?.sessionDate || "--/--/----";
      const status = safeText(session?.status, "planned");
      const statusLabel = status === "done" ? "Đã dạy" : status === "cancelled" ? "Hoãn" : "Kế hoạch";
      return `
        <button class="classes-session-item ${selected}" type="button" data-session-select="${escapeHtml(sid)}">
          <div class="classes-session-head">
            <strong>Buổi ${Number(session?.sessionNo || 0)}</strong>
            <span class="badge text-bg-light">${statusLabel}</span>
          </div>
          <div class="classes-session-meta">${escapeHtml(dateLabel)} • ${escapeHtml(
            safeText(session?.startTime, "--:--")
          )}</div>
        </button>
      `;
    })
    .join("");
  setHtml("classSessionsList", html);
}

function renderUpcomingSessionCard(vm = {}) {
  const upcoming = vm?.upcomingSession || null;
  if (!upcoming) {
    setHtml("classesUpcomingSessionCard", '<div class="text-muted small">Không có buổi sắp tới.</div>');
    return;
  }
  setHtml(
    "classesUpcomingSessionCard",
    `
      <div class="classes-upcoming-card">
        <div class="d-flex justify-content-between align-items-center gap-2">
          <strong>Buổi ${Number(upcoming?.sessionNo || 0)}</strong>
          <span class="badge text-bg-light">${
            safeText(upcoming?.status, "planned") === "done" ? "Đã dạy" : "Kế hoạch"
          }</span>
        </div>
        <div class="small mt-1">${escapeHtml(
          toDateLabel(upcoming?.scheduledAt) || upcoming?.sessionDate || "--/--/----"
        )} • ${escapeHtml(safeText(upcoming?.startTime, "--:--"))}</div>
      </div>
    `
  );
}

function renderSessionEditor(vm = {}) {
  const session = vm?.selectedSession || null;
  const students = Array.isArray(vm?.students) ? vm.students : [];
  if (!session) {
    setVisible("sessionEditor", false);
    setVisible("sessionEditorEmpty", true);
    return;
  }

  setVisible("sessionEditor", true);
  setVisible("sessionEditorEmpty", false);
  setValue("sessionId", safeText(session?.id));
  setValue("sessionStatus", safeText(session?.status, "planned"));
  setValue("sessionDate", safeText(session?.sessionDate));
  setValue("sessionStartTime", safeText(session?.startTime, "08:00"));
  setValue("sessionEndTime", safeText(session?.endTime, "10:00"));
  setValue("sessionLessonPlan", safeText(session?.lessonPlan));
  setText("sessionWeekdayText", weekdayLabel(session?.weekday));

  const attendanceRows = students
    .filter((student) => String(student?.status || "active") === "active")
    .map((student) => {
      const sid = safeText(student?.id);
      const attendance = safeText(session?.attendance?.[sid], "present");
      return `
        <div class="session-row">
          <div class="session-row-name">${escapeHtml(safeText(student?.name, "(Không rõ)"))}</div>
          <select class="form-select form-select-sm" data-session-attendance="${escapeHtml(sid)}">
            <option value="present" ${attendance === "present" ? "selected" : ""}>Đi học</option>
            <option value="absent" ${attendance === "absent" ? "selected" : ""}>Vắng</option>
          </select>
        </div>
      `;
    })
    .join("");

  const reviewRows = students
    .filter((student) => String(student?.status || "active") === "active")
    .map((student) => {
      const sid = safeText(student?.id);
      const review = safeText(session?.reviews?.[sid], "normal");
      return `
        <div class="session-row">
          <div class="session-row-name">${escapeHtml(safeText(student?.name, "(Không rõ)"))}</div>
          <select class="form-select form-select-sm" data-session-review="${escapeHtml(sid)}">
            <option value="normal" ${review === "normal" ? "selected" : ""}>Bình thường</option>
            <option value="unfocused" ${review === "unfocused" ? "selected" : ""}>Mất tập trung</option>
            <option value="good" ${review === "good" ? "selected" : ""}>Hoàn thành tốt</option>
            <option value="excellent" ${review === "excellent" ? "selected" : ""}>Xuất sắc</option>
          </select>
        </div>
      `;
    })
    .join("");

  setHtml(
    "sessionAttendanceList",
    attendanceRows || '<div class="text-muted small">Không có học sinh active trong lớp này.</div>'
  );
  setHtml(
    "sessionReviewList",
    reviewRows || '<div class="text-muted small">Không có học sinh active trong lớp này.</div>'
  );
}

function renderStudentsList(vm = {}) {
  const students = Array.isArray(vm?.students) ? vm.students : [];
  if (!students.length) {
    setHtml("classStudentsList", '<div class="text-muted small">Chưa có học sinh trong lớp.</div>');
    return;
  }

  const html = students
    .map((student) => {
      const sid = safeText(student?.id);
      const status = safeText(student?.status, "active");
      const statusLabel = status === "inactive" ? "Tạm ngưng" : "Đang học";
      const actionLabel = status === "inactive" ? "Kích hoạt lại" : "Ngừng";
      return `
        <div class="student-row">
          <div class="student-row-main">
            <strong>${escapeHtml(safeText(student?.name, "(Không tên)"))}</strong>
            <div class="small text-muted">${escapeHtml(safeText(student?.note))}</div>
          </div>
          <div class="student-row-actions">
            <span class="badge text-bg-light">${statusLabel}</span>
            <button class="btn btn-sm btn-outline-primary" type="button" data-student-toggle="${escapeHtml(
              sid
            )}">${actionLabel}</button>
          </div>
        </div>
      `;
    })
    .join("");
  setHtml("classStudentsList", html);
}

function renderPresentationAttendanceList(presentation = {}) {
  const attendance = Array.isArray(presentation?.attendance) ? presentation.attendance : [];
  const searchText = safeText(presentation?.gameState?.studentQuery || "").toLowerCase();
  const filtered = searchText
    ? attendance.filter((item) => safeText(item?.name).toLowerCase().includes(searchText))
    : attendance;

  if (!filtered.length) {
    setHtml("presentationAttendanceList", '<div class="text-muted small">Không có học sinh phù hợp.</div>');
    return;
  }

  const html = filtered
    .map((item) => {
      const present = safeText(item?.attendance, "present") === "present";
      const used = !!item?.used;
      const sid = safeText(item?.studentId);
      return `
        <div class="presentation-student-row">
          <div class="presentation-student-main">
            <strong>${escapeHtml(safeText(item?.name, "(Không rõ)"))}</strong>
            <div class="small text-muted">Điểm buổi: +${Math.max(0, Number(item?.pointCount || 0))}</div>
          </div>
          <div class="presentation-student-actions">
            <button class="btn btn-sm ${present ? "btn-success" : "btn-outline-secondary"}" type="button" data-pres-attendance="${escapeHtml(
              sid
            )}" data-next="${present ? "absent" : "present"}">${present ? "Đi học" : "Vắng"}</button>
            <div class="input-group input-group-sm presentation-point-input">
              <input
                type="number"
                min="1"
                step="1"
                value="1"
                class="form-control"
                data-pres-point-input="${escapeHtml(sid)}"
              />
              <button class="btn btn-outline-warning" type="button" data-pres-point-custom="${escapeHtml(
                sid
              )}">Cộng</button>
            </div>
            <button class="btn btn-sm ${used ? "btn-primary" : "btn-outline-primary"}" type="button" data-pres-used="${escapeHtml(
              sid
            )}">${used ? "Đã dùng" : "Chưa dùng"}</button>
          </div>
        </div>
      `;
    })
    .join("");
  setHtml("presentationAttendanceList", html);
}

function renderPresentationLeaderboard(presentation = {}) {
  setHtml("presentationLeaderboardSession", "");
  const classBoard = Array.isArray(presentation?.leaderboardClass) ? presentation.leaderboardClass : [];
  setHtml(
    "presentationLeaderboardClass",
    classBoard.length
      ? classBoard
          .map((item) => `<div class="small">${escapeHtml(item?.name)} • +${Number(item?.count || 0)}</div>`)
          .join("")
      : '<div class="text-muted small">Chưa có dữ liệu bảng điểm lớp.</div>'
  );
}

function renderPresentationHistory(presentation = {}) {
  const history = Array.isArray(presentation?.gameState?.wheelHistory)
    ? presentation.gameState.wheelHistory
    : [];
  const html = history.length
    ? history
        .slice(0, 12)
        .map((entry, index) => {
          const pickedAtLabel = toDateTimeLabel(entry?.pickedAt);
          const name = safeText(entry?.name, "Không rõ tên");
          return `<div class="presentation-history-item"><strong>#${index + 1} • ${escapeHtml(
            name
          )}</strong><small>${escapeHtml(pickedAtLabel || "--/--/----")}</small></div>`;
        })
        .join("")
    : '<div class="text-muted small">Chưa có lịch sử random tên trong buổi này.</div>';
  setHtml("presentationHistoryList", html);
}

function renderPresentationPane(vm = {}) {
  const presentation = vm?.presentation || {};
  const classesActive = Array.isArray(vm?.classesActive) ? vm.classesActive : [];
  const selectClass = byId("classPresentationSelect");
  if (selectClass) {
    const selectedId = safeText(presentation?.selectedClassId);
    selectClass.innerHTML = classesActive.length
      ? classesActive
          .map(
            (item) =>
              `<option value="${escapeHtml(safeText(item?.id))}" ${
                safeText(item?.id) === selectedId ? "selected" : ""
              }>${escapeHtml(safeText(item?.code || item?.title || "Lớp"))}</option>`
          )
          .join("")
      : '<option value="">Chưa có lớp active</option>';
  }

  const selectSession = byId("presentationSessionSelect");
  if (selectSession) {
    const selectedSessionId = safeText(presentation?.selectedSessionId);
    const options = Array.isArray(presentation?.availableSessions) ? presentation.availableSessions : [];
    selectSession.innerHTML = options.length
      ? options
          .map(
            (session) =>
              `<option value="${escapeHtml(safeText(session?.id))}" ${
                safeText(session?.id) === selectedSessionId ? "selected" : ""
              }>${escapeHtml(safeText(session?.label || `Buổi ${Number(session?.sessionNo || 0)}`))}</option>`
          )
          .join("")
      : '<option value="">Chưa có buổi</option>';
  }

  const session = presentation?.session || null;
  setText(
    "presentationSessionInfo",
    session
      ? `Buổi ${Number(session?.sessionNo || 0)} • ${
          toDateLabel(session?.scheduledAt) || session?.sessionDate || "--/--/----"
        }`
      : "Chưa có buổi học để trình chiếu."
  );

  const sync = presentation?.syncState || {};
  const pendingOps = Math.max(0, Number(sync?.pendingOps || 0));
  const syncBadge = byId("presentationSyncBadge");
  if (syncBadge) {
    if (sync?.hasError) {
      syncBadge.className = "badge text-bg-danger";
      syncBadge.textContent = "Lỗi đồng bộ";
    } else if (sync?.isSyncing || pendingOps > 0) {
      syncBadge.className = "badge text-bg-warning";
      syncBadge.textContent = `Đang đồng bộ (${pendingOps})`;
    } else {
      syncBadge.className = "badge text-bg-light";
      syncBadge.textContent = "Đã đồng bộ";
    }
  }

  setValue("presentationStudentSearch", safeText(presentation?.gameState?.studentQuery || ""));
  renderPresentationAttendanceList(presentation);
  setHtml("presentationGameTabs", "");
  setHtml("presentationGameStage", "");
  renderPresentationLeaderboard(presentation);
  renderPresentationHistory(presentation);

  const randomResult = byId("presentationRandomResult");
  if (randomResult) {
    randomResult.textContent = safeText(
      presentation?.gameState?.wheelResultText || "",
      "Bấm Random học sinh để chọn nhanh một bạn."
    );
  }
}

export function renderClassesPage(vm = {}) {
  setText("classesPageTitle", t("classes.title", "Lớp học"));
  setText(
    "classesPageSubtitle",
    t("classes.subtitle", "Quản lý lớp, buổi học và trình chiếu ngay trong một màn hình.")
  );
  setText("classesAdminTabOverviewLabel", t("classes.adminTabs.overview", "Tổng quan"));
  setText("classesAdminTabSessionsLabel", t("classes.adminTabs.sessions", "Buổi học"));
  setText("classesAdminTabStudentsLabel", t("classes.adminTabs.students", "Học sinh"));
  setText("classesAdminTabCreateLabel", t("classes.adminTabs.create", "Tạo lớp"));

  renderModeSwitch(vm?.mode || CLASSES_MODE.ADMIN);
  renderAdminTabs(vm?.adminTab || CLASSES_ADMIN_TAB.OVERVIEW);
  renderClassList(vm);
  renderClassDetail(vm);
  renderSessionFilter(vm?.sessionFilter || CLASSES_SESSION_FILTER.UPCOMING);
  renderSessionsList(vm);
  renderUpcomingSessionCard(vm);
  renderSessionEditor(vm);
  renderStudentsList(vm);
  renderPresentationPane(vm);
}
