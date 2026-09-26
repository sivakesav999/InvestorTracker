import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import { getInvestor, savePayment, saveAllPayments } from "../services/api.js";

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) return "-";

  const [year, month, day] = String(value).split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}-${month}-${year}`;
}

function preventNumberWheel(event) {
  if (document.activeElement === event.currentTarget) {
    event.preventDefault();
  }
}

export default function PaymentModal({
  open,
  investorId,
  onClose,
  onChanged,
  showToast,
}) {
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
        if (active) {
          showToast(error.message, "error");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
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
        String(payment._id) === String(id)
          ? {
              ...payment,
              [field]: value,
            }
          : payment,
      ),
    );
  }

  function getPaymentType(payment) {
    if (payment.isComplimentary) {
      return "complimentary";
    }

    if ((Number(payment.amountDue) || 0) === 0) {
      return "no-payment";
    }

    return "normal";
  }

  function isNoPayment(payment) {
    return getPaymentType(payment) === "no-payment";
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

    if (isNoPayment(payment)) {
      showToast(
        "This is a no-payment month. No payment can be recorded.",
        "error",
      );
      return;
    }

    const amountDue = Number(payment.amountDue) || 0;
    const amountPaid = Number(payment.amountPaid) || 0;

    if (amountPaid < 0) {
      showToast("Paid amount cannot be negative.", "error");
      return;
    }

    if (amountPaid > amountDue) {
      showToast("Paid amount cannot be greater than the amount due.", "error");
      return;
    }

    if (!["", "Cash", "UPI"].includes(payment.method || "")) {
      showToast("Payment method must be Cash or UPI.", "error");
      return;
    }

    try {
      setSavingId(id);

      await savePayment(id, {
        amount_paid: amountPaid,
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
      (payment) =>
        !isNoPayment(payment) &&
        !["", "Cash", "UPI"].includes(payment.method || ""),
    );

    if (invalidMethod) {
      showToast("Payment method must be Cash or UPI.", "error");
      return;
    }

    const invalidAmount = payments.find((payment) => {
      if (isNoPayment(payment)) {
        return false;
      }

      const amountDue = Number(payment.amountDue) || 0;
      const amountPaid = Number(payment.amountPaid) || 0;

      return amountPaid < 0 || amountPaid > amountDue;
    });

    if (invalidAmount) {
      showToast(
        `Invalid paid amount for Month ${invalidAmount.monthNo}.`,
        "error",
      );
      return;
    }

    try {
      setIsSavingAll(true);

      await saveAllPayments(
        payments.map((payment) => ({
          id: payment._id,

          amount_paid: isNoPayment(payment)
            ? 0
            : Number(payment.amountPaid) || 0,

          payment_date: isNoPayment(payment) ? "" : payment.paymentDate || "",

          method: isNoPayment(payment) ? "" : payment.method || "",

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

  return (
    <Modal open={open} onClose={onClose} className="wide">
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
            disabled={isLoading || isSavingAll}
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
            &nbsp; Investment: {money(investor.amount)}
            &nbsp; Monthly: {money(investor.monthlyPayout)}
            &nbsp; Remaining:{" "}
            {investor.remainingMonths ?? investor.monthsRemaining ?? 0}
          </p>

          <br />
        </div>
      )}

      <div className="table-wrap">
        <table
          className="payment-table"
          style={{
            tableLayout: "fixed",
            width: "100%",
          }}
        >
          <colgroup>
            <col style={{ width: "5%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "19%" }} />
            <col style={{ width: "8%" }} />
          </colgroup>

          <thead>
            <tr>
              <th>Month</th>
              <th>Due Date</th>
              <th>Type</th>
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
                <td colSpan="9" className="muted">
                  Loading payments...
                </td>
              </tr>
            ) : payments.length ? (
              payments.map((payment) => {
                const id = String(payment._id);

                const isSaving = String(savingId) === id;

                const paymentType = getPaymentType(payment);

                const noPayment = paymentType === "no-payment";

                return (
                  <tr
                    key={id}
                    className={
                      paymentType === "complimentary"
                        ? "complimentary-payment-row"
                        : noPayment
                          ? "no-payment-row"
                          : ""
                    }
                  >
                    <td>{payment.monthNo}</td>

                    <td>{formatDate(payment.dueDate)}</td>

                    <td>
                      {paymentType === "complimentary" ? (
                        <span className="status payment-type-badge complimentary">
                          Complimentary
                        </span>
                      ) : noPayment ? (
                        <span className="status payment-type-badge no-payment">
                          No Payment
                        </span>
                      ) : (
                        <span className="status payment-type-badge normal">
                          Normal
                        </span>
                      )}
                    </td>

                    <td>{money(payment.amountDue)}</td>

                    <td>
                      <input
                        type="number"
                        min="0"
                        value={noPayment ? 0 : (payment.amountPaid ?? "")}
                        onChange={(event) =>
                          updatePayment(id, "amountPaid", event.target.value)
                        }
                        onWheel={preventNumberWheel}
                        disabled={noPayment}
                      />
                    </td>

                    <td>
                      <input
                        type="date"
                        value={noPayment ? "" : payment.paymentDate || ""}
                        onChange={(event) =>
                          updatePayment(id, "paymentDate", event.target.value)
                        }
                        disabled={noPayment}
                      />
                    </td>

                    <td>
                      <select
                        value={noPayment ? "" : payment.method || ""}
                        onChange={(event) =>
                          updatePayment(id, "method", event.target.value)
                        }
                        disabled={noPayment}
                      >
                        <option value="">--</option>
                        <option value="Cash">Cash</option>
                        <option value="UPI">UPI</option>
                      </select>
                    </td>

                    <td>
                      <input
                        value={payment.notes || ""}
                        onChange={(event) =>
                          updatePayment(id, "notes", event.target.value)
                        }
                      />

                      {paymentType === "complimentary" && (
                        <small className="completed-message">
                          2% complimentary payment — no commission
                        </small>
                      )}

                      {noPayment && (
                        <small className="completed-message">
                          No payment on investments month, made after 25th
                        </small>
                      )}
                    </td>

                    <td>
                      <button
                        className="btn small"
                        type="button"
                        onClick={() => handleSave(id)}
                        disabled={isSaving || isSavingAll || noPayment}
                      >
                        {isSaving ? "Saving..." : "Save"}
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="9" className="muted">
                  No payment records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
