let _dashboardEventsBound = false;

function runHandler(handler, ...args) {
  if (typeof handler !== "function") return;
  Promise.resolve(handler(...args)).catch((err) => {
    console.error("dashboard event handler error", err);
  });
}

function pickTaskIdFromTarget(target) {
  return (
    target?.dataset?.taskId ||
    target?.dataset?.id ||
    target?.closest("[data-task-id]")?.dataset?.taskId ||
    ""
  )
    .toString()
    .trim();
}

function pickHabitIdFromTarget(target) {
  return (
    target?.dataset?.habitId ||
    target?.dataset?.priorityId ||
    target?.dataset?.id ||
    target?.closest("[data-habit-id]")?.dataset?.habitId ||
    ""
  )
    .toString()
    .trim();
}

export function initDashboardEvents(handlers = {}) {
  if (_dashboardEventsBound) return;

  const root = document.getElementById("dashboard");
  if (!root) return;

  _dashboardEventsBound = true;

  root.addEventListener("click", (e) => {
    const target = e.target;

    const checkinBtn = target.closest(
      ".btn-dash-priority-checkin, .btn-dash-next-checkin, #btnDashQuickCheckIn"
    );
    if (checkinBtn) {
      const habitId = pickHabitIdFromTarget(checkinBtn);
      if (habitId) {
        runHandler(handlers.onHabitCheckIn, habitId);
      }
      return;
    }

    const openVideoBtn = target.closest(
      ".btn-dash-next-open-video, #btnDashQuickDeadline, [data-dash-open-video]"
    );
    if (openVideoBtn) {
      const taskId = pickTaskIdFromTarget(openVideoBtn);
      runHandler(handlers.onOpenVideoPlan, taskId);
    }
  });
}
