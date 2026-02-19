export function setGlobalLoading(on) {
  const el = document.getElementById("appLoading");
  if (!el) return;
  el.classList.toggle("show", !!on);
}
