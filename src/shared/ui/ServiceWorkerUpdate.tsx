import { useEffect } from "react";
import { useToast } from "./Toast";
import { shouldRegisterServiceWorker } from "../lib/platform";

export function ServiceWorkerUpdate() {
  const { showToast } = useToast();

  useEffect(() => {
    if (!shouldRegisterServiceWorker()) return;
    const onUpdate = () => {
      showToast("Có bản mới. Tải lại trang để cập nhật.", "info");
    };
    window.addEventListener("htf:sw-update", onUpdate);
    return () => window.removeEventListener("htf:sw-update", onUpdate);
  }, [showToast]);

  return null;
}
