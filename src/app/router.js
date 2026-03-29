import { t } from "../shared/constants/copy.vi.js";
import { LAST_ROUTE_KEY } from "../shared/constants/keys.js";
import { ENABLED_ROUTES } from "../shared/constants/featureFlags.js";

const routes = Array.from(document.querySelectorAll(".route"));
const navLinks = Array.from(document.querySelectorAll("[data-route-link]"));
const topbarTitleEl = document.querySelector(".topbar-title .title");
const topbarSubtitleEl = document.querySelector(".topbar-title .subtitle");

const LEGACY_ROUTE_MAP = Object.freeze({
  overview: "reports",
  dashboard: "expenses",
  accounts: "expenses",
  classes: "expenses",
  "weekly-review": "expenses",
  settings: "expenses",
  goals: "expenses",
  "video-plan": "expenses",
});

function hasRoute(id = "") {
  return routes.some((section) => section.id === id);
}

function isRouteEnabled(id = "") {
  const routeId = String(id || "").trim();
  if (!routeId || routeId === "auth" || routeId === "expenses") return true;
  return ENABLED_ROUTES[routeId] !== false;
}

function normalizeRoute(routeId = "") {
  const raw = String(routeId || "").trim();
  if (!raw) return "expenses";
  if (raw === "auth") return "auth";

  const mapped = LEGACY_ROUTE_MAP[raw] || raw;
  if (!hasRoute(mapped)) return "expenses";
  if (!isRouteEnabled(mapped)) return "expenses";
  return mapped;
}

function updateTopbar(routeId = "expenses") {
  const title = t(`routeMeta.${routeId}.title`, "Tổng quan");
  const subtitle = t(`routeMeta.${routeId}.subtitle`, "");
  const showSubtitle = String(subtitle || "").trim().length > 0;

  if (topbarTitleEl) topbarTitleEl.textContent = title;
  if (topbarSubtitleEl) {
    topbarSubtitleEl.textContent = subtitle;
    topbarSubtitleEl.classList.toggle("d-none", !showSubtitle);
  }

  document.body.dataset.route = routeId;
}

function renderRoute(routeId = "expenses") {
  const id = normalizeRoute(routeId);

  routes.forEach((section) => {
    section.classList.toggle("active", section.id === id);
  });

  navLinks.forEach((link) => {
    const href = String(link.getAttribute("href") || "").replace("#", "").trim();
    link.classList.toggle("active", normalizeRoute(href) === id && id !== "auth");
  });

  updateTopbar(id);

  window.dispatchEvent(
    new CustomEvent("nexus:route-changed", {
      detail: { routeId: id },
    })
  );

  try {
    localStorage.setItem(LAST_ROUTE_KEY, id);
  } catch (err) {
    console.warn("Không thể lưu route cuối", err);
  }

  window.scrollTo({ top: 0, behavior: "auto" });
}

function hashRoute() {
  return normalizeRoute(String(location.hash || "").replace("#", ""));
}

export function setActiveRoute(routeId = "expenses") {
  const target = normalizeRoute(routeId);
  if (location.hash !== `#${target}`) {
    location.hash = `#${target}`;
    return;
  }
  renderRoute(target);
}

export function restoreLastRoute(defaultRoute = "expenses") {
  let next = normalizeRoute(defaultRoute);
  try {
    const saved = localStorage.getItem(LAST_ROUTE_KEY);
    if (saved) next = normalizeRoute(saved);
  } catch (err) {
    console.warn("Không thể đọc route cuối", err);
  }
  setActiveRoute(next);
}

window.addEventListener("hashchange", () => {
  renderRoute(hashRoute());
});

renderRoute(hashRoute());
