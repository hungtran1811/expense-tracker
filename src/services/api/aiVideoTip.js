import { callNetlifyFunction } from "./netlifyClient.js";

export async function getVideoTip(payload) {
  const data = await callNetlifyFunction("ai-video-tip", payload || {}, {
    timeoutMs: 15000,
  });
  return data?.tip || "";
}

