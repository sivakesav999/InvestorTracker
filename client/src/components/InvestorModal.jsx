import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import { getInvestor, getSchemes, saveInvestor } from "../services/api.js";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function sanitizePhone(value) {
  return value.replace(/\D/g, "").slice(0, 10);
}

function preventNumberWheel(event) {
  if (document.activeElement === event.currentTarget) {
    event.preventDefault();
  }
}

const EMPTY_FORM = {
  id: "",
  name: "",
  phone: "",
  address: "",
  investment_date: today(),
  amount: "",
  scheme: "",
  notes: "",
};

export default function InvestorModal({ open, investorId, onClose, onSaved, showToast }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [schemes, setSchemes] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    let active = true;

    async function load() {
      try {
        setIsLoading(true);

        const schemeData = await getSchemes();
        if (!active) return;
        setSchemes(schemeData);

        if (!investorId) {
          setForm({ ...EMPTY_FORM, investment_date: today(), scheme: schemeData[0] || "" });
          return;
        }

        const data = await getInvestor(investorId);
        if (!active) return;

        const investor = data.investor;
        setForm({
          id: investor.id || "",
          name: investor.name || "",
          phone: investor.phone || "",
          address: investor.address || "",
          investment_date: investor.investmentDate || "",
          amount: investor.amount ?? "",
          scheme: investor.scheme || "",
          notes: investor.notes || "",
        });
      } catch (error) {
        if (active) showToast(error.message, "error");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [open, investorId, showToast]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      investment_date: form.investment_date,
      amount: form.amount,
      scheme: form.scheme,
      notes: form.notes.trim(),
    };

    if (!payload.name) {
      showToast("Please enter investor name.", "error");
      return;
    }

    if (payload.phone !== "" && !/^\d{10}$/.test(payload.phone)) {
      showToast("Phone number must contain exactly 10 digits.", "error");
      return;
    }

    if (!payload.amount || Number(payload.amount) <= 0) {
      showToast("Please enter a valid investment amount.", "error");
      return;
    }

    if (!payload.investment_date) {
      showToast("Please select investment date.", "error");
      return;
    }

    if (!payload.scheme) {
      showToast("Please select a scheme.", "error");
      return;
    }

    try {
      setIsSaving(true);
      await saveInvestor(form.id || null, payload);
      onClose();
      await onSaved(Boolean(form.id));
      showToast(form.id ? "Investor updated successfully." : "Investor added successfully.");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
        <div className="modal-head">
          <h2>{investorId ? `Edit ${form.investorCode || "Investor"}` : "Add Investor"}</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label>
            Name
            <input
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              required
              disabled={isLoading || isSaving}
              autoFocus
            />
          </label>

          <label>
            Phone
            <input
              type="tel"
              inputMode="numeric"
              maxLength="10"
              pattern="[0-9]{10}"
              autoComplete="tel"
              placeholder="10-digit phone number"
              value={form.phone}
              onChange={(event) => update("phone", sanitizePhone(event.target.value))}
              disabled={isLoading || isSaving}
            />
          </label>

          <label>
            Address
            <textarea
              value={form.address}
              onChange={(event) => update("address", event.target.value)}
              disabled={isLoading || isSaving}
            />
          </label>

          <div className="grid">
            <label>
              Investment Date
              <input
                type="date"
                value={form.investment_date}
                onChange={(event) => update("investment_date", event.target.value)}
                required
                disabled={isLoading || isSaving}
              />
            </label>

            <label>
              Amount Invested
              <input
                type="number"
                min="1"
                value={form.amount}
                onChange={(event) => update("amount", event.target.value)}
                onWheel={preventNumberWheel}
                required
                disabled={isLoading || isSaving}
              />
            </label>
          </div>

          <label>
            Scheme
            <select
              value={form.scheme}
              onChange={(event) => update("scheme", event.target.value)}
              required
              disabled={isLoading || isSaving}
            >
              {schemes.map((scheme) => (
                <option value={scheme} key={scheme}>
                  {scheme}
                </option>
              ))}
            </select>
          </label>

          <label>
            Notes
            <textarea
              value={form.notes}
              onChange={(event) => update("notes", event.target.value)}
              disabled={isLoading || isSaving}
            />
          </label>

          <div className="actions">
            <button className="btn" type="button" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button className="btn primary" type="submit" disabled={isLoading || isSaving}>
              {isSaving ? "Saving..." : "Save Investor"}
            </button>
          </div>
        </form>
    </Modal>
  );
}
