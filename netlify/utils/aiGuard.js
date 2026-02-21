const DEFAULT_RATE_LIMIT_MAX = Number(process.env.AI_RATE_LIMIT_MAX || 12);
const DEFAULT_RATE_LIMIT_WINDOW_MS = Number(process.env.AI_RATE_LIMIT_WINDOW_MS || 60000);
const TOKEN_CACHE_TTL_MS = Number(process.env.AI_TOKEN_CACHE_TTL_MS || 300000);

const TOKEN_CACHE = new Map();
const RATE_LIMIT_CACHE = new Map();
let lastCleanupAt = 0;

function withCors(headers = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    ...headers,
  };
}

function jsonResponse(statusCode, payload = {}, headers = {}) {
  return {
    statusCode,
    headers: withCors({ "Content-Type": "application/json", ...headers }),
    body: JSON.stringify(payload),
  };
}

function readHeader(event, key) {
  const headers = event && typeof event === "object" ? event.headers || {} : {};
  return headers[key] || headers[key.toLowerCase()] || headers[key.toUpperCase()] || "";
}

function extractBearerToken(event) {
  const authHeader = String(readHeader(event, "authorization") || "").trim();
  if (!authHeader.toLowerCase().startsWith("bearer ")) return "";
  return authHeader.slice(7).trim();
}

function decodeJwtExp(token) {
  const parts = String(token || "").split(".");
  if (parts.length < 2) return 0;

  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=");
    const decoded = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
    const expSec = Number(decoded?.exp || 0);
    return Number.isFinite(expSec) && expSec > 0 ? expSec * 1000 : 0;
  } catch {
    return 0;
  }
}

function cleanupCaches(now = Date.now()) {
  if (now - lastCleanupAt < 30000) return;
  lastCleanupAt = now;

  for (const [token, cached] of TOKEN_CACHE.entries()) {
    const expiresAt = Number(cached?.expiresAt || 0);
    if (!expiresAt || expiresAt <= now) {
      TOKEN_CACHE.delete(token);
    }
  }

  for (const [key, timestamps] of RATE_LIMIT_CACHE.entries()) {
    const next = Array.isArray(timestamps)
      ? timestamps.filter((ts) => Number(ts) > now - DEFAULT_RATE_LIMIT_WINDOW_MS)
      : [];
    if (!next.length) {
      RATE_LIMIT_CACHE.delete(key);
      continue;
    }
    RATE_LIMIT_CACHE.set(key, next);
  }
}

function resolveFirebaseApiKey() {
  return (
    process.env.FIREBASE_WEB_API_KEY ||
    process.env.FIREBASE_API_KEY ||
    process.env.VITE_FB_API_KEY ||
    ""
  )
    .toString()
    .trim();
}

async function verifyTokenWithFirebase(token) {
  const now = Date.now();
  const cached = TOKEN_CACHE.get(token);
  if (cached && Number(cached.expiresAt || 0) > now) {
    return { uid: cached.uid, email: cached.email || "" };
  }

  const apiKey = resolveFirebaseApiKey();
  if (!apiKey) {
    throw new Error("Thiếu FIREBASE_WEB_API_KEY/FIREBASE_API_KEY trên server.");
  }

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
    }
  );

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    const err = new Error("ID token không hợp lệ.");
    err.details = errBody;
    throw err;
  }

  const data = await res.json().catch(() => ({}));
  const user = Array.isArray(data?.users) ? data.users[0] : null;
  const uid = String(user?.localId || "").trim();
  if (!uid) {
    throw new Error("Không đọc được uid từ ID token.");
  }

  const expMs = decodeJwtExp(token);
  const expiresAt = expMs > now ? Math.min(expMs, now + TOKEN_CACHE_TTL_MS) : now + TOKEN_CACHE_TTL_MS;
  TOKEN_CACHE.set(token, {
    uid,
    email: String(user?.email || "").trim(),
    expiresAt,
  });

  return {
    uid,
    email: String(user?.email || "").trim(),
  };
}

function consumeRateLimit(uid, routeKey, options = {}) {
  const now = Date.now();
  cleanupCaches(now);

  const windowMs = Math.max(5000, Number(options.windowMs || DEFAULT_RATE_LIMIT_WINDOW_MS));
  const maxRequests = Math.max(1, Number(options.maxRequests || DEFAULT_RATE_LIMIT_MAX));
  const key = `${routeKey || "ai"}:${uid}`;

  const current = Array.isArray(RATE_LIMIT_CACHE.get(key)) ? RATE_LIMIT_CACHE.get(key) : [];
  const active = current.filter((ts) => Number(ts) > now - windowMs);

  if (active.length >= maxRequests) {
    const oldest = active[0];
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return {
      allowed: false,
      retryAfterSec,
      remaining: 0,
    };
  }

  active.push(now);
  RATE_LIMIT_CACHE.set(key, active);

  return {
    allowed: true,
    retryAfterSec: 0,
    remaining: Math.max(0, maxRequests - active.length),
  };
}

async function guardAiRequest(event, options = {}) {
  if (event?.httpMethod === "OPTIONS") {
    return {
      ok: false,
      response: {
        statusCode: 204,
        headers: withCors(),
        body: "",
      },
    };
  }

  if (event?.httpMethod !== "POST") {
    return {
      ok: false,
      response: jsonResponse(405, { error: "Method Not Allowed" }),
    };
  }

  if (String(process.env.AI_GUARD_DISABLED || "").trim().toLowerCase() === "true") {
    return {
      ok: true,
      uid: "dev-local",
      email: "",
      rate: { allowed: true, retryAfterSec: 0, remaining: 0 },
    };
  }

  const token = extractBearerToken(event);
  if (!token) {
    return {
      ok: false,
      response: jsonResponse(401, {
        error: "Yêu cầu đăng nhập để sử dụng AI.",
        code: "UNAUTHORIZED",
      }),
    };
  }

  let identity;
  try {
    identity = await verifyTokenWithFirebase(token);
  } catch (err) {
    return {
      ok: false,
      response: jsonResponse(403, {
        error: "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.",
        code: "FORBIDDEN",
        details: String(err?.message || ""),
      }),
    };
  }

  const rate = consumeRateLimit(identity.uid, options.routeKey || "ai", options);
  if (!rate.allowed) {
    return {
      ok: false,
      response: jsonResponse(
        429,
        {
          error: "Bạn đang gọi AI quá nhanh. Vui lòng thử lại sau.",
          code: "RATE_LIMITED",
          retryAfterSec: rate.retryAfterSec,
        },
        { "Retry-After": String(rate.retryAfterSec) }
      ),
    };
  }

  return {
    ok: true,
    uid: identity.uid,
    email: identity.email,
    rate,
  };
}

module.exports = {
  withCors,
  jsonResponse,
  guardAiRequest,
};
