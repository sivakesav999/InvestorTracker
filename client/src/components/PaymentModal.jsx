import { useEffect, useState } from "react";
import { getInvestor, savePayment, saveAllPayments } from "../services/api.js";

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function preventNumberWheel(event) {
  if (document.activeElement === event.currentTarget) {
    event.preventDefault();
  }
}

export default function PaymentModal({ open, investorId, onClose, onChanged, showToast }) {
  const [investor, setInvestor] = useState(null);
  const [payments, setPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    if (!open || !investorId) return;

    let active = true;

    async function load() {
      try {
        setIsLoading(true);
        const data = await getInvestor(investorId);
        if (!active) return;
        setInvestor(data.investor);
        setPayments(data.payments || []);
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

  function updatePayment(id, field, value) {
    setPayments((current) =>
      current.map((payment) =>
        String(payment._id) === String(id) ? { ...payment, [field]: value } : payment,
      ),
    );
  }

  async function handleSave(id) {
    if (!id) {
      showToast("Payment ID is missing.", "error");
      return;
    }

    const payment = payments.find((item) => String(item._id) === String(id));
    if (!payment) {
      showToast("Payment record not found.", "error");
      return;
    }

    try {
      setSavingId(id);
      await savePayment(id, {
        amount_paid: Number(payment.amountPaid) || 0,
        payment_date: payment.paymentDate || "",
        method: payment.method || "",
        notes: payment.notes || "",
      });
      await onChanged();
      showToast("Payment saved successfully.");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSavingId(null);
    }
  }

  async function handleSaveAll() {
    if (!payments.length) {
      showToast("No payment records to save.", "error");
      return;
    }

    const invalidMethod = payments.find(
      (payment) => !["", "Cash", "UPI"].includes(payment.method || ""),
    );

    if (invalidMethod) {
      showToast("Payment method must be Cash or UPI.", "error");
      return;
    }

    try {
      setIsSavingAll(true);
      await saveAllPayments(
        payments.map((payment) => ({
          id: payment._id,
          amount_paid: Number(payment.amountPaid) || 0,
          payment_date: payment.paymentDate || "",
          method: payment.method || "",
          notes: payment.notes || "",
        })),
      );
      await onChanged();
      showToast(`${payments.length} payment entries saved successfully.`);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setIsSavingAll(false);
    }
  }

  if (!open) return null;

  return (
    <div className="modal" style={{ display: "flex" }}>
      <div className="modal-box wide">
        <div className="modal-head">
          <h2>
            Payments
            {investor ? ` • ${investor.investorCode} • ${investor.name}` : ""}
          </h2>

          <div className="payment-head-actions">
            <button
              id="saveAllPaymentsBtn"
              className="btn primary"
              type="button"
              onClick={handleSaveAll}
              disabled={isLoading || isSavingAll || savingId !== null}
            >
              {isSavingAll ? "Saving..." : "Save All"}
            </button>

            <button type="button" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
        </div>

        {investor && (
          <div id="paymentSummary">
            <p>
              <b>{investor.scheme}</b>
              &nbsp; Investment: {money(investor.amount)} &nbsp; Monthly: {money(investor.monthlyPayout)}
              &nbsp; Remaining: {investor.monthsRemaining}
            </p>
            <br />
          </div>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Due Date</th>
                <th>Due</th>
                <th>Paid</th>
                <th>Payment Date</th>
                <th>Method</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="8" className="muted">Loading payments...</td>
                </tr>
              ) : payments.length ? (
                payments.map((payment) => {
                  const id = String(payment._id);
                  return (
                    <tr key={id}>
                      <td>{payment.monthNo}</td>
                      <td>{payment.dueDate || "-"}</td>
                      <td>{money(payment.amountDue)}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          value={payment.amountPaid || 0}
                          onChange={(event) => updatePayment(id, "amountPaid", event.target.value)}
                          onWheel={preventNumberWheel}
                          disabled={isSavingAll || savingId !== null}
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          value={payment.paymentDate || ""}
                          onChange={(event) => updatePayment(id, "paymentDate", event.target.value)}
                          disabled={isSavingAll || savingId !== null}
                        />
                      </td>
                      <td>
                        <select
                          value={payment.method || ""}
                          onChange={(event) => updatePayment(id, "method", event.target.value)}
                          disabled={isSavingAll || savingId !== null}
                        >
                          <option value="">--</option>
                          <option value="Cash">Cash</option>
                          <option value="UPI">UPI</option>
                        </select>
                      </td>
                      <td>
                        <input
                          value={payment.notes || ""}
                          onChange={(event) => updatePayment(id, "notes", event.target.value)}
                          disabled={isSavingAll || savingId !== null}
                        />
                      </td>
                      <td>
                        <button
                          className="btn small"
                          type="button"
                          onClick={() => handleSave(id)}
                          disabled={isSavingAll || savingId !== null}
                        >
                          {savingId === id ? "Saving..." : "Save"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" className="muted">No payment records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
