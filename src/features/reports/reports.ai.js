import { getReportInsights } from "../../services/api/aiReportInsights.js";

export { getReportInsights };

export function stripHtmlTags(str = "") {
  return str.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

export function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function normalizeAiSummary(summary, fallback) {
  let s = (summary || "").replace(/\s+/g, " ").trim();
  const hasSentenceEnd = /[.!?]$/.test(s);
  const hasAnyPunc = /[.!?]/.test(s);

  if (!s || s.length < 45 || !hasAnyPunc) return fallback;
  if (!hasSentenceEnd) s += ".";
  if (/\b(you spend|you earn|you pay)\.$/i.test(s)) return fallback;

  return s;
}
