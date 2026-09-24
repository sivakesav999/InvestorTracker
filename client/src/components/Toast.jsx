import { useEffect } from "react";

export default function Toast({ toast }) {
  useEffect(() => {
    if (!toast) return undefined;

    const timer = window.setTimeout(toast.onClose, 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;

  return (
    <div
      role="status"
      className={`react-toast ${toast.type === "error" ? "error" : ""}`}
    >
      <span>{toast.message}</span>
      <button type="button" onClick={toast.onClose} aria-label="Close notification">
        ×
      </button>
    </div>
  );
}
