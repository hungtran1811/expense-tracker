export async function getReportInsights(payload) {
  const res = await fetch("/.netlify/functions/ai-report-insights", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${errText || "Server error"}`);
  }

  const data = await res.json();
  if (!data?.summary) throw new Error("No summary in response");
  return data.summary.trim();
}
