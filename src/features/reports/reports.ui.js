import { escapeHtml } from "./reports.ai.js";

export function renderAiSummaryBox(aiBox, summaryText, state = "done") {
  if (!aiBox) return;

  if (state === "loading") {
    aiBox.innerHTML = `
      <div class="d-flex align-items-center gap-2">
        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
        <span class="text-secondary small">AI đang phân tích...</span>
      </div>
    `;
    return;
  }

  if (state === "error") {
    aiBox.innerHTML = `<div class="text-danger small">${escapeHtml(summaryText)}</div>`;
    return;
  }

  const safe = escapeHtml(summaryText).replace(/\n{2,}/g, "\n").replace(/\n/g, "<br/>");
  aiBox.innerHTML = `
    <div class="small text-secondary mb-1">AI gợi ý</div>
    <div class="ai-summary">${safe}</div>
  `;
}

