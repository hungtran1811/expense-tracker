// assets/router.js
// Simple hash router (fixed)

const routes = Array.from(document.querySelectorAll(".route"));
const navLinks = Array.from(document.querySelectorAll(".sidebar .nav-link"));
const LAST_ROUTE_KEY = "et_last_route";

function renderRoute(routeId) {
  const id = routeId || "dashboard";

  // show/hide sections
  routes.forEach((sec) => sec.classList.toggle("active", sec.id === id));

  // active nav link
  navLinks.forEach((a) => {
    const href = a.getAttribute("href");
    a.classList.toggle("active", href === "#" + id);
  });

  // persist last route safely
  try {
    localStorage.setItem(LAST_ROUTE_KEY, id);
  } catch (e) {
    console.warn("Cannot persist last route", e);
  }

  window.scrollTo({ top: 0, behavior: "instant" });
}

// routeId optional:
// - if provided => force navigate to that route and render
// - if not => read from hash and render
export function setActiveRoute(routeId) {
  const current = location.hash.replace("#", "") || "dashboard";
  const target = routeId || current;

  // nếu gọi setActiveRoute("auth") => update hash để refresh vẫn giữ đúng trang
  if (routeId && location.hash !== "#" + routeId) {
    location.hash = "#" + routeId;
    // hashchange sẽ gọi renderRoute, nên return để tránh render 2 lần
    return;
  }

  renderRoute(target);
}

export function restoreLastRoute(defaultRoute = "dashboard") {
  let target = defaultRoute;
  try {
    const saved = localStorage.getItem(LAST_ROUTE_KEY);
    if (saved) target = saved;
  } catch (e) {
    console.warn("Cannot read last route", e);
  }

  setActiveRoute(target);
}

// Khi user đổi hash thủ công / bấm menu
window.addEventListener("hashchange", () => {
  const hash = location.hash.replace("#", "") || "dashboard";
  renderRoute(hash);
});

// Render lần đầu khi load trang
setActiveRoute();
