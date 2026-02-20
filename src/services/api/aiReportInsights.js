import { callNetlifyFunction } from "./netlifyClient.js";

const REPORT_INSIGHT_TIMEOUT_MS = 15000;

export async function getReportInsights(payload, options = {}) {
  const withMeta = !!options?.withMeta;
  const timeoutMs = Math.max(1000, Number(options?.timeoutMs || REPORT_INSIGHT_TIMEOUT_MS));

  try {
    const data = await callNetlifyFunction("ai-report-insights", payload || {}, {
      timeoutMs,
    });
    const summary = String(data?.summary || "").trim();
    if (!summary) {
      throw new Error("Không nhận được insight AI hợp lệ.");
    }

    if (withMeta) {
      return {
        summary,
        model: String(data?.model || "gemini-3-flash-latest"),
        promptVersion: String(data?.promptVersion || "2.6.0"),
      };
    }
    return summary;
  } catch (err) {
    throw err instanceof Error ? err : new Error("Không thể tạo insight AI.");
  }
}
