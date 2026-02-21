const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

function readFileSafe(relPath) {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) return "";
  return fs.readFileSync(full, "utf8");
}

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

const failures = [];

const indexHtml = readFileSafe("index.html");
const requiredIds = [
  "videoViewBoard",
  "videoViewCalendar",
  "videoCalendarMonthLabel",
  "videoCalendarGrid",
  "videoCalendarWeekStrip",
  "videoCalendarAgenda",
  "videoUnscheduledList",
  "dashboardAccountBalances",
];
requiredIds.forEach((id) => {
  assert(indexHtml.includes(`id=\"${id}\"`), `Thiếu id bắt buộc trong index.html: ${id}`, failures);
});

const guardTargets = [
  "netlify/functions/ai-categorize.js",
  "netlify/functions/ai-goal-suggest.js",
  "netlify/functions/ai-video-copilot.js",
  "netlify/functions/ai-report-insights.js",
];
guardTargets.forEach((file) => {
  const text = readFileSafe(file);
  assert(text.includes("guardAiRequest"), `Thiếu guardAiRequest trong ${file}`, failures);
});

const requiredDocs = [
  "docs/qa/smoke-checklist.vi.md",
  "docs/releases/phase-2.8-rc.vi.md",
  "README.md",
  ".env.example",
];
requiredDocs.forEach((file) => {
  assert(fs.existsSync(path.join(ROOT, file)), `Thiếu tài liệu/biến môi trường: ${file}`, failures);
});

if (failures.length) {
  console.error("Smoke-lite failed:");
  failures.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}

console.log("Smoke-lite passed: cấu trúc chính và guard cơ bản hợp lệ.");
