import { getCurrentIdToken } from "../firebase/auth.js";

function isLocalhost(hostname = "") {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function getConfiguredBaseUrl() {
  const raw =
    (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_NETLIFY_BASE_URL) || "";
  return String(raw || "").trim().replace(/\/+$/, "");
}

function buildFunctionUrl(baseUrl, functionName) {
  const base = String(baseUrl || "").trim();
  const name = String(functionName || "").trim();
  if (!name) throw new Error("Thiếu tên Netlify function");
  if (!base) return `/.netlify/functions/${name}`;
  return `${base}/.netlify/functions/${name}`;
}

function createAbortController(timeoutMs = 15000) {
  const controller = new AbortController();
  const safeTimeout = Math.max(1000, Number(timeoutMs || 15000));
  const timer = setTimeout(() => controller.abort(), safeTimeout);
  return { controller, timer };
}

async function parseResponse(res) {
  const contentType = String(res.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("application/json")) {
    return res.json().catch(() => ({}));
  }
  const text = await res.text().catch(() => "");
  return { error: text };
}

function normalizeErrorMessage(payload, status = 500, defaultMessage = "Không thể gọi AI") {
  if (status === 401) return "Bạn cần đăng nhập để sử dụng AI.";
  if (status === 403) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (status === 429) {
    const retryAfter = Number(payload?.retryAfterSec || payload?.retryAfter || 0);
    if (Number.isFinite(retryAfter) && retryAfter > 0) {
      return `Bạn gọi AI quá nhanh. Vui lòng thử lại sau ${retryAfter}s.`;
    }
    return "Bạn gọi AI quá nhanh. Vui lòng thử lại sau.";
  }

  if (!payload) return `HTTP ${status}: ${defaultMessage}`;
  if (typeof payload === "string") return `HTTP ${status}: ${payload || defaultMessage}`;

  const msg = payload.error || payload.message || payload.details || defaultMessage;
  return `HTTP ${status}: ${msg}`;
}

async function buildRequestHeaders(extraHeaders = {}) {
  const token = await getCurrentIdToken(false);
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extraHeaders || {}),
  };
}

export async function callNetlifyFunction(functionName, payload = {}, options = {}) {
  const timeoutMs = Number(options?.timeoutMs || 15000);
  const method = String(options?.method || "POST").toUpperCase();
  const customBase = String(options?.baseUrl || "").trim();
  const configuredBase = getConfiguredBaseUrl();

  const sameOriginBase =
    typeof window !== "undefined" && window.location && window.location.origin
      ? window.location.origin
      : "";
  const runtimeHostname =
    typeof window !== "undefined" && window.location && window.location.hostname
      ? window.location.hostname
      : "";
  const localFallbackBase = isLocalhost(runtimeHostname) ? "http://localhost:8899" : "";

  const candidateBases = [customBase, configuredBase, "", localFallbackBase]
    .map((item) => String(item || "").trim())
    .filter((item, idx, arr) => arr.indexOf(item) === idx);

  if (!candidateBases.includes("")) candidateBases.splice(2, 0, "");

  const tried = [];
  let lastError = null;

  for (const base of candidateBases) {
    const url = buildFunctionUrl(base, functionName);
    tried.push(url);
    const { controller, timer } = createAbortController(timeoutMs);

    try {
      const headers = await buildRequestHeaders(options?.headers || {});
      const res = await fetch(url, {
        method,
        headers,
        body: method === "GET" ? undefined : JSON.stringify(payload || {}),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        const body = await parseResponse(res);
        const message = normalizeErrorMessage(body, res.status, "Function trả lỗi");

        const isSameOrigin404 =
          res.status === 404 &&
          isLocalhost(runtimeHostname) &&
          (base === "" || (sameOriginBase && url.startsWith(sameOriginBase)));

        if (isSameOrigin404) {
          lastError = new Error(message);
          continue;
        }

        throw new Error(message);
      }

      return await parseResponse(res);
    } catch (err) {
      clearTimeout(timer);
      if (err?.name === "AbortError") {
        lastError = new Error("AI đang bận. Hết thời gian chờ phản hồi.");
        continue;
      }
      lastError = err instanceof Error ? err : new Error("Không thể gọi Netlify function.");
    }
  }

  const hint =
    typeof window !== "undefined" && isLocalhost(window.location.hostname)
      ? " Môi trường local cần chạy Netlify Dev (`netlify dev`) rồi mở app qua cổng 8899."
      : "";
  const message = lastError?.message || "Không thể gọi Netlify function.";
  const trace = tried.length ? ` Endpoint đã thử: ${tried.join(" | ")}` : "";
  throw new Error(`${message}${hint}${trace}`);
}
