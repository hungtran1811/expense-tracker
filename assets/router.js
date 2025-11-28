// Simple hash router
const routes = Array.from(document.querySelectorAll(".route"));
const navLinks = Array.from(document.querySelectorAll(".sidebar .nav-link"));
export function setActiveRoute() {
  const hash = location.hash.replace("#", "") || "dashboard";
  routes.forEach((sec) => sec.classList.toggle("active", sec.id === hash));
  navLinks.forEach((a) =>
    a.classList.toggle("active", a.getAttribute("href") === "#" + hash)
  );
  window.scrollTo({ top: 0, behavior: "instant" });
}
window.addEventListener("hashchange", setActiveRoute);
