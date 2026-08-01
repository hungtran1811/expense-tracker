function byId(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function parseDateInput(value = "") {
  const raw = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [year, month, day] = raw.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateInputValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getTodayValue() {
  return toDateInputValue(new Date());
}

function formatDateValue(value = "") {
  const date = parseDateInput(value);
  if (!date) return "Chọn ngày";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatMonthLabel(monthKey = "") {
  const [year, month] = String(monthKey || "").split("-").map(Number);
  if (!year || !month) return "";
  return `Tháng ${pad(month)}/${year}`;
}

function getMonthKeyFromDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function getControl(wrapper) {
  return byId(wrapper?.dataset?.controlFor || "");
}

function getVisibleLabel(wrapper) {
  return wrapper?.querySelector("[data-filter-value]");
}

function getPopover(wrapper) {
  return wrapper?.querySelector("[data-filter-popover]");
}

function getTrigger(wrapper) {
  return wrapper?.querySelector("[data-filter-trigger]");
}

function setExpanded(wrapper, expanded) {
  const trigger = getTrigger(wrapper);
  if (trigger) trigger.setAttribute("aria-expanded", expanded ? "true" : "false");
}

function closeAllControls(except = null) {
  document.querySelectorAll("[data-filter-control].is-open").forEach((wrapper) => {
    if (except && wrapper === except) return;
    wrapper.classList.remove("is-open");
    setExpanded(wrapper, false);
  });
}

function updateSelectControl(wrapper) {
  const control = getControl(wrapper);
  const labelEl = getVisibleLabel(wrapper);
  const popover = getPopover(wrapper);
  if (!control || !labelEl || !popover) return;

  const options = Array.from(control.options || []);
  const selectedOption = options.find((option) => option.value === control.value) || options[0] || null;
  labelEl.textContent = selectedOption?.textContent?.trim() || "Chọn";

  popover.innerHTML = `
    <div class="filter-options-list" role="listbox">
      ${options
        .map((option) => {
          const selected = option.value === control.value;
          return `
            <button
              type="button"
              class="filter-option-item ${selected ? "is-selected" : ""}"
              data-filter-option
              data-value="${escapeHtml(option.value)}"
              role="option"
              aria-selected="${selected ? "true" : "false"}"
            >
              <span>${escapeHtml(option.textContent?.trim() || "")}</span>
              ${selected ? '<i class="bi bi-check2"></i>' : ""}
            </button>
          `;
        })
        .join("")}
    </div>
  `;
}

function buildCalendarDays(monthKey = "", selectedValue = "", todayValue = getTodayValue()) {
  const [year, month] = String(monthKey || "").split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const startDate = new Date(year, month - 1, 1 - startOffset);
  const selectedKey = String(selectedValue || "").trim();
  const todayKey = String(todayValue || "").trim();

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    const dateKey = toDateInputValue(date);
    const currentMonthKey = getMonthKeyFromDate(date);
    return {
      dateKey,
      dayLabel: date.getDate(),
      isCurrentMonth: currentMonthKey === monthKey,
      isSelected: dateKey === selectedKey,
      isToday: dateKey === todayKey,
    };
  });
}

function updateDateControl(wrapper) {
  const control = getControl(wrapper);
  const labelEl = getVisibleLabel(wrapper);
  const popover = getPopover(wrapper);
  if (!control || !labelEl || !popover) return;

  const selectedValue = String(control.value || "").trim();
  labelEl.textContent = formatDateValue(selectedValue);

  const selectedDate = parseDateInput(selectedValue);
  const viewMonth = String(wrapper.dataset.viewMonth || "").trim();
  const today = new Date();
  const activeMonth =
    /^\d{4}-\d{2}$/.test(viewMonth)
      ? viewMonth
      : getMonthKeyFromDate(selectedDate || today);

  wrapper.dataset.viewMonth = activeMonth;

  const allowClear = wrapper.dataset.allowClear === "true";
  const days = buildCalendarDays(activeMonth, selectedValue, getTodayValue());

  popover.innerHTML = `
    <div class="filter-calendar">
      <div class="filter-calendar-head">
        <button type="button" class="filter-calendar-nav" data-filter-nav="-1" aria-label="Tháng trước">
          <i class="bi bi-chevron-left"></i>
        </button>
        <strong>${escapeHtml(formatMonthLabel(activeMonth))}</strong>
        <button type="button" class="filter-calendar-nav" data-filter-nav="1" aria-label="Tháng sau">
          <i class="bi bi-chevron-right"></i>
        </button>
      </div>
      <div class="filter-calendar-weekdays">
        <span>T2</span>
        <span>T3</span>
        <span>T4</span>
        <span>T5</span>
        <span>T6</span>
        <span>T7</span>
        <span>CN</span>
      </div>
      <div class="filter-calendar-grid">
        ${days
          .map(
            (day) => `
              <button
                type="button"
                class="filter-calendar-day ${day.isCurrentMonth ? "" : "is-muted"} ${day.isSelected ? "is-selected" : ""} ${day.isToday ? "is-today" : ""}"
                data-filter-date="${day.dateKey}"
              >
                ${day.dayLabel}
              </button>
            `
          )
          .join("")}
      </div>
      <div class="filter-calendar-foot">
        ${
          allowClear
            ? '<button type="button" class="filter-calendar-link" data-filter-clear="true">Bỏ lọc</button>'
            : '<span class="filter-calendar-spacer"></span>'
        }
        <button type="button" class="filter-calendar-link strong" data-filter-today="true">Hôm nay</button>
      </div>
    </div>
  `;
}

function syncControl(wrapper) {
  if (!wrapper) return;
  const type = wrapper.dataset.filterControl;
  if (type === "select") {
    updateSelectControl(wrapper);
    return;
  }
  if (type === "date") {
    updateDateControl(wrapper);
  }
}

function shiftViewMonth(wrapper, delta = 0) {
  const current = String(wrapper?.dataset?.viewMonth || "").trim();
  const [year, month] = current.split("-").map(Number);
  if (!year || !month) return;
  const date = new Date(year, month - 1 + Number(delta || 0), 1);
  wrapper.dataset.viewMonth = getMonthKeyFromDate(date);
  updateDateControl(wrapper);
}

function dispatchNativeChange(control) {
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

function applyControlValue(wrapper, value = "") {
  const control = getControl(wrapper);
  if (!control) return;
  control.value = value;
  syncControl(wrapper);
  dispatchNativeChange(control);
}

function handleDocumentClick(event) {
  const option = event.target.closest("[data-filter-option]");
  if (option) {
    const wrapper = option.closest("[data-filter-control]");
    const control = getControl(wrapper);
    if (!control) return;
    control.value = option.dataset.value || "";
    syncControl(wrapper);
    dispatchNativeChange(control);
    closeAllControls();
    return;
  }

  const dayButton = event.target.closest("[data-filter-date]");
  if (dayButton) {
    const wrapper = dayButton.closest("[data-filter-control]");
    applyControlValue(wrapper, dayButton.dataset.filterDate || "");
    closeAllControls();
    return;
  }

  const navButton = event.target.closest("[data-filter-nav]");
  if (navButton) {
    const wrapper = navButton.closest("[data-filter-control]");
    shiftViewMonth(wrapper, Number(navButton.dataset.filterNav || 0));
    return;
  }

  const todayButton = event.target.closest("[data-filter-today]");
  if (todayButton) {
    const wrapper = todayButton.closest("[data-filter-control]");
    applyControlValue(wrapper, getTodayValue());
    closeAllControls();
    return;
  }

  const clearButton = event.target.closest("[data-filter-clear]");
  if (clearButton) {
    const wrapper = clearButton.closest("[data-filter-control]");
    applyControlValue(wrapper, "");
    closeAllControls();
    return;
  }

  const trigger = event.target.closest("[data-filter-trigger]");
  if (trigger) {
    const wrapper = trigger.closest("[data-filter-control]");
    if (!wrapper) return;
    const willOpen = !wrapper.classList.contains("is-open");
    closeAllControls(wrapper);
    wrapper.classList.toggle("is-open", willOpen);
    setExpanded(wrapper, willOpen);
    if (willOpen) syncControl(wrapper);
    return;
  }

  if (!event.target.closest("[data-filter-control]")) {
    closeAllControls();
  }
}

function handleKeydown(event) {
  if (event.key === "Escape") {
    closeAllControls();
  }
}

function handleNativeChange(event) {
  const control = event.target;
  if (!(control instanceof HTMLElement) || !control.classList.contains("filter-native-control")) return;
  const wrapper = document.querySelector(`[data-control-for="${control.id}"]`);
  if (wrapper) syncControl(wrapper);
}

let bound = false;

export function bindFilterControls() {
  if (bound) return;
  bound = true;
  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("keydown", handleKeydown);
  document.addEventListener("change", handleNativeChange, true);
}

export function syncFilterControls() {
  document.querySelectorAll("[data-filter-control]").forEach((wrapper) => {
    syncControl(wrapper);
  });
}
