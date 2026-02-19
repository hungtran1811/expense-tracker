export async function getVideoTip(payload) {
  const res = await fetch("/.netlify/functions/ai-video-tip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI video tip failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data?.tip || "";
}
