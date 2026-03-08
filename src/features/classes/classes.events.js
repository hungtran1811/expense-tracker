let _bound = false;

function byId(id) {
  return document.getElementById(id);
}

function safeText(value) {
  return String(value ?? "").trim();
}

function toInt(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.trunc(num) : fallback;
}

function run(handler, ...args) {
  if (typeof handler !== "function") return;
  Promise.resolve(handler(...args)).catch((err) => {
    console.error("classes event error", err);
  });
}

function readCreateClassPayload() {
  return {
    code: safeText(byId("classCreateCode")?.value),
    subject: safeText(byId("classCreateSubject")?.value),
    level: safeText(byId("classCreateLevel")?.value),
    startDate: safeText(byId("classCreateStartDate")?.value),
    weekday: toInt(byId("classCreateWeekday")?.value, 1),
    startTime: safeText(byId("classCreateStartTime")?.value) || "08:00",
    status: safeText(byId("classCreateStatus")?.value) || "active",
    description: safeText(byId("classCreateDescription")?.value),
  };
}

function readEditClassPayload() {
  return {
    classId: safeText(byId("classId")?.value),
    code: safeText(byId("classCode")?.value),
    subject: safeText(byId("classSubject")?.value),
    level: safeText(byId("classLevel")?.value),
    startDate: safeText(byId("classStartDate")?.value),
    weekday: toInt(byId("classWeekday")?.value, 1),
    startTime: safeText(byId("classStartTime")?.value) || "08:00",
    status: safeText(byId("classStatus")?.value) || "active",
    description: safeText(byId("classDescription")?.value),
  };
}

function readSessionPayload(root) {
  const attendance = {};
  root.querySelectorAll("[data-session-attendance]").forEach((node) => {
    const studentId = safeText(node?.dataset?.sessionAttendance);
    if (!studentId) return;
    attendance[studentId] = safeText(node.value) === "absent" ? "absent" : "present";
  });

  const reviews = {};
  root.querySelectorAll("[data-session-review]").forEach((node) => {
    const studentId = safeText(node?.dataset?.sessionReview);
    if (!studentId) return;
    reviews[studentId] = safeText(node.value) || "normal";
  });

  return {
    sessionId: safeText(byId("sessionId")?.value),
    status: safeText(byId("sessionStatus")?.value) || "planned",
    sessionDate: safeText(byId("sessionDate")?.value),
    sessionStartTime: safeText(byId("sessionStartTime")?.value) || "08:00",
    sessionEndTime: safeText(byId("sessionEndTime")?.value) || "10:00",
    lessonPlan: safeText(byId("sessionLessonPlan")?.value),
    sessionNote: safeText(byId("sessionNote")?.value),
    attendance,
    reviews,
  };
}

export function bindClassesEvents(handlers = {}) {
  if (_bound) return;

  const root = byId("classes");
  if (!root) return;
  _bound = true;

  byId("classesModeAdmin")?.addEventListener("click", () => run(handlers.onChangeMode, "admin"));
  byId("classesModePresentation")?.addEventListener("click", () =>
    run(handlers.onChangeMode, "presentation")
  );
  byId("btnClassesExitPresentation")?.addEventListener("click", () =>
    run(handlers.onExitPresentation)
  );

  byId("classesTabOverview")?.addEventListener("click", () =>
    run(handlers.onChangeAdminTab, "overview")
  );
  byId("classesTabSessions")?.addEventListener("click", () =>
    run(handlers.onChangeAdminTab, "sessions")
  );
  byId("classesTabStudents")?.addEventListener("click", () =>
    run(handlers.onChangeAdminTab, "students")
  );
  byId("classesTabCreate")?.addEventListener("click", () => run(handlers.onChangeAdminTab, "create"));

  byId("classesSessionFilterUpcoming")?.addEventListener("click", () =>
    run(handlers.onChangeSessionFilter, "upcoming")
  );
  byId("classesSessionFilterPast")?.addEventListener("click", () =>
    run(handlers.onChangeSessionFilter, "past")
  );
  byId("classesSessionFilterAll")?.addEventListener("click", () =>
    run(handlers.onChangeSessionFilter, "all")
  );

  byId("btnCreateClass")?.addEventListener("click", () =>
    run(handlers.onCreateClass, readCreateClassPayload())
  );

  byId("btnSaveClass")?.addEventListener("click", () =>
    run(handlers.onSaveClass, readEditClassPayload())
  );

  byId("btnDeleteClass")?.addEventListener("click", () => {
    const classId = safeText(byId("classId")?.value);
    run(handlers.onDeleteClass, classId);
  });

  byId("btnAddStudent")?.addEventListener("click", () => {
    const payload = {
      name: safeText(byId("classStudentName")?.value),
      note: safeText(byId("classStudentNote")?.value),
      status: "active",
    };
    run(handlers.onAddStudent, payload);
  });

  byId("btnSaveSession")?.addEventListener("click", () =>
    run(handlers.onSaveSession, readSessionPayload(root))
  );

  byId("btnRescheduleSession")?.addEventListener("click", () => {
    const sessionId = safeText(byId("sessionId")?.value);
    const reason = safeText(byId("sessionRescheduleReason")?.value);
    run(handlers.onRescheduleSession, { sessionId, reason });
  });

  byId("classPresentationSelect")?.addEventListener("change", (e) => {
    run(handlers.onSelectPresentationClass, safeText(e.target?.value));
  });
  byId("presentationSessionSelect")?.addEventListener("change", (e) => {
    run(handlers.onSelectPresentationSession, safeText(e.target?.value));
  });
  byId("presentationStudentSearch")?.addEventListener("input", (e) => {
    run(handlers.onPresentationSearch, safeText(e.target?.value));
  });
  byId("presentationRandomButton")?.addEventListener("click", () => run(handlers.onPresentationRandom));
  byId("presentationUsedReset")?.addEventListener("click", () => run(handlers.onPresentationResetUsed));
  byId("presentationRandomHistoryClear")?.addEventListener("click", () =>
    run(handlers.onPresentationClearRandomHistory)
  );
  byId("presentationHighlightReset")?.addEventListener("click", () =>
    run(handlers.onPresentationResetPoints)
  );
  byId("presentationAudioToggle")?.addEventListener("click", () =>
    run(handlers.onPresentationToggleAudio)
  );

  root.addEventListener("change", (e) => {
    const quizNode = e.target.closest("[data-game-quiz-candidate]");
    if (quizNode) {
      run(handlers.onPresentationGameCandidate, {
        game: "quiz",
        studentId: safeText(quizNode.dataset.gameQuizCandidate),
        checked: !!quizNode.checked,
      });
      return;
    }

    const challengeNode = e.target.closest("[data-game-challenge-candidate]");
    if (challengeNode) {
      run(handlers.onPresentationGameCandidate, {
        game: "challenge",
        studentId: safeText(challengeNode.dataset.gameChallengeCandidate),
        checked: !!challengeNode.checked,
      });
      return;
    }

    const timerNode = e.target.closest("[data-game-timer-candidate]");
    if (timerNode) {
      run(handlers.onPresentationGameCandidate, {
        game: "timer",
        studentId: safeText(timerNode.dataset.gameTimerCandidate),
        checked: !!timerNode.checked,
      });
      return;
    }

    if (e.target?.id === "presentationQuizAnswer") {
      run(handlers.onPresentationQuizAnswer, safeText(e.target?.value));
      return;
    }

    if (e.target?.id === "presentationTimerPreset") {
      run(handlers.onPresentationTimerPreset, safeText(e.target?.value));
    }
  });

  root.addEventListener("click", (e) => {
    const classBtn = e.target.closest("[data-class-select]");
    if (classBtn) {
      run(handlers.onSelectClass, safeText(classBtn.dataset.classSelect));
      return;
    }

    const sessionBtn = e.target.closest("[data-session-select]");
    if (sessionBtn) {
      run(handlers.onSelectSession, safeText(sessionBtn.dataset.sessionSelect));
      return;
    }

    const studentToggleBtn = e.target.closest("[data-student-toggle]");
    if (studentToggleBtn) {
      run(handlers.onToggleStudent, safeText(studentToggleBtn.dataset.studentToggle));
      return;
    }

    const attendanceBtn = e.target.closest("[data-pres-attendance]");
    if (attendanceBtn) {
      run(handlers.onPresentationAttendance, {
        studentId: safeText(attendanceBtn.dataset.presAttendance),
        next: safeText(attendanceBtn.dataset.next) || "present",
      });
      return;
    }

    const pointBtn = e.target.closest("[data-pres-point-student]");
    if (pointBtn) {
      run(handlers.onPresentationAddPoint, {
        studentId: safeText(pointBtn.dataset.presPointStudent),
        delta: toInt(pointBtn.dataset.presPointDelta, 1),
      });
      return;
    }

    const customPointBtn = e.target.closest("[data-pres-point-custom]");
    if (customPointBtn) {
      const studentId = safeText(customPointBtn.dataset.presPointCustom);
      const group = customPointBtn.closest(".presentation-point-input");
      const input = group?.querySelector("[data-pres-point-input]");
      const delta = toInt(input?.value, 1);
      run(handlers.onPresentationAddPoint, {
        studentId,
        delta: delta > 0 ? delta : 1,
      });
      return;
    }

    const usedBtn = e.target.closest("[data-pres-used]");
    if (usedBtn) {
      run(handlers.onPresentationToggleUsed, safeText(usedBtn.dataset.presUsed));
      return;
    }

    const gameSwitchBtn = e.target.closest("[data-game-switch]");
    if (gameSwitchBtn) {
      run(handlers.onPresentationSwitchGame, safeText(gameSwitchBtn.dataset.gameSwitch));
      return;
    }

    const gameActionBtn = e.target.closest("[data-game-action]");
    if (gameActionBtn) {
      run(handlers.onPresentationGameAction, {
        action: safeText(gameActionBtn.dataset.gameAction),
        studentId: safeText(gameActionBtn.dataset.studentId),
        delta: toInt(gameActionBtn.dataset.delta, 1),
      });
      return;
    }

    if (e.target?.id === "presentationTimerStart") {
      run(handlers.onPresentationTimerStart);
      return;
    }
    if (e.target?.id === "presentationTimerPause") {
      run(handlers.onPresentationTimerPause);
      return;
    }
    if (e.target?.id === "presentationTimerReset") {
      run(handlers.onPresentationTimerReset);
    }
  });
}
