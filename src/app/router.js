import { t } from "../shared/constants/copy.vi.js";
import { LAST_ROUTE_KEY } from "../shared/constants/keys.js";
import { ENABLED_ROUTES } from "../shared/constants/featureFlags.js";

const routes = Array.from(document.querySelectorAll(".route"));
const navLinks = Array.from(document.querySelectorAll("[data-route-link]"));
const topbarTitleEl = document.querySelector(".topbar-title .title");
const topbarSubtitleEl = document.querySelector(".topbar-title .subtitle");

const LEGACY_ROUTE_MAP = Object.freeze({
  overview: "home",
  dashboard: "home",
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
  if (!routeId || routeId === "auth" || routeId === "home" || routeId === "expenses") return true;
  return ENABLED_ROUTES[routeId] !== false;
}

export function parseHashRoute(raw = "") {
  const hash = String(raw || location.hash || "")
    .replace("#", "")
    .trim();

  if (!hash) return { routeId: "home", expensesView: "ledger" };
  if (hash === "auth") return { routeId: "auth", expensesView: "ledger" };

  if (hash === "expenses" || hash.startsWith("expenses/")) {
    const sub = hash.split("/")[1] || "";
    return { routeId: "expenses", expensesView: sub === "manage" ? "manage" : "ledger" };
  }

  const mapped = LEGACY_ROUTE_MAP[hash] || hash;
  if (!hasRoute(mapped)) return { routeId: "home", expensesView: "ledger" };
  if (!isRouteEnabled(mapped)) return { routeId: "home", expensesView: "ledger" };
  return { routeId: mapped, expensesView: "ledger" };
}

function normalizeRoute(routeId = "") {
  return parseHashRoute(routeId).routeId;
}

function buildRouteHash(routeId = "home", expensesView = "ledger") {
  const id = normalizeRoute(routeId);
  if (id === "expenses" && expensesView === "manage") return "expenses/manage";
  return id;
}

function updateTopbar(routeId = "home") {
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

function renderRoute(rawHash = "") {
  const parsed = parseHashRoute(rawHash || String(location.hash || "").replace("#", "").trim());
  const id = parsed.routeId;

  routes.forEach((section) => {
    section.classList.toggle("active", section.id === id);
  });

  navLinks.forEach((link) => {
    const href = String(link.getAttribute("href") || "").replace("#", "").trim();
    link.classList.toggle("active", normalizeRoute(href) === id && id !== "auth");
  });

  document.querySelectorAll("[data-expenses-tab]").forEach((link) => {
    const tab = link.getAttribute("data-expenses-tab") || "ledger";
    link.classList.toggle("active", id === "expenses" && tab === parsed.expensesView);
  });

  updateTopbar(id);

  window.dispatchEvent(
    new CustomEvent("nexus:route-changed", {
      detail: { routeId: id, expensesView: parsed.expensesView },
    })
  );

  try {
    localStorage.setItem(LAST_ROUTE_KEY, buildRouteHash(id, parsed.expensesView));
  } catch (err) {
    console.warn("Không thể lưu route cuối", err);
  }

  window.scrollTo({ top: 0, behavior: "auto" });
}

function hashRoute() {
  return String(location.hash || "").replace("#", "").trim() || "home";
}

export function setActiveRoute(routeId = "home", options = {}) {
  const hash = buildRouteHash(routeId, options.expensesView || "ledger");
  if (location.hash !== `#${hash}`) {
    location.hash = `#${hash}`;
    return;
  }
  renderRoute(hash);
}

export function restoreLastRoute(defaultRoute = "home") {
  let next = normalizeRoute(defaultRoute);
  try {
    const saved = localStorage.getItem(LAST_ROUTE_KEY);
    if (saved) {
      const parsed = parseHashRoute(saved);
      next = parsed.routeId;
      if (parsed.routeId === "expenses" && parsed.expensesView === "manage") {
        setActiveRoute("expenses", { expensesView: "manage" });
        return;
      }
    }
  } catch (err) {
    console.warn("Không thể đọc route cuối", err);
  }
  setActiveRoute(next);
}

window.addEventListener("hashchange", () => {
  renderRoute(hashRoute());
});

renderRoute(hashRoute());
