export async function suggestCategory({ name, note, categories }) {
  const res = await fetch("/.netlify/functions/ai-categorize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, note, categories }),
  });

  if (!res.ok) {
    throw new Error(`AI categorize failed: ${res.status}`);
  }

  return res.json();
}
