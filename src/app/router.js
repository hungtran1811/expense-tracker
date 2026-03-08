import { t } from "../shared/constants/copy.vi.js";
import { ENABLED_ROUTES } from "../shared/constants/featureFlags.js";
import { LAST_ROUTE_KEY } from "../shared/constants/keys.js";

const routes = Array.from(document.querySelectorAll(".route"));
const navLinks = Array.from(document.querySelectorAll(".rail-link"));
const topbarTitleEl = document.querySelector(".topbar-title .title");
const topbarSubtitleEl = document.querySelector(".topbar-title .subtitle");

const blockedRoutes = new Set();
Object.entries(ENABLED_ROUTES || {}).forEach(([routeId, isEnabled]) => {
  if (isEnabled === false) blockedRoutes.add(String(routeId || "").trim());
});

function hasRoute(id) {
  return routes.some((sec) => sec.id === id);
}

function normalizeRoute(routeId) {
  const id = String(routeId || "").trim() || "dashboard";
  if (!hasRoute(id)) return "dashboard";
  if (blockedRoutes.has(id)) return "dashboard";
  return id;
}

function updateTopbar(routeId) {
  const title = t(`routeMeta.${routeId}.title`, t("routeMeta.dashboard.title", "Trung tâm"));
  let subtitle = t(
    `routeMeta.${routeId}.subtitle`,
    t("routeMeta.dashboard.subtitle", "Tổng quan")
  );
  if (routeId === "dashboard") {
    subtitle = "Tổng quan tài chính và lịch lớp học sắp tới";
  }
  const hasSubtitle = String(subtitle || "").trim().length > 0;

  if (topbarTitleEl) topbarTitleEl.textContent = title;
  if (topbarSubtitleEl) {
    topbarSubtitleEl.textContent = subtitle;
    topbarSubtitleEl.classList.toggle("d-none", !hasSubtitle);
  }

  document.body.dataset.route = routeId;
}

function renderRoute(routeId) {
  const id = normalizeRoute(routeId);

  routes.forEach((sec) => {
    sec.classList.toggle("active", sec.id === id);
  });

  navLinks.forEach((link) => {
    const href = (link.getAttribute("href") || "").replace("#", "").trim();
    const isFinanceGroup = href === "expenses" && id === "accounts";
    link.classList.toggle("active", href === id || isFinanceGroup);
    if (blockedRoutes.has(href)) link.classList.add("d-none");
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
  return normalizeRoute(location.hash.replace("#", ""));
}

export function setActiveRoute(routeId) {
  const target = normalizeRoute(routeId || hashRoute());
  if (location.hash !== `#${target}`) {
    location.hash = `#${target}`;
    return;
  }
  renderRoute(target);
}

export function restoreLastRoute(defaultRoute = "dashboard") {
  let target = normalizeRoute(defaultRoute);

  try {
    const saved = localStorage.getItem(LAST_ROUTE_KEY);
    if (saved) target = normalizeRoute(saved);
  } catch (err) {
    console.warn("Không thể đọc route cuối", err);
  }

  setActiveRoute(target);
}

window.addEventListener("hashchange", () => {
  renderRoute(hashRoute());
});

renderRoute(hashRoute());
