import { useEffect, useState } from "react";

export default function Modal({ open, onClose, className = "", children }) {
  const [rendered, setRendered] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setRendered(true);
      setClosing(false);
      return undefined;
    }

    if (!rendered) return undefined;

    setClosing(true);
    const timer = window.setTimeout(() => {
      setRendered(false);
      setClosing(false);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [open]);

  if (!rendered) return null;

  return (
    <div
      className={`modal react-modal${closing ? " is-closing" : ""}`}
      style={{ display: "flex" }}
      aria-hidden={closing}
    >
      <div className={`modal-box ${className}`.trim()}>{children}</div>
    </div>
  );
}
