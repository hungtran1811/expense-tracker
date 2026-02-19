export function showToast(msg, type = "success") {
  const el = document.getElementById("appToast");
  if (!el) {
    console.log("[Toast]", type.toUpperCase(), msg);
    return;
  }

  el.classList.remove(
    "toast-success",
    "toast-error",
    "toast-info",
    "text-bg-success",
    "text-bg-danger",
    "text-bg-primary"
  );
  const map = {
    success: "toast-success",
    error: "toast-error",
    info: "toast-info",
  };
  el.classList.add(map[type] || "toast-info");

  el.querySelector(".toast-body").textContent = msg;
  const t = bootstrap.Toast.getOrCreateInstance(el, { delay: 2500 });
  t.show();
}
