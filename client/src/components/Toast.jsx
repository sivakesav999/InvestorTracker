import { useEffect, useRef } from "react";

export default function Toast({ toast }) {
  const shownToastId = useRef(null);

  useEffect(() => {
    if (!toast || typeof window.Toastify !== "function") {
      return undefined;
    }

    // React StrictMode can run an effect more than once in development.
    // Prevent the same toast state from creating duplicate Toastify toasts.
    if (shownToastId.current === toast.id) {
      return undefined;
    }

    shownToastId.current = toast.id;

    window
      .Toastify({
        text: toast.message,
        duration: 3000,
        close: true,
        gravity: "top",
        position: "right",
        stopOnFocus: true,
        style: {
          background: toast.type === "error" ? "#b42318" : "#1769aa",
          borderRadius: "8px",
        },
        callback: toast.onClose,
      })
      .showToast();

    // IMPORTANT:
    // Do not call hideToast() in the cleanup function.
    // React StrictMode performs an effect cleanup during development,
    // which would make the toast disappear immediately like a flash.
    return undefined;
  }, [toast]);

  return null;
}