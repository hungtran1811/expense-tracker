// Simple hash router
const routes = Array.from(document.querySelectorAll(".route"));
const navLinks = Array.from(document.querySelectorAll(".sidebar .nav-link"));
const LAST_ROUTE_KEY = "et_last_route";
export function setActiveRoute() {
  const hash = location.hash.replace("#", "") || "dashboard";
  routes.forEach((sec) => sec.classList.toggle("active", sec.id === hash));
  navLinks.forEach((a) =>
    a.classList.toggle("active", a.getAttribute("href") === "#" + hash)
  );
  try {
    localStorage.setItem(LAST_ROUTE_KEY, routeId);
  } catch (e) {
    console.warn("Cannot persist last route", e);
  }
  window.scrollTo({ top: 0, behavior: "instant" });
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
window.addEventListener("hashchange", setActiveRoute);
